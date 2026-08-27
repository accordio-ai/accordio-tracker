/**
 * useProjects — loads the user's project list for the Log flow.
 *
 * Replaces the ad-hoc retry loop that lived in ActivityHub. Three rules matter:
 *
 * 1. An empty list is a SUCCESS, not a retry trigger. The old loop required
 *    `data.length > 0`, so an account with no projects burned every retry and
 *    a server error looked identical to an empty account.
 * 2. Retries never stop. The old loop gave up after 5 attempts (~30s), so an
 *    app launched before the network was up stayed broken until relaunch.
 * 3. The last good list is cached, so a transient failure shows stale-but-real
 *    projects instead of an empty picker.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface Project {
  id: string;
  name: string;
  client_name?: string;
  color?: string;
}

export type ProjectsStatus = 'loading' | 'ready' | 'error';

export type ProjectsErrorCode =
  | 'not_authenticated'
  | 'auth_expired'
  | 'server_error'
  | 'network_error';

const CACHE_KEY = 'accordio.projects.cache.v1';

/** 2s, 4s, 8s, 16s, 32s, then every 60s — forever. */
function backoffMs(attempt: number): number {
  return Math.min(2000 * 2 ** attempt, 60_000);
}

function readCache(): Project[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(projects: Project[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(projects));
  } catch {
    // Quota or private mode — the cache is an optimization, not a requirement.
  }
}

export function useProjects() {
  const cached = useRef<Project[] | null>(null);
  if (cached.current === null) cached.current = readCache();

  const [projects, setProjects] = useState<Project[]>(cached.current ?? []);
  const [status, setStatus] = useState<ProjectsStatus>('loading');
  const [errorCode, setErrorCode] = useState<ProjectsErrorCode | null>(null);

  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);

  // Mirrored into a ref so the mount-only focus listener reads live status
  // rather than the value captured at first render.
  const statusRef = useRef<ProjectsStatus>('loading');
  statusRef.current = status;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    if (cancelledRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const result = await window.electron.projects.list();
      if (cancelledRef.current) return;

      if (result.success) {
        // An empty array here genuinely means "no projects yet".
        attemptRef.current = 0;
        clearTimer();
        setProjects(result.data);
        setErrorCode(null);
        setStatus('ready');
        writeCache(result.data);
        return;
      }

      setErrorCode(result.code);
      setStatus('error');
      clearTimer();
      const delay = backoffMs(attemptRef.current);
      attemptRef.current += 1;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void load();
      }, delay);
    } catch {
      // The IPC bridge itself failed — treat as a network-class error.
      if (cancelledRef.current) return;
      setErrorCode('network_error');
      setStatus('error');
      clearTimer();
      const delay = backoffMs(attemptRef.current);
      attemptRef.current += 1;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void load();
      }, delay);
    } finally {
      inFlightRef.current = false;
    }
  }, [clearTimer]);

  /** Force an immediate reload, resetting the backoff. */
  const reload = useCallback(() => {
    attemptRef.current = 0;
    clearTimer();
    void load();
  }, [clearTimer, load]);

  useEffect(() => {
    cancelledRef.current = false;
    void load();

    // Coming back to the window is a good moment to recover — the user may
    // have just signed in, or the network may have returned.
    const onFocus = () => {
      if (statusRef.current === 'error') reload();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelledRef.current = true;
      clearTimer();
      window.removeEventListener('focus', onFocus);
    };
    // Intentionally mount-only: `load` and `reload` are stable, and `status`
    // is read through the listener closure rather than resubscribing on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { projects, status, errorCode, reload };
}
