/**
 * Minimal assertion harness.
 *
 * The app has no test framework and doesn't need one — these tests exist to
 * pin down the time-tracking regressions that shipped in v1.5.5 and would be
 * invisible again if they came back. Run with `npm test`.
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function section(name: string): void {
  console.log(`\n${name}`);
}

export function expect(label: string, got: unknown, want: unknown): void {
  const ok = Object.is(got, want);
  if (ok) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    const msg = `${label}: got ${String(got)}, want ${String(want)}`;
    failures.push(msg);
    console.log(`  FAIL ${msg}`);
  }
}

export function expectClose(label: string, got: number, want: number, tolerance = 0.01): void {
  const ok = Math.abs(got - want) <= tolerance;
  if (ok) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    const msg = `${label}: got ${got}, want ${want} (±${tolerance})`;
    failures.push(msg);
    console.log(`  FAIL ${msg}`);
  }
}

export function report(): void {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}
