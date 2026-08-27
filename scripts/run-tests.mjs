#!/usr/bin/env node
/**
 * Bundles each tests/*.test.ts with esbuild (aliasing `electron` to a stub so
 * main-process modules load under plain node) and runs it.
 *
 * Deliberately not a test framework: the app ships no runtime test deps, and
 * these tests exist to pin specific regressions rather than to grow into a
 * suite that needs one.
 */

import { readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const testsDir = join(root, 'tests');
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

const files = readdirSync(testsDir).filter((f) => f.endsWith('.test.ts'));
if (files.length === 0) {
  console.log('No tests found.');
  process.exit(0);
}

const outDir = mkdtempSync(join(tmpdir(), 'accordio-tests-'));
let failed = 0;

try {
  for (const file of files) {
    const out = join(outDir, file.replace(/\.ts$/, '.js'));
    execFileSync(
      esbuild,
      [
        join(testsDir, file),
        '--bundle',
        '--platform=node',
        '--format=cjs',
        `--outfile=${out}`,
        `--alias:electron=${join(testsDir, 'stubs', 'electron')}`,
        '--external:active-win',
        '--external:file-icon',
        '--log-level=warning',
      ],
      { stdio: 'inherit' }
    );

    console.log(`\n─── ${file} ───`);
    try {
      execFileSync(process.execPath, [out], { stdio: 'inherit' });
    } catch {
      failed++;
    }
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

process.exit(failed > 0 ? 1 : 0);
