/**
 * Settings Store
 *
 * Persistent storage for app settings using electron-store.
 */

import Store from 'electron-store';
import { TimeEntry } from './time-tracker';

// Default API URL - change this for different environments
// Production: https://app.accordio.ai
// Local development: http://localhost:3000
export const DEFAULT_API_URL = 'https://app.accordio.ai';

// Memory interface for AI custom instructions
export interface Memory {
  id: string;
  content: string;
  category?: string;
  createdAt: number;
}

// Time tracking settings
export interface TimeTrackingSettings {
  enabled: boolean;
  idleTimeoutMinutes: number; // 1, 2, 5, 10, 15 (default: 10)
  syncIntervalMinutes: number; // 1, 5, 10, 15 (default: 5)
  showInMenuBar: boolean;
  trackBrowserTabs: boolean;
  excludedApps: string[];
  // NOTE: `categories` is deliberately gone. It persisted a stale 6-bucket
  // taxonomy (development/design/communication/productivity/browsers/
  // entertainment) with no `meetings` bucket, and because electron-store
  // writes defaults to disk it silently overrode the real 14-category map in
  // activity-monitor.ts for every existing user. There was never a UI to edit
  // it. The taxonomy now lives in exactly one place — see APP_CATEGORIES.
}

// Active task display settings
export interface ActiveTaskSettings {
  showInBrainBar: boolean;
  showProject: boolean;
}

interface StoreSchema {
  // General settings
  apiUrl: string;
  startAtLogin: boolean;
  globalShortcut: string;
  theme: 'light' | 'dark' | 'system';
  lastSessionId?: string;

  // Time tracking
  timeTracking: TimeTrackingSettings;
  /** Bumped when persisted timeTracking settings need a migration. */
  timeTrackingSchemaVersion?: number;
  /**
   * User category corrections, keyed by "appName::windowTitlePrefix". Lets a
   * "this was a meeting" fix generalise instead of needing to be repeated.
   */
  categoryOverrides?: Record<string, string>;
  timeEntries?: TimeEntry[];
  lastSyncTime?: number;

  // Active task
  activeTask: ActiveTaskSettings;

  // Memories (persisted AI instructions)
  memories: Memory[];

  // Dark mode (legacy, for backwards compat)
  darkMode?: boolean;

  // Permissions state (for macOS accessibility/screen recording prompts)
  // permissionsUserConfirmed: user clicked "complete" during onboarding (persists across restarts)
  permissionsUserConfirmed?: boolean;
  // permissionsSystemDetected: live system check result (volatile, re-checked on startup)
  permissionsSystemDetected?: boolean;
  // permissionsFunctionallyWorking: active-win probe returned data (most reliable signal)
  permissionsFunctionallyWorking?: boolean;
  permissionsPromptedLaunch?: number;
  permissionsUserSkipped?: boolean;
  // Legacy flag (kept for migration, will be removed in future)
  permissionsGranted?: boolean;

  // First-run setup window (main/onboarding-windows.ts). Undefined on installs
  // that predate it — treated as completed when a token already exists.
  onboardingCompleted?: boolean;
  // Set right before the post-setup relaunch so the popover opens on boot.
  resumeAfterRelaunch?: boolean;
  // Background update downloads, chosen in setup. Undefined means on.
  autoUpdate?: boolean;
}


export const store = new Store<StoreSchema>({
  defaults: {
    apiUrl: DEFAULT_API_URL,
    startAtLogin: false,
    globalShortcut: 'CommandOrControl+Shift+A',
    theme: 'system',

    timeTracking: {
      enabled: true,
      idleTimeoutMinutes: 10,
      syncIntervalMinutes: 5,
      showInMenuBar: true,
      trackBrowserTabs: true,
      excludedApps: ['Electron', 'Accordio AGI', 'Accordio AI', 'Spotify', 'Music', 'Netflix', 'Apple TV', 'VLC'],
    },

    activeTask: {
      showInBrainBar: true,
      showProject: true,
    },

    memories: [],
  },
});

// One-time fix-up for the "Accordio AI" rename: defaults only apply to fresh
// installs — persisted settings still carry the old exclusion list, which
// would make the renamed app track itself.
{
  const tt = store.get('timeTracking');
  if (tt?.excludedApps && !tt.excludedApps.includes('Accordio AI')) {
    store.set('timeTracking', { ...tt, excludedApps: [...tt.excludedApps, 'Accordio AI'] });
  }
}

/**
 * Time-tracking settings schema version.
 *
 * v2 (v1.6.0):
 *  - Drops the persisted `categories` map. It shadowed the real 14-category
 *    taxonomy with a 6-bucket legacy one that had no `meetings` key, so Teams
 *    and Zoom were classified as "communication" and counted toward nothing.
 *    Safe to delete outright — no UI ever wrote to it.
 *  - Raises the idle timeout floor from 5 to 10 minutes. Five minutes without
 *    a keypress is normal in a meeting; it should not read as "stopped working".
 */
const TIME_TRACKING_SCHEMA_VERSION = 2;
{
  const version = store.get('timeTrackingSchemaVersion') ?? 1;
  if (version < TIME_TRACKING_SCHEMA_VERSION) {
    const tt = store.get('timeTracking') as (TimeTrackingSettings & { categories?: unknown }) | undefined;
    if (tt) {
      const next = { ...tt };
      delete next.categories;
      if (!next.idleTimeoutMinutes || next.idleTimeoutMinutes < 10) {
        next.idleTimeoutMinutes = 10;
      }
      store.set('timeTracking', next);
    }
    store.set('timeTrackingSchemaVersion', TIME_TRACKING_SCHEMA_VERSION);
  }
}

// Helper functions for type-safe access

export function getTimeTrackingSettings(): TimeTrackingSettings {
  return store.get('timeTracking');
}

export function setTimeTrackingSettings(settings: Partial<TimeTrackingSettings>): void {
  const current = store.get('timeTracking');
  store.set('timeTracking', { ...current, ...settings });
}

export function getActiveTaskSettings(): ActiveTaskSettings {
  return store.get('activeTask');
}

export function setActiveTaskSettings(settings: Partial<ActiveTaskSettings>): void {
  const current = store.get('activeTask');
  store.set('activeTask', { ...current, ...settings });
}

export function getMemories(): Memory[] {
  return store.get('memories') || [];
}

export function addMemory(content: string, category?: string): Memory {
  const memories = getMemories();
  const newMemory: Memory = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    category,
    createdAt: Date.now(),
  };
  memories.push(newMemory);
  store.set('memories', memories);
  return newMemory;
}

export function deleteMemory(id: string): boolean {
  const memories = getMemories();
  const idx = memories.findIndex((m) => m.id === id);
  if (idx !== -1) {
    memories.splice(idx, 1);
    store.set('memories', memories);
    return true;
  }
  return false;
}

export function clearMemories(): void {
  store.set('memories', []);
}

export function setMemories(memories: Memory[]): void {
  store.set('memories', memories);
}
