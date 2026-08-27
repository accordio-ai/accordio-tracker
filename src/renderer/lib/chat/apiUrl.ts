/**
 * The web app base URL, resolved from settings once and cached.
 *
 * Resolved lazily (not at module load) because the transport used to capture
 * the URL when React mounted — before the async settings read had landed — so
 * a dev build pointing at a custom apiUrl could fire its first message at
 * production. Callers ask at request time instead.
 */

const DEFAULT_API_URL = 'https://app.accordio.ai';

let cached: Promise<string> | null = null;

export function getApiUrl(): Promise<string> {
  if (!cached) {
    cached = window.electron.settings
      .get('apiUrl')
      .then((value) => (typeof value === 'string' && value ? value : DEFAULT_API_URL))
      .catch(() => DEFAULT_API_URL);
  }
  return cached;
}

export { DEFAULT_API_URL };
