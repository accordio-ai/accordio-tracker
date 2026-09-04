/**
 * Onboarding windows
 *
 * The first-run experience is not the menubar popover: it is a standalone,
 * centred window that opens over a blurred, lightened copy of the desktop,
 * the way a macOS setup assistant does. This module owns every window that
 * belongs to that experience:
 *
 *  - onboarding the 1200x750 setup window (traffic light close only)
 *  - dragHelper the floating "Drag Accordio to the list above" panel shown
 *               over System Settings; its app row is a native file drag of
 *               the .app bundle, so dropping it on the privacy list grants
 *               the permission without hunting through Finder
 *  - hotkeyHint the small "Open Accordio any time" card shown at the bottom
 *               of the screen once setup completes
 *
 * All three load the same renderer bundle and pick their surface from the
 * `window` query parameter (see renderer/main.tsx).
 */

import { app, BrowserWindow, screen, nativeImage, shell } from 'electron';
import path from 'path';
import logger from './logger';

export type DragHelperKind = 'accessibility' | 'screenRecording';

interface WindowDeps {
  preloadPath: string;
  iconPath: string;
  isAllowedExternalUrl: (url: string) => boolean;
  isAllowedNavigation: (url: string) => boolean;
}

let deps: WindowDeps | null = null;
let onboardingWindow: BrowserWindow | null = null;
let dragHelperWindow: BrowserWindow | null = null;
let hotkeyHintWindow: BrowserWindow | null = null;
let hotkeyHintTimer: ReturnType<typeof setTimeout> | null = null;

const ONBOARDING_WIDTH = 1200;
const ONBOARDING_HEIGHT = 750;

export function configureOnboardingWindows(d: WindowDeps) {
  deps = d;
}

function rendererEntry(query: Record<string, string>): { url?: string; file?: string; query: Record<string, string> } {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (!app.isPackaged && devUrl) {
    const u = new URL(devUrl);
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    return { url: u.toString(), query };
  }
  return { file: path.join(__dirname, '../renderer/index.html'), query };
}

function loadRenderer(win: BrowserWindow, query: Record<string, string>) {
  const entry = rendererEntry(query);
  if (entry.url) {
    void win.loadURL(entry.url);
  } else if (entry.file) {
    void win.loadFile(entry.file, { query });
  }
}

function baseWebPreferences() {
  return {
    preload: deps!.preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    nodeIntegrationInWorker: false,
  };
}

function hardenWindow(win: BrowserWindow) {
  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (deps?.isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (!deps?.isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });
  if (app.isPackaged) {
    wc.on('devtools-opened', () => wc.closeDevTools());
  }
}

/** Smoothly animate a window's opacity. Resolves when done. */
function fadeWindow(win: BrowserWindow, from: number, to: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const steps = Math.max(1, Math.round(durationMs / 16));
    let i = 0;
    win.setOpacity(from);
    const tick = setInterval(() => {
      i += 1;
      if (win.isDestroyed()) {
        clearInterval(tick);
        resolve();
        return;
      }
      const t = i / steps;
      const eased = 1 - Math.pow(1 - t, 3);
      win.setOpacity(from + (to - from) * eased);
      if (i >= steps) {
        clearInterval(tick);
        resolve();
      }
    }, 16);
  });
}

/* ── Onboarding window ───────────────────────────────────────────────── */

export function getOnboardingWindow(): BrowserWindow | null {
  return onboardingWindow && !onboardingWindow.isDestroyed() ? onboardingWindow : null;
}

export function isOnboardingOpen(): boolean {
  return getOnboardingWindow() !== null;
}

export async function openOnboardingWindow(): Promise<BrowserWindow> {
  if (!deps) throw new Error('configureOnboardingWindows() must run before openOnboardingWindow()');

  const existing = getOnboardingWindow();
  if (existing) {
    existing.show();
    existing.focus();
    return existing;
  }

  logger.log('[Onboarding] Opening setup window');

  // A menubar app normally has no Dock presence. Setup is a real window, so
  // give it one for the duration (Cmd+Tab, the app menu, a proper close).
  app.dock?.show().catch(() => { /* not fatal */ });

  const win = new BrowserWindow({
    width: ONBOARDING_WIDTH,
    height: ONBOARDING_HEIGHT,
    show: false,
    center: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Accordio',
    backgroundColor: '#ffffff',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      ...baseWebPreferences(),
      // The setup music starts with the window, before any click.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  onboardingWindow = win;
  hardenWindow(win);

  // Lets the renderer feel like a native sheet: no yellow/green lights.
  win.setWindowButtonVisibility(true);

  loadRenderer(win, { window: 'onboarding' });

  win.on('closed', () => {
    onboardingWindow = null;
    hideDragHelper();
    app.dock?.hide();
  });

  await new Promise<void>((resolve) => {
    if (win.isDestroyed()) return resolve();
    win.once('ready-to-show', () => resolve());
  });
  if (win.isDestroyed()) return win;

  win.setOpacity(0);
  win.show();
  win.focus();
  await fadeWindow(win, 0, 1, 360);

  return win;
}

export function closeOnboardingWindows() {
  const win = getOnboardingWindow();
  if (win) win.close();
  hideDragHelper();
}

/* ── Drag helper (System Settings companion) ─────────────────────────── */

export function showDragHelper(kind: DragHelperKind) {
  if (!deps) return;
  hideDragHelper();

  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const w = 520;
  const h = 132;

  const win = new BrowserWindow({
    width: w,
    height: h,
    x: Math.round(x + (width - w) / 2),
    y: Math.round(y + height - h - 28),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // Never steal focus from System Settings: the panel only needs mouse
    // events for its drag row and close button.
    focusable: false,
    alwaysOnTop: true,
    webPreferences: baseWebPreferences(),
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hardenWindow(win);
  loadRenderer(win, { window: 'drag-helper', kind });
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    win.showInactive();
  });
  win.on('closed', () => {
    if (dragHelperWindow === win) dragHelperWindow = null;
  });
  dragHelperWindow = win;
}

export function hideDragHelper() {
  if (dragHelperWindow && !dragHelperWindow.isDestroyed()) {
    dragHelperWindow.close();
  }
  dragHelperWindow = null;
}

/** Path of the running .app bundle — what gets dropped on the privacy list. */
export function appBundlePath(): string {
  if (process.platform !== 'darwin') return process.execPath;
  // .../Accordio AI.app/Contents/MacOS/Accordio AI → .../Accordio AI.app
  // In development this resolves to Electron.app, which is exactly the
  // binary macOS needs to trust for the dev build.
  return path.resolve(process.execPath, '..', '..', '..');
}

export function appDragIcon() {
  const icon = nativeImage.createFromPath(deps?.iconPath ?? '');
  return icon.isEmpty() ? icon : icon.resize({ width: 64, height: 64 });
}

/* ── Hotkey hint ─────────────────────────────────────────────────────── */

export function showHotkeyHint(shortcut: string, autoHideMs = 9000) {
  if (!deps) return;
  hideHotkeyHint();

  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const w = 320;
  const h = 184;

  const win = new BrowserWindow({
    width: w,
    height: h,
    x: Math.round(x + (width - w) / 2),
    y: Math.round(y + height - h - 24),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    webPreferences: baseWebPreferences(),
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hardenWindow(win);
  loadRenderer(win, { window: 'hotkey-hint', shortcut });
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    win.setOpacity(0);
    win.showInactive();
    void fadeWindow(win, 0, 1, 260);
  });
  win.on('closed', () => {
    if (hotkeyHintWindow === win) hotkeyHintWindow = null;
  });
  hotkeyHintWindow = win;

  hotkeyHintTimer = setTimeout(() => hideHotkeyHint(), autoHideMs);
}

export function hideHotkeyHint() {
  if (hotkeyHintTimer) {
    clearTimeout(hotkeyHintTimer);
    hotkeyHintTimer = null;
  }
  const win = hotkeyHintWindow;
  hotkeyHintWindow = null;
  if (win && !win.isDestroyed()) {
    void fadeWindow(win, win.getOpacity(), 0, 200).then(() => {
      if (!win.isDestroyed()) win.close();
    });
  }
}

/** Send to every onboarding-family renderer that is alive. */
export function sendToOnboardingWindows(channel: string, ...args: unknown[]) {
  for (const win of [onboardingWindow, dragHelperWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}
