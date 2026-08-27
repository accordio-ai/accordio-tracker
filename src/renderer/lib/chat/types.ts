/**
 * Chat message model.
 *
 * These types come from the `ai` package rather than being redeclared, on
 * purpose. The interesting part of a parts-based model isn't the shape — it's
 * the reducer that turns a chunk stream into it: accumulating `tool-input-delta`
 * into partially-parsed JSON, moving a tool part through
 * `input-streaming → input-available → output-available | output-error`,
 * correlating by `toolCallId` across the up-to-5 steps that
 * `brain-agent.ts` allows per turn, and keying text parts by chunk id so two
 * text blocks in one step don't concatenate into each other.
 *
 * That reducer is exactly what the old hand-rolled SSE parser in
 * `src/main/api.ts` got wrong — it matched on a `tool-call` chunk type that
 * does not exist in the AI SDK v6 UI message stream, so every tool and
 * reasoning chunk was silently dropped. `ai` ships a tested implementation;
 * we use it instead of owning a second one.
 */

import type { UIMessage, UIMessagePart, UITools } from 'ai';

/**
 * `/api/agi/chat` emits no `data-*` parts — those are written by the dashboard's
 * `/api/ai/chat` hand-built stream writer, which this endpoint doesn't share.
 * Declared empty so adding one later is a type change, not a re-architecture.
 */
export type AgiDataParts = Record<string, never>;

/**
 * Brain tool schemas live in the web repo (`Accordio/lib/brain-tools.ts`) and
 * aren't importable across repos, so tool input/output stay `unknown`. Narrow
 * at the render site for the few tools that get a bespoke card body.
 */
export type AgiTools = UITools;

export interface AgiMetadata {
  creditsUsed?: number;
  creditsRemaining?: number;
  sessionId?: string;
}

export type AgiMessage = UIMessage<AgiMetadata, AgiDataParts, AgiTools>;
export type AgiPart = UIMessagePart<AgiDataParts, AgiTools>;

/** Thrown by the transport when the server returns 402 for missing credits. */
export class CreditsExhaustedError extends Error {
  readonly creditsRemaining: number;

  constructor(message: string, creditsRemaining: number) {
    super(message);
    this.name = 'CreditsExhaustedError';
    this.creditsRemaining = creditsRemaining;
  }
}

/** Thrown by the transport when the server returns 402 for an expired trial. */
export class TrialExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrialExpiredError';
  }
}
