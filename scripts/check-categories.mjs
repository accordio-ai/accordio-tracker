#!/usr/bin/env node
/**
 * Guards against taxonomy drift between the desktop app and the web app.
 *
 * `src/shared/categories.ts` is a hand-mirrored copy of the canonical
 * definition in `Accordio/lib/activity-ai.ts`. When they disagree, the menubar
 * app and the /time page report different Focus/Meetings/Breaks numbers for
 * the same day — the exact class of bug this mirror exists to prevent.
 *
 * Compares the taxonomy constants only (the files legitimately differ
 * elsewhere: the web copy carries AI enrichment, the desktop copy carries
 * scoring). Exits 0 and skips when the sibling repo isn't checked out, so an
 * isolated clone still builds.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const LOCAL = resolve(here, '../src/shared/categories.ts');
const CANONICAL = resolve(here, '../../Accordio/lib/activity-ai.ts');

if (!existsSync(CANONICAL)) {
  console.log('[check-categories] Accordio/lib/activity-ai.ts not found — skipping drift check.');
  process.exit(0);
}

/** Pull the quoted string literals out of a named array or Set declaration. */
function extractList(source, name) {
  // Matches `export const NAME ... = [ ... ]` or `= new Set<...>([ ... ])`
  const re = new RegExp(`export const ${name}[^=]*=\\s*(?:new Set<[^>]*>\\()?\\[([\\s\\S]*?)\\]`, 'm');
  const match = source.match(re);
  if (!match) return null;
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
}

const local = readFileSync(LOCAL, 'utf8');
const canonical = readFileSync(CANONICAL, 'utf8');

const NAMES = ['ALL_CATEGORIES', 'FOCUS_CATEGORIES', 'WORK_CATEGORIES', 'BREAK_CATEGORIES'];
let failed = false;

for (const name of NAMES) {
  const a = extractList(local, name);
  const b = extractList(canonical, name);

  if (!a || !b) {
    console.error(`[check-categories] Could not parse ${name} from ${!a ? 'src/shared/categories.ts' : 'Accordio/lib/activity-ai.ts'}`);
    failed = true;
    continue;
  }

  if (a.join(',') !== b.join(',')) {
    console.error(`[check-categories] DRIFT in ${name}`);
    console.error(`  desktop: ${a.join(', ')}`);
    console.error(`  web:     ${b.join(', ')}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nTaxonomy drift detected. Update src/shared/categories.ts to match Accordio/lib/activity-ai.ts.');
  process.exit(1);
}

console.log('[check-categories] Taxonomy matches the web app.');
