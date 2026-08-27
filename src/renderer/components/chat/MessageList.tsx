/**
 * The conversation.
 *
 * Sticks to the bottom while the user is already there, and stops following if
 * they scroll up to read — the old implementation called `scrollIntoView` on
 * every render, which yanked you back down mid-read during a long answer.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown } from 'lucide-react';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { MessageActions } from './MessageActions';
import { ThinkingIndicator } from './ThinkingIndicator';
import type { AgiMessage } from '../../lib/chat/types';

/** Px from the bottom still counted as "at the bottom". */
const STICK_THRESHOLD = 48;

interface MessageListProps {
  messages: AgiMessage[];
  isLoading: boolean;
  isThinking: boolean;
  error: Error | null;
  onRetry: () => void;
  /** The credits chip — rendered right-aligned in the last message's
      actions row, so it scrolls with the conversation. */
  footer?: ReactNode;
}

export function MessageList({
  messages,
  isLoading,
  isThinking,
  error,
  onRetry,
  footer,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance <= STICK_THRESHOLD);
  }, []);

  // Follow new content only when the user hasn't scrolled away. useLayoutEffect
  // so the jump happens before paint rather than as a visible lurch.
  useLayoutEffect(() => {
    if (atBottom) scrollToBottom('auto');
  }, [messages, isThinking, atBottom, scrollToBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const lastIndex = messages.length - 1;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        // Bottom padding reserves the floating composer's measured height so the
        // last message can scroll fully clear of it, while mid-scroll content
        // passes underneath into the composer backdrop's fade.
        className="flex-1 space-y-4 overflow-y-auto px-4 pt-3 pb-[calc(var(--brain-bar-height,96px)+40px)]"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((message, i) => (
          <div key={message.id} className="group/msg">
            {message.role === 'user' ? (
              <UserMessage message={message} />
            ) : (
              <>
                <AssistantMessage
                  message={message}
                  isStreaming={isLoading}
                  isLast={i === lastIndex}
                />
                <MessageActions
                  message={message}
                  isLast={i === lastIndex}
                  isLoading={isLoading}
                  onRetry={onRetry}
                  trailing={i === lastIndex ? footer : undefined}
                />
              </>
            )}
          </div>
        ))}

        {isThinking && <ThinkingIndicator />}

        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
            Something went wrong.{' '}
            <button type="button" onClick={onRetry} className="underline underline-offset-2">
              Try again
            </button>
          </div>
        )}
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          aria-label="Scroll to latest"
          className="absolute bottom-[calc(var(--brain-bar-height,96px)+36px)] left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-(--border-medium) bg-(--bg-raised)/90 text-(--text-secondary) shadow-lg backdrop-blur-md transition-colors hover:text-(--text-primary)"
        >
          <ArrowDown size={14} />
        </button>
      )}
    </div>
  );
}
