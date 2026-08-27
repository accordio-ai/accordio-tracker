/**
 * A tool call card.
 *
 * Ported from the dashboard's inline version. State handling matters more than
 * the styling: a pending tool is only *processing* if the turn it belongs to is
 * still live. A pending tool on a finished turn was interrupted, and it must
 * say so — captioning an interrupted `createContract` card "Contract created"
 * asserts a contract exists when it doesn't. That's why every config carries
 * both a past-tense `label` and a present-tense `processing` string.
 *
 * This is the first version of this component that can actually render. The
 * previous one read Anthropic-shaped `tool_use` blocks that `/api/agi/chat`
 * never produces, and the main-process stream parser discarded the real tool
 * chunks before they reached the renderer.
 */

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import {
  resolveToolConfig,
  TINT_CLASSES,
  DEFAULT_TOOL_DURATION,
} from '../../lib/chat/toolConfigs';
import { isPendingState, type ToolState } from '../../lib/chat/parts';

interface ToolCardProps {
  toolName: string;
  state: ToolState;
  errorText?: string;
  /** The owning turn is still streaming. */
  turnIsLive: boolean;
  /** Previous card was the same tool — draw a connector. */
  connectedToPrevious?: boolean;
}

export function ToolCard({
  toolName,
  state,
  errorText,
  turnIsLive,
  connectedToPrevious,
}: ToolCardProps) {
  const config = resolveToolConfig(toolName);
  const tint = TINT_CLASSES[config.tint];
  const Icon = config.icon;

  const pending = isPendingState(state);
  const isProcessing = pending && turnIsLive;
  const isInterrupted = pending && !turnIsLive;
  const isErrored = state === 'output-error';
  const isComplete = state === 'output-available';

  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number>(Date.now());

  // Progress creeps toward 92% over the tool's expected duration and stops —
  // it never claims a completion the stream hasn't reported.
  useEffect(() => {
    if (!isProcessing) return;
    const duration = (config.duration ?? DEFAULT_TOOL_DURATION) * 1000;
    const tick = () => {
      setProgress(Math.min(0.92, (Date.now() - startedAt.current) / duration));
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [isProcessing, config.duration]);

  return (
    <div className="relative w-full">
      {connectedToPrevious && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-2 left-5 h-2 w-px bg-(--border-medium)"
        />
      )}

      <div
        className={`relative overflow-hidden rounded-xl border px-3 py-2.5 transition-colors ${
          isErrored
            ? 'border-red-400/40 bg-red-500/5'
            : isComplete
              ? `border-transparent ${tint.bg}`
              : tint.border
        }`}
      >
        {/* Progress fill, behind the content. */}
        {isProcessing && (
          <span
            aria-hidden
            className={`absolute inset-0 origin-left ${tint.bg} transition-transform duration-200 ease-linear`}
            style={{ transform: `scaleX(${progress})` }}
          />
        )}

        <div className="relative flex items-center gap-2.5">
          <Icon
            size={15}
            className={`shrink-0 ${isErrored ? 'text-red-400' : tint.icon} ${
              isProcessing ? 'animate-pulse' : ''
            }`}
          />

          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-(--text-primary)">
            {isComplete ? config.label : config.processing}
          </span>

          {isComplete && <Check size={14} className="shrink-0 text-[#78D277]" />}

          {isInterrupted && (
            <span className="shrink-0 rounded-full border border-(--border-medium) px-2 py-0.5 text-[10px] text-(--text-tertiary)">
              Interrupted
            </span>
          )}

          {isErrored && (
            <span className="shrink-0 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
              Failed
            </span>
          )}
        </div>

        {errorText && (
          <p className="relative mt-1.5 text-[11px] leading-snug text-red-400">{errorText}</p>
        )}
      </div>
    </div>
  );
}

export default ToolCard;
