/**
 * Meeting Detector
 *
 * Answers one question the frontmost-window sampler cannot: "is the user in a
 * call right now?"
 *
 * Why this exists: the activity monitor samples only the focused window, so a
 * 40-minute Teams call during which you take notes in Notion, screen-share
 * Figma, or simply listen without touching the keyboard was recorded as ~9
 * minutes of Teams. Meeting duration has to come from a call-active signal,
 * not from "is this app focused" plus "is the keyboard moving".
 *
 * Design constraints, all learned from the bug this replaces:
 *
 * - Runs on its own timer, completely outside ActivityMonitor.poll(). It never
 *   consults isIdle, isPaused, excludedApps or activeWin. A meeting must be
 *   detectable while the user is HID-idle — that is the entire point.
 * - Emits an OVERLAY track, not a replacement. App entries keep being recorded
 *   during a call so project attribution survives; the scorer resolves the
 *   overlap (see shared/categories.ts computeScores).
 * - Biased toward false negatives. This feeds a billing product, so a missed
 *   meeting is recoverable by hand while an invented one is not.
 */

import { EventEmitter } from 'events';
import { listWindowTitles, listAllTabs } from './applescript-bridge';
import logger from './logger';

export type MeetingSource = 'browser-tab' | 'zoom-window' | 'teams-window';

export interface MeetingSession {
  id: string;
  appName: string;
  startTime: number;
  endTime: number;
  source: MeetingSource;
}

/** Native apps whose windows we inspect for a live call. */
const ZOOM_PROCESSES = ['zoom.us', 'Zoom'];
const TEAMS_PROCESSES = ['Microsoft Teams', 'Microsoft Teams (work or school)'];

/**
 * Zoom is unambiguous: the in-call window is literally titled "Zoom Meeting",
 * while the idle app shows "Zoom Workplace" or "zoom.us".
 */
function zoomWindowIndicatesCall(titles: string[]): boolean {
  return titles.some(t => {
    const lower = t.toLowerCase().trim();
    if (!lower) return false;
    if (lower.includes('zoom meeting')) return true;
    if (lower.includes('zoom webinar')) return true;
    // "Meeting" / "Participants" / "Chat" panels only exist during a call.
    return lower === 'meeting' || lower.startsWith('meeting ');
  });
}

/**
 * Teams is the hard case, and the reason the original title-keyword check
 * failed. New Teams reuses a single window whose title is the meeting subject,
 * which is indistinguishable from a chat thread title.
 *
 * The usable signal is structural rather than textual: joining a call opens a
 * SECOND window (the meeting stage) alongside the main app window. So we look
 * for a window whose title is not recognisable app chrome.
 *
 * NOTE: this heuristic is the least certain part of the detector and has not
 * been validated against every Teams build. It is deliberately paired with the
 * two-tick confirmation below, and a wrong call is always user-deletable.
 */
const TEAMS_CHROME_TITLES = [
  'microsoft teams',
  'chat | microsoft teams',
  'calendar | microsoft teams',
  'activity | microsoft teams',
  'teams | microsoft teams',
  'calls | microsoft teams',
  'files | microsoft teams',
  'notifications',
  '',
];

function teamsWindowIndicatesCall(titles: string[]): boolean {
  return titles.some(t => {
    const lower = t.toLowerCase().trim();
    if (!lower) return false;
    // Explicit keywords first — cheap and unambiguous when present.
    if (lower.includes('meeting') || lower.includes(' call') || lower.startsWith('call ')) return true;
    if (TEAMS_CHROME_TITLES.includes(lower)) return false;
    // A window that is neither chrome nor a keyword match is the meeting stage.
    return !lower.endsWith('| microsoft teams');
  });
}

/**
 * A URL that means "a call is in progress", as opposed to a lobby or landing
 * page. Structure matters: `meet.google.com` alone is the home page, while
 * `meet.google.com/abc-defg-hij` is a room.
 */
const MEETING_URL_PATTERNS: RegExp[] = [
  /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i,
  /zoom\.us\/(j|w|s)\/\d+/i,
  /zoom\.us\/wc\/\d+/i,
  /teams\.(microsoft|live)\.com\/.*meetup-join/i,
  /teams\.(microsoft|live)\.com\/v2\/.*meeting/i,
  /whereby\.com\/[a-z0-9-]+/i,
  /\.webex\.com\/(meet|join|wbxmjs)\//i,
  /app\.gather\.town\//i,
  /meet\.jit\.si\/[a-z0-9-]+/i,
  // discord.com/channels/… is deliberately absent: text and voice channels
  // share that exact URL shape, so any Discord tab open in a background
  // browser window would register as a call. No URL-level signal separates
  // the two — Discord simply can't be detected this way.
  /around\.co\/r\//i,
];

function urlIndicatesCall(url: string): boolean {
  return MEETING_URL_PATTERNS.some(re => re.test(url));
}

/** Browsers we can enumerate tabs in. Firefox derivatives expose nothing. */
const TAB_CAPABLE_BROWSERS = [
  'Google Chrome', 'Chromium', 'Brave Browser', 'Microsoft Edge',
  'Vivaldi', 'Opera', 'Dia', 'Arc', 'Safari',
];

export function isTabCapableBrowser(appName: string): boolean {
  return TAB_CAPABLE_BROWSERS.includes(appName);
}

export interface MeetingDetectorOptions {
  /** Poll interval when a candidate app is running. */
  activeTickMs?: number;
  /** Poll interval when nothing meeting-shaped is open. */
  idleTickMs?: number;
  /** Consecutive positive ticks required before a meeting is confirmed. */
  confirmTicks?: number;
  /** How long the signal may vanish before the meeting is closed. */
  holdMs?: number;
}

type State = 'idle' | 'candidate' | 'active';

export class MeetingDetector extends EventEmitter {
  private readonly activeTickMs: number;
  private readonly idleTickMs: number;
  private readonly confirmTicks: number;
  private readonly holdMs: number;

  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private state: State = 'idle';
  private positiveTicks = 0;
  /** When the first positive tick was seen — the meeting's real start. */
  private candidateSince = 0;
  private lastPositiveAt = 0;
  private current: { id: string; appName: string; startTime: number; source: MeetingSource } | null = null;

  /** Browsers that are actually running, refreshed each tick from window data. */
  private runningBrowsers: string[] = [];

  constructor(options: MeetingDetectorOptions = {}) {
    super();
    this.activeTickMs = options.activeTickMs ?? 15_000;
    this.idleTickMs = options.idleTickMs ?? 60_000;
    this.confirmTicks = options.confirmTicks ?? 2;
    this.holdMs = options.holdMs ?? 90_000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext(this.idleTickMs);
    logger.log('[MeetingDetector] Started');
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // Close an open meeting rather than losing it.
    if (this.current) this.endMeeting(Date.now());
    logger.log('[MeetingDetector] Stopped');
  }

  isActive(): boolean {
    return this.state === 'active';
  }

  getCurrentMeeting(): MeetingSession | null {
    if (!this.current) return null;
    return { ...this.current, endTime: Date.now() };
  }

  /** Tell the detector which browsers are worth enumerating. */
  setRunningBrowsers(browsers: string[]): void {
    this.runningBrowsers = browsers.filter(b => TAB_CAPABLE_BROWSERS.includes(b));
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    let signal: { source: MeetingSource; appName: string } | null = null;
    try {
      signal = await this.detect();
    } catch (e) {
      logger.error('[MeetingDetector] Detection error:', e);
    }

    // stop() may have run while detect() awaited osascript. A stopped detector
    // must not mutate state, emit, or reschedule — stop() already finalized
    // any open meeting.
    if (!this.running) return;

    const now = Date.now();

    if (signal) {
      this.lastPositiveAt = now;
      if (this.state === 'idle') {
        this.state = 'candidate';
        this.positiveTicks = 1;
        this.candidateSince = now;
      } else if (this.state === 'candidate') {
        this.positiveTicks += 1;
        if (this.positiveTicks >= this.confirmTicks) {
          // Backdate to the first sighting so the confirmation delay isn't
          // silently shaved off every meeting.
          this.startMeeting(signal, this.candidateSince);
        }
      }
    } else {
      if (this.state === 'candidate') {
        // Not sustained — discard without ever having emitted anything.
        this.state = 'idle';
        this.positiveTicks = 0;
      } else if (this.state === 'active' && now - this.lastPositiveAt >= this.holdMs) {
        // The signal has been gone long enough that this wasn't a window blip,
        // a tab reload, or a breakout room. End at the last positive sighting,
        // not now, so the hold period isn't billed as meeting time.
        this.endMeeting(this.lastPositiveAt);
      }
    }

    const busy = this.state !== 'idle' || this.runningBrowsers.length > 0;
    this.scheduleNext(busy ? this.activeTickMs : this.idleTickMs);
  }

  private async detect(): Promise<{ source: MeetingSource; appName: string } | null> {
    // 1. Browser tabs — the highest-confidence signal, because a call URL is
    //    structurally distinct from a lobby page.
    for (const browser of this.runningBrowsers) {
      const tabs = await listAllTabs(browser);
      if (tabs.some(urlIndicatesCall)) {
        return { source: 'browser-tab', appName: browser };
      }
    }

    // 2. Native app windows — one batched osascript for every candidate.
    const titles = await listWindowTitles([...ZOOM_PROCESSES, ...TEAMS_PROCESSES]);

    for (const proc of ZOOM_PROCESSES) {
      const t = titles.get(proc);
      if (t && zoomWindowIndicatesCall(t)) {
        return { source: 'zoom-window', appName: proc };
      }
    }

    for (const proc of TEAMS_PROCESSES) {
      const t = titles.get(proc);
      if (t && teamsWindowIndicatesCall(t)) {
        return { source: 'teams-window', appName: proc };
      }
    }

    return null;
  }

  private startMeeting(signal: { source: MeetingSource; appName: string }, startTime: number): void {
    this.state = 'active';
    this.current = {
      id: `meeting-${startTime}-${Math.random().toString(36).slice(2, 8)}`,
      appName: signal.appName,
      startTime,
      source: signal.source,
    };
    logger.log(`[MeetingDetector] Meeting started (${signal.source}, ${signal.appName})`);
    this.emit('meetingStarted', { ...this.current, endTime: startTime });
  }

  private endMeeting(endTime: number): void {
    if (!this.current) return;
    const session: MeetingSession = { ...this.current, endTime: Math.max(endTime, this.current.startTime) };
    this.current = null;
    this.state = 'idle';
    this.positiveTicks = 0;
    logger.log(
      `[MeetingDetector] Meeting ended (${session.source}, ${Math.round((session.endTime - session.startTime) / 60000)}m)`
    );
    this.emit('meetingEnded', session);
  }
}

let detectorInstance: MeetingDetector | null = null;

export function createMeetingDetector(options?: MeetingDetectorOptions): MeetingDetector {
  // Same contract as createActivityMonitor/createTimeTracker: re-init must not
  // leak the previous instance. A leaked detector keeps its timer chain and
  // handlers alive, and every leaked copy records its own duplicate entry for
  // the same call. stop() also closes an open meeting, so a call spanning a
  // re-init is finalized rather than lost.
  if (detectorInstance) {
    detectorInstance.stop();
  }
  detectorInstance = new MeetingDetector(options);
  return detectorInstance;
}

export function getMeetingDetector(): MeetingDetector | null {
  return detectorInstance;
}

// Exported for tests.
export const __testing = {
  urlIndicatesCall,
  zoomWindowIndicatesCall,
  teamsWindowIndicatesCall,
};
