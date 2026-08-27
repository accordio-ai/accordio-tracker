/**
 * Regression tests for the v1.6.0 time-tracking fixes.
 *
 * Each block pins one bug that shipped in v1.5.5 and produced the report that
 * started this work: a 40-minute Microsoft Teams meeting logged as 9 minutes,
 * with the missing 31 minutes scored as a break.
 *
 * Run: npm test
 */

import { section, expect, expectClose, report } from './harness';
import { createActivityMonitor, categorizeActivity, APP_CATEGORIES } from '../src/main/activity-monitor';
import { computeScores } from '../src/shared/categories';
import { MeetingDetector, __testing } from '../src/main/meeting-detector';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ────────────────────────────────────────────────────────────────
// 1. The idle trap door
//
// poll() used to begin `if (this.isPaused || this.isIdle || ...) return`, and
// nothing inside poll() could ever clear isIdle. Crossing the idle threshold
// once stopped tracking permanently until the next screen lock or sleep.
// ────────────────────────────────────────────────────────────────
async function testIdleRecovery(): Promise<void> {
  section('Idle model');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monitor: any = createActivityMonitor({ pollInterval: 50, idleTimeout: 1 });
  monitor.activeWin = async () => ({
    owner: { name: 'Microsoft Teams', bundleId: 'com.microsoft.teams', path: '/x' },
    title: 'Weekly sync',
    url: undefined,
  });

  const absences: Array<{ reason: string; start: number; end: number }> = [];
  monitor.on('absence', (r: { reason: string; start: number; end: number }) => absences.push(r));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { powerMonitor } = require('electron');
  let fakeIdleSeconds = 0;
  powerMonitor.getSystemIdleTime = () => fakeIdleSeconds;

  monitor.isRunning = true;
  monitor.isPaused = false;
  monitor.isIdle = false;
  monitor.screenLocked = false;
  monitor.systemSuspended = false;
  monitor.lastPollTime = Date.now();

  for (let i = 0; i < 4; i++) { await monitor.poll(); await sleep(60); }
  expect('tracks while active', monitor.isIdle, false);
  expect('records the active app', monitor.currentActivity?.appName, 'Microsoft Teams');

  fakeIdleSeconds = 90; // past the 1-minute threshold
  await monitor.poll();
  expect('goes idle past the threshold', monitor.isIdle, true);
  expect('opens an absence', monitor.openAbsence?.reason, 'idle');

  // Keep polling while idle, then return. This is the regression.
  for (let i = 0; i < 3; i++) { await monitor.poll(); await sleep(60); }
  fakeIdleSeconds = 0;
  await monitor.poll();
  expect('RECOVERS from idle (trap door fixed)', monitor.isIdle, false);
  expect('records exactly one absence', absences.length, 1);
  expect('absence is attributed to idle', absences[0]?.reason, 'idle');
  expectClose('absence spans the idle window', (absences[0].end - absences[0].start) / 1000, 90, 2);

  for (let i = 0; i < 3; i++) { await monitor.poll(); await sleep(60); }
  expect('resumes tracking after idle', monitor.currentActivity?.appName, 'Microsoft Teams');

  // A live meeting must suppress HID idle — passive listening is still work.
  monitor.setMeetingActive(true);
  fakeIdleSeconds = 300;
  await monitor.poll();
  expect('a live meeting overrides idle', monitor.isIdle, false);

  // ...but a locked screen overrides even a live meeting.
  monitor.screenLocked = true;
  await monitor.poll();
  expect('screen lock overrides a live meeting', monitor.isIdle, true);
}

// ────────────────────────────────────────────────────────────────
// 2. Categorisation
//
// 'Microsoft Teams' appears in both `messaging` and `meetings`; the old
// matcher returned the first hit in object-key order and used unbounded
// substring matching, so 'Pop' matched "Popclip".
// ────────────────────────────────────────────────────────────────
function testCategorisation(): void {
  section('Categorisation');

  const cases: Array<[string, string, string | undefined, string]> = [
    ['Microsoft Teams', 'Microsoft Teams', undefined, 'messaging'],
    ['Microsoft Teams', 'Meeting with Acme', undefined, 'meetings'],
    ['Slack', 'general | Acme', undefined, 'messaging'],
    ['Slack', 'Huddle in #general', undefined, 'meetings'],
    ['Code', 'index.ts — accordio', undefined, 'development'],
    ['Xcode', 'MyApp.xcodeproj', undefined, 'development'],
    ['zoom.us', 'Zoom Meeting', undefined, 'meetings'],
    ['Figma', 'Untitled', undefined, 'design'],
    ['Linear', 'ACC-123', undefined, 'pm'],
    ['Google Chrome', '', 'https://meet.google.com/abc-defg-hij', 'meetings'],
    ['Google Chrome', '', 'https://github.com/x/y', 'development'],
    // Substring false positives the old matcher produced:
    ['Popclip', 'whatever', undefined, 'uncategorized'],
    ['Turnaround', 'whatever', undefined, 'uncategorized'],
  ];

  for (const [app, title, url, want] of cases) {
    expect(`${app} → ${want}`, categorizeActivity(app, title, url, APP_CATEGORIES), want);
  }
}

// ────────────────────────────────────────────────────────────────
// 3. Scoring
//
// The old scorer booked every timeline gap between 1 minute and 2 hours as a
// break AND added it to the denominator, so a dead tracker inflated Breaks and
// depressed Focus simultaneously.
// ────────────────────────────────────────────────────────────────
function testScoring(): void {
  const T0 = new Date('2026-07-20T09:00:00Z').getTime();
  const min = (n: number) => n * 60_000;

  section('Scoring — the reported bug');
  {
    // 40-minute Teams call; the user typed for 9 minutes and then listened.
    const entries = [{ category: 'messaging', startTime: T0, endTime: T0 + min(9), duration: 9 * 60 }];
    const meetings = [{ startTime: T0, endTime: T0 + min(40) }];
    const s = computeScores(entries, meetings, []);
    expectClose('the whole call counts as a meeting', s.meetingsMinutes, 40);
    expectClose('nothing is booked as a break', s.breaksMinutes, 0);
    expectClose('total is the call length', s.totalMinutes, 40);
  }

  section('Scoring — overlay, not suppression');
  {
    // Figma screen-shared inside the call keeps its attribution but must not
    // double-count against the meeting.
    const entries = [
      { category: 'design', startTime: T0 + min(10), endTime: T0 + min(30), duration: 20 * 60 },
      { category: 'development', startTime: T0 + min(40), endTime: T0 + min(70), duration: 30 * 60 },
    ];
    const meetings = [{ startTime: T0, endTime: T0 + min(40) }];
    const s = computeScores(entries, meetings, []);
    expectClose('meeting keeps its full length', s.meetingsMinutes, 40);
    expectClose('in-call app time is absorbed', s.focusMinutes, 30);
    expectClose('no double counting', s.totalMinutes, 70);
  }

  section('Scoring — gaps are not breaks');
  {
    const entries = [{ category: 'development', startTime: T0, endTime: T0 + min(60), duration: 60 * 60 }];
    const absences = [
      { start: T0 + min(60), end: T0 + min(75), reason: 'idle' as const },
      { start: T0 + min(75), end: T0 + min(135), reason: 'suspended' as const },
    ];
    const s = computeScores(entries, [], absences);
    expectClose('witnessed idle is a break', s.breaksMinutes, 15);
    expectClose('a sleeping Mac is untracked, not a break', s.untrackedMinutes, 60);
    expectClose('untracked is excluded from the denominator', s.totalMinutes, 75);
    expect('focus percent stays honest', s.focusPercent, 80);
  }

  section('Scoring — idle inside a call');
  {
    const entries = [{ category: 'messaging', startTime: T0, endTime: T0 + min(9), duration: 9 * 60 }];
    const meetings = [{ startTime: T0, endTime: T0 + min(40) }];
    const absences = [{ start: T0 + min(9), end: T0 + min(40), reason: 'idle' as const }];
    const s = computeScores(entries, meetings, absences);
    expectClose('listening in a call is not a break', s.breaksMinutes, 0);
    expectClose('the call is fully counted', s.meetingsMinutes, 40);
  }

  section('Scoring — legacy categories');
  {
    // Persisted entries may still carry the old 6-bucket vocabulary.
    const entries = [{ category: 'communication', startTime: T0, endTime: T0 + min(30), duration: 30 * 60 }];
    const s = computeScores(entries, [], []);
    expectClose('"communication" is work, not a break', s.breaksMinutes, 0);
    expectClose('and it still counts toward the total', s.totalMinutes, 30);
  }
}

// ────────────────────────────────────────────────────────────────
// 4. Meeting detection
// ────────────────────────────────────────────────────────────────
function testMeetingSignals(): void {
  section('Meeting signals — URLs');
  const urls: Array<[string, boolean]> = [
    ['https://meet.google.com/abc-defg-hij', true],
    ['https://meet.google.com/', false],
    ['https://zoom.us/j/1234567890', true],
    ['https://zoom.us/', false],
    ['https://teams.microsoft.com/l/meetup-join/19%3ameeting', true],
    ['https://whereby.com/my-room', true],
    ['https://github.com/anthropics/claude', false],
  ];
  for (const [url, want] of urls) {
    expect(url.slice(0, 48), __testing.urlIndicatesCall(url), want);
  }

  section('Meeting signals — window titles');
  expect('idle Zoom', __testing.zoomWindowIndicatesCall(['Zoom Workplace']), false);
  expect('in-call Zoom', __testing.zoomWindowIndicatesCall(['Zoom Workplace', 'Zoom Meeting']), true);
  expect('idle Teams', __testing.teamsWindowIndicatesCall(['Microsoft Teams']), false);
  expect('Teams on a chat thread', __testing.teamsWindowIndicatesCall(['Acme Corp | Microsoft Teams']), false);
  expect('Teams meeting stage', __testing.teamsWindowIndicatesCall(['Chat | Microsoft Teams', 'Weekly sync']), true);
}

async function testMeetingStateMachine(): Promise<void> {
  section('Meeting state machine');

  const d = new MeetingDetector({ activeTickMs: 10, idleTickMs: 10, confirmTicks: 2, holdMs: 100 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = d as any;

  let signalOn = false;
  any.detect = async () => (signalOn ? { source: 'zoom-window', appName: 'zoom.us' } : null);

  const started: unknown[] = [];
  const ended: Array<{ startTime: number; endTime: number }> = [];
  d.on('meetingStarted', (m) => started.push(m));
  d.on('meetingEnded', (m) => ended.push(m));

  any.running = true;
  any.scheduleNext = () => {}; // drive ticks manually

  signalOn = true;
  await any.tick();
  expect('one tick does not confirm a meeting', started.length, 0);

  signalOn = false;
  await any.tick();
  expect('an unsustained blip is discarded', started.length, 0);
  expect('  and resets to idle', any.state, 'idle');

  signalOn = true;
  await any.tick();
  const firstSighting = any.candidateSince;
  await any.tick();
  expect('two sustained ticks confirm', started.length, 1);
  expect('  start is backdated to first sighting', any.current.startTime, firstSighting);

  signalOn = false;
  await any.tick();
  expect('the hold window survives a signal blip', any.state, 'active');

  await sleep(120);
  await any.tick();
  expect('the meeting ends after the hold expires', ended.length, 1);
  expect('  ends at the last positive sighting', ended[0].endTime <= Date.now() - 100, true);
}

async function main(): Promise<void> {
  await testIdleRecovery();
  testCategorisation();
  testScoring();
  testMeetingSignals();
  await testMeetingStateMachine();
  report();
}

void main();
