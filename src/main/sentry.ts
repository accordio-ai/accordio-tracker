/**
 * Sentry Error Tracking for Accordio AGI Electron App
 *
 * Initializes Sentry for both the main and renderer processes.
 * Should be imported as early as possible in the main process.
 */

import { app } from 'electron';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

let isInitialized = false;
let Sentry: typeof import('@sentry/electron/main') | null = null;

export async function initSentry(): Promise<void> {
  if (isInitialized) return;

  // Only initialize if DSN is configured
  if (!SENTRY_DSN) {
    console.log('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  try {
    // Lazy-load Sentry to avoid calling app.getAppPath() before app is ready
    Sentry = await import('@sentry/electron/main');

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: app.isPackaged ? 'production' : 'development',
      release: `accordio-agi@${app.getVersion()}`,

      // Capture 100% of errors in production, 10% in development
      sampleRate: app.isPackaged ? 1.0 : 0.1,

      // Capture 20% of transactions for performance monitoring
      tracesSampleRate: 0.2,

      // Don't send events in development unless explicitly enabled
      enabled: app.isPackaged || process.env.SENTRY_DEBUG === 'true',

      // Add extra context
      initialScope: {
        tags: {
          'app.type': 'electron-menubar',
          'process.type': 'main',
          platform: process.platform,
          arch: process.arch,
        },
      },

      // Filter out noisy errors
      beforeSend(event, hint) {
        const error = hint.originalException;

        // Don't send network errors that are expected
        if (error instanceof Error) {
          const message = error.message.toLowerCase();

          // Skip gateway connection errors (expected when offline)
          if (
            message.includes('unexpected server response') ||
            message.includes('econnrefused') ||
            message.includes('enotfound') ||
            message.includes('etimedout')
          ) {
            return null;
          }

          // Skip EPIPE errors (expected in packaged apps)
          if ('code' in error && error.code === 'EPIPE') {
            return null;
          }
        }

        return event;
      },
    });

    isInitialized = true;
    console.log('[Sentry] Initialized for Accordio AGI');
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Capture an exception with optional context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: 'fatal' | 'error' | 'warning' | 'info';
  }
): void {
  if (!isInitialized || !Sentry) return;

  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    if (context?.level) {
      scope.setLevel(context.level);
    }

    Sentry!.captureException(error);
  });
}

/**
 * Capture a message with optional context
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' = 'info'
): void {
  if (!isInitialized || !Sentry) return;
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id?: string; email?: string } | null): void {
  if (!isInitialized || !Sentry) return;
  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
}): void {
  if (!isInitialized || !Sentry) return;
  Sentry.addBreadcrumb(breadcrumb);
}

export { Sentry };
