/**
 * The duration parser behind click-to-edit. This is the affordance that
 * directly answers "Teams says 9m, it was 40m", so it has to accept whatever
 * shape the user types without silently misreading it.
 */

import { section, expect, report } from './harness';
import { parseDuration, formatDurationInput } from '../src/shared/duration';

section('parseDuration');
const cases: Array<[string, number | null]> = [
  ['40m', 40 * 60],
  ['40', 40 * 60],          // bare number means minutes
  ['1h15', 75 * 60],
  ['1h 15m', 75 * 60],
  ['1h15m', 75 * 60],
  ['2h', 120 * 60],
  ['1:15', 75 * 60],
  ['0:45', 45 * 60],
  ['1:15:30', 75 * 60 + 30],
  ['1.5h', 90 * 60],
  ['90 min', 90 * 60],
  ['90 minutes', 90 * 60],
  ['45s', 45],
  ['  40m  ', 40 * 60],
  ['40M', 40 * 60],
  // Rejections — must not silently produce a number.
  ['', null],
  ['abc', null],
  ['1:99', null],
  ['h', null],
  ['--5', null],
];
for (const [input, want] of cases) {
  expect(`"${input}"`, parseDuration(input), want);
}

section('formatDurationInput round-trips');
for (const seconds of [45, 60, 600, 40 * 60, 75 * 60, 120 * 60]) {
  const formatted = formatDurationInput(seconds);
  expect(`${seconds}s → "${formatted}" → back`, parseDuration(formatted), seconds);
}

report();
