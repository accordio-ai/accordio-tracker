/**
 * Dev-only: run a development build side by side with the installed app.
 *
 * Both default to the same userData folder, and both the single-instance lock
 * and every electron-store file live there. Imported first by main/index.ts so
 * the path is switched before any store module constructs its Store — an
 * override that runs later silently reads (and writes!) the installed app's
 * settings and tokens.
 */
import { app } from 'electron';

if (!app.isPackaged && process.env.ACCORDIO_USER_DATA_DIR) {
  app.setPath('userData', process.env.ACCORDIO_USER_DATA_DIR);
}
