/**
 * Per-message actions: copy, rate, retry.
 *
 * Only rendered on the last assistant message and revealed on hover over the
 * message area, so the conversation stays clean. The row also carries the
 * credits counter (`trailing`), right-aligned.
 *
 * Unlike the dashboard, a rating is POSTed and stored rather than only firing
 * an analytics event. Analytics-only feedback means neither surface can answer
 * "which responses got a thumbs down", which is the entire reason to collect it.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { AgiMessage } from '../../lib/chat/types';
import { submitMessageFeedback } from '../../lib/chat/feedback';

interface MessageActionsProps {
  message: AgiMessage;
  isLast: boolean;
  isLoading: boolean;
  onRetry: () => void;
  /** Right-aligned extra content (the credits chip). */
  trailing?: ReactNode;
}

export function MessageActions({ message, isLast, isLoading, onRetry, trailing }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<'up' | 'down' | null>(null);

  const text = message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  const rate = useCallback(
    (value: 'up' | 'down') => {
      if (rating === value) return;
      setRating(value);
      // Fire and forget — a failed rating must never interrupt the chat.
      void submitMessageFeedback(message.id, value);
    },
    [rating, message.id]
  );

  // Only the last message gets an actions row, and only once it has text.
  if (!isLast || !text || isLoading) return null;

  const base =
    'rounded-lg p-1.5 text-(--text-tertiary) transition-colors hover:bg-white/5 hover:text-(--text-secondary)';

  return (
    <div className="mt-3 -ml-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
      <button type="button" onClick={copy} className={base} title={copied ? 'Copied' : 'Copy'}>
        {copied ? <Check size={14} className="text-[#78D277]" /> : <Copy size={14} />}
      </button>

      <button
        type="button"
        onClick={() => rate('up')}
        title="Good response"
        className={
          rating === 'up' ? 'rounded-lg p-1.5 text-[#78D277] bg-[#78D277]/10' : base
        }
      >
        <ThumbsUp size={14} />
      </button>

      <button
        type="button"
        onClick={() => rate('down')}
        title="Bad response"
        className={rating === 'down' ? 'rounded-lg p-1.5 text-red-400 bg-red-500/10' : base}
      >
        <ThumbsDown size={14} />
      </button>

      <button type="button" onClick={onRetry} className={base} title="Regenerate">
        <RotateCcw size={14} />
      </button>

      {trailing}
    </div>
  );
}
