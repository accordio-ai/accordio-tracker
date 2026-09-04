/**
 * Accordio AI Menu Bar App
 *
 * Main process entry point for the Electron menu bar application.
 */

// Must stay the first import: switches userData before any store is built.
import './dev-user-data';
import { initSentry, captureException, setUser, addBreadcrumb } from './sentry';

import { app, globalShortcut, ipcMain, nativeImage, nativeTheme, systemPreferences, dialog, shell, Menu, powerMonitor, desktopCapturer } from 'electron';
import { menubar } from 'menubar';
import path from 'path';
import * as fs from 'fs';
import { autoUpdater } from 'electron-updater';
import logger from './logger';
import { getToken, setToken, getRefreshToken, setRefreshToken, clearRefreshToken, getTokenExpiry, setTokenExpiry, clearAllTokens } from './auth';
import {
  store,
  DEFAULT_API_URL,
  getTimeTrackingSettings,
  setTimeTrackingSettings,
  getActiveTaskSettings,
  setActiveTaskSettings,
  getMemories,
  addMemory,
  deleteMemory,
  setMemories,
} from './store';
import { AGIApiClient, ApiError } from './api';
import {
  configureOnboardingWindows,
  openOnboardingWindow,
  closeOnboardingWindows,
  isOnboardingOpen,
  showDragHelper,
  hideDragHelper,
  appBundlePath,
  appDragIcon,
  showHotkeyHint,
  hideHotkeyHint,
  sendToOnboardingWindows,
} from './onboarding-windows';

/** Why a `projects:list` call failed — lets the renderer say something true. */
type ProjectsListErrorCode =
  | 'not_authenticated'
  | 'auth_expired'
  | 'server_error'
  | 'network_error';
import { createActivityMonitor, getActivityMonitor, ActivityMonitorOptions } from './activity-monitor';
import { createTimeTracker, getTimeTracker } from './time-tracker';
import { createMeetingDetector, getMeetingDetector, isTabCapableBrowser, type MeetingSession } from './meeting-detector';

// Global error handlers to prevent crashes from WebSocket connection failures
process.on('uncaughtException', (error) => {
  logger.error('[Main] Uncaught exception:', error.message);

  // Capture in Sentry (filtered errors are handled in sentry.ts beforeSend)
  captureException(error, {
    tags: { 'error.type': 'uncaughtException' },
    level: 'error',
  });

  // Don't exit - the app can continue even if gateway connection fails
  if (error.message.includes('Unexpected server response') || error.message.includes('ECONNREFUSED')) {
    logger.log('[Main] Gateway connection failed, will retry...');
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('[Main] Unhandled rejection:', String(reason));

  // Capture in Sentry
  captureException(reason instanceof Error ? reason : new Error(String(reason)), {
    tags: { 'error.type': 'unhandledRejection' },
    level: 'error',
  });
});

// Dev-only: expose CDP so the renderer can be inspected/screenshotted while QA'ing
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9223');
  // Unsigned dev binaries can't reuse the "Electron Safe Storage" Keychain
  // item another dev build created, so macOS asks for the login password on
  // every fresh profile. The mock keychain sidesteps that in development;
  // packaged builds are signed and open their own item silently.
  app.commandLine.appendSwitch('use-mock-keychain');
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mb: ReturnType<typeof menubar> | null = null;
let apiClient: AGIApiClient | null = null;
let activeShortcut: string | null = null;

/**
 * Events the popover and the setup window both care about (permission
 * changes, session expiry). The setup window lives in its own BrowserWindow,
 * so a send to `mb.window` alone would never reach it.
 */
const sendToRenderers = (channel: string, ...args: unknown[]) => {
  mb?.window?.webContents.send(channel, ...args);
  sendToOnboardingWindows(channel, ...args);
};

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedNavigation(rawUrl: string): boolean {
  if (rawUrl.startsWith('file://')) {
    return true;
  }
  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    try {
      const devUrl = new URL(process.env.VITE_DEV_SERVER_URL);
      const target = new URL(rawUrl);
      return devUrl.origin === target.origin;
    } catch {
      return false;
    }
  }
  return false;
}

// Helper to get correct asset path for both dev and production
const getAssetPath = (assetName: string): string => {
  if (app.isPackaged) {
    // Production: assets are in Resources/assets via extraResources
    return path.join(process.resourcesPath, 'assets', assetName);
  }
  // Development: assets are relative to project root
  return path.join(__dirname, '../../assets', assetName);
};

const registerToggleShortcut = (shortcut: string): boolean => {
  if (!mb) return false;
  const menubarInstance = mb;

  if (activeShortcut) {
    globalShortcut.unregister(activeShortcut);
  }

  const registered = globalShortcut.register(shortcut, () => {
    hideHotkeyHint();
    if (menubarInstance.window?.isVisible()) {
      menubarInstance.hideWindow();
    } else {
      menubarInstance.showWindow();
    }
  });

  if (registered) {
    activeShortcut = shortcut;
  }

  return registered;
};

const createMenubar = () => {
  const iconPath = getAssetPath('iconTemplate.png');
  logger.log('[Accordio AGI] Loading menu bar icon from:', iconPath);
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true); // Required for macOS menu bar to handle light/dark mode

  mb = menubar({
    index: process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, '../renderer/index.html')}`,
    icon,
    preloadWindow: true,
    browserWindow: {
      width: 400,
      height: 500,
      minWidth: 320,
      minHeight: 400,
      maxWidth: 600,
      maxHeight: 800,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        // SECURITY: Additional hardening for production
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        nodeIntegrationInWorker: false,
      },
      resizable: true,
      skipTaskbar: true,
      alwaysOnTop: false,
    },
    showDockIcon: false,
  });

  configureOnboardingWindows({
    preloadPath: path.join(__dirname, '../preload/index.js'),
    iconPath: getAssetPath('icon.png'),
    isAllowedExternalUrl,
    isAllowedNavigation,
  });

  mb.on('ready', () => {
    logger.log('[Accordio AGI] Ready');
    addBreadcrumb({ category: 'app', message: 'Menubar ready', level: 'info' });

    // Crash recovery: track startup crashes to prevent boot loops
    const lastStartup = store.get('lastStartupTime' as never) as number | undefined;
    const crashCount = (store.get('crashCount' as never) as number) || 0;
    const now = Date.now();

    if (lastStartup && (now - lastStartup) < 30_000) {
      // App crashed within 30s of last startup
      store.set('crashCount' as never, crashCount + 1);
    } else {
      store.set('crashCount' as never, 0);
    }
    store.set('lastStartupTime' as never, now);

    if (crashCount >= 3) {
      logger.error('[CrashRecovery] Detected 3+ consecutive crashes, offering reset');
      dialog.showMessageBox({
        type: 'warning',
        title: 'Accordio AI - Startup Issue',
        message: 'Accordio AI has crashed multiple times on startup.',
        detail: 'Would you like to reset settings to defaults? This may fix the issue.',
        buttons: ['Reset Settings', 'Try Again'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) {
          store.clear();
          store.set('crashCount' as never, 0);
          logger.log('[CrashRecovery] Settings reset');
        }
      });
    }

    // Mark successful startup after 30s
    setTimeout(() => {
      store.set('crashCount' as never, 0);
    }, 30_000);

    const shortcut = (store.get('globalShortcut') as string) || 'CommandOrControl+Shift+A';
    const registered = registerToggleShortcut(shortcut);

    if (!registered) {
      logger.error('Failed to register global shortcut');
    } else {
      logger.log(`[Shortcut] Registered: ${shortcut}`);
    }

    // Right-click context menu only (left-click opens the app window via menubar library)
    mb!.tray.on('right-click', () => {
      const isStartAtLogin = Boolean(store.get('startAtLogin'));
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open at Login',
          type: 'checkbox',
          checked: isStartAtLogin,
          click: (menuItem) => {
            const enabled = menuItem.checked;
            store.set('startAtLogin', enabled);
            app.setLoginItemSettings({ openAtLogin: enabled });
            logger.log(`[Settings] Open at Login: ${enabled}`);
          },
        },
        { type: 'separator' },
        {
          label: 'Quit Accordio',
          accelerator: 'CommandOrControl+Q',
          click: () => {
            app.quit();
          },
        },
      ]);
      mb!.tray.popUpContextMenu(contextMenu);
    });

    // Initialize API client with stored token
    initializeApiClient();

    // Re-validate auth when Mac wakes from sleep (setTimeout is unreliable across sleep)
    powerMonitor.on('resume', () => {
      logger.log('[Auth] System resumed from sleep, checking token validity...');
      addBreadcrumb({ category: 'auth', message: 'System resumed, re-validating session', level: 'info' });

      // Small delay to let network reconnect after wake
      setTimeout(async () => {
        const token = await getToken();
        const refreshToken = await getRefreshToken();

        if (!token && !refreshToken) {
          logger.log('[Auth] No tokens after resume, user needs to sign in');
          return;
        }

        const expiry = getTokenExpiry();
        const isExpired = expiry && Date.now() >= expiry - 60_000;

        if (isExpired || !token) {
          logger.log('[Auth] Token expired during sleep, refreshing...');
          await handleSessionRefresh();
        } else {
          // Token still valid — reschedule refresh based on remaining time
          if (expiry) {
            const remainingSeconds = Math.floor((expiry - Date.now()) / 1000);
            logger.log(`[Auth] Token still valid after resume, ${remainingSeconds}s remaining`);
            scheduleTokenRefresh(remainingSeconds);
          }
        }
      }, 3000);
    });

    // Initialize time tracking if enabled
    initializeTimeTracking();

    // Start permission polling to detect changes and prompt for restart
    startPermissionPolling();

    void routeFirstRun();
  });

  mb.on('after-show', () => {
    // Focus the window when shown
    mb?.window?.focus();

    // Refresh key data when window becomes visible (covers web<->desktop switches)
    if (apiClient) {
      apiClient.getCredits().then((credits) => {
        mb?.window?.webContents.send('credits:updated', {
          creditsUsed: credits.monthly_allocation - credits.credit_balance,
          creditsRemaining: credits.credit_balance,
        });
      }).catch(() => { /* silent */ });
    }
  });

  mb.on('after-create-window', () => {
    // Prevent window from hiding when cursor moves to the macOS menu bar.
    // The menubar library hides on blur, but moving to the system menu bar steals focus
    // and triggers blur — which is annoying. Instead, we handle hide manually:
    // the window hides when the tray icon is clicked again or the user presses Escape.
    if (mb?.window) {
      // Remove the default blur-to-hide behavior
      mb.window.removeAllListeners('blur');

      // Only hide when clicking outside the window area (not on menu bar focus loss)
      mb.window.on('blur', () => {
        // Small delay to check if focus went to our tray icon (which should toggle, not double-hide)
        setTimeout(() => {
          if (mb?.window && !mb.window.isFocused() && !mb.window.isDestroyed()) {
            // Check if cursor is near the window — don't hide if it's just touching the menu bar
            const bounds = mb.window.getBounds();
            const cursorPos = require('electron').screen.getCursorScreenPoint();
            const isNearWindow =
              cursorPos.x >= bounds.x - 20 &&
              cursorPos.x <= bounds.x + bounds.width + 20 &&
              cursorPos.y >= bounds.y - 40 && // Extra margin at top for menu bar
              cursorPos.y <= bounds.y + bounds.height + 20;

            if (!isNearWindow) {
              mb.hideWindow();
            }
          }
        }, 150);
      });
    }

    const webContents = mb?.window?.webContents;
    if (webContents) {
      webContents.setWindowOpenHandler(({ url }) => {
        if (isAllowedExternalUrl(url)) {
          shell.openExternal(url);
        }
        return { action: 'deny' };
      });

      webContents.on('will-navigate', (event, url) => {
        if (!isAllowedNavigation(url)) {
          event.preventDefault();
        }
      });
    }

    // SECURITY: Only allow DevTools in development builds
    if (!app.isPackaged) {
      // Prevent window from hiding when DevTools is open in dev mode
      mb?.window?.webContents.on('devtools-opened', () => {
        mb?.window?.setAlwaysOnTop(true);
      });

      mb?.window?.webContents.on('devtools-closed', () => {
        mb?.window?.setAlwaysOnTop(false);
      });
    } else {
      // SECURITY: Disable DevTools in production
      mb?.window?.webContents.on('devtools-opened', () => {
        mb?.window?.webContents.closeDevTools();
      });
    }
  });
};

/**
 * Decide what the user sees on launch: the setup window (signed out, or setup
 * never finished) or nothing until they click the tray icon.
 */
const routeFirstRun = async () => {
  const token = await getToken();

  // Installs that predate the setup window are already signed in and
  // configured — never replay setup at them on update.
  if (token && store.get('onboardingCompleted') === undefined) {
    store.set('onboardingCompleted', true);
  }

  if (store.get('resumeAfterRelaunch')) {
    store.delete('resumeAfterRelaunch');
    mb?.showWindow();
    showHotkeyHint(store.get('globalShortcut') || 'CommandOrControl+Shift+A');
    return;
  }

  const forced = process.env.ACCORDIO_FORCE_ONBOARDING === '1';
  if (forced || !token || !store.get('onboardingCompleted')) {
    try {
      await openOnboardingWindow();
    } catch (error) {
      logger.error('[Onboarding] Failed to open setup window:', error);
    }
  }
};

/**
 * Handle session refresh when token expires (401) or proactively before expiry.
 * Tries refresh token first, then notifies renderer to re-login.
 */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let isRefreshing = false; // Guard against concurrent refresh attempts
let lastSessionExpiredSent = 0; // Debounce rapid logout events

const handleSessionRefresh = async () => {
  // Prevent concurrent refresh attempts (e.g. multiple 401s at once)
  if (isRefreshing) {
    logger.log('[Auth] Refresh already in progress, skipping');
    return;
  }
  isRefreshing = true;

  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      // Long-lived menubar JWTs (issued by /api/auth/device/authorize when a
      // signing secret is set) deliberately ship without a refresh token because
      // the 30-day JWT is meant to outlive the Supabase refresh dance. A single
      // 401 in that mode (transient network hiccup, post-sleep race, brief Vercel
      // error) was nuking the session overnight even though the JWT was still
      // valid. Treat the 401 as transient while the access token is still inside
      // its expiry window; only log out once the JWT itself has expired.
      const currentToken = await getToken();
      const expiry = getTokenExpiry();
      if (currentToken && expiry && Date.now() < expiry - 60_000) {
        logger.warn('[Auth] 401 received but stored token still valid by expiry — treating as transient, not logging out');
        return;
      }

      const now = Date.now();
      if (now - lastSessionExpiredSent < 5000) {
        logger.log('[Auth] No refresh token, but sessionExpired already sent recently');
        return;
      }
      logger.log('[Auth] No refresh token and token expired, notifying renderer to re-login');
      lastSessionExpiredSent = now;
      sendToRenderers('auth:sessionExpired');
      return;
    }

    const apiUrl = store.get('apiUrl') || DEFAULT_API_URL;

    // Try up to 3 times (initial + 2 retries) with increasing delays
    let refreshTokenRejected = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          const delay = attempt * 3000; // 3s, 6s
          logger.log(`[Auth] Retry ${attempt} for token refresh in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          logger.log('[Auth] Attempting token refresh...');
        }

        const response = await fetch(`${apiUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.token) {
            await setToken(data.token);
            if (data.refreshToken) {
              await setRefreshToken(data.refreshToken);
            }
            // Track expiry for proactive refresh (default 1hr if not provided)
            const expiresIn = data.expiresIn || 3600;
            setTokenExpiry(Date.now() + expiresIn * 1000);
            // Schedule next refresh 5 minutes before expiry
            scheduleTokenRefresh(expiresIn);

            // Update API client with new token
            apiClient = new AGIApiClient(apiUrl, data.token);
            apiClient.onSessionExpired = () => handleSessionRefresh();
            getTimeTracker()?.updateSettings({ token: data.token, apiUrl });
            logger.log('[Auth] Token refreshed successfully, next refresh in', Math.round(expiresIn - 300), 's');
            return;
          }
        }

        // 401 means refresh token is truly invalid — don't retry
        if (response.status === 401) {
          logger.log('[Auth] Refresh token rejected (401), not retrying');
          refreshTokenRejected = true;
          break;
        }
      } catch (error) {
        logger.error(`[Auth] Token refresh attempt ${attempt} failed:`, error);
        // Network errors are transient — keep retrying
      }
    }

    // Only clear refresh token if server explicitly rejected it (401)
    // For network errors, keep the token so we can retry later (e.g. after sleep/wake)
    if (refreshTokenRejected) {
      await clearRefreshToken();
      const now = Date.now();
      if (now - lastSessionExpiredSent < 5000) {
        logger.log('[Auth] Refresh rejected, but sessionExpired already sent recently');
        return;
      }
      lastSessionExpiredSent = now;
      logger.log('[Auth] Refresh token invalid, notifying renderer to re-login');
      sendToRenderers('auth:sessionExpired');
    } else {
      // Network failure — schedule a retry in 30s instead of logging out
      logger.log('[Auth] Refresh failed due to network, will retry in 30s');
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        handleSessionRefresh();
      }, 30_000);
    }
  } finally {
    isRefreshing = false;
  }
};

/**
 * Schedule proactive token refresh before expiry.
 * Refreshes 5 minutes before the access token expires so the user never sees a 401.
 */
const scheduleTokenRefresh = (expiresInSeconds: number) => {
  if (refreshTimer) clearTimeout(refreshTimer);

  // Refresh 5 min before expiry (minimum 30s from now)
  const refreshInMs = Math.max(30_000, (expiresInSeconds - 300) * 1000);
  logger.log(`[Auth] Scheduling proactive refresh in ${Math.round(refreshInMs / 1000)}s`);

  refreshTimer = setTimeout(() => {
    handleSessionRefresh();
  }, refreshInMs);
};

/**
 * Restore session on app startup.
 * Checks stored tokens, refreshes if needed, so user stays signed in across restarts.
 */
const restoreSession = async (): Promise<boolean> => {
  const token = await getToken();
  const refreshToken = await getRefreshToken();

  if (!token && !refreshToken) {
    logger.log('[Auth] No stored session, user needs to sign in');
    return false;
  }

  if (token) {
    const expiry = getTokenExpiry();
    // If token is still valid for at least 1 minute, use it
    if (!expiry || Date.now() < expiry - 60_000) {
      logger.log('[Auth] Restored session from stored token');
      // Schedule refresh based on remaining time
      if (expiry) {
        const remainingSeconds = Math.floor((expiry - Date.now()) / 1000);
        scheduleTokenRefresh(remainingSeconds);
      } else {
        // No expiry tracked — schedule refresh in 50 minutes (safe default for 1hr tokens)
        scheduleTokenRefresh(3000);
      }
      return true;
    }
  }

  // Token expired or about to expire — try refresh
  if (refreshToken) {
    logger.log('[Auth] Stored token expired, attempting refresh...');
    await handleSessionRefresh();
    // Check if refresh succeeded
    const newToken = await getToken();
    return newToken !== null;
  }

  return false;
};

const initializeApiClient = async () => {
  // Try to restore existing session (handles token refresh if expired)
  const sessionRestored = await restoreSession();

  const token = await getToken();
  if (token) {
    const apiUrl = store.get('apiUrl') || DEFAULT_API_URL;
    apiClient = new AGIApiClient(apiUrl, token);

    // Handle session expiry (401 responses) — try refresh first
    apiClient.onSessionExpired = () => handleSessionRefresh();

    // Set Sentry user context from JWT
    try {
      const payload = token.split('.')[1];
      if (payload) {
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        setUser({
          id: decoded.sub || decoded.user_id || decoded.id,
          email: decoded.email,
        });
      }
    } catch {
      // Ignore JWT decode errors
    }

    // Sync memories from server on startup
    setTimeout(() => {
      syncMemoriesFromServer();
    }, 2000);

    // Fetch initial credit balance
    setTimeout(async () => {
      try {
        if (apiClient) {
          const credits = await apiClient.getCredits();
          mb?.window?.webContents.send('credits:updated', {
            creditsUsed: credits.monthly_allocation - credits.credit_balance,
            creditsRemaining: credits.credit_balance,
          });
        }
      } catch (error) {
        logger.error('[Credits] Failed to fetch initial balance:', (error as Error).message);
      }
    }, 3000);

    if (sessionRestored) {
      logger.log('[Auth] Session restored — user stays signed in');
    }
  }
};

// Check permissions without prompting (for renderer to query status)
// Note: checkScreenRecording should only be true when user is on the permissions steps
// to avoid triggering macOS dialogs on first app launch
const checkPermissionsStatus = (checkScreenRecording = false): { accessibility: boolean; screenRecording: boolean } => {
  if (process.platform !== 'darwin') {
    return { accessibility: true, screenRecording: true };
  }

  // Check Accessibility permission WITHOUT prompting (pass false)
  // Note: This can return stale values on macOS - app restart may be needed after granting
  const accessibility = systemPreferences.isTrustedAccessibilityClient(false);

  // Only check Screen Recording permission when explicitly requested
  // This prevents triggering macOS permission dialogs on first app launch
  let screenRecording = false;
  if (checkScreenRecording) {
    const screenStatus = systemPreferences.getMediaAccessStatus('screen');
    screenRecording = screenStatus === 'granted';
  }

  logger.log('[Permissions] Status check:', { accessibility, screenRecording, checkScreenRecording });

  return { accessibility, screenRecording };
};

// Request accessibility permission (will trigger system dialog)
const requestAccessibilityPermission = (): boolean => {
  if (process.platform !== 'darwin') return true;
  // Passing true will prompt if not already granted
  return systemPreferences.isTrustedAccessibilityClient(true);
};

// Open System Preferences to specific pane
const openPermissionSettings = (type: 'accessibility' | 'screenRecording') => {
  const urls = {
    accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    screenRecording: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  };
  shell.openExternal(urls[type]);
};

const checkPermissions = async (): Promise<boolean> => {
  if (process.platform !== 'darwin') {
    return true; // Only macOS requires these permissions
  }

  const status = checkPermissionsStatus(true);
  logger.log('[Time Tracking] Permission status:', status);

  const hasAll = status.accessibility && status.screenRecording;
  store.set('permissionsSystemDetected', hasAll);

  if (hasAll) {
    return true;
  }

  // If user already confirmed permissions in onboarding, trust that over stale detection
  if (store.get('permissionsUserConfirmed')) {
    logger.log('[Time Tracking] System detection says missing, but user confirmed during onboarding. Trusting user.');
    return true;
  }

  return false;
};

const initializeTimeTracking = async () => {
  logger.log('[Time Tracking] Initializing...');
  const settings = getTimeTrackingSettings();
  logger.log('[Time Tracking] Settings:', JSON.stringify(settings, null, 2));
  if (!settings.enabled) {
    logger.log('[Time Tracking] Disabled in settings');
    return;
  }

  // Check permissions - uses dual-flag system (system detection + user confirmation)
  const hasPermissions = await checkPermissions();
  if (!hasPermissions) {
    logger.log('[Time Tracking] Neither system detection nor user confirmation indicates permissions granted.');
    logger.log('[Time Tracking] Attempting to start anyway for functional validation...');
  }

  const token = await getToken();
  const apiUrl = store.get('apiUrl') || DEFAULT_API_URL;

  // Create activity monitor
  const monitorOptions: ActivityMonitorOptions = {
    pollInterval: 5000, // 5 seconds
    idleTimeout: settings.idleTimeoutMinutes,
    trackBrowserTabs: settings.trackBrowserTabs,
    excludedApps: settings.excludedApps,
    // No `categories` — the taxonomy lives in activity-monitor.ts only.
  };

  const monitor = createActivityMonitor(monitorOptions);

  // Meeting detection runs on its own timer, outside the frontmost-window
  // sampler. A call has to stay measurable while the user screen-shares,
  // takes notes elsewhere, or just listens — none of which the sampler sees.
  const meetingDetector = createMeetingDetector();

  meetingDetector.on('meetingStarted', (session: MeetingSession) => {
    // Suppress HID idle for the duration: passive listening is still working.
    monitor.setMeetingActive(true);
    mb?.window?.webContents.send('time:meetingStarted', session);
  });

  meetingDetector.on('meetingEnded', (session: MeetingSession) => {
    monitor.setMeetingActive(false);
    getTimeTracker()?.addMeetingEntry(session);
    mb?.window?.webContents.send('time:meetingEnded', session);
  });

  meetingDetector.start();

  // Which browsers the detector should enumerate tabs in. Probing every known
  // browser on every tick would be pointlessly expensive, so we only consider
  // ones the user has actually focused this session — you have to focus a
  // browser at least once to open a meeting tab in it.
  const seenBrowsers = new Set<string>();

  // Forward monitor events to renderer
  monitor.on('activityStarted', (activity) => {
    if (isTabCapableBrowser(activity.appName) && !seenBrowsers.has(activity.appName)) {
      seenBrowsers.add(activity.appName);
      meetingDetector.setRunningBrowsers([...seenBrowsers]);
    }
    mb?.window?.webContents.send('time:activityStarted', activity);
  });

  monitor.on('activityEnded', (activity) => {
    mb?.window?.webContents.send('time:activityEnded', activity);
  });

  monitor.on('activityResumed', (activityId: string) => {
    mb?.window?.webContents.send('time:activityResumed', activityId);
  });

  monitor.on('idle', (payload: { start: number; reason: string }) => {
    mb?.window?.webContents.send('time:idle', payload);
  });

  monitor.on('active', () => {
    mb?.window?.webContents.send('time:active');
  });

  // A witnessed absence — the monitor saw the user leave AND come back. Only
  // these can honestly be scored as breaks; unexplained gaps are untracked.
  monitor.on('absence', (record: { start: number; end: number; reason: string }) => {
    mb?.window?.webContents.send('time:absence', record);
  });

  // Forward permission warning events to renderer (Task 4: Surface null-window detection)
  monitor.on('permissionWarning', () => {
    logger.log('[Time Tracking] Permission warning - forwarding to renderer');
    mb?.window?.webContents.send('time:permissionWarning');
    store.set('permissionsFunctionallyWorking', false);
  });

  // Forward empty title warning (Screen Recording granted but app needs restart)
  monitor.on('emptyTitles', () => {
    logger.log('[Time Tracking] Empty browser titles detected - Screen Recording may need app restart');
    mb?.window?.webContents.send('time:emptyTitles');
  });

  // Recovery — clear the sticky warning banner once titles start coming through again.
  monitor.on('titlesRecovered', () => {
    logger.log('[Time Tracking] Browser titles recovered, clearing warning');
    mb?.window?.webContents.send('time:titlesRecovered');
  });

  // Without a listener, EventEmitter turns 'error' (emitted when active-win
  // fails to load) into a synchronous throw — an unhandled rejection from
  // every call site that fires initializeTimeTracking() without awaiting it.
  monitor.on('error', (err: Error) => {
    logger.error('[Time Tracking] Activity monitor error:', err);
  });

  // Create time tracker
  const tracker = createTimeTracker({
    syncInterval: settings.syncIntervalMinutes,
    apiUrl,
    token: token || undefined,
  });

  // Let user category corrections feed back into live classification.
  monitor.categoryOverrideLookup = (appName, windowTitle) =>
    tracker.getCategoryOverride(appName, windowTitle);

  // Forward tracker events to renderer
  tracker.on('syncStarted', () => {
    mb?.window?.webContents.send('time:syncStarted');
  });

  tracker.on('syncCompleted', (result) => {
    mb?.window?.webContents.send('time:syncCompleted', result);
  });

  tracker.on('syncFailed', (result) => {
    mb?.window?.webContents.send('time:syncFailed', result);
  });

  // Start tracking
  await monitor.start();
  tracker.start();

  // Functional permission test: after starting, check if active-win actually returns data
  // This is the most reliable way to verify permissions work, regardless of system API cache
  setTimeout(async () => {
    try {
      const activeWinModule = await import('active-win');
      const testResult = await activeWinModule.default({ screenRecordingPermission: false, accessibilityPermission: false });
      if (testResult) {
        logger.log('[Time Tracking] Functional test PASSED - active-win returned window data');
        store.set('permissionsFunctionallyWorking', true);
      } else {
        logger.log('[Time Tracking] Functional test returned null - permissions may not be fully granted');
        // Don't set to false yet - null can also mean no window is focused (screen locked, etc.)
      }
    } catch (error) {
      logger.error('[Time Tracking] Functional test failed:', error);
      store.set('permissionsFunctionallyWorking', false);
    }
  }, 3000);

  logger.log('[Time Tracking] Initialized');
};

// ============================================
// IPC Input Validation Helpers
// ============================================

function validateString(value: unknown, name: string, maxLength = 10000): string {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`);
  }
  if (value.length > maxLength) {
    throw new Error(`${name} exceeds maximum length of ${maxLength}`);
  }
  return value;
}

function validateEmail(value: unknown): string {
  const email = validateString(value, 'email', 320);
  if (!email.includes('@') || !email.includes('.')) {
    throw new Error('Invalid email format');
  }
  return email;
}

function validateUrl(value: unknown, name: string): string {
  const url = validateString(value, name, 2000);
  try {
    new URL(url);
  } catch {
    throw new Error(`${name} is not a valid URL`);
  }
  return url;
}

// IPC Handlers
ipcMain.handle('auth:getToken', async () => {
  return await getToken();
});

ipcMain.handle('auth:setToken', async (_, token: unknown) => {
  const validToken = validateString(token, 'token');
  await setToken(validToken);
  const apiUrl = store.get('apiUrl') || DEFAULT_API_URL;
  apiClient = new AGIApiClient(apiUrl, validToken);
  const tracker = getTimeTracker();
  tracker?.updateSettings({ token: validToken, apiUrl });
  // Sync any queued entries now that we have a valid token
  tracker?.sync().catch((err) => logger.error('[TimeTracker] Post-auth sync failed:', err));
  return true;
});

ipcMain.handle('auth:clearToken', async () => {
  await clearAllTokens();
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  apiClient = null;
  getTimeTracker()?.updateSettings({ token: '' });
  return true;
});

ipcMain.handle('auth:sendCode', async (_, email: unknown) => {
  const validEmail = validateEmail(email);
  // Always use production URL for authentication
  const apiUrl = DEFAULT_API_URL;
  try {
    logger.info(`[Auth] Sending code to ${validEmail} via ${apiUrl}`);
    const response = await fetch(`${apiUrl}/api/auth/email-code/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: validEmail }),
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return { success: response.ok, data };
    } catch {
      logger.error(`[Auth] Invalid JSON response: ${text.substring(0, 200)}`);
      return { success: false, error: 'Server returned invalid response' };
    }
  } catch (error) {
    logger.error('[Auth] Send code error:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('auth:verifyCode', async (_, email: unknown, code: unknown) => {
  const validEmail = validateEmail(email);
  const validCode = validateString(code, 'code', 6);
  if (!/^\d{6}$/.test(validCode)) {
    return { success: false, error: 'Invalid verification code format (must be 6 digits)' };
  }
  // Always use production URL for authentication
  const apiUrl = DEFAULT_API_URL;
  try {
    logger.info(`[Auth] Verifying code for ${validEmail}`);
    const response = await fetch(`${apiUrl}/api/auth/email-code/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: validEmail, code: validCode }),
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (response.ok && data.token) {
        await setToken(data.token);
        // Store refresh token if provided (for Supabase session tokens).
        // Clear any stale refresh token when none returned — otherwise an old
        // Supabase refresh token from a previous login can sit in the store
        // alongside a fresh long-lived JWT and get used (and rejected) later.
        if (data.refreshToken) {
          await setRefreshToken(data.refreshToken);
        } else {
          await clearRefreshToken();
        }
        // Track expiry and schedule proactive refresh
        const expiresIn = data.expiresIn || 3600;
        setTokenExpiry(Date.now() + expiresIn * 1000);
        scheduleTokenRefresh(expiresIn);

        // Update store to use production URL
        store.set('apiUrl', apiUrl);
        apiClient = new AGIApiClient(apiUrl, data.token);
        // Set up auto-refresh on session expiry
        apiClient.onSessionExpired = () => handleSessionRefresh();
        const authTracker = getTimeTracker();
        authTracker?.updateSettings({ token: data.token, apiUrl });
        // Sync any queued entries now that we have a valid token
        authTracker?.sync().catch((err) => logger.error('[TimeTracker] Post-auth sync failed:', err));
      }
      return { success: response.ok, data };
    } catch {
      logger.error(`[Auth] Invalid JSON response: ${text.substring(0, 200)}`);
      return { success: false, error: 'Server returned invalid response' };
    }
  } catch (error) {
    logger.error('[Auth] Verify code error:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Device Authorization IPC handlers (Sign in via Web App)
ipcMain.handle('auth:deviceRequest', async () => {
  const apiUrl = DEFAULT_API_URL;
  try {
    logger.info('[Auth] Requesting device authorization code');
    const response = await fetch(`${apiUrl}/api/auth/device/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (response.ok && data.deviceCode) {
        return { success: true, deviceCode: data.deviceCode, expiresIn: data.expiresIn };
      }
      logger.error('[Auth] Device request failed:', response.status, data.error);
      return { success: false, error: data.error || 'Device authorization not available' };
    } catch {
      logger.error('[Auth] Device request returned invalid JSON:', text.substring(0, 200));
      return { success: false, error: 'Server returned invalid response' };
    }
  } catch (error) {
    logger.error('[Auth] Device request error:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('auth:deviceOpenBrowser', async (_, deviceCode: unknown) => {
  const code = validateString(deviceCode, 'deviceCode', 8);
  const apiUrl = DEFAULT_API_URL;
  const authorizeUrl = `${apiUrl}/authorize?code=${encodeURIComponent(code)}`;
  logger.info(`[Auth] Opening browser for device authorization: ${authorizeUrl}`);
  await shell.openExternal(authorizeUrl);
  return { success: true };
});

ipcMain.handle('auth:devicePoll', async (_, deviceCode: unknown) => {
  const code = validateString(deviceCode, 'deviceCode', 8);
  const apiUrl = DEFAULT_API_URL;
  try {
    // Cache-busting param prevents Vercel/CDN caching stale 'pending' responses
    const response = await fetch(
      `${apiUrl}/api/auth/device/poll?code=${encodeURIComponent(code)}&_t=${Date.now()}`,
      {
        headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      logger.error(`[Auth] Device poll HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      return { success: false, error: `Server returned ${response.status}` };
    }

    const data = await response.json();
    logger.info('[Auth] Device poll response:', { status: data.status, hasToken: !!data.token, cacheControl: response.headers.get('cache-control') });

    if (data.status === 'authorized' && data.token) {
      logger.info('[Auth] Device authorized — storing token and completing auth');
      // Store the token (same as email-code verify flow)
      await setToken(data.token);
      if (data.refreshToken) {
        await setRefreshToken(data.refreshToken);
      } else {
        // Clear stale refresh token from any prior Supabase-session login —
        // long-lived JWTs ship without one and we don't want the old token used.
        await clearRefreshToken();
      }
      // Track expiry and schedule proactive refresh
      const expiresIn = data.expiresIn || 3600;
      setTokenExpiry(Date.now() + expiresIn * 1000);
      scheduleTokenRefresh(expiresIn);

      store.set('apiUrl', apiUrl);
      apiClient = new AGIApiClient(apiUrl, data.token);
      apiClient.onSessionExpired = () => handleSessionRefresh();
      const deviceTracker = getTimeTracker();
      deviceTracker?.updateSettings({ token: data.token, apiUrl });
      // Sync any queued entries now that we have a valid token
      deviceTracker?.sync().catch((err) => logger.error('[TimeTracker] Post-device-auth sync failed:', err));

      return { success: true, status: 'authorized', token: data.token };
    }

    return { success: true, status: data.status || 'pending' };
  } catch (error) {
    logger.error('[Auth] Device poll error:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Permission IPC handlers
ipcMain.handle('permissions:getStatus', (_, checkScreenRecording = true) => {
  return checkPermissionsStatus(checkScreenRecording);
});

ipcMain.handle('permissions:getDetailedStatus', () => {
  const systemStatus = checkPermissionsStatus(true);
  return {
    systemDetected: systemStatus,
    userConfirmed: store.get('permissionsUserConfirmed') || false,
    functionallyWorking: store.get('permissionsFunctionallyWorking') || false,
    userSkipped: store.get('permissionsUserSkipped') || false,
  };
});

ipcMain.handle('permissions:requestAccessibility', () => {
  const result = requestAccessibilityPermission();
  // Start aggressive polling to detect when user grants in System Settings
  startAggressivePermissionPolling();
  return result;
});

ipcMain.handle('permissions:openSettings', (_, type: 'accessibility' | 'screenRecording') => {
  openPermissionSettings(type);
  // Start aggressive polling so UI updates instantly when permission is granted
  startAggressivePermissionPolling();
  return true;
});

// One-shot capture attempt. macOS only lists an app in the Screen Recording
// pane after it has actually tried to capture, and the first attempt fires the
// native "wants to record this computer's screen" prompt — so this both
// registers the app and asks, without a settings round-trip.
ipcMain.handle('permissions:requestScreenRecording', async () => {
  try {
    await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
  } catch {
    // Denied or capture unavailable — the status check below reports the truth.
  }
  startAggressivePermissionPolling();
  try {
    return systemPreferences.getMediaAccessStatus('screen') === 'granted';
  } catch {
    return false;
  }
});

ipcMain.handle('permissions:skip', () => {
  store.set('permissionsUserSkipped', true);
  store.set('permissionsUserConfirmed', false);
  setTimeTrackingSettings({ enabled: false });
  getActivityMonitor()?.stop();
  getTimeTracker()?.stop();
  getMeetingDetector()?.stop();
  return true;
});

ipcMain.handle('permissions:complete', async () => {
  const status = checkPermissionsStatus(true);
  logger.log('[Permissions] Complete called, system status:', status);

  // User clicked "continue" - this is a persistent confirmation that survives restarts
  store.set('permissionsUserConfirmed', true);
  store.set('permissionsUserSkipped', false);
  store.set('permissionsSystemDetected', status.accessibility && status.screenRecording);

  if (!status.accessibility || !status.screenRecording) {
    logger.log('[Permissions] System detection shows missing, but user confirmed. Will validate via functional test.');
  }

  // Initialize time tracking - the functional test inside will validate if permissions actually work
  await initializeTimeTracking();
  return true;
});

// Retry time tracking initialization (e.g., after user grants permissions manually)
ipcMain.handle('permissions:retryTracking', () => {
  logger.log('[Permissions] Retrying time tracking initialization...');
  initializeTimeTracking();
  return true;
});

// Permission state polling: detect when user grants permissions in System Settings
// Uses aggressive polling (1s) for instant Loom-style detection.
// Screen recording and camera/mic update instantly on macOS 13+ (Ventura) via
// CGPreflightScreenCaptureAccess/AVCaptureDevice — no restart needed.
// Accessibility changes may still require a restart on some macOS versions, but
// we validate via a functional active-win probe before prompting.
let lastKnownPermissions = { accessibility: false, screenRecording: false };
let permissionPollStarted = false;
let aggressivePolling = false;
let aggressivePollTimer: ReturnType<typeof setInterval> | null = null;

const startPermissionPolling = () => {
  if (permissionPollStarted) return;
  permissionPollStarted = true;

  // Initial state
  lastKnownPermissions = checkPermissionsStatus(true);

  // Normal background polling every 3 seconds
  setInterval(() => {
    if (aggressivePolling) return; // Skip when aggressive polling is active
    pollPermissions();
  }, 3000);
};

/**
 * Start aggressive polling (every 500ms) — called when user is sent to System Settings.
 * Stops automatically after 2 minutes or when permission is detected.
 */
const startAggressivePermissionPolling = () => {
  if (aggressivePolling) return;
  aggressivePolling = true;

  logger.log('[Permissions] Starting aggressive polling (500ms) for instant detection');
  const startTime = Date.now();

  aggressivePollTimer = setInterval(() => {
    // Timeout after 2 minutes
    if (Date.now() - startTime > 120_000) {
      stopAggressivePermissionPolling();
      return;
    }
    pollPermissions();
  }, 500);
};

const stopAggressivePermissionPolling = () => {
  if (aggressivePollTimer) {
    clearInterval(aggressivePollTimer);
    aggressivePollTimer = null;
  }
  aggressivePolling = false;
  logger.log('[Permissions] Stopped aggressive polling');
};

const pollPermissions = () => {
  const current = checkPermissionsStatus(true);

  const accessibilityChanged = lastKnownPermissions.accessibility !== current.accessibility;
  const screenRecordingChanged = lastKnownPermissions.screenRecording !== current.screenRecording;

  if (accessibilityChanged || screenRecordingChanged) {
    logger.log('[Permissions] Change detected:', {
      accessibility: `${lastKnownPermissions.accessibility} → ${current.accessibility}`,
      screenRecording: `${lastKnownPermissions.screenRecording} → ${current.screenRecording}`,
    });

    store.set('permissionsSystemDetected', current.accessibility && current.screenRecording);

    const newlyGranted =
      (accessibilityChanged && current.accessibility) ||
      (screenRecordingChanged && current.screenRecording);

    if (newlyGranted) {
      store.set('permissionsUserConfirmed', true);

      // Stop aggressive polling — permission was detected
      stopAggressivePermissionPolling();

      // The System Settings companion has done its job
      hideDragHelper();

      // Notify renderer immediately so UI updates instantly (Loom-style)
      sendToRenderers('permissions:changed', {
        ...current,
        newlyGranted: true,
      });

      // Run functional validation via active-win probe before deciding on restart
      validatePermissionsFunctionally().then((functionallyWorking) => {
        if (functionallyWorking) {
          // Permissions work without restart — screen recording on macOS 13+
          logger.log('[Permissions] Functional validation passed — no restart needed');
          store.set('permissionsFunctionallyWorking', true);
          sendToRenderers('permissions:validated', { working: true });

          // Re-initialize time tracking with new permissions
          initializeTimeTracking();
        } else if (accessibilityChanged && current.accessibility) {
          // Accessibility often needs restart on macOS for TCC to fully apply
          logger.log('[Permissions] Accessibility granted but functional test failed — restart recommended');
          sendToRenderers('permissions:validated', { working: false, needsRestart: true });
          // During setup the window itself folds the restart into its last
          // step — a native dialog on top of it would be jarring.
          if (isOnboardingOpen()) return;
          dialog.showMessageBox({
            type: 'info',
            title: 'Almost There',
            message: 'Accessibility permission was granted. A quick restart is needed for macOS to fully apply it.',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
          }).then(({ response }) => {
            if (response === 0) {
              app.relaunch();
              app.exit(0);
            }
          });
        } else {
          // Screen recording granted but functional test still fails — try init anyway
          logger.log('[Permissions] Screen recording granted, functional test inconclusive — attempting init');
          store.set('permissionsFunctionallyWorking', false);
          initializeTimeTracking();
        }
      });
    } else {
      // Permission was revoked
      sendToRenderers('permissions:changed', {
        ...current,
        newlyGranted: false,
      });
    }

    lastKnownPermissions = current;
  }
};

/**
 * Functional validation: actually test if active-win can read window data.
 * This is the most reliable signal — it bypasses stale TCC cache issues.
 */
const validatePermissionsFunctionally = async (): Promise<boolean> => {
  try {
    const activeWinModule = await import('active-win');
    const testResult = await activeWinModule.default({
      screenRecordingPermission: false,
      accessibilityPermission: false,
    });
    return testResult !== null && testResult !== undefined;
  } catch {
    return false;
  }
};

// Chat IPC is gone. The renderer now talks to /api/agi/chat directly via the
// AI SDK (see renderer/lib/chat/transport.ts): it already held the auth token
// and CSP already allowed the origin, so proxying through main bought nothing
// and cost us the structured tool/reasoning parts, which the hand-rolled SSE
// parser here discarded.

ipcMain.handle('agi:getCurrentFocus', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const response = await apiClient.getCurrentFocus();
    return { success: true, data: response };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('agi:getSessions', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const response = await apiClient.getSessions();
    return { success: true, data: response };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// --- Credits ---

ipcMain.handle('credits:get', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const data = await apiClient.getCredits();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// --- Limits (signatures, AI actions) ---

ipcMain.handle('limits:get', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const data = await apiClient.getLimits();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// --- Profile & Context ---

ipcMain.handle('profile:get', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const data = await apiClient.getProfile();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('context:getUnified', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const data = await apiClient.getUnifiedContext();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('settings:get', (_, key: unknown) => {
  const validKey = validateString(key, 'settings key', 100);
  return store.get(validKey);
});

ipcMain.handle('settings:set', (_, key: unknown, value: unknown) => {
  const validKey = validateString(key, 'settings key', 100);
  // SECURITY: Prevent setting sensitive keys via the generic settings handler
  const protectedKeys = ['permissionsUserConfirmed', 'permissionsSystemDetected', 'permissionsFunctionallyWorking', 'apiUrl'];
  if (protectedKeys.includes(validKey)) {
    logger.error(`[Settings] Attempt to set protected key via generic handler: ${validKey}`);
    return false;
  }
  if (validKey === 'startAtLogin' && typeof value === 'boolean') {
    app.setLoginItemSettings({ openAtLogin: value });
  }

  if (validKey === 'autoUpdate' && typeof value === 'boolean') {
    autoUpdater.autoDownload = value;
  }

  if (validKey === 'globalShortcut' && typeof value === 'string') {
    const registered = registerToggleShortcut(value);
    if (!registered) {
      logger.error(`[Shortcut] Failed to register requested shortcut: ${value}`);
      return false;
    }
  }

  store.set(validKey, value);
  return true;
});

ipcMain.handle('window:hide', () => {
  mb?.hideWindow();
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('app:relaunch', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('app:openExternal', async (_, url: unknown) => {
  try {
    const validUrl = validateUrl(url, 'external url');
    if (!isAllowedExternalUrl(validUrl)) {
      return false;
    }
    await shell.openExternal(validUrl);
    return true;
  } catch {
    return false;
  }
});

// App icon cache to avoid repeated file system access
const appIconCache = new Map<string, string>();

// Additional app path mappings for common apps
const appPathAliases: Record<string, string[]> = {
  // Code editors
  'Code': ['/Applications/Visual Studio Code.app', '/Applications/Visual Studio Code - Insiders.app'],
  'Visual Studio Code': ['/Applications/Visual Studio Code.app'],
  'Code - Insiders': ['/Applications/Visual Studio Code - Insiders.app'],
  'VS Code': ['/Applications/Visual Studio Code.app'],
  'VSCode': ['/Applications/Visual Studio Code.app'],
  'Cursor': ['/Applications/Cursor.app'],
  'Xcode': ['/Applications/Xcode.app'],
  'Sublime Text': ['/Applications/Sublime Text.app'],

  // Browsers
  'Dia': ['/Applications/Dia.app', '/Applications/Dia Browser.app'],
  'Arc': ['/Applications/Arc.app'],
  'Safari': ['/Applications/Safari.app'],
  'Google Chrome': ['/Applications/Google Chrome.app'],
  'Chrome': ['/Applications/Google Chrome.app'],
  'Google Chrome Canary': ['/Applications/Google Chrome Canary.app'],
  'Firefox': ['/Applications/Firefox.app'],
  'Firefox Developer Edition': ['/Applications/Firefox Developer Edition.app'],
  'Brave Browser': ['/Applications/Brave Browser.app'],
  'Microsoft Edge': ['/Applications/Microsoft Edge.app'],
  'Opera': ['/Applications/Opera.app'],
  'Vivaldi': ['/Applications/Vivaldi.app'],

  // Communication
  'Slack': ['/Applications/Slack.app'],
  'Discord': ['/Applications/Discord.app'],
  'Telegram': ['/Applications/Telegram.app'],
  'WhatsApp': ['/Applications/WhatsApp.app'],
  'zoom.us': ['/Applications/zoom.us.app'],
  'Zoom': ['/Applications/zoom.us.app'],
  'zoom': ['/Applications/zoom.us.app'],
  'Microsoft Teams': ['/Applications/Microsoft Teams.app'],

  // Productivity
  'Notion': ['/Applications/Notion.app'],
  'Obsidian': ['/Applications/Obsidian.app'],
  'Linear': ['/Applications/Linear.app'],
  'Figma': ['/Applications/Figma.app'],

  // Media
  'Spotify': ['/Applications/Spotify.app'],
  'Music': ['/System/Applications/Music.app'],
  'Apple Music': ['/System/Applications/Music.app'],
  'Podcasts': ['/System/Applications/Podcasts.app'],

  // Terminals
  'iTerm2': ['/Applications/iTerm.app'],
  'iTerm': ['/Applications/iTerm.app'],
  'Hyper': ['/Applications/Hyper.app'],
  'Warp': ['/Applications/Warp.app'],
  'Terminal': ['/System/Applications/Utilities/Terminal.app'],
  'Alacritty': ['/Applications/Alacritty.app'],
  'kitty': ['/Applications/kitty.app'],

  // System apps
  'Activity Monitor': ['/System/Applications/Utilities/Activity Monitor.app'],
  'Notes': ['/System/Applications/Notes.app'],
  'Mail': ['/System/Applications/Mail.app'],
  'Messages': ['/System/Applications/Messages.app'],
  'Calendar': ['/System/Applications/Calendar.app'],
  'Finder': ['/System/Library/CoreServices/Finder.app'],
  'Preview': ['/System/Applications/Preview.app'],
  'System Settings': ['/System/Applications/System Settings.app'],
  'System Preferences': ['/System/Applications/System Preferences.app'],
  'Photos': ['/System/Applications/Photos.app'],
  'App Store': ['/System/Applications/App Store.app'],
  'TextEdit': ['/System/Applications/TextEdit.app'],
  'Console': ['/System/Applications/Utilities/Console.app'],

  // Other
  '1Password': ['/Applications/1Password.app', '/Applications/1Password 7.app'],
  'Raycast': ['/Applications/Raycast.app'],
  'Alfred': ['/Applications/Alfred 5.app', '/Applications/Alfred 4.app'],
  'Docker': ['/Applications/Docker.app'],
  'Postman': ['/Applications/Postman.app'],
  'TablePlus': ['/Applications/TablePlus.app'],
};

// Lazy-loaded file-icon module (ESM)
let fileIconModule: typeof import('file-icon') | null = null;

async function getFileIconModule() {
  if (!fileIconModule) {
    try {
      fileIconModule = await import('file-icon');
    } catch (error) {
      logger.log('[AppIcon] Failed to load file-icon module:', error);
    }
  }
  return fileIconModule;
}

ipcMain.handle('app:getIcon', async (_, appPathOrName: string) => {
  if (!appPathOrName) return null;

  // Check cache first
  if (appIconCache.has(appPathOrName)) {
    return appIconCache.get(appPathOrName);
  }

  // Extract app name from path or use as-is if it's already a name
  let appName = appPathOrName;
  const appNameMatch = appPathOrName.match(/([^/]+)\.app$/);
  if (appNameMatch) {
    appName = appNameMatch[1];
  }

  // Try using file-icon module first (native macOS API, better quality)
  const fileIcon = await getFileIconModule();
  if (fileIcon) {
    try {
      // Try by app name first (most reliable)
      const result = await fileIcon.fileIconToBuffer(appName, { size: 64 });
      if (result && result.length > 0) {
        const base64 = Buffer.from(result).toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;
        appIconCache.set(appPathOrName, dataUrl);
        return dataUrl;
      }
    } catch (error) {
      logger.log(`[AppIcon] file-icon failed for "${appName}", trying paths...`);
    }

    // Try known aliases
    if (appPathAliases[appName]) {
      for (const aliasPath of appPathAliases[appName]) {
        try {
          const result = await fileIcon.fileIconToBuffer(aliasPath, { size: 64 });
          if (result && result.length > 0) {
            const base64 = Buffer.from(result).toString('base64');
            const dataUrl = `data:image/png;base64,${base64}`;
            appIconCache.set(appPathOrName, dataUrl);
            return dataUrl;
          }
        } catch {
          continue;
        }
      }
    }
  }

  // Fall back to Electron's app.getFileIcon
  // Extract .app bundle path if full binary path is provided
  let bundlePath = appPathOrName;
  const appBundleMatch = appPathOrName.match(/^(.+\.app)/);
  if (appBundleMatch) {
    bundlePath = appBundleMatch[1];
  }

  // Try the provided path first
  let pathsToTry = [bundlePath];
  if (bundlePath !== appPathOrName) {
    pathsToTry.push(appPathOrName);
  }

  // Add alias paths if available
  if (appPathAliases[appName]) {
    pathsToTry = [...pathsToTry, ...appPathAliases[appName]];
  }

  // Also try the app name directly as a key
  const baseName = appPathOrName.split('/').pop()?.replace('.app', '') || '';
  if (appPathAliases[baseName]) {
    pathsToTry = [...pathsToTry, ...appPathAliases[baseName]];
  }

  // Try standard locations if path doesn't exist
  if (!appPathOrName.startsWith('/Applications') && !appPathOrName.startsWith('/System')) {
    pathsToTry.push(`/Applications/${baseName}.app`);
    pathsToTry.push(`/Applications/${appName}.app`);
    pathsToTry.push(`/System/Applications/${appName}.app`);
    pathsToTry.push(`/System/Applications/Utilities/${appName}.app`);
  }

  // Remove duplicates
  pathsToTry = [...new Set(pathsToTry)];

  for (const tryPath of pathsToTry) {
    try {
      // Check if path exists first
      if (!fs.existsSync(tryPath)) {
        continue;
      }

      const icon = await app.getFileIcon(tryPath, { size: 'normal' });

      // Check if icon is valid (not empty)
      if (icon.isEmpty()) {
        continue;
      }

      const dataUrl = icon.toDataURL();

      // Validate data URL format
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        continue;
      }

      // Cache with original path as key
      appIconCache.set(appPathOrName, dataUrl);
      return dataUrl;
    } catch (error) {
      continue;
    }
  }

  logger.log(`[AppIcon] Could not find icon for: ${appPathOrName}`);
  return null;
});

// ============================================
// Time Tracking IPC Handlers
// ============================================

ipcMain.handle('time:getActivity', () => {
  const monitor = getActivityMonitor();
  const tracker = getTimeTracker();

  return {
    current: monitor?.getCurrentActivity() || null,
    entries: tracker?.getTodayEntries() || [],
    summary: tracker?.getSummary() || null,
    // Witnessed absences, so the renderer can label gaps by cause instead of
    // assuming every hole in the timeline was a break.
    absences: monitor?.getAbsences() || [],
    // The call in progress right now, if any — a finished meeting is already
    // in `entries` as an overlay row.
    currentMeeting: getMeetingDetector()?.getCurrentMeeting() || null,
  };
});

ipcMain.handle('time:getLoggedEntries', async () => {
  if (!apiClient) return { success: false, entries: [] };
  try {
    const entries = await apiClient.getLoggedEntries();
    return { success: true, entries };
  } catch (error) {
    return { success: false, entries: [], error: (error as Error).message };
  }
});

ipcMain.handle('time:getSettings', () => {
  return getTimeTrackingSettings();
});

ipcMain.handle('time:updateSettings', async (_, settings: Partial<ReturnType<typeof getTimeTrackingSettings>>) => {
  // Note: We no longer block on permission check here because macOS permission
  // detection can be stale. The activity monitor will handle missing permissions
  // gracefully by returning undefined windows. If permissions are truly missing,
  // the tracking will just show no activity until permissions are granted.
  if (settings.enabled === true) {
    const status = checkPermissionsStatus(true);
    if (!status.accessibility || !status.screenRecording) {
      logger.log('[Time Tracking] Permission check returned incomplete, but proceeding anyway:', status);
      logger.log('[Time Tracking] Note: macOS permission cache may be stale. Will attempt to track.');
    }
  }

  setTimeTrackingSettings(settings);

  // Update activity monitor if running
  const monitor = getActivityMonitor();
  if (monitor) {
    monitor.updateSettings({
      idleTimeout: settings.idleTimeoutMinutes,
      trackBrowserTabs: settings.trackBrowserTabs,
      excludedApps: settings.excludedApps,
    });
  }

  // Update time tracker if running
  const tracker = getTimeTracker();
  if (tracker) {
    tracker.updateSettings({
      syncInterval: settings.syncIntervalMinutes,
    });
  }

  // Handle enable/disable
  if (settings.enabled !== undefined) {
    if (settings.enabled) {
      await initializeTimeTracking();
    } else {
      monitor?.stop();
      tracker?.stop();
      getMeetingDetector()?.stop();
    }
  }

  return { success: true };
});

ipcMain.handle('time:syncNow', async () => {
  const tracker = getTimeTracker();
  if (!tracker) {
    return { success: false, error: 'Time tracking not initialized' };
  }
  const result = await tracker.sync();
  return result;
});

ipcMain.handle('time:assignProject', async (_, entryId: string, projectId: string) => {
  const tracker = getTimeTracker();
  if (!tracker) {
    return { success: false, error: 'Time tracking not initialized' };
  }
  const success = tracker.assignProject(entryId, projectId || undefined);
  // Trigger sync so updated project assignment reaches the web app
  if (success) {
    tracker.sync().catch((err) => logger.error('[TimeTracker] Sync after project assignment failed:', err));
  }
  return { success };
});

// Learn project assignment patterns — fire-and-forget to server
ipcMain.handle('time:learnPattern', async (_, appName: string, projectId: string, windowTitle: string, url?: string) => {
  const token = await getToken();
  if (!token) return;

  const apiUrl = store.get('apiUrl') || DEFAULT_API_URL;
  try {
    await fetch(`${apiUrl}/api/time/learn-pattern`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        app_name: appName,
        window_title: windowTitle,
        url: url || undefined,
      }),
    });
  } catch {
    // Non-critical — local learning still works
  }
});

ipcMain.handle('time:getSuggestions', () => {
  const tracker = getTimeTracker();
  return tracker?.getProjectSuggestions() || [];
});

ipcMain.handle('time:getSyncStatus', () => {
  const tracker = getTimeTracker();
  return tracker?.getSyncStatus() || { lastSync: 0, pendingCount: 0, isSyncing: false };
});

ipcMain.handle('time:addManualEntry', async (_, description: string, projectId: string, duration: number, category?: string) => {
  const tracker = getTimeTracker();
  if (!tracker) {
    return { success: false, error: 'Time tracking not initialized' };
  }
  const entry = tracker.addManualEntry(description, projectId || undefined, duration, category);
  // Trigger immediate sync so the entry appears in the web app right away
  tracker.sync().catch((err) => logger.error('[TimeTracker] Sync after manual entry failed:', err));
  return { success: true, entry };
});

ipcMain.handle('time:deleteEntry', (_, entryId: string) => {
  const tracker = getTimeTracker();
  if (!tracker) {
    return { success: false, error: 'Time tracking not initialized' };
  }
  const success = tracker.deleteEntry(entryId);
  return { success };
});

ipcMain.handle('time:updateEntry', (_, entryId: string, updates: {
  description?: string;
  isBillable?: boolean;
  startTime?: number;
  endTime?: number;
  duration?: number;
  category?: string;
  projectId?: string;
}) => {
  const tracker = getTimeTracker();
  if (!tracker) {
    return { success: false, error: 'Time tracking not initialized' };
  }
  const entry = tracker.updateEntry(entryId, updates);
  if (!entry) {
    return { success: false, error: 'Entry not found' };
  }
  // Trigger immediate sync so the edit persists to the web app right away
  tracker.sync().catch((err) => logger.error('[TimeTracker] Sync after entry update failed:', err));
  return { success: true, entry };
});

ipcMain.handle('time:mergeEntries', (_, entryIds: string[]) => {
  const tracker = getTimeTracker();
  if (!tracker) return { success: false, error: 'Time tracking not initialized' };
  const entry = tracker.mergeEntries(entryIds);
  if (!entry) return { success: false, error: 'Need at least two entries to merge' };
  tracker.sync().catch((err) => logger.error('[TimeTracker] Sync after merge failed:', err));
  return { success: true, entry };
});

ipcMain.handle('time:splitEntry', (_, entryId: string, atTimestamp: number) => {
  const tracker = getTimeTracker();
  if (!tracker) return { success: false, error: 'Time tracking not initialized' };
  const result = tracker.splitEntry(entryId, atTimestamp);
  if (!result) return { success: false, error: 'Split point must fall inside the entry' };
  tracker.sync().catch((err) => logger.error('[TimeTracker] Sync after split failed:', err));
  return { success: true, entries: result };
});

ipcMain.handle('time:recategorizeEntry', (_, entryId: string, category: string) => {
  const tracker = getTimeTracker();
  if (!tracker) return { success: false, error: 'Time tracking not initialized' };
  const entry = tracker.recategorizeEntry(entryId, category);
  if (!entry) return { success: false, error: 'Entry not found' };
  tracker.sync().catch((err) => logger.error('[TimeTracker] Sync after recategorize failed:', err));
  return { success: true, entry };
});

// Manual timer control
let manualTimerStart: number | null = null;
let manualTimerDescription: string = '';
let manualTimerProjectId: string = '';

ipcMain.handle('time:startManualTimer', (_, description: string, projectId?: string) => {
  manualTimerStart = Date.now();
  manualTimerDescription = description || 'Manual time entry';
  manualTimerProjectId = projectId || '';
  mb?.window?.webContents.send('time:manualTimerStarted', { startTime: manualTimerStart, description: manualTimerDescription });
  return { success: true, startTime: manualTimerStart };
});

ipcMain.handle('time:stopManualTimer', async () => {
  if (!manualTimerStart) {
    return { success: false, error: 'No timer running' };
  }

  const tracker = getTimeTracker();
  const duration = Math.floor((Date.now() - manualTimerStart) / 1000);

  if (duration < 10) {
    manualTimerStart = null;
    return { success: false, error: 'Timer too short (minimum 10 seconds)' };
  }

  let entry = null;
  if (tracker) {
    entry = tracker.addManualEntry(manualTimerDescription, manualTimerProjectId || undefined, duration, 'manual');
    // Trigger immediate sync so the entry appears in the web app right away
    tracker.sync().catch((err) => logger.error('[TimeTracker] Immediate sync after timer stop failed:', err));
  }

  manualTimerStart = null;
  manualTimerDescription = '';
  manualTimerProjectId = '';

  mb?.window?.webContents.send('time:manualTimerStopped', { entry });
  return { success: true, entry, duration };
});

ipcMain.handle('time:getManualTimerStatus', () => {
  return {
    isRunning: manualTimerStart !== null,
    startTime: manualTimerStart,
    description: manualTimerDescription,
    elapsed: manualTimerStart ? Math.floor((Date.now() - manualTimerStart) / 1000) : 0,
  };
});

ipcMain.handle('time:isTrackingEnabled', () => {
  const settings = getTimeTrackingSettings();
  return settings.enabled;
});

// ============================================
// Active Task IPC Handlers
// ============================================

ipcMain.handle('task:getSettings', () => {
  return getActiveTaskSettings();
});

ipcMain.handle('task:updateSettings', (_, settings: Partial<ReturnType<typeof getActiveTaskSettings>>) => {
  setActiveTaskSettings(settings);
  return { success: true };
});

ipcMain.handle('task:getFocus', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const focus = await apiClient.getCurrentFocus();
    return { success: true, data: focus };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('task:setFocus', async (_, taskId: string) => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    await apiClient.setFocusTask(taskId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('task:clearFocus', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    await apiClient.clearFocusTask();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// ============================================
// Memory IPC Handlers (Local + Server Sync)
// ============================================

ipcMain.handle('memory:list', () => {
  return getMemories();
});

ipcMain.handle('memory:add', async (_, content: string, category?: string) => {
  // Save to server first if authenticated to get the server ID
  if (apiClient) {
    try {
      const result = await apiClient.saveMemory(content, category);
      if (result.success && result.memory) {
        // Use the server's ID for the local memory
        const serverMemory = result.memory;
        const localMemory = {
          id: serverMemory.id,
          content: serverMemory.content || content,
          category: serverMemory.category || category,
          createdAt: serverMemory.created_at ? new Date(serverMemory.created_at).getTime() : Date.now(),
        };
        // Add to local store with server ID
        const memories = getMemories();
        memories.push(localMemory);
        setMemories(memories);
        logger.log('[Memory] Saved to server and local with ID:', serverMemory.id);
        return localMemory;
      }
    } catch (error) {
      logger.error('[Memory] Failed to sync to server:', error);
    }
  }

  // Fallback to local-only if not authenticated
  const memory = addMemory(content, category);
  return memory;
});

ipcMain.handle('memory:delete', async (_, id: string) => {
  // Delete from server first if authenticated
  if (apiClient) {
    try {
      await apiClient.deleteMemory(id);
      logger.log('[Memory] Deleted from server:', id);
    } catch (error) {
      logger.error('[Memory] Failed to delete from server:', error);
    }
  }

  // Delete locally
  const success = deleteMemory(id);
  return { success };
});

// ============================================
// Projects IPC Handler
// ============================================

ipcMain.handle('projects:list', async () => {
  if (!apiClient) {
    // The API client is built asynchronously after session restore, so this is
    // a normal transient state at launch — kick a refresh so the caller's retry
    // has something to recover into.
    void handleSessionRefresh();
    return { success: false, code: 'not_authenticated', error: 'Not authenticated' };
  }
  try {
    const projects = await apiClient.getProjects();
    return { success: true, data: projects };
  } catch (error) {
    const err = error as ApiError;
    let code: ProjectsListErrorCode = 'server_error';
    if (err instanceof ApiError) {
      if (err.isNetworkError) code = 'network_error';
      else if (err.status === 401 || err.status === 403) code = 'auth_expired';
      else if (err.status >= 500) code = 'server_error';
      else code = 'server_error';
    }
    logger.error('[Projects] Failed to list projects:', err.message);
    return { success: false, code, error: err.message };
  }
});

// ============================================
// Integrations IPC Handlers
// ============================================

ipcMain.handle('integrations:list', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const response = await apiClient.getIntegrations();
    return { success: true, data: response };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('integrations:openSettings', (_, provider?: string) => {
  const apiUrl = store.get('apiUrl') || DEFAULT_API_URL;
  const settingsUrl = provider
    ? `${apiUrl}/settings/integrations?connect=${provider}`
    : `${apiUrl}/settings/integrations`;
  shell.openExternal(settingsUrl);
  return { success: true };
});

// ============================================
// Channels IPC Handlers (WhatsApp, Telegram, Slack)
// ============================================

// WhatsApp pairing is link-code based, via `/api/agi/whatsapp/link` — see
// `channels:getWhatsAppLinkCode` below. The old QR/scan flow belonged to the
// Baileys agi-gateway and died with the Overlord rebuild; its `/start`,
// `/wait` and `/logout` endpoints no longer exist.
ipcMain.handle('channels:connectTelegram', async (_event, _botToken: string) => {
  // Telegram doesn't need QR - it connects via bot token
  // The token is configured in the gateway, so we just verify it works
  logger.log('[Channels] Telegram connection requested (token-based, configured in gateway)');

  // For now, just return success since Telegram is configured via env var
  // In a full implementation, this would call a gateway endpoint to validate and store the token
  return { success: true, message: 'Telegram uses bot token configured in gateway' };
});

ipcMain.handle('channels:connectSlack', async (_event, _botToken: string, _appToken: string) => {
  // Slack is configured via OAuth in the web app
  logger.log('[Channels] Slack connection requested (OAuth-based, configured in web app)');
  const apiUrl = store.get('apiUrl') || DEFAULT_API_URL;
  const settingsUrl = `${apiUrl}/settings/integrations?connect=slack`;
  shell.openExternal(settingsUrl);
  return { success: true, message: 'Opened web app to connect Slack' };
});

// WhatsApp unlink goes through DELETE `/api/agi/whatsapp/link` — the same
// route the web settings page uses, which clears both `user_channel_links`
// (settings UI) and `overlord_channel_links` (gateway routing). The old
// `/api/agi/whatsapp/logout` died with the Overlord rebuild.
//
// Telegram and Slack have no AGI-authed unlink route yet (`/api/agi/telegram/link`
// is POST + GET only, `/api/agi/slack/status` is GET) — unlink those in the web
// app, which reaches them via the session-authed /api/user/channel-links.
ipcMain.handle('channels:disconnect', async (_, channel: 'whatsapp' | 'telegram' | 'slack') => {
  if (channel !== 'whatsapp') {
    return { success: false, error: `${channel} disconnect is not implemented in desktop yet` };
  }

  const apiUrl = (store.get('apiUrl') as string) || DEFAULT_API_URL;
  const token = await getToken();

  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${apiUrl}/api/agi/whatsapp/link`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      logger.error('[Channels] WhatsApp unlink failed:', response.status);
      return { success: false, error: `Failed to disconnect WhatsApp (${response.status})` };
    }

    return { success: true };
  } catch (error) {
    logger.error('[Channels] WhatsApp unlink error:', error);
    return { success: false, error: (error as Error).message };
  }
});

// WhatsApp Pairing Code Flow - generate a code for linking account
ipcMain.handle('channels:getWhatsAppLinkCode', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
    const token = await getToken();

    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${apiUrl}/api/agi/whatsapp/link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || errorData.message || 'Failed to generate link code' };
    }

    const data = await response.json();
    logger.log('[Channels] Generated WhatsApp link code:', data.code);

    return {
      success: true,
      code: data.code,
      botPhone: data.botPhone,
      instructions: data.instructions,
      expiresAt: data.expiresAt,
    };
  } catch (error) {
    logger.error('[Channels] Error generating WhatsApp link code:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Check if WhatsApp is linked
ipcMain.handle('channels:getStatusAll', async () => {
  try {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
    const token = await getToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${apiUrl}/api/agi/channels`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      return { success: false, error: `Failed to fetch channel status (${response.status})` };
    }

    return { success: true, data: await response.json() };
  } catch (error) {
    logger.error('[Channels] Error fetching channel status:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('channels:checkWhatsAppLinked', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
    const token = await getToken();

    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${apiUrl}/api/agi/whatsapp/link`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to check status' };
    }

    const data = await response.json();
    return {
      success: true,
      linked: data.linked,
      displayName: data.displayName,
      phoneNumber: data.phoneNumber,
      botPhone: data.botPhone,
      botConnected: data.botConnected,
    };
  } catch (error) {
    logger.error('[Channels] Error checking WhatsApp status:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Telegram Pairing Code Flow - generate a code for linking account
ipcMain.handle('channels:getTelegramLinkCode', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
    const token = await getToken();

    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${apiUrl}/api/agi/telegram/link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to generate link code' };
    }

    const data = await response.json();
    logger.log('[Channels] Generated Telegram link code:', data.code);

    return {
      success: true,
      code: data.code,
      deepLink: data.deepLink,
      expiresAt: data.expiresAt,
    };
  } catch (error) {
    logger.error('[Channels] Error generating Telegram link code:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Check if Telegram is linked
ipcMain.handle('channels:checkTelegramLinked', async () => {
  if (!apiClient) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
    const token = await getToken();

    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${apiUrl}/api/agi/telegram/link`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to check status' };
    }

    const data = await response.json();
    return {
      success: true,
      linked: data.linked,
      displayName: data.displayName,
      telegramId: data.telegramId,
    };
  } catch (error) {
    logger.error('[Channels] Error checking Telegram status:', error);
    return { success: false, error: (error as Error).message };
  }
});

// ============================================
// Memory Sync Functions
// ============================================

const syncMemoriesFromServer = async () => {
  if (!apiClient) {
    logger.log('[Memory Sync] No API client, skipping sync');
    return;
  }

  try {
    logger.log('[Memory Sync] Fetching memories from server...');
    const response = await apiClient.getMemories();
    const serverMemories = response.memories || [];

    // Convert server memories to local format
    const localMemories = serverMemories.map((m) => ({
      id: m.id,
      content: m.content,
      category: m.category,
      createdAt: new Date(m.created_at).getTime(),
    }));

    setMemories(localMemories);
    logger.log(`[Memory Sync] Synced ${localMemories.length} memories from server`);

    // Notify renderer
    mb?.window?.webContents.send('memory:synced', { count: localMemories.length });
  } catch (error) {
    logger.error('[Memory Sync] Failed to sync memories:', error);
  }
};

ipcMain.handle('memory:syncFromServer', async () => {
  await syncMemoriesFromServer();
  return { success: true, memories: getMemories() };
});

// ============================================
// Auto-Updater Setup
// ============================================

// Survives the renderer not existing yet — the download usually finishes
// before the menubar window is first opened, so the renderer asks for this
// on mount instead of relying solely on the push event.
let downloadedUpdateVersion: string | null = null;

const setupAutoUpdater = () => {
  if (!app.isPackaged) {
    logger.log('[AutoUpdater] Skipping in development mode');
    return;
  }

  autoUpdater.logger = {
    info: (message: unknown) => logger.log('[AutoUpdater]', message),
    warn: (message: unknown) => logger.log('[AutoUpdater] WARN:', message),
    error: (message: unknown) => logger.error('[AutoUpdater] ERROR:', message),
    debug: (message: unknown) => logger.log('[AutoUpdater] DEBUG:', message),
  };

  autoUpdater.autoDownload = store.get('autoUpdate') !== false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    logger.log('[AutoUpdater] Checking for updates...');
    mb?.window?.webContents.send('update:checking');
  });

  autoUpdater.on('update-available', (info) => {
    logger.log('[AutoUpdater] Update available:', info.version);
    mb?.window?.webContents.send('update:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    logger.log('[AutoUpdater] No updates available');
    mb?.window?.webContents.send('update:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    logger.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
    mb?.window?.webContents.send('update:progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.log('[AutoUpdater] Update downloaded:', info.version);
    // The renderer shows a "Restart to update" prompt below the chat input —
    // a native dialog is jarring for a menubar app (pops behind windows, steals
    // focus). autoInstallOnAppQuit still applies if the prompt is ignored.
    downloadedUpdateVersion = info.version;
    mb?.window?.webContents.send('update:downloaded', info);
  });

  autoUpdater.on('error', (error) => {
    logger.error('[AutoUpdater] Error:', error);
    mb?.window?.webContents.send('update:error', error.message);
  });

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('[AutoUpdater] Check failed:', err);
    });
  }, 5000);

  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('[AutoUpdater] Periodic check failed:', err);
    });
  }, 4 * 60 * 60 * 1000);
};

// IPC handlers for manual update control
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) {
    return { success: false, error: 'Updates not available in development' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, data: result?.updateInfo };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('update:getPending', () => downloadedUpdateVersion);

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// ── Setup window IPC ──────────────────────────────────────────────────

ipcMain.handle('onboarding:getState', async () => {
  const token = await getToken();
  return {
    authenticated: !!token,
    onboardingCompleted: !!store.get('onboardingCompleted'),
    startAtLogin: !!store.get('startAtLogin'),
    autoUpdate: store.get('autoUpdate') !== false,
    theme: store.get('theme') || 'system',
    shortcut: store.get('globalShortcut') || 'CommandOrControl+Shift+A',
    trackingEnabled: getTimeTrackingSettings().enabled,
    version: app.getVersion(),
    isPackaged: app.isPackaged,
  };
});

ipcMain.handle('onboarding:open', async () => {
  mb?.hideWindow();
  await openOnboardingWindow();
  return true;
});

ipcMain.handle('onboarding:setTheme', (_, theme: unknown) => {
  if (theme !== 'system' && theme !== 'light' && theme !== 'dark') return false;
  store.set('theme', theme);
  const dark = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors);
  store.set('darkMode', dark);
  return true;
});

ipcMain.handle('onboarding:showDragHelper', (_, kind: unknown) => {
  if (kind !== 'accessibility' && kind !== 'screenRecording') return false;
  showDragHelper(kind);
  return true;
});

ipcMain.handle('onboarding:hideDragHelper', () => {
  hideDragHelper();
  return true;
});

// Native drag-out of the app bundle. Must run synchronously inside the
// renderer's dragstart, which is why this is `on`, not `handle`.
ipcMain.on('onboarding:startAppDrag', (event) => {
  try {
    event.sender.startDrag({ file: appBundlePath(), icon: appDragIcon() });
  } catch (error) {
    logger.error('[Onboarding] startDrag failed:', error);
  }
});

ipcMain.handle('onboarding:hideHotkeyHint', () => {
  hideHotkeyHint();
  return true;
});

ipcMain.handle('onboarding:complete', async (_, opts: unknown) => {
  const relaunch = !!(opts && typeof opts === 'object' && (opts as { relaunch?: unknown }).relaunch === true);
  store.set('onboardingCompleted', true);
  logger.log('[Onboarding] Completed', { relaunch });

  if (relaunch) {
    // macOS only hands window titles to a process started after the Screen
    // Recording grant. Come back straight into the popover.
    store.set('resumeAfterRelaunch', true);
    closeOnboardingWindows();
    app.relaunch();
    app.exit(0);
    return true;
  }

  closeOnboardingWindows();

  // The popover was created before sign-in; a reload re-mounts it with the
  // token in place, then it opens with the hotkey card underneath.
  const popover = mb?.window;
  const shortcut = store.get('globalShortcut') || 'CommandOrControl+Shift+A';
  if (popover && !popover.isDestroyed()) {
    popover.webContents.once('did-finish-load', () => {
      mb?.showWindow();
      showHotkeyHint(shortcut);
    });
    popover.webContents.reload();
  } else {
    mb?.showWindow();
    showHotkeyHint(shortcut);
  }
  return true;
});

// App lifecycle
app.on('ready', async () => {
  // Initialize Sentry now that app is ready
  await initSentry();

  // Clear launch-specific flags
  store.delete('permissionsPromptedLaunch');
  store.delete('permissionsUserSkipped');

  const startAtLogin = Boolean(store.get('startAtLogin'));
  app.setLoginItemSettings({ openAtLogin: startAtLogin });

  createMenubar();

  // Setup auto-updater
  setupAutoUpdater();
});

app.on('before-quit', () => {
  // Finalize tracking before the process dies. Order matters: the detector's
  // stop() closes an open meeting and emits meetingEnded → addMeetingEntry, so
  // it must run while the tracker is still alive; monitor.stop() finalizes the
  // current activity the same way; tracker.stop() last — it saves entries and
  // fires a final sync. Without this, quitting mid-call (including the
  // auto-updater's relaunch) silently discarded the whole meeting.
  getMeetingDetector()?.stop();
  getActivityMonitor()?.stop();
  getTimeTracker()?.stop();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
