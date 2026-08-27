/**
 * The model's extended thinking, collapsed by default.
 *
 * `brain-agent.ts` enables `thinking: { type: 'adaptive' }`, so reasoning has
 * been streaming to the desktop all along — the old parser just had no branch
 * for `reasoning-delta` and dropped it. This surfaces it at no extra cost.
 *
 * Collapsed by default because in a 400px popover a wall of reasoning buries
 * the actual answer.
 */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface ReasoningBlockProps {
  text: string;
}

export function ReasoningBlock({ text }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(false);
  if (!text.trim()) return null;

  return (
    <div className="mb-2 w-full">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-(--text-tertiary) transition-colors hover:text-(--text-secondary)"
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        Thought for a moment
      </button>
      {expanded && (
        <div className="mt-1 border-l border-(--border-soft) pl-3 text-[12px] leading-relaxed whitespace-pre-wrap text-(--text-tertiary)">
          {text}
        </div>
      )}
    </div>
  );
}
