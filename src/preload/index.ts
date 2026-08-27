/**
 * Preload Script
 *
 * Exposes safe IPC methods to the renderer process.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for time tracking
interface TimeTrackingSettings {
  enabled: boolean;
  idleTimeoutMinutes: number;
  syncIntervalMinutes: number;
  showInMenuBar: boolean;
  trackBrowserTabs: boolean;
  excludedApps: string[];
}

interface ActiveTaskSettings {
  showInBrainBar: boolean;
  showProject: boolean;
}

/** Why the user was absent. Only 'idle' is a break; the rest are untracked. */
export type AbsenceReason = 'idle' | 'locked' | 'suspended';

export interface AbsenceRecord {
  start: number;
  end: number;
  reason: AbsenceReason;
}

/** A detected call. Runs as an overlay track alongside normal app entries. */
export interface MeetingSessionInfo {
  id: string;
  appName: string;
  startTime: number;
  endTime: number;
  source: 'browser-tab' | 'zoom-window' | 'teams-window';
}

export interface ProjectSummary {
  id: string;
  name: string;
  client_name?: string;
  color?: string;
}

/** Why a project list failed to load. */
export type ProjectsListErrorCode =
  | 'not_authenticated'
  | 'auth_expired'
  | 'server_error'
  | 'network_error';

export type ProjectsListResult =
  | { success: true; data: ProjectSummary[] }
  | { success: false; code: ProjectsListErrorCode; error: string };

interface Memory {
  id: string;
  content: string;
  category?: string;
  createdAt: number;
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

interface TimeEntry extends ActivityEntry {
  synced: boolean;
  syncedAt?: number;
  description?: string;
  isBillable?: boolean;
}

interface TimeSummary {
  today: number;
  week: number;
  byCategory: Record<string, number>;
  byProject: Record<string, number>;
  unassigned: number;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  error?: string;
}

interface SyncStatus {
  lastSync: number;
  pendingCount: number;
  isSyncing: boolean;
}

// Type definitions for the exposed API
export interface ElectronAPI {
  auth: {
    getToken: () => Promise<string | null>;
    setToken: (token: string) => Promise<boolean>;
    clearToken: () => Promise<boolean>;
    sendCode: (email: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    verifyCode: (email: string, code: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    deviceRequest: () => Promise<{ success: boolean; deviceCode?: string; expiresIn?: number; error?: string }>;
    deviceOpenBrowser: (deviceCode: string) => Promise<{ success: boolean }>;
    devicePoll: (deviceCode: string) => Promise<{ success: boolean; status?: string; token?: string; error?: string }>;
    onSessionExpired: (callback: () => void) => () => void;
  };
  permissions: {
    getStatus: (checkScreenRecording?: boolean) => Promise<{ accessibility: boolean; screenRecording: boolean }>;
    getDetailedStatus: () => Promise<{
      systemDetected: { accessibility: boolean; screenRecording: boolean };
      userConfirmed: boolean;
      functionallyWorking: boolean;
      userSkipped: boolean;
    }>;
    requestAccessibility: () => Promise<boolean>;
    requestScreenRecording: () => Promise<boolean>;
    openSettings: (type: 'accessibility' | 'screenRecording') => Promise<boolean>;
    skip: () => Promise<boolean>;
    complete: () => Promise<boolean>;
    retryTracking: () => Promise<boolean>;
    onChanged: (callback: (data: { accessibility: boolean; screenRecording: boolean; newlyGranted: boolean }) => void) => () => void;
    onValidated: (callback: (data: { working: boolean; needsRestart?: boolean }) => void) => () => void;
  };
  agi: {
    // Chat no longer crosses IPC — the renderer calls /api/agi/chat directly
    // through the AI SDK. See renderer/lib/chat/transport.ts.
    getCurrentFocus: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
    getSessions: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
  };
  time: {
    getActivity: () => Promise<{ current: ActivityEntry | null; entries: TimeEntry[]; summary: TimeSummary | null; absences: AbsenceRecord[]; currentMeeting: MeetingSessionInfo | null }>;
    getSettings: () => Promise<TimeTrackingSettings>;
    updateSettings: (settings: Partial<TimeTrackingSettings>) => Promise<{
      success: boolean;
      error?: string;
      permissions?: { accessibility: boolean; screenRecording: boolean };
    }>;
    syncNow: () => Promise<SyncResult>;
    assignProject: (entryId: string, projectId: string) => Promise<{ success: boolean }>;
    learnPattern: (appName: string, projectId: string, windowTitle: string, url?: string) => Promise<void>;
    getSuggestions: () => Promise<Array<{ suggestion: string; count: number; entries: string[] }>>;
    getSyncStatus: () => Promise<SyncStatus>;
    getLoggedEntries: () => Promise<{ success: boolean; entries: Array<{ id: string; project_id: string | null; project_name: string | null; project_color: string | null; description: string | null; app_name: string | null; started_at: string; ended_at: string | null; duration_minutes: number; source: string; is_billable: boolean }> }>;
    addManualEntry: (description: string, projectId: string, duration: number, category?: string) => Promise<{ success: boolean; entry?: TimeEntry }>;
    deleteEntry: (entryId: string) => Promise<{ success: boolean }>;
    updateEntry: (entryId: string, updates: { description?: string; isBillable?: boolean; startTime?: number; endTime?: number; duration?: number; category?: string; projectId?: string }) => Promise<{ success: boolean; entry?: TimeEntry; error?: string }>;
    mergeEntries: (entryIds: string[]) => Promise<{ success: boolean; entry?: TimeEntry; error?: string }>;
    splitEntry: (entryId: string, atTimestamp: number) => Promise<{ success: boolean; entries?: TimeEntry[]; error?: string }>;
    recategorizeEntry: (entryId: string, category: string) => Promise<{ success: boolean; entry?: TimeEntry; error?: string }>;
    // Manual timer controls
    startManualTimer: (description: string, projectId?: string) => Promise<{ success: boolean; startTime?: number }>;
    stopManualTimer: () => Promise<{ success: boolean; entry?: TimeEntry; duration?: number; error?: string }>;
    getManualTimerStatus: () => Promise<{ isRunning: boolean; startTime: number | null; description: string; elapsed: number }>;
    isTrackingEnabled: () => Promise<boolean>;
    // Event listeners
    onActivityStarted: (callback: (activity: ActivityEntry) => void) => void;
    onActivityEnded: (callback: (activity: ActivityEntry) => void) => void;
    onActivityResumed: (callback: (activityId: string) => void) => void;
    onIdle: (callback: (payload: { start: number; reason: AbsenceReason }) => void) => void;
    onActive: (callback: () => void) => void;
    onAbsence: (callback: (record: AbsenceRecord) => void) => void;
    onMeetingStarted: (callback: (session: MeetingSessionInfo) => void) => void;
    onMeetingEnded: (callback: (session: MeetingSessionInfo) => void) => void;
    onSyncStarted: (callback: () => void) => void;
    onSyncCompleted: (callback: (result: SyncResult) => void) => void;
    onSyncFailed: (callback: (result: SyncResult) => void) => void;
    onManualTimerStarted: (callback: (data: { startTime: number; description: string }) => void) => void;
    onManualTimerStopped: (callback: (data: { entry?: TimeEntry }) => void) => void;
    onPermissionWarning: (callback: () => void) => void;
    onEmptyTitles: (callback: () => void) => void;
    onTitlesRecovered: (callback: () => void) => void;
  };
  task: {
    getSettings: () => Promise<ActiveTaskSettings>;
    updateSettings: (settings: Partial<ActiveTaskSettings>) => Promise<{ success: boolean }>;
    getFocus: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
    setFocus: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    clearFocus: () => Promise<{ success: boolean; error?: string }>;
  };
  memory: {
    list: () => Promise<Memory[]>;
    add: (content: string, category?: string) => Promise<Memory>;
    delete: (id: string) => Promise<{ success: boolean }>;
    syncFromServer: () => Promise<{ success: boolean; memories: Memory[] }>;
    onSynced: (callback: (data: { count: number }) => void) => () => void;
  };
  credits: {
    get: () => Promise<{ success: boolean; data?: { daily_messages: number; daily_messages_used: number; bonus_messages: number; legend_message_tier: number; total_available: number }; error?: string }>;
    onUpdated: (callback: (data: { creditsUsed: number; creditsRemaining: number }) => void) => () => void;
    onExhausted: (callback: (data: { message: string; creditsRemaining: number }) => void) => () => void;
  };
  limits: {
    get: () => Promise<{ success: boolean; data?: { id: string; user_id: string; ai_actions_used: number; ai_actions_limit: number; signatures_used: number; signatures_limit: number; period_start: string; period_end: string }; error?: string }>;
  };
  profile: {
    get: () => Promise<{ success: boolean; data?: {
      id: string; email: string; full_name: string | null; avatar_url: string | null;
      logo_url: string | null; business_name: string | null; phone_number: string | null;
      address: string | null; location: string | null; skills: string[] | null;
      plan: string | null; preferred_currency: string | null; brand_color: string | null;
      onboarding_completed: boolean | null;
      slug: string | null; created_at: string | null;
    }; error?: string }>;
  };
  context: {
    getUnified: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
  };
  integrations: {
    list: () => Promise<{
      success: boolean;
      data?: {
        integrations: Array<{
          provider: string;
          connected: boolean;
          name: string;
          icon?: string;
        }>;
        summary: { total: number; connected: number };
      };
      error?: string;
    }>;
    openSettings: (provider?: string) => Promise<{ success: boolean }>;
    onStatusChanged: (callback: (data: { integrations: Array<{ provider: string; connected: boolean; name: string }> }) => void) => void;
  };
  channels: {
    // WhatsApp pairing code flow
    getWhatsAppLinkCode: () => Promise<{ success: boolean; code?: string; botPhone?: string; instructions?: string; expiresAt?: string; error?: string }>;
    checkWhatsAppLinked: () => Promise<{ success: boolean; linked?: boolean; displayName?: string; phoneNumber?: string; botPhone?: string; botConnected?: boolean; error?: string }>;
    connectTelegram: (botToken: string) => Promise<{ success: boolean; error?: string }>;
    connectSlack: (botToken: string, appToken: string) => Promise<{ success: boolean; error?: string }>;
    disconnect: (channel: 'whatsapp' | 'telegram' | 'slack') => Promise<{ success: boolean; error?: string }>;
    // Telegram pairing code flow
    getTelegramLinkCode: () => Promise<{ success: boolean; code?: string; deepLink?: string; expiresAt?: string; error?: string }>;
    checkTelegramLinked: () => Promise<{ success: boolean; linked?: boolean; displayName?: string; error?: string }>;
    // All three channel link statuses in one call (overlord_channel_links)
    getStatusAll: () => Promise<{ success: boolean; data?: { whatsapp: { linked: boolean }; telegram: { linked: boolean }; slack: { linked: boolean } }; error?: string }>;
  };
  projects: {
    /**
     * Discriminated so the renderer can tell "you have no projects" apart from
     * "the request failed" — conflating them is what produced a permanently
     * empty picker over a 500.
     */
    list: () => Promise<ProjectsListResult>;
  };
  settings: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
  };
  window: {
    hide: () => void;
  };
  app: {
    getIcon: (appPath: string) => Promise<string | null>;
    getVersion: () => Promise<string>;
    openExternal: (url: string) => Promise<boolean>;
    quit: () => void;
    relaunch: () => Promise<void>;
  };
  update: {
    check: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
    install: () => void;
    getPending: () => Promise<string | null>;
    onChecking: (callback: () => void) => void;
    onAvailable: (callback: (info: { version: string }) => void) => void;
    onNotAvailable: (callback: () => void) => void;
    onProgress: (callback: (progress: { percent: number }) => void) => void;
    onDownloaded: (callback: (info: { version: string }) => void) => void;
    onError: (callback: (error: string) => void) => void;
  };
}

contextBridge.exposeInMainWorld('electron', {
  auth: {
    getToken: () => ipcRenderer.invoke('auth:getToken'),
    setToken: (token: string) => ipcRenderer.invoke('auth:setToken', token),
    clearToken: () => ipcRenderer.invoke('auth:clearToken'),
    sendCode: (email: string) => ipcRenderer.invoke('auth:sendCode', email),
    verifyCode: (email: string, code: string) => ipcRenderer.invoke('auth:verifyCode', email, code),
    deviceRequest: () => ipcRenderer.invoke('auth:deviceRequest'),
    deviceOpenBrowser: (deviceCode: string) => ipcRenderer.invoke('auth:deviceOpenBrowser', deviceCode),
    devicePoll: (deviceCode: string) => ipcRenderer.invoke('auth:devicePoll', deviceCode),
    onSessionExpired: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('auth:sessionExpired', handler);
      return () => ipcRenderer.removeListener('auth:sessionExpired', handler);
    },
  },
  permissions: {
    getStatus: (checkScreenRecording = true) => ipcRenderer.invoke('permissions:getStatus', checkScreenRecording),
    getDetailedStatus: () => ipcRenderer.invoke('permissions:getDetailedStatus'),
    requestAccessibility: () => ipcRenderer.invoke('permissions:requestAccessibility'),
    requestScreenRecording: () => ipcRenderer.invoke('permissions:requestScreenRecording'),
    openSettings: (type: 'accessibility' | 'screenRecording') => ipcRenderer.invoke('permissions:openSettings', type),
    skip: () => ipcRenderer.invoke('permissions:skip'),
    complete: () => ipcRenderer.invoke('permissions:complete'),
    retryTracking: () => ipcRenderer.invoke('permissions:retryTracking'),
    onChanged: (callback: (data: { accessibility: boolean; screenRecording: boolean; newlyGranted: boolean }) => void) => {
      const handler = (_: unknown, data: { accessibility: boolean; screenRecording: boolean; newlyGranted: boolean }) => callback(data);
      ipcRenderer.on('permissions:changed', handler);
      return () => ipcRenderer.removeListener('permissions:changed', handler);
    },
    onValidated: (callback: (data: { working: boolean; needsRestart?: boolean }) => void) => {
      const handler = (_: unknown, data: { working: boolean; needsRestart?: boolean }) => callback(data);
      ipcRenderer.on('permissions:validated', handler);
      return () => ipcRenderer.removeListener('permissions:validated', handler);
    },
  },
  agi: {
    getCurrentFocus: () => ipcRenderer.invoke('agi:getCurrentFocus'),
    getSessions: () => ipcRenderer.invoke('agi:getSessions'),
  },
  time: {
    getActivity: () => ipcRenderer.invoke('time:getActivity'),
    getSettings: () => ipcRenderer.invoke('time:getSettings'),
    updateSettings: (settings: Partial<TimeTrackingSettings>) => ipcRenderer.invoke('time:updateSettings', settings),
    syncNow: () => ipcRenderer.invoke('time:syncNow'),
    assignProject: (entryId: string, projectId: string) => ipcRenderer.invoke('time:assignProject', entryId, projectId),
    learnPattern: (appName: string, projectId: string, windowTitle: string, url?: string) => ipcRenderer.invoke('time:learnPattern', appName, projectId, windowTitle, url),
    getSuggestions: () => ipcRenderer.invoke('time:getSuggestions'),
    getSyncStatus: () => ipcRenderer.invoke('time:getSyncStatus'),
    getLoggedEntries: () => ipcRenderer.invoke('time:getLoggedEntries'),
    addManualEntry: (description: string, projectId: string, duration: number, category?: string) =>
      ipcRenderer.invoke('time:addManualEntry', description, projectId, duration, category),
    deleteEntry: (entryId: string) => ipcRenderer.invoke('time:deleteEntry', entryId),
    updateEntry: (entryId: string, updates: { description?: string; isBillable?: boolean; startTime?: number; endTime?: number; duration?: number; category?: string; projectId?: string }) =>
      ipcRenderer.invoke('time:updateEntry', entryId, updates),
    mergeEntries: (entryIds: string[]) => ipcRenderer.invoke('time:mergeEntries', entryIds),
    splitEntry: (entryId: string, atTimestamp: number) => ipcRenderer.invoke('time:splitEntry', entryId, atTimestamp),
    recategorizeEntry: (entryId: string, category: string) => ipcRenderer.invoke('time:recategorizeEntry', entryId, category),
    // Manual timer controls
    startManualTimer: (description: string, projectId?: string) =>
      ipcRenderer.invoke('time:startManualTimer', description, projectId),
    stopManualTimer: () => ipcRenderer.invoke('time:stopManualTimer'),
    getManualTimerStatus: () => ipcRenderer.invoke('time:getManualTimerStatus'),
    isTrackingEnabled: () => ipcRenderer.invoke('time:isTrackingEnabled'),
    // Event listeners
    onActivityStarted: (callback: (activity: ActivityEntry) => void) => {
      ipcRenderer.on('time:activityStarted', (_, activity) => callback(activity));
    },
    onActivityEnded: (callback: (activity: ActivityEntry) => void) => {
      ipcRenderer.on('time:activityEnded', (_, activity) => callback(activity));
    },
    onActivityResumed: (callback: (activityId: string) => void) => {
      ipcRenderer.on('time:activityResumed', (_, activityId) => callback(activityId));
    },
    onIdle: (callback: (payload: { start: number; reason: AbsenceReason }) => void) => {
      ipcRenderer.on('time:idle', (_, payload) => callback(payload));
    },
    onActive: (callback: () => void) => {
      ipcRenderer.on('time:active', callback);
    },
    onAbsence: (callback: (record: AbsenceRecord) => void) => {
      ipcRenderer.on('time:absence', (_, record) => callback(record));
    },
    onMeetingStarted: (callback: (session: MeetingSessionInfo) => void) => {
      ipcRenderer.on('time:meetingStarted', (_, session) => callback(session));
    },
    onMeetingEnded: (callback: (session: MeetingSessionInfo) => void) => {
      ipcRenderer.on('time:meetingEnded', (_, session) => callback(session));
    },
    onSyncStarted: (callback: () => void) => {
      ipcRenderer.on('time:syncStarted', callback);
    },
    onSyncCompleted: (callback: (result: SyncResult) => void) => {
      ipcRenderer.on('time:syncCompleted', (_, result) => callback(result));
    },
    onSyncFailed: (callback: (result: SyncResult) => void) => {
      ipcRenderer.on('time:syncFailed', (_, result) => callback(result));
    },
    onManualTimerStarted: (callback: (data: { startTime: number; description: string }) => void) => {
      ipcRenderer.on('time:manualTimerStarted', (_, data) => callback(data));
    },
    onManualTimerStopped: (callback: (data: { entry?: TimeEntry }) => void) => {
      ipcRenderer.on('time:manualTimerStopped', (_, data) => callback(data));
    },
    onPermissionWarning: (callback: () => void) => {
      ipcRenderer.on('time:permissionWarning', () => callback());
    },
    onEmptyTitles: (callback: () => void) => {
      ipcRenderer.on('time:emptyTitles', () => callback());
    },
    onTitlesRecovered: (callback: () => void) => {
      ipcRenderer.on('time:titlesRecovered', () => callback());
    },
  },
  task: {
    getSettings: () => ipcRenderer.invoke('task:getSettings'),
    updateSettings: (settings: Partial<ActiveTaskSettings>) => ipcRenderer.invoke('task:updateSettings', settings),
    getFocus: () => ipcRenderer.invoke('task:getFocus'),
    setFocus: (taskId: string) => ipcRenderer.invoke('task:setFocus', taskId),
    clearFocus: () => ipcRenderer.invoke('task:clearFocus'),
  },
  memory: {
    list: () => ipcRenderer.invoke('memory:list'),
    add: (content: string, category?: string) => ipcRenderer.invoke('memory:add', content, category),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', id),
    syncFromServer: () => ipcRenderer.invoke('memory:syncFromServer'),
    onSynced: (callback: (data: { count: number }) => void) => {
      const handler = (_: unknown, data: { count: number }) => callback(data);
      ipcRenderer.on('memory:synced', handler);
      return () => ipcRenderer.removeListener('memory:synced', handler);
    },
  },
  credits: {
    get: () => ipcRenderer.invoke('credits:get'),
    onUpdated: (callback: (data: { creditsUsed: number; creditsRemaining: number }) => void) => {
      const handler = (_: unknown, data: { creditsUsed: number; creditsRemaining: number }) => callback(data);
      ipcRenderer.on('credits:updated', handler);
      return () => ipcRenderer.removeListener('credits:updated', handler);
    },
    onExhausted: (callback: (data: { message: string; creditsRemaining: number }) => void) => {
      const handler = (_: unknown, data: { message: string; creditsRemaining: number }) => callback(data);
      ipcRenderer.on('credits:exhausted', handler);
      return () => ipcRenderer.removeListener('credits:exhausted', handler);
    },
  },
  limits: {
    get: () => ipcRenderer.invoke('limits:get'),
  },
  profile: {
    get: () => ipcRenderer.invoke('profile:get'),
  },
  context: {
    getUnified: () => ipcRenderer.invoke('context:getUnified'),
  },
  integrations: {
    list: () => ipcRenderer.invoke('integrations:list'),
    openSettings: (provider?: string) => ipcRenderer.invoke('integrations:openSettings', provider),
    onStatusChanged: (callback: (data: { integrations: Array<{ provider: string; connected: boolean; name: string }> }) => void) => {
      ipcRenderer.on('integrations:statusChanged', (_, data) => callback(data));
    },
  },
  channels: {
    getWhatsAppLinkCode: () => ipcRenderer.invoke('channels:getWhatsAppLinkCode'),
    checkWhatsAppLinked: () => ipcRenderer.invoke('channels:checkWhatsAppLinked'),
    connectTelegram: (botToken: string) => ipcRenderer.invoke('channels:connectTelegram', botToken),
    connectSlack: (botToken: string, appToken: string) => ipcRenderer.invoke('channels:connectSlack', botToken, appToken),
    disconnect: (channel: 'whatsapp' | 'telegram' | 'slack') => ipcRenderer.invoke('channels:disconnect', channel),
    // Telegram pairing code flow
    getTelegramLinkCode: () => ipcRenderer.invoke('channels:getTelegramLinkCode'),
    checkTelegramLinked: () => ipcRenderer.invoke('channels:checkTelegramLinked'),
    getStatusAll: () => ipcRenderer.invoke('channels:getStatusAll'),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  },
  window: {
    hide: () => ipcRenderer.invoke('window:hide'),
  },
  app: {
    getIcon: (appPath: string) => ipcRenderer.invoke('app:getIcon', appPath),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    quit: () => ipcRenderer.invoke('app:quit'),
    relaunch: () => ipcRenderer.invoke('app:relaunch'),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    getPending: () => ipcRenderer.invoke('update:getPending'),
    onChecking: (callback: () => void) => {
      ipcRenderer.on('update:checking', callback);
    },
    onAvailable: (callback: (info: { version: string }) => void) => {
      ipcRenderer.on('update:available', (_, info) => callback(info));
    },
    onNotAvailable: (callback: () => void) => {
      ipcRenderer.on('update:not-available', callback);
    },
    onProgress: (callback: (progress: { percent: number }) => void) => {
      ipcRenderer.on('update:progress', (_, progress) => callback(progress));
    },
    onDownloaded: (callback: (info: { version: string }) => void) => {
      ipcRenderer.on('update:downloaded', (_, info) => callback(info));
    },
    onError: (callback: (error: string) => void) => {
      ipcRenderer.on('update:error', (_, error) => callback(error));
    },
  },
} satisfies ElectronAPI);

// Declare the global type
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
