/**
 * Chat transport.
 *
 * The renderer talks to `/api/agi/chat` directly rather than proxying through
 * the main process. That used to look like an auth boundary, but the renderer
 * already holds the access token (`App.tsx` calls `auth.getToken()` on mount)
 * and the CSP already allows `connect-src https://app.accordio.ai`, so the
 * proxy was defending a line that wasn't there. Going direct lets the `ai`
 * package own stream parsing instead of the hand-rolled SSE reader that had
 * been silently discarding every tool and reasoning chunk.
 *
 * Two things this shim has to reconcile:
 *
 * 1. `/api/agi/chat` accepts `ModelMessage[]` (route.ts destructures
 *    `{ messages }` and hands them straight to `processBrainChat`), while
 *    `useChat` sends `UIMessage[]`. `prepareSendMessagesRequest` converts.
 * 2. Credits, session id and the 402 body ride on the HTTP response rather
 *    than in the stream, so they're read in a `fetch` wrapper.
 */

import { DefaultChatTransport, convertToModelMessages } from 'ai';
import { CreditsExhaustedError, TrialExpiredError, type AgiMessage } from './types';
import { getApiUrl, DEFAULT_API_URL } from './apiUrl';

export interface AgiTransportOptions {
  /** Current session id, or null on a fresh conversation. */
  getSessionId: () => string | null;
  /** Server minted or confirmed a session id (X-AGI-Session-Id). */
  onSessionId: (sessionId: string) => void;
  onCredits: (update: { creditsUsed: number; creditsRemaining: number }) => void;
  onCreditsExhausted: (detail: { message: string; creditsRemaining: number }) => void;
  onTrialExpired: (detail: { message: string }) => void;
}

export function createAgiTransport(options: AgiTransportOptions) {
  return new DefaultChatTransport<AgiMessage>({
    // Placeholder — every request overrides `api` below. Resolving the URL per
    // request (like the token) means the transport never has to be rebuilt,
    // and the first message can't race the async settings read and go to the
    // wrong host on a dev build.
    api: `${DEFAULT_API_URL}/api/agi/chat`,

    prepareSendMessagesRequest: async ({ messages }) => {
      // Flush any unsynced activity first so the agent's server-side context
      // reflects what the user just did. Best-effort — never block the send:
      // the sync has no timeout of its own, so race it against 2s rather than
      // letting a hung network stall the message until the OS TCP timeout.
      try {
        await Promise.race([
          window.electron.time.syncNow(),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch {
        // Sync failures are surfaced elsewhere; they must not eat a message.
      }

      // Fetched per request rather than captured once, so a token refreshed
      // mid-session is picked up without rebuilding the transport.
      const [token, apiUrl] = await Promise.all([
        window.electron.auth.getToken(),
        getApiUrl(),
      ]);

      return {
        api: `${apiUrl}/api/agi/chat`,
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: {
          messages: await convertToModelMessages(messages),
          sessionId: options.getSessionId() ?? undefined,
        },
      };
    },

    fetch: async (input, init) => {
      const response = await fetch(input as RequestInfo, init);

      // The server mints a session on the first turn and returns the id here.
      // Round-tripping it is what stops every message creating its own session
      // row — the desktop previously ignored this header entirely.
      const sessionId = response.headers.get('X-AGI-Session-Id');
      if (sessionId) options.onSessionId(sessionId);

      const remaining = parseInt(response.headers.get('X-Credits-Remaining') ?? '-1', 10);
      if (remaining >= 0) {
        options.onCredits({
          creditsUsed: parseInt(response.headers.get('X-Credits-Used') ?? '0', 10),
          creditsRemaining: remaining,
        });
      }

      if (response.status === 402) {
        // Read the body before the SDK turns this into a generic stream error,
        // so the UI can tell "trial over" apart from "out of credits" — the
        // credit guard uses the same status for both.
        const body = await response
          .clone()
          .json()
          .catch(() => ({}) as { error?: string; message?: string });
        if (body.error === 'trial_expired') {
          const message =
            body.message ?? 'Your 14-day trial has ended. Upgrade to Legend to keep creating.';
          options.onTrialExpired({ message });
          throw new TrialExpiredError(message);
        }
        const message = body.message ?? 'You have used all your daily messages.';
        options.onCreditsExhausted({ message, creditsRemaining: 0 });
        throw new CreditsExhaustedError(message, 0);
      }

      return response;
    },
  });
}
