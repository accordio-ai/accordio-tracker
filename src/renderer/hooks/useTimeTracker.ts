import { useState, useEffect, useCallback } from 'react';
import type { AbsenceRecord } from '../../shared/categories';

interface TimeTrackingSettings {
  enabled: boolean;
  idleTimeoutMinutes: number;
  syncIntervalMinutes: number;
  showInMenuBar: boolean;
  trackBrowserTabs: boolean;
  excludedApps: string[];
}

interface PermissionStatus {
  accessibility: boolean;
  screenRecording: boolean;
}

interface ActivityEntry {
  id: string;
  appName: string;
  windowTitle: string;
  url?: string;
  category: string;
  startTime: number;
  endTime: number;
  duration: number;
  projectId?: string;
  projectSuggestion?: string;
  bundleId?: string;
  appPath?: string;
}

export interface TimeEntry extends ActivityEntry {
  synced: boolean;
  syncedAt?: number;
  isBillable?: boolean;
  description?: string;
  /** 'meeting' rows are the detector's overlay track, not a focused window. */
  sessionKind?: 'app' | 'meeting';
  meetingSource?: string;
}

interface TimeSummary {
  today: number;
  week: number;
  byCategory: Record<string, number>;
  byProject: Record<string, number>;
  unassigned: number;
}

// SyncResult used for event callbacks
type SyncResult = {
  success: boolean;
  synced: number;
  failed: number;
  error?: string;
};

interface SyncStatus {
  lastSync: number;
  pendingCount: number;
  isSyncing: boolean;
}

interface ProjectSuggestion {
  suggestion: string;
  count: number;
  entries: string[];
}

export function useTimeTracker() {
  const [currentActivity, setCurrentActivity] = useState<ActivityEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [settings, setSettings] = useState<TimeTrackingSettings | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: 0,
    pendingCount: 0,
    isSyncing: false,
  });
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [isIdle, setIsIdle] = useState(false);
  // Absences the monitor witnessed both ends of, and the call in progress.
  // Both feed the scorer — without them a gap is unattributable and a live
  // meeting is invisible until it ends.
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [currentMeeting, setCurrentMeeting] = useState<{ startTime: number; appName: string } | null>(null);
  const [loggedEntries, setLoggedEntries] = useState<Array<{
    id: string;
    project_id: string | null;
    project_name: string | null;
    project_color: string | null;
    description: string | null;
    app_name: string | null;
    started_at: string;
    ended_at: string | null;
    duration_minutes: number;
    source: string;
    is_billable: boolean;
  }>>([]);

  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [hasEmptyTitles, setHasEmptyTitles] = useState(false);

  // Manual timer state
  const [isManualTimerRunning, setIsManualTimerRunning] = useState(false);
  const [manualTimerStart, setManualTimerStart] = useState<number | null>(null);
  const [manualTimerDescription, setManualTimerDescription] = useState('');
  const [manualTimerElapsed, setManualTimerElapsed] = useState(0);

  const refreshPermissions = useCallback(async () => {
    try {
      const status = await window.electron.permissions.getStatus(true);
      setPermissionStatus(status);
      if (status.accessibility && status.screenRecording) {
        setPermissionError(null);
      }
      return status;
    } catch (error) {
      console.error('[useTimeTracker] Failed to check permissions:', error);
      return null;
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [activityData, settingsData, statusData, suggestionsData, timerStatus] = await Promise.all([
          window.electron.time.getActivity(),
          window.electron.time.getSettings(),
          window.electron.time.getSyncStatus(),
          window.electron.time.getSuggestions(),
          window.electron.time.getManualTimerStatus(),
        ]);

        setCurrentActivity(activityData.current);
        setEntries(activityData.entries);
        setSummary(activityData.summary);
        setSettings(settingsData);
        setSyncStatus(statusData);
        setSuggestions(suggestionsData);

        // Restore manual timer state if running
        if (timerStatus.isRunning) {
          setIsManualTimerRunning(true);
          setManualTimerStart(timerStatus.startTime);
          setManualTimerDescription(timerStatus.description);
          setManualTimerElapsed(timerStatus.elapsed);
        }
      } catch (error) {
        console.error('[useTimeTracker] Failed to load data:', error);
      }
    };

    loadData();
  }, []);

  // Fetch server-side logged entries (Web → Desktop sync)
  const refreshLoggedEntries = useCallback(async () => {
    try {
      const result = await window.electron.time.getLoggedEntries();
      if (result.success) {
        setLoggedEntries(result.entries);
      }
    } catch {
      // Silently fail — logged entries are supplementary
    }
  }, []);

  // Fetch on mount and every 60s
  useEffect(() => {
    refreshLoggedEntries();
    const interval = setInterval(refreshLoggedEntries, 60_000);
    return () => clearInterval(interval);
  }, [refreshLoggedEntries]);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    if (!permissionStatus) return;
    if (permissionStatus.accessibility && permissionStatus.screenRecording) return;

    const interval = setInterval(() => {
      refreshPermissions();
    }, 2000);

    return () => clearInterval(interval);
  }, [permissionStatus?.accessibility, permissionStatus?.screenRecording, refreshPermissions]);

  // Manual timer elapsed time updater
  useEffect(() => {
    if (!isManualTimerRunning || !manualTimerStart) return;

    const interval = setInterval(() => {
      setManualTimerElapsed(Math.floor((Date.now() - manualTimerStart) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isManualTimerRunning, manualTimerStart]);

  // Listen for activity events
  useEffect(() => {
    window.electron.time.onActivityStarted((activity) => {
      setCurrentActivity(activity);
    });

    window.electron.time.onActivityEnded((activity) => {
      setCurrentActivity(null);
      setEntries((prev) => [
        ...prev,
        { ...activity, synced: false },
      ]);
    });

    window.electron.time.onActivityResumed((activityId) => {
      setEntries((prev) => prev.filter((e) => e.id !== activityId));
    });

    window.electron.time.onIdle(() => {
      setIsIdle(true);
      setCurrentActivity(null);
    });

    window.electron.time.onActive(() => {
      setIsIdle(false);
    });

    window.electron.time.onAbsence((record) => {
      setAbsences((prev) => [...prev, record]);
    });

    window.electron.time.onMeetingStarted((session) => {
      setCurrentMeeting({ startTime: session.startTime, appName: session.appName });
    });

    window.electron.time.onMeetingEnded(() => {
      // The finished meeting arrives as an overlay entry on the next refresh.
      setCurrentMeeting(null);
      void refreshActivity();
    });

    window.electron.time.onSyncStarted(() => {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
    });

    window.electron.time.onSyncCompleted((_result: SyncResult) => {
      setSyncStatus({
        lastSync: Date.now(),
        pendingCount: 0,
        isSyncing: false,
      });
      // Refresh entries but preserve local project assignments
      // that may not have synced yet
      window.electron.time.getActivity().then((data) => {
        setCurrentActivity(data.current);
        setEntries((prev) => {
          // Merge: keep local projectId if main process lost it
          const localProjects = new Map(
            prev.filter(e => e.projectId).map(e => [e.id, e.projectId])
          );
          return data.entries.map((e: TimeEntry) => ({
            ...e,
            projectId: e.projectId || localProjects.get(e.id) || undefined,
          }));
        });
        setSummary(data.summary);
      });
    });

    window.electron.time.onSyncFailed((_result: SyncResult) => {
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
    });

    // Manual timer events
    window.electron.time.onManualTimerStarted((data) => {
      setIsManualTimerRunning(true);
      setManualTimerStart(data.startTime);
      setManualTimerDescription(data.description);
      setManualTimerElapsed(0);
    });

    window.electron.time.onManualTimerStopped(() => {
      setIsManualTimerRunning(false);
      setManualTimerStart(null);
      setManualTimerDescription('');
      setManualTimerElapsed(0);
      refreshActivity();
    });

    // Empty browser titles = Screen Recording needs app restart
    window.electron.time.onEmptyTitles(() => {
      setHasEmptyTitles(true);
    });

    // Titles recovered — clear the banner so users don't have to restart
    // just because of a transient empty-title period (browser launching, etc).
    window.electron.time.onTitlesRecovered(() => {
      setHasEmptyTitles(false);
    });
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      const data = await window.electron.time.getActivity();
      setCurrentActivity(data.current);
      setEntries((prev) => {
        // Preserve local project assignments during refresh
        const localProjects = new Map(
          prev.filter(e => e.projectId).map(e => [e.id, e.projectId])
        );
        return data.entries.map((e: TimeEntry) => ({
          ...e,
          projectId: e.projectId || localProjects.get(e.id) || undefined,
        }));
      });
      setSummary(data.summary);
      setAbsences(data.absences || []);
      setCurrentMeeting(data.currentMeeting || null);
    } catch (error) {
      console.error('[useTimeTracker] Failed to refresh activity:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    try {
      const result = await window.electron.time.syncNow();
      if (result.success) {
        await refreshActivity();
      }
      return result;
    } catch (error) {
      return { success: false, synced: 0, failed: 0, error: (error as Error).message };
    }
  }, [refreshActivity]);

  const updateSettings = useCallback(async (newSettings: Partial<TimeTrackingSettings>) => {
    try {
      if (newSettings.enabled === true) {
        setIsCheckingPermissions(true);
        // Clear any previous permission errors - we'll try to enable anyway
        // since macOS permission detection can be stale
        setPermissionError(null);
      }

      if (newSettings.enabled === false) {
        setPermissionError(null);
      }

      const result = await window.electron.time.updateSettings(newSettings);
      if (!result.success) {
        if (result.permissions) {
          setPermissionStatus(result.permissions);
        }
        if (result.error) {
          setPermissionError(result.error);
        }
        return result;
      }

      const updated = await window.electron.time.getSettings();
      setSettings(updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    } finally {
      setIsCheckingPermissions(false);
    }
  }, [refreshPermissions]);

  const assignProject = useCallback(async (entryId: string, projectId: string) => {
    try {
      const result = await window.electron.time.assignProject(entryId, projectId);
      if (result.success) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, projectId, synced: false } : e
          )
        );
        // Refresh suggestions
        const newSuggestions = await window.electron.time.getSuggestions();
        setSuggestions(newSuggestions);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, []);

  const addManualEntry = useCallback(async (
    description: string,
    projectId: string,
    duration: number,
    category?: string
  ) => {
    try {
      const result = await window.electron.time.addManualEntry(description, projectId, duration, category);
      if (result.success && result.entry) {
        setEntries((prev) => [...prev, result.entry!]);
        await refreshActivity();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [refreshActivity]);

  const deleteEntry = useCallback(async (entryId: string) => {
    try {
      const result = await window.electron.time.deleteEntry(entryId);
      if (result.success) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
        await refreshActivity();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [refreshActivity]);

  // Toggle billable status for an entry
  const toggleBillable = useCallback(async (entryId: string, isBillable: boolean) => {
    // Update local state immediately for responsiveness
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, isBillable, synced: false } : e
      )
    );
    try {
      const result = await window.electron.time.updateEntry(entryId, { isBillable });
      if (!result.success) {
        // Revert on error
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, isBillable: !isBillable } : e
          )
        );
      }
      return result;
    } catch (error) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, isBillable: !isBillable } : e
        )
      );
      return { success: false, error: (error as Error).message };
    }
  }, []);

  // Update entry description
  const updateEntryDescription = useCallback(async (entryId: string, description: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, description, synced: false } : e
      )
    );
    try {
      return await window.electron.time.updateEntry(entryId, { description });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, []);

  /**
   * Correct an entry's duration. Optimistic, then reverts on failure — same
   * pattern as updateEntryDescription above.
   */
  const updateEntryDuration = useCallback(async (entryId: string, durationSeconds: number) => {
    let previous: TimeEntry | undefined;
    setEntries((prev) => {
      previous = prev.find((e) => e.id === entryId);
      return prev.map((e) =>
        e.id === entryId
          ? { ...e, duration: durationSeconds, endTime: e.startTime + durationSeconds * 1000, synced: false }
          : e
      );
    });
    try {
      const result = await window.electron.time.updateEntry(entryId, { duration: durationSeconds });
      if (!result.success && previous) {
        const restore = previous;
        setEntries((prev) => prev.map((e) => (e.id === entryId ? restore : e)));
      }
      return result;
    } catch (error) {
      if (previous) {
        const restore = previous;
        setEntries((prev) => prev.map((e) => (e.id === entryId ? restore : e)));
      }
      return { success: false, error: (error as Error).message };
    }
  }, []);

  const recategorizeEntry = useCallback(async (entryId: string, category: string) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, category, synced: false } : e)));
    try {
      return await window.electron.time.recategorizeEntry(entryId, category);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, []);

  const mergeEntries = useCallback(async (entryIds: string[]) => {
    try {
      const result = await window.electron.time.mergeEntries(entryIds);
      await refreshActivity();
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [refreshActivity]);

  // Manual timer controls
  const startTimer = useCallback(async (description: string = 'Manual time entry', projectId?: string) => {
    try {
      const result = await window.electron.time.startManualTimer(description, projectId);
      if (result.success && result.startTime) {
        setIsManualTimerRunning(true);
        setManualTimerStart(result.startTime);
        setManualTimerDescription(description);
        setManualTimerElapsed(0);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, []);

  const stopTimer = useCallback(async () => {
    try {
      const result = await window.electron.time.stopManualTimer();
      if (result.success) {
        setIsManualTimerRunning(false);
        setManualTimerStart(null);
        setManualTimerDescription('');
        setManualTimerElapsed(0);
        await refreshActivity();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [refreshActivity]);

  // Calculate formatted times
  const formattedToday = formatDuration(summary?.today || 0);
  const formattedWeek = formatDuration(summary?.week || 0);
  const formattedManualTimer = formatDuration(manualTimerElapsed);

  // Non-work categories to hide from unassigned and work views
  const NON_WORK_CATEGORIES = new Set(['entertainment', 'social', 'personal', 'utilities']);

  // Get unassigned entries (excluding non-work, system apps, and invalid entries)
  const unassignedEntries = entries.filter((e) =>
    !e.projectId &&
    !NON_WORK_CATEGORIES.has(e.category) &&
    !['Electron', 'Accordio AGI', 'Accordio AI'].includes(e.appName) &&
    e.appName && // Must have app name
    e.appName.trim() !== '' && // Must not be empty
    e.duration >= 5 // At least 5 seconds
  );

  // Filter out non-work and system apps from entries for display
  const workEntries = entries.filter((e) =>
    !NON_WORK_CATEGORIES.has(e.category) &&
    !['Electron', 'Accordio AGI', 'Accordio AI'].includes(e.appName)
  );

  // All entries excluding only system apps — used for score calculations (includes breaks/entertainment)
  const allUserEntries = entries.filter((e) =>
    !['Electron', 'Accordio AGI', 'Accordio AI'].includes(e.appName)
  );

  return {
    // State
    currentActivity,
    entries: workEntries,
    allEntries: allUserEntries,
    summary,
    settings,
    syncStatus,
    suggestions,
    isIdle,
    absences,
    currentMeeting,
    permissionStatus,
    permissionError,
    isCheckingPermissions,
    hasEmptyTitles,
    unassignedEntries,
    formattedToday,
    formattedWeek,

    // Manual timer state
    isManualTimerRunning,
    manualTimerStart,
    manualTimerDescription,
    manualTimerElapsed,
    formattedManualTimer,

    // Actions
    refreshActivity,
    syncNow,
    updateSettings,
    assignProject,
    addManualEntry,
    deleteEntry,
    toggleBillable,
    updateEntryDescription,
    updateEntryDuration,
    recategorizeEntry,
    mergeEntries,
    startTimer,
    stopTimer,
    refreshPermissions,

    // Server-side logged entries (Web → Desktop sync)
    loggedEntries,
    refreshLoggedEntries,
  };
}

function formatDuration(seconds: number): string {
  // Round to avoid floating point precision issues
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export { formatDuration };
