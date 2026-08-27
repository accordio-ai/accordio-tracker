/**
 * Parse and format human durations for the correction UI.
 *
 * Accepts the shapes people actually type when fixing a mis-tracked entry:
 * "40m", "40", "1h15", "1h 15m", "1:15", "1.5h", "90 min".
 */

/** Returns seconds, or null when the input isn't a duration. */
export function parseDuration(input: string): number | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  // "1:15" / "1:15:30" — colon-separated h:m[:s]
  const colon = raw.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (colon) {
    const [, h, m, s] = colon;
    return Number(h) * 3600 + Number(m) * 60 + Number(s ?? 0);
  }

  // "1.5h" / "0.25 hours"
  const decimalHours = raw.match(/^(\d*\.\d+|\d+)\s*(?:h|hr|hrs|hour|hours)$/);
  if (decimalHours) {
    return Math.round(Number(decimalHours[1]) * 3600);
  }

  // "1h15", "1h 15m", "1h15m", "2h"
  const hm = raw.match(/^(\d+)\s*(?:h|hr|hrs|hour|hours)\s*(\d+)?\s*(?:m|min|mins|minute|minutes)?$/);
  if (hm) {
    return Number(hm[1]) * 3600 + Number(hm[2] ?? 0) * 60;
  }

  // "40m", "40 min", "90 minutes"
  const minutes = raw.match(/^(\d*\.\d+|\d+)\s*(?:m|min|mins|minute|minutes)$/);
  if (minutes) {
    return Math.round(Number(minutes[1]) * 60);
  }

  // "45s"
  const seconds = raw.match(/^(\d+)\s*(?:s|sec|secs|second|seconds)$/);
  if (seconds) {
    return Number(seconds[1]);
  }

  // A bare number means minutes — the unit people mean when correcting a
  // tracker that said "9" and should have said "40".
  const bare = raw.match(/^(\d*\.\d+|\d+)$/);
  if (bare) {
    return Math.round(Number(bare[1]) * 60);
  }

  return null;
}

/** "1h 15m", "40m", "45s" — the shape parseDuration round-trips. */
export function formatDurationInput(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
