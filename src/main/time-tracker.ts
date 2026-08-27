/**
 * Time Tracker
 *
 * Manages time tracking data, syncs with web app, and provides AI project suggestions.
 * Implements a local buffer for offline support with periodic sync to the Accordio API.
 */

import { EventEmitter } from 'events';
import { store, DEFAULT_API_URL } from './store';
import logger from './logger';
import { ActivityEntry, ActivityDetail, TitleHistoryEntry, getActivityMonitor, ActivityMonitor } from './activity-monitor';

// Lazy-loaded file-icon module for fetching app icons
let fileIconModule: typeof import('file-icon') | null = null;

async function getFileIconModule() {
  if (!fileIconModule) {
    try {
      fileIconModule = await import('file-icon');
    } catch (error) {
      logger.log('[TimeTracker] Failed to load file-icon module:', error);
    }
  }
  return fileIconModule;
}

// Cache for app icons to avoid refetching
const appIconCache = new Map<string, string>();

/**
 * Get app icon as base64 data URL
 */
async function getAppIconBase64(appName: string, appPath?: string): Promise<string | null> {
  const cacheKey = appPath || appName;

  // Check cache first
  if (appIconCache.has(cacheKey)) {
    return appIconCache.get(cacheKey) || null;
  }

  const fileIcon = await getFileIconModule();
  if (!fileIcon) return null;

  try {
    // Try by app name first
    const result = await fileIcon.fileIconToBuffer(appName, { size: 64 });
    if (result && result.length > 0) {
      const base64 = Buffer.from(result).toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;
      appIconCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
  } catch {
    // Try by path if name fails
    if (appPath) {
      try {
        const result = await fileIcon.fileIconToBuffer(appPath, { size: 64 });
        if (result && result.length > 0) {
          const base64 = Buffer.from(result).toString('base64');
          const dataUrl = `data:image/png;base64,${base64}`;
          appIconCache.set(cacheKey, dataUrl);
          return dataUrl;
        }
      } catch {
        // Ignore
      }
    }
  }

  return null;
}

export interface TimeEntry {
  id: string;
  serverId?: string; // Server-side UUID for reliable dedup
  appName: string;
  windowTitle: string;
  url?: string;
  category: string;
  startTime: number;
  endTime: number;
  duration: number;
  projectId?: string;
  projectSuggestion?: string;
  synced: boolean;
  syncedAt?: number;
  // Server permanently rejected this entry (4xx) — never re-queue it
  syncFailed?: boolean;
  bundleId?: string;
  appPath?: string;
  detail?: ActivityDetail;
  titleHistory?: TitleHistoryEntry[];
  description?: string; // User-edited description — overrides the server-built one on sync
  isBillable?: boolean;
  /**
   * The user corrected this entry by hand. Tells the server to bypass its
   * monotonic-upward update gate (which otherwise drops any edit that shortens
   * an entry) and to stop later automatic captures overwriting the correction.
   */
  userEdited?: boolean;
  /** Tombstone — the entry was deleted locally and the server row must go too. */
  deleted?: boolean;
  /**
   * 'app' (default) = a frontmost-window session. 'meeting' = an overlay track
   * emitted by the meeting detector, which runs independently of what's
   * focused. Overlap between the two is resolved at scoring time, never at
   * capture time.
   */
  sessionKind?: 'app' | 'meeting';
  /** Which signal detected the meeting (browser-tab / zoom-window / …). */
  meetingSource?: string;
}

export interface TimeSummary {
  today: number;
  week: number;
  byCategory: Record<string, number>;
  byProject: Record<string, number>;
  unassigned: number;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  error?: string;
}

export interface TimeTrackerOptions {
  syncInterval?: number; // minutes (default: 5)
  maxBufferSize?: number; // max entries before force sync
  apiUrl?: string;
  token?: string;
}

export class TimeTracker extends EventEmitter {
  private syncInterval: number; // in minutes
  private maxBufferSize: number;
  private apiUrl: string;
  private token: string;

  private syncTimer: NodeJS.Timeout | null = null;
  private realtimeCurrentSyncTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isSyncing = false;

  private entries: TimeEntry[] = [];
  private syncQueue: TimeEntry[] = [];
  private lastSyncTime: number = 0;

  private activityMonitor: ActivityMonitor | null = null;
  private readonly realtimeCurrentSyncIntervalMs = 30_000;
  private readonly onActivityStarted = (_activity: ActivityEntry) => {
    this.startRealtimeCurrentSync();
  };
  private readonly onActivityEnded = (activity: ActivityEntry) => {
    this.stopRealtimeCurrentSync();
    this.addEntry(activity);
  };
  private readonly onActivityResumed = (activityId: string) => {
    // Remove the previously synced entry — it will be re-added with the full
    // duration when the resumed activity is finalized again.
    this.deleteEntry(activityId);
  };

  /** User category corrections, keyed by "appName::windowTitlePrefix". */
  private categoryOverrides = new Map<string, string>();

  constructor(options: TimeTrackerOptions = {}) {
    super();
    this.syncInterval = options.syncInterval || 5;
    this.maxBufferSize = options.maxBufferSize || 100;
    this.apiUrl = options.apiUrl || DEFAULT_API_URL;
    this.token = options.token || '';

    // Load persisted entries from store
    this.loadEntries();
    this.categoryOverrides = new Map(
      Object.entries((store.get('categoryOverrides') as Record<string, string>) || {})
    );
  }

  /**
   * Start time tracking
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Connect to activity monitor
    this.activityMonitor = getActivityMonitor();
    if (this.activityMonitor) {
      this.activityMonitor.on('activityStarted', this.onActivityStarted);
      this.activityMonitor.on('activityEnded', this.onActivityEnded);
      this.activityMonitor.on('activityResumed', this.onActivityResumed);
    }

    // Start sync timer
    this.startSyncTimer();

    this.emit('started');
    logger.log('[TimeTracker] Started');
  }

  /**
   * Stop time tracking
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.stopRealtimeCurrentSync();

    // Stop sync timer
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.activityMonitor) {
      this.activityMonitor.off('activityStarted', this.onActivityStarted);
      this.activityMonitor.off('activityEnded', this.onActivityEnded);
      this.activityMonitor.off('activityResumed', this.onActivityResumed);
    }

    // Final sync attempt
    this.sync();

    // Save entries
    this.saveEntries();

    this.emit('stopped');
    logger.log('[TimeTracker] Stopped');
  }

  /**
   * Update settings
   */
  updateSettings(options: Partial<TimeTrackerOptions>): void {
    if (options.syncInterval !== undefined) {
      this.syncInterval = options.syncInterval;
      // Restart sync timer with new interval
      this.startSyncTimer();
    }
    if (options.apiUrl !== undefined) {
      this.apiUrl = options.apiUrl;
    }
    if (options.token !== undefined) {
      this.token = options.token;
    }
  }

  /**
   * Add a new entry from activity monitor
   */
  private addEntry(activity: ActivityEntry): void {
    const entry: TimeEntry = {
      ...activity,
      synced: false,
    };

    this.entries.push(entry);
    this.syncQueue.push(entry);
    this.emit('entryAdded', entry);

    if (this.syncQueue.length >= this.maxBufferSize) {
      logger.log('[TimeTracker] Sync queue reached max buffer size, forcing immediate sync');
    }

    // Trigger an immediate sync for near real-time context in AGI/chat surfaces.
    // The periodic timer still acts as a fallback retry mechanism.
    this.sync();

    // Save periodically
    this.saveEntries();
  }

  /**
   * Record a detected meeting as an overlay entry.
   *
   * Deliberately NOT a replacement for the app entries recorded during the
   * call: screen-sharing Figma or taking Notion notes mid-meeting is real work
   * with real project attribution, and suppressing it would throw away the only
   * signal that says which project the meeting was for. The scorer resolves the
   * overlap (`computeScores` subtracts meeting time from every other bucket),
   * so storing both never double-counts.
   */
  addMeetingEntry(meeting: { id: string; appName: string; startTime: number; endTime: number; source: string }): TimeEntry | null {
    let durationSeconds = Math.floor((meeting.endTime - meeting.startTime) / 1000);
    // Same floor the activity monitor applies — a "meeting" under 30s is noise.
    if (durationSeconds < 30) return null;
    // Same 12h absolute cap as MAX_ACTIVITY_DURATION_S. A meeting-room tab
    // left open (Meet lobby, post-call page) keeps the detector's signal
    // positive indefinitely — without a cap, a weekend-old tab becomes a
    // multi-day meeting entry synced to the server.
    const MAX_MEETING_DURATION_S = 12 * 60 * 60;
    let endTime = meeting.endTime;
    if (durationSeconds > MAX_MEETING_DURATION_S) {
      logger.warn(`[TimeTracker] Meeting duration ${durationSeconds}s exceeds max, capping to ${MAX_MEETING_DURATION_S}s`);
      durationSeconds = MAX_MEETING_DURATION_S;
      endTime = meeting.startTime + MAX_MEETING_DURATION_S * 1000;
    }

    const entry: TimeEntry = {
      id: meeting.id,
      appName: meeting.appName,
      windowTitle: 'Meeting',
      category: 'meetings',
      startTime: meeting.startTime,
      endTime,
      duration: durationSeconds,
      sessionKind: 'meeting',
      meetingSource: meeting.source,
      synced: false,
    };

    this.entries.push(entry);
    this.syncQueue.push(entry);
    this.emit('entryAdded', entry);
    this.sync();
    this.saveEntries();
    return entry;
  }

  private startRealtimeCurrentSync(): void {
    this.stopRealtimeCurrentSync();
    void this.syncCurrentActivitySnapshot();
    this.realtimeCurrentSyncTimer = setInterval(() => {
      void this.syncCurrentActivitySnapshot();
    }, this.realtimeCurrentSyncIntervalMs);
  }

  private stopRealtimeCurrentSync(): void {
    if (this.realtimeCurrentSyncTimer) {
      clearInterval(this.realtimeCurrentSyncTimer);
      this.realtimeCurrentSyncTimer = null;
    }
  }

  private async syncCurrentActivitySnapshot(): Promise<void> {
    if (!this.isRunning || !this.token || !this.activityMonitor) return;

    const current = this.activityMonitor.getCurrentActivity();
    if (!current) return;

    // Avoid spam before the activity has at least one full minute.
    // Server-side sync already ignores entries under 1 minute.
    if (current.duration < 60) return;

    // Reject absurdly long durations (sleep/suspend edge case).
    // The activity monitor caps at 12h but this is a belt-and-suspenders check.
    if (current.duration > 12 * 60 * 60) {
      logger.warn(`[TimeTracker] Refusing to sync snapshot with duration ${current.duration}s (>12h)`);
      return;
    }

    try {
      const appIcon = await getAppIconBase64(current.appName, current.appPath);
      const response = await fetch(`${this.apiUrl}/api/agi/activity`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entries: [
            {
              app_name: current.appName,
              window_title: current.windowTitle,
              url: current.url,
              category: current.category,
              start_time: new Date(current.startTime).toISOString(),
              end_time: new Date(current.endTime).toISOString(),
              duration_seconds: current.duration,
              project_id: current.projectId || undefined,
              client_id: current.id,
              server_id: (current as any).serverId || undefined,
              app_icon: appIcon,
              bundle_id: current.bundleId,
              app_path: current.appPath,
              detail: current.detail || undefined,
              title_history: current.titleHistory?.map(t => ({
                title: t.title,
                detail: t.detail,
                first_seen: new Date(t.firstSeen).toISOString(),
                last_seen: new Date(t.lastSeen).toISOString(),
                duration_seconds: t.durationSeconds,
              })) || undefined,
            },
          ],
        }),
      });

      if (response.ok) {
        this.lastSyncTime = Date.now();
        this.saveEntries();
      } else {
        logger.warn('[TimeTracker] Current activity snapshot sync failed:', response.status);
      }
    } catch (error) {
      logger.error('[TimeTracker] Current activity snapshot sync error:', error);
    }
  }

  /**
   * Add a manual time entry
   */
  addManualEntry(
    description: string,
    projectId: string | undefined,
    duration: number, // in seconds
    category: string = 'manual'
  ): TimeEntry {
    const now = Date.now();
    const entry: TimeEntry = {
      id: `${now}-${Math.random().toString(36).substr(2, 9)}`,
      appName: 'Manual Entry',
      windowTitle: description,
      category,
      startTime: now - duration * 1000,
      endTime: now,
      duration,
      projectId: projectId || undefined, // Ensure empty strings become undefined
      synced: false,
    };

    this.entries.push(entry);
    this.syncQueue.push(entry);
    this.emit('entryAdded', entry);
    this.saveEntries();

    return entry;
  }

  /**
   * Get all entries
   */
  getEntries(): TimeEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries for a specific time range
   */
  getEntriesInRange(startTime: number, endTime: number): TimeEntry[] {
    return this.entries.filter(
      (e) => e.startTime >= startTime && e.endTime <= endTime
    );
  }

  /**
   * Get today's entries
   */
  getTodayEntries(): TimeEntry[] {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.getEntriesInRange(startOfDay.getTime(), Date.now());
  }

  /**
   * Get this week's entries
   */
  getWeekEntries(): TimeEntry[] {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return this.getEntriesInRange(startOfWeek.getTime(), Date.now());
  }

  /**
   * Get time summary
   */
  getSummary(): TimeSummary {
    const todayEntries = this.getTodayEntries();
    const weekEntries = this.getWeekEntries();

    const byCategory: Record<string, number> = {};
    const byProject: Record<string, number> = {};
    let unassigned = 0;

    for (const entry of todayEntries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.duration;
      if (entry.projectId) {
        byProject[entry.projectId] = (byProject[entry.projectId] || 0) + entry.duration;
      } else {
        unassigned += entry.duration;
      }
    }

    return {
      today: todayEntries.reduce((sum, e) => sum + e.duration, 0),
      week: weekEntries.reduce((sum, e) => sum + e.duration, 0),
      byCategory,
      byProject,
      unassigned,
    };
  }

  /**
   * Assign a project to an entry
   */
  assignProject(entryId: string, projectId: string | undefined): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    if (entry) {
      entry.projectId = projectId || undefined;
      entry.synced = false; // Mark for re-sync
      if (!this.syncQueue.find((e) => e.id === entryId)) {
        this.syncQueue.push(entry);
      }
      this.saveEntries();
      this.emit('entryUpdated', entry);
      return true;
    }
    return false;
  }

  /**
   * Update a user-editable field on an entry and queue it for re-sync.
   *
   * Duration/time edits set `userEdited`, which the server uses to bypass its
   * monotonic-upward update gate. Without that flag, shortening an entry —
   * exactly what you do when a 40-minute meeting logged as 9 — is silently
   * discarded on sync.
   */
  updateEntry(
    entryId: string,
    updates: {
      description?: string;
      isBillable?: boolean;
      startTime?: number;
      endTime?: number;
      duration?: number;
      category?: string;
      projectId?: string;
    }
  ): TimeEntry | null {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) return null;

    if (updates.description !== undefined) entry.description = updates.description;
    if (updates.isBillable !== undefined) entry.isBillable = updates.isBillable;
    if (updates.projectId !== undefined) entry.projectId = updates.projectId;

    let timingChanged = false;
    if (updates.startTime !== undefined) {
      entry.startTime = updates.startTime;
      timingChanged = true;
    }
    if (updates.endTime !== undefined) {
      entry.endTime = updates.endTime;
      timingChanged = true;
    }
    if (updates.duration !== undefined) {
      entry.duration = Math.max(0, Math.round(updates.duration));
      // Keep endTime consistent — the scorer reads both.
      entry.endTime = entry.startTime + entry.duration * 1000;
      timingChanged = true;
    } else if (timingChanged) {
      entry.duration = Math.max(0, Math.round((entry.endTime - entry.startTime) / 1000));
    }

    if (updates.category !== undefined) {
      entry.category = updates.category;
      entry.userEdited = true;
    }
    if (timingChanged) entry.userEdited = true;

    this.queueForResync(entry);
    this.emit('entryUpdated', entry);
    return entry;
  }

  /** Mark an entry dirty and make sure it's in the sync queue exactly once. */
  private queueForResync(entry: TimeEntry): void {
    entry.synced = false;
    if (!this.syncQueue.find((e) => e.id === entry.id)) {
      this.syncQueue.push(entry);
    }
    this.saveEntries();
  }

  /**
   * Merge several entries into one.
   *
   * The survivor spans from the earliest start to the latest end, but its
   * duration is the SUM of the inputs, not the span — the time between them
   * was not worked. The gap is recorded so the UI can explain the difference.
   */
  mergeEntries(entryIds: string[]): TimeEntry | null {
    const targets = this.entries.filter((e) => entryIds.includes(e.id));
    if (targets.length < 2) return null;

    const sorted = [...targets].sort((a, b) => a.startTime - b.startTime);
    // Keep the longest entry as the survivor so its id, project and metadata
    // are the ones most likely to already be correct.
    const survivor = [...targets].sort((a, b) => b.duration - a.duration)[0];
    const summedDuration = targets.reduce((sum, e) => sum + e.duration, 0);

    survivor.startTime = sorted[0].startTime;
    survivor.endTime = sorted[sorted.length - 1].endTime;
    survivor.duration = summedDuration;
    survivor.titleHistory = targets.flatMap((e) => e.titleHistory ?? []);
    survivor.userEdited = true;

    for (const entry of targets) {
      if (entry.id !== survivor.id) this.deleteEntry(entry.id);
    }

    this.queueForResync(survivor);
    this.emit('entryUpdated', survivor);
    return survivor;
  }

  /**
   * Split an entry in two at a timestamp. The survivor keeps the original id
   * (and therefore its server row); the second half is a new entry inheriting
   * project, category and app.
   */
  splitEntry(entryId: string, atTimestamp: number): [TimeEntry, TimeEntry] | null {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) return null;
    if (atTimestamp <= entry.startTime || atTimestamp >= entry.endTime) return null;

    const second: TimeEntry = {
      ...entry,
      id: `${entry.id}-split-${atTimestamp}`,
      serverId: undefined,
      startTime: atTimestamp,
      endTime: entry.endTime,
      duration: Math.round((entry.endTime - atTimestamp) / 1000),
      titleHistory: entry.titleHistory?.filter((t) => t.firstSeen >= atTimestamp),
      userEdited: true,
      synced: false,
    };

    entry.endTime = atTimestamp;
    entry.duration = Math.round((atTimestamp - entry.startTime) / 1000);
    entry.titleHistory = entry.titleHistory?.filter((t) => t.firstSeen < atTimestamp);
    entry.userEdited = true;

    this.entries.push(second);
    this.queueForResync(entry);
    this.queueForResync(second);
    this.emit('entryUpdated', entry);
    this.emit('entryAdded', second);
    return [entry, second];
  }

  /**
   * Re-categorise an entry. Also records the correction locally so the same
   * app+title pattern classifies correctly next time — without that, fixing a
   * miscategorised meeting is busywork you repeat every day.
   */
  recategorizeEntry(entryId: string, category: string): TimeEntry | null {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) return null;

    entry.category = category;
    entry.userEdited = true;
    this.rememberCategoryOverride(entry.appName, entry.windowTitle, category);
    this.queueForResync(entry);
    this.emit('entryUpdated', entry);
    return entry;
  }

  /**
   * Get unassigned entries
   */
  getUnassignedEntries(): TimeEntry[] {
    return this.entries.filter((e) => !e.projectId);
  }

  /**
   * Get project suggestions based on activity patterns
   */
  getProjectSuggestions(): Array<{ suggestion: string; count: number; entries: string[] }> {
    const suggestions = new Map<string, { count: number; entries: string[] }>();

    for (const entry of this.entries) {
      if (entry.projectSuggestion && !entry.projectId) {
        const existing = suggestions.get(entry.projectSuggestion);
        if (existing) {
          existing.count++;
          existing.entries.push(entry.id);
        } else {
          suggestions.set(entry.projectSuggestion, { count: 1, entries: [entry.id] });
        }
      }
    }

    return Array.from(suggestions.entries())
      .map(([suggestion, data]) => ({ suggestion, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Force sync now
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return { success: true, synced: 0, failed: 0 };
    }

    if (!this.token) {
      return { success: false, synced: 0, failed: 0, error: 'Not authenticated' };
    }

    this.isSyncing = true;
    this.emit('syncStarted');

    const toSync = [...this.syncQueue];
    let synced = 0;
    let failed = 0;

    try {
      // Batch entries for sync
      const batchSize = 50;
      for (let i = 0; i < toSync.length; i += batchSize) {
        const batch = toSync.slice(i, i + batchSize);

        // Fetch app icons for all entries in batch (in parallel)
        const entriesWithIcons = await Promise.all(
          batch.map(async (e) => {
            const appIcon = await getAppIconBase64(e.appName, e.appPath);
            return {
              app_name: e.appName,
              window_title: e.windowTitle,
              url: e.url,
              category: e.category,
              start_time: new Date(e.startTime).toISOString(),
              end_time: new Date(e.endTime).toISOString(),
              duration_seconds: e.duration,
              project_id: e.projectId || undefined,
              client_id: e.id,
              server_id: e.serverId || undefined, // For reliable dedup after source promotion
              description: e.description || undefined,
              is_billable: e.isBillable,
              app_icon: appIcon,
              bundle_id: e.bundleId,
              app_path: e.appPath,
              // Marks the meeting overlay track so the server (and the web
              // /time page) can resolve overlap the same way the desktop does.
              session_kind: e.sessionKind || undefined,
              meeting_source: e.meetingSource || undefined,
              user_edited: e.userEdited || undefined,
              deleted: e.deleted || undefined,
              detail: e.detail || undefined,
              title_history: e.titleHistory?.map(t => ({
                title: t.title,
                detail: t.detail,
                first_seen: new Date(t.firstSeen).toISOString(),
                last_seen: new Date(t.lastSeen).toISOString(),
                duration_seconds: t.durationSeconds,
              })) || undefined,
            };
          })
        );

        // Use the AGI activity endpoint (user JWT auth, not bot/service key auth)
        const response = await fetch(`${this.apiUrl}/api/agi/activity`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entries: entriesWithIcons,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          // Mark entries as synced
          for (const entry of batch) {
            const original = this.entries.find((e) => e.id === entry.id);
            if (original) {
              original.synced = true;
              original.syncedAt = Date.now();
            }
            // Remove from sync queue
            const queueIdx = this.syncQueue.findIndex((e) => e.id === entry.id);
            if (queueIdx !== -1) {
              this.syncQueue.splice(queueIdx, 1);
            }
          }
          synced += batch.length;

          // Store server IDs for reliable dedup on future syncs
          if (result.entries) {
            for (const serverEntry of result.entries) {
              const local = this.entries.find((e) => e.id === serverEntry.client_id);
              if (local && serverEntry.id) {
                local.serverId = serverEntry.id;
              }
            }
          }
        } else {
          failed += batch.length;
          logger.error('[TimeTracker] Sync batch failed:', response.status);
          if (response.status >= 400 && response.status < 500) {
            // Permanent rejection — retrying the identical payload can never
            // succeed, so drop the batch from the queue instead of letting it
            // block sync forever. The entries stay locally with syncFailed set.
            for (const entry of batch) {
              const original = this.entries.find((e) => e.id === entry.id);
              if (original) original.syncFailed = true;
              const queueIdx = this.syncQueue.findIndex((e) => e.id === entry.id);
              if (queueIdx !== -1) this.syncQueue.splice(queueIdx, 1);
            }
          }
        }
      }

      this.lastSyncTime = Date.now();
      this.saveEntries();

      const result: SyncResult = { success: failed === 0, synced, failed };
      this.emit('syncCompleted', result);
      return result;
    } catch (error) {
      const result: SyncResult = {
        success: false,
        synced,
        failed: toSync.length - synced,
        error: (error as Error).message,
      };
      this.emit('syncFailed', result);
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    lastSync: number;
    pendingCount: number;
    isSyncing: boolean;
  } {
    return {
      lastSync: this.lastSyncTime,
      pendingCount: this.syncQueue.length,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Delete an entry
   */
  /**
   * Delete an entry.
   *
   * An entry that never reached the server can just be dropped. One that HAS
   * been synced is tombstoned instead and queued, so the server row goes with
   * it — previously this spliced locally and left the row orphaned, which made
   * the delete button a lie and would have made merge double-count.
   */
  deleteEntry(entryId: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return false;

    const entry = this.entries[idx];
    const reachedServer = entry.synced || !!entry.serverId;

    this.entries.splice(idx, 1);
    const queueIdx = this.syncQueue.findIndex((e) => e.id === entryId);
    if (queueIdx !== -1) this.syncQueue.splice(queueIdx, 1);

    if (reachedServer) {
      // Keep it out of `entries` (so the UI drops it immediately) but push a
      // tombstone through the normal sync path. It's removed from the queue on
      // a successful sync like any other entry.
      this.syncQueue.push({ ...entry, deleted: true, synced: false });
    }

    this.saveEntries();
    this.emit('entryDeleted', entryId);
    return true;
  }

  /**
   * Remember that the user re-categorised this kind of activity, so the
   * classifier agrees next time instead of making the user fix it daily.
   */
  private rememberCategoryOverride(appName: string, windowTitle: string, category: string): void {
    const key = `${appName}::${(windowTitle || '').slice(0, 60)}`;
    this.categoryOverrides.set(key, category);
    store.set('categoryOverrides', Object.fromEntries(this.categoryOverrides));
  }

  /** Category override for an app+title pair, if the user has set one. */
  getCategoryOverride(appName: string, windowTitle: string): string | undefined {
    return (
      this.categoryOverrides.get(`${appName}::${(windowTitle || '').slice(0, 60)}`) ??
      this.categoryOverrides.get(`${appName}::`)
    );
  }

  /**
   * Clear all entries
   */
  clearEntries(): void {
    this.entries = [];
    this.syncQueue = [];
    this.saveEntries();
    this.emit('entriesCleared');
  }

  // Private methods

  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.syncTimer = setInterval(
      () => this.sync(),
      this.syncInterval * 60 * 1000
    );
  }

  private loadEntries(): void {
    try {
      const saved = store.get('timeEntries') as TimeEntry[] | undefined;
      if (saved && Array.isArray(saved)) {
        this.entries = saved;
        // Rebuild sync queue from unsynced entries — but only recent ones.
        // Stale unsynced entries (or ones the server permanently rejected)
        // used to re-queue on every launch and jam the Sync button forever.
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        this.syncQueue = this.entries.filter(
          (e) => !e.synced && !e.syncFailed && e.endTime >= weekAgo
        );
      }
      this.lastSyncTime = (store.get('lastSyncTime') as number) || 0;
    } catch (error) {
      logger.error('[TimeTracker] Failed to load entries:', error);
    }
  }

  private saveEntries(): void {
    try {
      // Only keep last 7 days of entries to prevent unbounded growth.
      // Unsynced entries age out too — keeping them forever meant a failed
      // batch from months ago haunted the sync queue indefinitely.
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentEntries = this.entries.filter((e) => e.endTime >= weekAgo);
      store.set('timeEntries', recentEntries);
      store.set('lastSyncTime', this.lastSyncTime);
    } catch (error) {
      logger.error('[TimeTracker] Failed to save entries:', error);
    }
  }
}

// Singleton instance
let timeTrackerInstance: TimeTracker | null = null;

export function createTimeTracker(options?: TimeTrackerOptions): TimeTracker {
  if (timeTrackerInstance) {
    timeTrackerInstance.stop();
  }
  timeTrackerInstance = new TimeTracker(options);
  return timeTrackerInstance;
}

export function getTimeTracker(): TimeTracker | null {
  return timeTrackerInstance;
}
