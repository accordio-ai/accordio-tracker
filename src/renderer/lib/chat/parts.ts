/**
 * Helpers for reading message parts.
 *
 * Tool parts are typed `tool-${toolName}` (plus a `dynamic-tool` variant), so
 * naive `type.startsWith('tool-')` checks both over-match and miss cases. The
 * `ai` package exports proper guards; use them.
 */

import { isToolUIPart, getToolName, type ToolUIPart } from 'ai';
import type { AgiPart } from './types';

export type AgiToolPart = ToolUIPart & {
  toolCallId: string;
  errorText?: string;
};

export function isToolPart(part: AgiPart): part is AgiToolPart {
  return isToolUIPart(part as never);
}

export function toolNameOf(part: AgiToolPart): string {
  return getToolName(part as never) as string;
}

/** The four states a tool part moves through, plus what they mean for the UI. */
export type ToolState = AgiToolPart['state'];

export function isPendingState(state: ToolState): boolean {
  return state === 'input-streaming' || state === 'input-available';
}
