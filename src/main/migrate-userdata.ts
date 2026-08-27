/**
 * One-time userData migration for the "Accordio AGI" → "Accordio AI" rename.
 *
 * Electron derives the userData directory from the product name, so without
 * this rename every existing install would come up empty after updating —
 * losing its auth tokens, settings, and unsynced time entries.
 *
 * MUST be imported before any module that touches userData at import time
 * (store.ts instantiates electron-store as a module side effect).
 */
import { app } from 'electron';
import path from 'path';
import * as fs from 'fs';

try {
  const appData = app.getPath('appData');
  const oldDir = path.join(appData, 'Accordio AGI');
  const newDir = path.join(appData, 'Accordio AI');
  if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
    fs.renameSync(oldDir, newDir);
  }
} catch {
  // Fresh install, or the rename failed (permissions/race) — the app still
  // boots with defaults rather than crashing before the window exists.
}
