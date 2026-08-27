/**
 * Shared activity taxonomy and scoring.
 *
 * MIRRORS `Accordio/lib/activity-ai.ts` (the web app's canonical definition).
 * These two files must agree — if they drift, the menubar app and the /time
 * page report different numbers for the same day, which is exactly the bug
 * this module exists to prevent. `npm run check:categories` diffs them.
 *
 * Importable from both the main and renderer processes — keep it free of
 * Electron and Node APIs.
 */

export type ActivityCategory =
  // Focus (deep work)
  | 'development'
  | 'design'
  | 'writing'
  | 'research'
  // Work (shallow work)
  | 'email'
  | 'messaging'
  | 'meetings'
  | 'pm'
  | 'finance'
  // Non-work
  | 'social'
  | 'entertainment'
  | 'personal'
  | 'utilities'
  // Catch-all
  | 'uncategorized';

export const ALL_CATEGORIES: ActivityCategory[] = [
  'development', 'design', 'writing', 'research',
  'email', 'messaging', 'meetings', 'pm', 'finance',
  'social', 'entertainment', 'personal', 'utilities',
  'uncategorized',
];

/** Focus categories — count toward the Focus score. */
export const FOCUS_CATEGORIES = new Set<ActivityCategory>([
  'development', 'design', 'writing', 'research',
]);

/** Work categories — count toward Work Hours but not Focus. */
export const WORK_CATEGORIES = new Set<ActivityCategory>([
  'development', 'design', 'writing', 'research',
  'email', 'messaging', 'meetings', 'pm', 'finance',
]);

/** Non-work / break categories. */
export const BREAK_CATEGORIES = new Set<ActivityCategory>([
  'entertainment', 'social', 'personal',
]);

export const CATEGORY_META: Record<ActivityCategory, { label: string; color: string; focus: boolean }> = {
  development:   { label: 'Development',        color: '#3b82f6', focus: true },
  design:        { label: 'Design',             color: '#ec4899', focus: true },
  writing:       { label: 'Writing & Docs',     color: '#14b8a6', focus: true },
  research:      { label: 'Research',           color: '#6366f1', focus: true },
  email:         { label: 'Email',              color: '#f97316', focus: false },
  messaging:     { label: 'Messaging',          color: '#8b5cf6', focus: false },
  meetings:      { label: 'Meetings',           color: '#a855f7', focus: false },
  pm:            { label: 'Project Management', color: '#22c55e', focus: false },
  finance:       { label: 'Finance & Admin',    color: '#64748b', focus: false },
  social:        { label: 'Social Media',       color: '#f43f5e', focus: false },
  entertainment: { label: 'Entertainment',      color: '#ef4444', focus: false },
  personal:      { label: 'Personal',           color: '#78716c', focus: false },
  utilities:     { label: 'Utilities',          color: '#94a3b8', focus: false },
  uncategorized: { label: 'Uncategorized',      color: '#6b7280', focus: false },
};

const LEGACY_CATEGORY_MAP: Record<string, ActivityCategory> = {
  communication: 'messaging',
  documentation: 'writing',
  admin: 'pm',
  other: 'uncategorized',
  browsers: 'uncategorized',
  productivity: 'pm',
  code: 'development',
};

export function normalizeCategory(raw: string | null | undefined): ActivityCategory {
  if (!raw) return 'uncategorized';
  const lower = raw.toLowerCase().trim();
  if (ALL_CATEGORIES.includes(lower as ActivityCategory)) return lower as ActivityCategory;
  return LEGACY_CATEGORY_MAP[lower] ?? 'uncategorized';
}

// ============================================
// Scoring
// ============================================

export interface ScorableEntry {
  category: string;
  /** Epoch ms. */
  startTime: number;
  /** Epoch ms. */
  endTime: number;
  /** Seconds. */
  duration: number;
}

export interface ScorableMeeting {
  /** Epoch ms. */
  startTime: number;
  /** Epoch ms. */
  endTime: number;
}

export type AbsenceReason = 'idle' | 'locked' | 'suspended';

export interface ScorableAbsence {
  start: number;
  end: number;
  reason: AbsenceReason;
}

/** Same shape, named for the transport layer (IPC / main process). */
export type AbsenceRecord = ScorableAbsence;

export interface Scores {
  /** Minutes. */
  focusMinutes: number;
  meetingsMinutes: number;
  breaksMinutes: number;
  /** Time the tracker could not account for. Excluded from the denominator. */
  untrackedMinutes: number;
  /** Denominator for the percentages — excludes untracked time. */
  totalMinutes: number;
  focusPercent: number;
  meetingsPercent: number;
  breaksPercent: number;
}

/** Total overlap between [aStart,aEnd] and a list of intervals, in ms. */
function overlapMs(aStart: number, aEnd: number, intervals: Array<{ startTime: number; endTime: number }>): number {
  let total = 0;
  for (const b of intervals) {
    const start = Math.max(aStart, b.startTime);
    const end = Math.min(aEnd, b.endTime);
    if (end > start) total += end - start;
  }
  return total;
}

/** Merge overlapping intervals so shared time is never counted twice. */
function mergeIntervals(intervals: Array<{ startTime: number; endTime: number }>): Array<{ startTime: number; endTime: number }> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startTime - b.startTime);
  const out: Array<{ startTime: number; endTime: number }> = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].startTime <= last.endTime) {
      last.endTime = Math.max(last.endTime, sorted[i].endTime);
    } else {
      out.push({ ...sorted[i] });
    }
  }
  return out;
}

/**
 * The single source of Focus / Meetings / Breaks. Every surface must call this
 * — three divergent copies used to exist and disagreed on the same day.
 *
 * Two rules distinguish it from what came before:
 *
 * 1. **Meetings win over app attribution.** A detected call is authoritative
 *    for its whole interval; overlapping app time is subtracted from the other
 *    buckets so screen-sharing Figma during a review doesn't double-count.
 * 2. **Gaps are not breaks.** Only an absence the monitor witnessed both ends
 *    of, with reason 'idle', counts as a break. A hole in the timeline could
 *    equally be a dead tracker, a quit app, or a revoked permission — the old
 *    code called all of them "break" and added them to the denominator, which
 *    inflated Breaks and depressed Focus at the same time.
 */
export function computeScores(
  entries: ScorableEntry[],
  meetings: ScorableMeeting[] = [],
  absences: ScorableAbsence[] = []
): Scores {
  const entryInterval = (e: ScorableEntry) => ({
    startTime: e.startTime,
    // Prefer explicit timestamps; fall back to duration for entries whose
    // endTime hasn't been finalized yet.
    endTime: e.endTime > e.startTime ? e.endTime : e.startTime + e.duration * 1000,
  });

  // Meeting time is the union of detected calls and meetings-categorised
  // entries. Detection is best-effort; an explicit category is also real
  // evidence, so neither alone is authoritative.
  const categorised = entries
    .filter(e => normalizeCategory(e.category) === 'meetings')
    .map(entryInterval);
  const meetingIntervals = mergeIntervals([...meetings, ...categorised]);
  const meetingsMs = meetingIntervals.reduce((sum, i) => sum + (i.endTime - i.startTime), 0);

  let focusMs = 0;
  let breaksMs = 0;
  let otherWorkMs = 0;

  for (const entry of entries) {
    const category = normalizeCategory(entry.category);
    if (category === 'meetings') continue; // already counted above

    const { startTime: start, endTime: end } = entryInterval(entry);
    // Time already claimed by a meeting belongs to the meeting bucket only.
    const remaining = Math.max(0, end - start - overlapMs(start, end, meetingIntervals));
    if (remaining === 0) continue;

    if (FOCUS_CATEGORIES.has(category)) focusMs += remaining;
    else if (BREAK_CATEGORIES.has(category)) breaksMs += remaining;
    else otherWorkMs += remaining;
  }

  // Witnessed idle is a real break. Locked/suspended is untracked, not leisure.
  let untrackedMs = 0;
  for (const a of absences) {
    const span = Math.max(0, a.end - a.start);
    // An absence overlapping a live call isn't a break — the user was in a
    // meeting, just not typing.
    const outside = Math.max(0, span - overlapMs(a.start, a.end, meetingIntervals));
    if (a.reason === 'idle') breaksMs += outside;
    else untrackedMs += outside;
  }

  const toMin = (ms: number) => ms / 60000;
  const focusMinutes = toMin(focusMs);
  const meetingsMinutes = toMin(meetingsMs);
  const breaksMinutes = toMin(breaksMs);
  const untrackedMinutes = toMin(untrackedMs);
  // Untracked time is deliberately NOT in the denominator — including it would
  // make every percentage shrink for reasons the user can't see.
  const totalMinutes = focusMinutes + meetingsMinutes + breaksMinutes + toMin(otherWorkMs);

  const pct = (n: number) => (totalMinutes > 0 ? Math.round((n / totalMinutes) * 100) : 0);

  return {
    focusMinutes,
    meetingsMinutes,
    breaksMinutes,
    untrackedMinutes,
    totalMinutes,
    focusPercent: pct(focusMinutes),
    meetingsPercent: pct(meetingsMinutes),
    breaksPercent: pct(breaksMinutes),
  };
}
