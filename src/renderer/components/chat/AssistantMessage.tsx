/**
 * An assistant turn.
 *
 * Matches the dashboard: flat left-aligned prose, no bubble, no avatar, no
 * header row. Tool cards render above the text within the same turn.
 *
 * Markdown goes through `react-markdown` rather than the dashboard's
 * hand-rolled regex formatter. The web version has no fenced-code-block
 * support and injects inline `onmouseover` handlers for a hover effect CSS
 * does for free — copying it would be a regression and an inline-script
 * surface. The visual output is matched via CSS instead.
 */

import MarkdownRenderer from './MarkdownRenderer';
import { ToolCard } from './ToolCard';
import { ArtifactCard } from './ArtifactCard';
import { ReasoningBlock } from './ReasoningBlock';
import type { AgiMessage } from '../../lib/chat/types';
import { isToolPart, toolNameOf } from '../../lib/chat/parts';
import { resolveArtifact } from '../../lib/chat/artifacts';

interface AssistantMessageProps {
  message: AgiMessage;
  /** The turn is still live — drives processing state on unfinished tools. */
  isStreaming: boolean;
  /** Last message in the list; only it may show a live processing state. */
  isLast: boolean;
}

export function AssistantMessage({ message, isStreaming, isLast }: AssistantMessageProps) {
  // Paragraph break between parts — text split around a tool call would
  // otherwise concatenate mid-sentence ("…fuller picture.Here's where…").
  const text = message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n');

  const reasoning = message.parts
    .filter((p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning')
    .map((p) => p.text)
    .join('');

  const toolParts = message.parts.filter(isToolPart);

  return (
    <div className="flex flex-col items-start">
      {reasoning && <ReasoningBlock text={reasoning} />}

      {toolParts.length > 0 && (
        <div className="mb-2 flex w-full flex-col gap-2">
          {toolParts.map((part, i) => {
            const previous = i > 0 ? toolParts[i - 1] : undefined;
            const name = toolNameOf(part);
            // A finished tool that left something openable (a contract, an
            // invoice, a client) gets a preview card under its status row.
            const artifact =
              part.state === 'output-available' ? resolveArtifact(name, part.output, part.input) : null;
            const key = part.toolCallId ?? `${message.id}-tool-${i}`;
            return (
              <div key={key} className="flex flex-col gap-2">
                <ToolCard
                  toolName={name}
                  state={part.state}
                  errorText={part.errorText}
                  // Only the live turn's last message can still be processing;
                  // anything else in a pending state was interrupted.
                  turnIsLive={isStreaming && isLast}
                  // Consecutive cards for the same tool get a connector line.
                  connectedToPrevious={previous ? toolNameOf(previous) === name : false}
                />
                {artifact && <ArtifactCard artifact={artifact} />}
              </div>
            );
          })}
        </div>
      )}

      {text && (
        <div
          className={`prose prose-sm dark:prose-invert max-w-none ${
            isStreaming && isLast ? 'streaming-prose' : ''
          }`}
        >
          <MarkdownRenderer content={text} />
        </div>
      )}
    </div>
  );
}
