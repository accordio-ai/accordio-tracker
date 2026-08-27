/**
 * AppleScript Bridge
 *
 * Enriches active window data with AppleScript when active-win
 * returns empty titles/URLs (Screen Recording permission issues,
 * or browsers that don't expose URLs via accessibility API).
 *
 * Supports:
 * - Window titles via System Events (all apps, needs Accessibility)
 * - Browser tab URLs via direct AppleScript (Chrome, Safari, Dia, Arc, Brave, etc.)
 */

import { execFile } from 'child_process';
import logger from './logger';

// Browser-specific AppleScript commands for getting the active tab URL + title.
// Each browser has slightly different AppleScript syntax.
const BROWSER_SCRIPTS: Record<string, { url: string; title: string }> = {
  'Google Chrome': {
    url: 'tell application "Google Chrome" to get URL of active tab of front window',
    title: 'tell application "Google Chrome" to get title of active tab of front window',
  },
  'Chrome': {
    url: 'tell application "Google Chrome" to get URL of active tab of front window',
    title: 'tell application "Google Chrome" to get title of active tab of front window',
  },
  'Chromium': {
    url: 'tell application "Chromium" to get URL of active tab of front window',
    title: 'tell application "Chromium" to get title of active tab of front window',
  },
  'Safari': {
    url: 'tell application "Safari" to get URL of current tab of front window',
    title: 'tell application "Safari" to get name of current tab of front window',
  },
  'Safari Technology Preview': {
    url: 'tell application "Safari Technology Preview" to get URL of current tab of front window',
    title: 'tell application "Safari Technology Preview" to get name of current tab of front window',
  },
  'Dia': {
    url: 'tell application "Dia" to get URL of active tab of front window',
    title: 'tell application "Dia" to get title of active tab of front window',
  },
  // Arc uses "tab 1" instead of "active tab"
  'Arc': {
    url: 'tell application "Arc" to get URL of tab 1 of front window',
    title: 'tell application "Arc" to get title of tab 1 of front window',
  },
  'Brave Browser': {
    url: 'tell application "Brave Browser" to get URL of active tab of front window',
    title: 'tell application "Brave Browser" to get title of active tab of front window',
  },
  'Brave': {
    url: 'tell application "Brave Browser" to get URL of active tab of front window',
    title: 'tell application "Brave Browser" to get title of active tab of front window',
  },
  'Vivaldi': {
    url: 'tell application "Vivaldi" to get URL of active tab of front window',
    title: 'tell application "Vivaldi" to get title of active tab of front window',
  },
  'Microsoft Edge': {
    url: 'tell application "Microsoft Edge" to get URL of active tab of front window',
    title: 'tell application "Microsoft Edge" to get title of active tab of front window',
  },
  'Opera': {
    url: 'tell application "Opera" to get URL of active tab of front window',
    title: 'tell application "Opera" to get title of active tab of front window',
  },
  'Firefox': {
    url: '', // Firefox doesn't support AppleScript for tab URLs
    title: '',
  },
  'Orion': {
    url: 'tell application "Orion" to get URL of active tab of front window',
    title: 'tell application "Orion" to get title of active tab of front window',
  },
  'Zen Browser': {
    url: '', // Zen (Firefox-based) doesn't support AppleScript
    title: '',
  },
};

// Cache failed browsers so we don't keep retrying — but only for a short window.
// Without a TTL, a browser that wasn't foregrounded at first probe (common for Dia)
// stays disabled for the whole session and we never capture its URLs.
const FAILED_BROWSER_TTL_MS = 5 * 60 * 1000;
const failedBrowsers = new Map<string, number>();

/**
 * Run an AppleScript command with a timeout.
 * Returns null on any error (timeout, permission, app not running, etc.)
 */
export function runAppleScript(script: string, timeoutMs = 1500): Promise<string | null> {
  return new Promise((resolve) => {
    if (!script) {
      resolve(null);
      return;
    }

    const proc = execFile('osascript', ['-e', script], { timeout: timeoutMs }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const result = stdout.trim();
      resolve(result || null);
    });

    // Safety: ensure we always resolve
    proc.on('error', () => resolve(null));
  });
}

export interface AppleScriptEnrichment {
  title?: string;
  url?: string;
}

/**
 * Get the window title of the frontmost app via System Events.
 * Uses AXMain attribute to find the focused window, falling back
 * to first non-empty title. Some apps (VS Code) have hidden helper
 * windows that appear as window 1 with empty titles.
 */
export async function getWindowTitle(appName: string): Promise<string | null> {
  // appName comes from the OS-reported process name, which a malicious local app
  // could craft to break out of the AppleScript string literal. Escape backslash
  // first (so the quote-escape can't be neutralized) and drop any newlines.
  const escaped = appName
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  // Try AXMain first (the focused window)
  const axMainScript = `tell application "System Events"
  tell process "${escaped}"
    try
      set focusedWin to (first window whose value of attribute "AXMain" is true)
      return title of focusedWin
    on error
      -- Fallback: find first non-empty title
      set winTitles to title of every window
      repeat with t in winTitles
        if length of (t as text) > 0 then return (t as text)
      end repeat
      return ""
    end try
  end tell
end tell`;

  return runAppleScript(axMainScript);
}

/**
 * Get browser tab URL and title via direct AppleScript.
 * Only works for browsers with AppleScript dictionaries.
 */
export async function getBrowserTabInfo(appName: string): Promise<{ url: string | null; title: string | null }> {
  // Skip if we failed recently — but let the entry expire so Dia/Orion get another shot
  // once they're actually foregrounded.
  const failedAt = failedBrowsers.get(appName);
  if (failedAt !== undefined) {
    if (Date.now() - failedAt < FAILED_BROWSER_TTL_MS) {
      return { url: null, title: null };
    }
    failedBrowsers.delete(appName);
  }

  const scripts = BROWSER_SCRIPTS[appName];
  if (!scripts) {
    return { url: null, title: null };
  }

  // Run URL and title in parallel
  const [url, title] = await Promise.all([
    scripts.url ? runAppleScript(scripts.url) : Promise.resolve(null),
    scripts.title ? runAppleScript(scripts.title) : Promise.resolve(null),
  ]);

  // If both failed, cool down retries for a few minutes (avoids hammering osascript
  // when the browser isn't running) but don't permanently disable.
  if (!url && !title && scripts.url && scripts.title) {
    failedBrowsers.set(appName, Date.now());
    logger.log(`[AppleScript] Browser "${appName}" AppleScript failed, retrying after ${FAILED_BROWSER_TTL_MS / 1000}s`);
  } else if (url || title) {
    // Success after an earlier failure — clear the cool-down.
    failedBrowsers.delete(appName);
  }

  return { url, title };
}

/**
 * Enrich active window data with AppleScript.
 * Called when active-win returns empty title/URL.
 *
 * @param appName - The app name from active-win
 * @param isBrowserApp - Whether the app is a known browser
 * @param hasTitle - Whether active-win already provided a title
 * @param hasUrl - Whether active-win already provided a URL
 */
export async function enrichWithAppleScript(
  appName: string,
  isBrowserApp: boolean,
  hasTitle: boolean,
  hasUrl: boolean,
  wantUrl = true,
): Promise<AppleScriptEnrichment> {
  const result: AppleScriptEnrichment = {};

  // wantUrl=false is the "Track Browser Tabs" setting being off. It must gate
  // both the lookup and the return value: the caller passes hasUrl=false in
  // that state, so without this the enrichment would silently reinstate the
  // very URL the setting says we don't collect.
  const needsUrl = wantUrl && !hasUrl;

  if (isBrowserApp && (needsUrl || !hasTitle)) {
    // For browsers, try direct AppleScript first (gets both URL + title)
    const tabInfo = await getBrowserTabInfo(appName);
    if (wantUrl && tabInfo.url && !hasUrl) result.url = tabInfo.url;
    if (tabInfo.title && !hasTitle) result.title = tabInfo.title;
  }

  // If we still don't have a title, fall back to System Events
  if (!hasTitle && !result.title) {
    const title = await getWindowTitle(appName);
    if (title) result.title = title;
  }

  return result;
}

// ============================================
// Meeting-detection primitives
//
// Unlike the enrichment helpers above, these inspect apps that are NOT
// frontmost — the whole point of meeting detection is that a call keeps
// running while you work in another window.
// ============================================

/** How long a batched enumeration may take before we give up on the tick. */
const ENUMERATION_TIMEOUT_MS = 2500;

// Unit/record separators. These cannot appear in a window title, so they're
// safe delimiters for packing a batched result into one string.
const FIELD_SEP = String.fromCharCode(31);
const RECORD_SEP = String.fromCharCode(30);

/** Escape a string for interpolation into an AppleScript literal. */
function escapeAppleScript(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

/**
 * Window titles of one or more processes, whether or not they're frontmost.
 *
 * One `osascript` invocation for all processes — spawning a process per app on
 * every tick is far too expensive for a 15s poll. Missing processes are
 * skipped silently rather than failing the whole batch.
 *
 * Requires Accessibility permission (the app already depends on it for
 * active-win). Returns an empty map when permission is missing.
 */
export async function listWindowTitles(processNames: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (processNames.length === 0) return result;

  const list = processNames.map(n => `"${escapeAppleScript(n)}"`).join(', ');

  const script = `set out to ""
tell application "System Events"
  repeat with pname in {${list}}
    try
      if exists (process (pname as text)) then
        repeat with w in (windows of process (pname as text))
          try
            set out to out & (pname as text) & (ASCII character 31) & (title of w) & (ASCII character 30)
          end try
        end repeat
      end if
    end try
  end repeat
end tell
return out`;

  const raw = await runAppleScript(script, ENUMERATION_TIMEOUT_MS);
  if (!raw) return result;

  for (const record of raw.split(RECORD_SEP)) {
    if (!record.trim()) continue;
    const sep = record.indexOf(FIELD_SEP);
    if (sep === -1) continue;
    const process = record.slice(0, sep).trim();
    const title = record.slice(sep + 1).trim();
    if (!process) continue;
    const titles = result.get(process) ?? [];
    if (title) titles.push(title);
    result.set(process, titles);
  }

  return result;
}

/**
 * Every open tab URL in a browser, not just the active one.
 *
 * A Google Meet call keeps running in a background tab while you take notes
 * elsewhere, so the active tab alone cannot tell us whether a call is live.
 * Firefox-derived browsers have no AppleScript dictionary and return [].
 */
const ALL_TABS_SCRIPTS: Record<string, string> = {
  'Google Chrome': 'tell application "Google Chrome" to get URL of every tab of every window',
  'Chrome': 'tell application "Google Chrome" to get URL of every tab of every window',
  'Chromium': 'tell application "Chromium" to get URL of every tab of every window',
  'Brave Browser': 'tell application "Brave Browser" to get URL of every tab of every window',
  'Brave': 'tell application "Brave Browser" to get URL of every tab of every window',
  'Microsoft Edge': 'tell application "Microsoft Edge" to get URL of every tab of every window',
  'Vivaldi': 'tell application "Vivaldi" to get URL of every tab of every window',
  'Opera': 'tell application "Opera" to get URL of every tab of every window',
  'Dia': 'tell application "Dia" to get URL of every tab of every window',
  'Arc': 'tell application "Arc" to get URL of every tab of every window',
  'Safari': 'tell application "Safari" to get URL of every tab of every window',
  'Safari Technology Preview': 'tell application "Safari Technology Preview" to get URL of every tab of every window',
};

/** Browsers that timed out or refused — retried after the same TTL as above. */
const failedTabEnumeration = new Map<string, number>();

export async function listAllTabs(appName: string): Promise<string[]> {
  const script = ALL_TABS_SCRIPTS[appName];
  if (!script) return [];

  const failedAt = failedTabEnumeration.get(appName);
  if (failedAt !== undefined) {
    if (Date.now() - failedAt < FAILED_BROWSER_TTL_MS) return [];
    failedTabEnumeration.delete(appName);
  }

  const raw = await runAppleScript(script, ENUMERATION_TIMEOUT_MS);
  if (raw === null) {
    // Timeout, denied Automation, or the browser isn't running. Back off —
    // retrying a blocked Apple Event every tick would stall the detector.
    // (Observed in practice: an un-consented Automation request blocks until
    // the AppleEvent timeout, ~120s, not the 2.5s we asked for.)
    failedTabEnumeration.set(appName, Date.now());
    logger.debug(`[AppleScript] Tab enumeration unavailable for ${appName}`);
    return [];
  }

  // osascript renders an AppleScript list as comma-space separated values.
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s !== 'missing value');
}
