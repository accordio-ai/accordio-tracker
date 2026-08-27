import { useState, useEffect, useCallback } from 'react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  project?: {
    id: string;
    name: string;
  };
}

interface Timer {
  started_at: string;
  elapsed_seconds: number;
}

interface CurrentFocus {
  task?: Task;
  timer?: Timer;
}

interface ActiveTaskSettings {
  showInBrainBar: boolean;
  showProject: boolean;
}

export function useActiveTask() {
  const [focus, setFocus] = useState<CurrentFocus | null>(null);
  const [settings, setSettings] = useState<ActiveTaskSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate elapsed time for timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [focusResult, settingsData] = await Promise.all([
          window.electron.task.getFocus(),
          window.electron.task.getSettings(),
        ]);

        if (focusResult.success && focusResult.data) {
          setFocus(focusResult.data as CurrentFocus);
        }
        setSettings(settingsData);
        setIsLoading(false);
      } catch (err) {
        setError((err as Error).message);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Update elapsed time every second when timer is active
  useEffect(() => {
    if (!focus?.timer) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = new Date(focus.timer.started_at).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startedAt) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [focus?.timer]);

  const refresh = useCallback(async () => {
    try {
      const result = await window.electron.task.getFocus();
      if (result.success && result.data) {
        setFocus(result.data as CurrentFocus);
      } else {
        setFocus(null);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const setFocusTask = useCallback(async (taskId: string) => {
    try {
      const result = await window.electron.task.setFocus(taskId);
      if (result.success) {
        await refresh();
      }
      return result;
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [refresh]);

  const clearFocus = useCallback(async () => {
    try {
      const result = await window.electron.task.clearFocus();
      if (result.success) {
        setFocus(null);
      }
      return result;
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<ActiveTaskSettings>) => {
    try {
      await window.electron.task.updateSettings(newSettings);
      const updated = await window.electron.task.getSettings();
      setSettings(updated);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  // Format elapsed time
  const formattedElapsed = formatElapsed(elapsedSeconds);

  return {
    // State
    task: focus?.task || null,
    timer: focus?.timer || null,
    settings,
    isLoading,
    error,
    elapsedSeconds,
    formattedElapsed,

    // Derived
    hasTask: !!focus?.task,
    hasTimer: !!focus?.timer,
    shouldShow: settings?.showInBrainBar && focus?.task,

    // Actions
    refresh,
    setFocusTask,
    clearFocus,
    updateSettings,
  };
}

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export { formatElapsed };
