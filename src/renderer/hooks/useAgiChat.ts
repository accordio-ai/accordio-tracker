/**
 * Chat state for the menubar app.
 *
 * Replaces the chat half of `useGateway`. Three things change:
 *
 * 1. Messages are `UIMessage`s with `parts[]`, so tool calls and reasoning
 *    survive to the renderer. The old path stringified everything, and its
 *    tool branch matched a `tool-call` chunk type that doesn't exist in the
 *    AI SDK v6 stream — so tool activity was dropped entirely.
 * 2. There is no separate `streamingContent` buffer. The in-flight assistant
 *    message is a real message in the array whose parts mutate.
 * 3. The delta de-dup and duplicate-completion guards are gone. They were
 *    vestigial from a removed second (WebSocket) stream that also emitted
 *    `agi:chatStream`; with one transport they're unnecessary by construction.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { createAgiTransport } from '../lib/chat/transport';
import { filesToParts, type AttachmentPart } from '../lib/chat/attachments';
import type { AgiMessage } from '../lib/chat/types';

export interface UseAgiChatResult {
  messages: AgiMessage[];
  /** True while a turn is in flight (submitted or streaming). */
  isLoading: boolean;
  /** True before the first chunk arrives — drives the "Thinking..." state. */
  isThinking: boolean;
  error: Error | null;
  /** Non-fatal attachment problems, shown inline in the composer. */
  attachmentErrors: string[];
  sendMessage: (text: string, files?: File[]) => Promise<void>;
  stop: () => void;
  retry: () => void;
  clear: () => void;
}

export function useAgiChat(): UseAgiChatResult {
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  // Built once. The API URL and auth token are resolved inside the transport
  // per request, so nothing here needs to react to async settings — a
  // transport rebuilt mid-session wouldn't be picked up by useChat anyway.
  const transport = useMemo(
    () =>
      createAgiTransport({
        getSessionId: () => sessionIdRef.current,
        // Holding the session id is what stops every message minting a new
        // server-side session row — the old client ignored this header.
        onSessionId: (id) => {
          sessionIdRef.current = id;
        },
        onCredits: (update) => {
          window.dispatchEvent(new CustomEvent('accordio:credits', { detail: update }));
        },
        onCreditsExhausted: (detail) => {
          window.dispatchEvent(new CustomEvent('accordio:credits-exhausted', { detail }));
        },
        onTrialExpired: (detail) => {
          window.dispatchEvent(new CustomEvent('accordio:trial-expired', { detail }));
        },
      }),
    []
  );

  const { messages, sendMessage: send, status, error, stop, setMessages, regenerate } =
    useChat<AgiMessage>({ transport });

  const isLoading = status === 'streaming' || status === 'submitted';
  // "Thinking" is the gap between submit and the first chunk landing.
  const isThinking = status === 'submitted';

  const sendMessage = useCallback(
    async (text: string, files?: File[]) => {
      const parts: AttachmentPart[] = [];

      if (files?.length) {
        const { parts: fileParts, errors } = await filesToParts(files);
        parts.push(...fileParts);
        setAttachmentErrors(errors);
      } else {
        setAttachmentErrors([]);
      }

      const trimmed = text.trim();
      if (trimmed) parts.push({ type: 'text', text: trimmed });
      if (parts.length === 0) return;

      await send({ parts } as Parameters<typeof send>[0]);
    },
    [send]
  );

  const clear = useCallback(() => {
    // Abort any in-flight stream first — the SDK's stream job holds a
    // reference to the old assistant message, so without this a "new chat"
    // mid-generation resurrects partial content into the fresh conversation.
    void stop();
    setMessages([]);
    sessionIdRef.current = null;
    setAttachmentErrors([]);
  }, [stop, setMessages]);

  const retry = useCallback(() => {
    void regenerate();
  }, [regenerate]);

  return {
    messages,
    isLoading,
    isThinking,
    error: (error as Error) ?? null,
    attachmentErrors,
    sendMessage,
    stop,
    retry,
    clear,
  };
}
