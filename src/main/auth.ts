/**
 * Authentication Module
 *
 * Stores auth/refresh tokens encrypted with Electron's safeStorage, which binds
 * the encryption key to the OS keychain (macOS Keychain / Windows DPAPI). The
 * on-disk electron-store only ever holds opaque ciphertext, so the tokens are
 * useless to anyone who copies the file without also being the logged-in OS user.
 *
 * This replaces the previous approach (electron-store `encryptionKey` with a
 * constant string baked into the app bundle), which was obfuscation only — the
 * key shipped inside the asar and could be recovered from any copy of the app.
 *
 * Migration: tokens from the older stores are transparently re-encrypted into
 * the safeStorage-backed store on first access, so existing users stay signed in
 * across the upgrade. The long-lived (30-day) menubar JWT is independent of any
 * browser/Supabase session, so signing out on the web never invalidates it and
 * it survives laptop restarts (the Keychain entry persists).
 */

import Store from 'electron-store';
import { app, safeStorage } from 'electron';
import logger from './logger';

// v3 store: opaque ciphertext only — no encryptionKey, no embedded secret.
const tokenStore = new Store<Record<string, string>>({ name: 'secure-tokens-v3' });

// Older stores kept solely for a one-time migration so the upgrade doesn't
// log anyone out. v2 used a hardcoded encryptionKey (electron-store decrypts it
// transparently on read); v1 stored safeStorage-prefixed values directly.
const legacyV2Store = new Store<Record<string, string>>({
  name: 'secure-tokens-v2',
  encryptionKey: 'accordio-agi-v2-token-store',
});
const legacyV1Store = new Store<Record<string, string>>({ name: 'secure-tokens' });

const AUTH_TOKEN_KEY = 'auth-token';
const REFRESH_TOKEN_KEY = 'refresh-token';
const TOKEN_EXPIRY_KEY = 'token-expiry';
// Legacy: kept here only so the one-time migration can purge it from the old
// on-disk stores. The gateway WebSocket was retired with agi-gateway.
const LEGACY_GATEWAY_TOKEN_KEY = 'gateway-token';

const ENC_PREFIX = 'enc:';
const PLAIN_PREFIX = 'plain:';

/**
 * Whether OS-backed encryption is usable right now. safeStorage requires the
 * app to be ready and a keychain/credential store to be available (always true
 * on a signed macOS build post-ready; can be false on headless Linux/dev).
 */
function canEncrypt(): boolean {
  try {
    return app.isReady() && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptValue(value: string): string {
  if (canEncrypt()) {
    try {
      return ENC_PREFIX + safeStorage.encryptString(value).toString('base64');
    } catch (error) {
      logger.error('[Auth] safeStorage encrypt failed, falling back to plaintext:', error);
    }
  }
  // Fallback only when no OS keychain is available. Marked so it round-trips,
  // and so it gets upgraded to ciphertext the next time canEncrypt() is true.
  return PLAIN_PREFIX + value;
}

function decryptValue(stored: string | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith(ENC_PREFIX)) {
    if (!canEncrypt()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(ENC_PREFIX.length), 'base64'));
    } catch (error) {
      logger.error('[Auth] safeStorage decrypt failed:', error);
      return null;
    }
  }
  if (stored.startsWith(PLAIN_PREFIX)) {
    return stored.slice(PLAIN_PREFIX.length);
  }
  // Unprefixed legacy value (plain JWT from the v2 hardcoded-key store).
  return stored;
}

// One-time, best-effort migration of tokens from the legacy stores into the
// safeStorage-backed v3 store. Guarded so it runs at most once per process and
// only when the keychain is usable (otherwise we'd re-store as plaintext).
let migrationDone = false;
function migrateLegacyTokens(): void {
  if (migrationDone) return;

  // Nothing to migrate → never touch the keychain. safeStorage's first use
  // opens the app's Keychain item, and on a fresh install that is exactly
  // the "wants to use your confidential information" password prompt users
  // met on first launch. A signed-out app has no reason to ask.
  const hasLegacy = [legacyV2Store, legacyV1Store].some(
    (src) => !!src.get(AUTH_TOKEN_KEY) || !!src.get(REFRESH_TOKEN_KEY)
  );
  if (!hasLegacy) {
    migrationDone = true;
    return;
  }

  if (!canEncrypt()) return; // Try again on the next call once app is ready.
  migrationDone = true;

  try {
    const v3Empty = !tokenStore.get(AUTH_TOKEN_KEY) && !tokenStore.get(REFRESH_TOKEN_KEY);

    if (v3Empty) {
      // Prefer v2 (most recent), then v1.
      for (const src of [legacyV2Store, legacyV1Store]) {
        const rawToken = src.get(AUTH_TOKEN_KEY) as string | undefined;
        const rawRefresh = src.get(REFRESH_TOKEN_KEY) as string | undefined;
        const rawExpiry = src.get(TOKEN_EXPIRY_KEY) as string | undefined;

        const token = decryptValue(rawToken);
        if (token && !tokenStore.get(AUTH_TOKEN_KEY)) {
          tokenStore.set(AUTH_TOKEN_KEY, encryptValue(token));
        }
        const refresh = decryptValue(rawRefresh);
        if (refresh && !tokenStore.get(REFRESH_TOKEN_KEY)) {
          tokenStore.set(REFRESH_TOKEN_KEY, encryptValue(refresh));
        }
        if (rawExpiry && !tokenStore.get(TOKEN_EXPIRY_KEY)) {
          // Expiry is a non-secret timestamp; store as plain string.
          tokenStore.set(TOKEN_EXPIRY_KEY, rawExpiry.replace(new RegExp(`^${PLAIN_PREFIX}`), ''));
        }
      }
      if (tokenStore.get(AUTH_TOKEN_KEY)) {
        logger.log('[Auth] Migrated existing session into safeStorage (v3) — user stays signed in');
      }
    }

    // Purge legacy stores regardless, so we never read stale tokens again.
    try { legacyV2Store.clear(); } catch { /* ignore */ }
    try { legacyV1Store.clear(); } catch { /* ignore */ }
  } catch (error) {
    logger.error('[Auth] Legacy token migration failed (non-critical):', error);
  }
}

/**
 * Get the stored authentication token
 */
export async function getToken(): Promise<string | null> {
  try {
    migrateLegacyTokens();
    const stored = tokenStore.get(AUTH_TOKEN_KEY) as string | undefined;
    if (!stored) return null; // decryptValue would consult the keychain
    return decryptValue(stored);
  } catch (error) {
    logger.error('[Auth] Failed to get token:', error);
    return null;
  }
}

/**
 * Store the authentication token
 */
export async function setToken(token: string): Promise<void> {
  try {
    tokenStore.set(AUTH_TOKEN_KEY, encryptValue(token));
  } catch (error) {
    logger.error('[Auth] Failed to store token:', error);
    throw error;
  }
}

/**
 * Clear the stored authentication token
 */
export async function clearToken(): Promise<void> {
  try {
    tokenStore.delete(AUTH_TOKEN_KEY);
  } catch (error) {
    logger.error('[Auth] Failed to clear token:', error);
    throw error;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}

// Refresh token (for Supabase session tokens that expire in ~1hr)

export async function getRefreshToken(): Promise<string | null> {
  try {
    migrateLegacyTokens();
    const stored = tokenStore.get(REFRESH_TOKEN_KEY) as string | undefined;
    if (!stored) return null;
    return decryptValue(stored);
  } catch (error) {
    logger.error('[Auth] Failed to get refresh token:', error);
    return null;
  }
}

export async function setRefreshToken(token: string): Promise<void> {
  try {
    tokenStore.set(REFRESH_TOKEN_KEY, encryptValue(token));
  } catch (error) {
    logger.error('[Auth] Failed to store refresh token:', error);
    throw error;
  }
}

export async function clearRefreshToken(): Promise<void> {
  try {
    tokenStore.delete(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

// Token expiry tracking for proactive refresh (non-secret timestamp, stored plain)

export function getTokenExpiry(): number | null {
  try {
    const val = tokenStore.get(TOKEN_EXPIRY_KEY) as string | undefined;
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

export function setTokenExpiry(expiresAtMs: number): void {
  try {
    tokenStore.set(TOKEN_EXPIRY_KEY, String(expiresAtMs));
  } catch {
    // Non-critical
  }
}

/**
 * Clear all stored tokens (full sign-out)
 */
export async function clearAllTokens(): Promise<void> {
  tokenStore.delete(AUTH_TOKEN_KEY);
  tokenStore.delete(REFRESH_TOKEN_KEY);
  tokenStore.delete(TOKEN_EXPIRY_KEY);
  tokenStore.delete(LEGACY_GATEWAY_TOKEN_KEY);
  // Also purge legacy stores in case migration hadn't run yet.
  try { legacyV2Store.clear(); } catch { /* ignore */ }
  try { legacyV1Store.clear(); } catch { /* ignore */ }
}
