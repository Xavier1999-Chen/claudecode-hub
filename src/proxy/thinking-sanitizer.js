/**
 * Strip "foreign" thinking blocks from outbound conversation history
 * before forwarding to Anthropic OAuth accounts.
 *
 * Issue #40 background:
 *
 * Anthropic's `thinking` content blocks carry a `signature` field that
 * is the cryptographically-encrypted thinking content. When the proxy
 * pool routes a multi-turn conversation across heterogeneous upstreams
 * (e.g. turn 1 went via an aggregated provider serving GLM / Kimi /
 * any non-Anthropic Claude-compatible model, turn 2 lands on a real
 * Anthropic OAuth account), the assistant history sent on turn 2
 * contains thinking blocks whose signatures cannot be decrypted by
 * Anthropic. Anthropic rejects with:
 *
 *   400 invalid_request_error
 *   "messages.N.content.M: Invalid `signature` in `thinking` block"
 *
 * Stripping the *entire* thinking block from history is safe in the
 * normal case (per Anthropic's docs: "you can omit thinking blocks from
 * previous turns ... or let the API strip them for you"), and is the
 * approach used by LiteLLM, CLIProxyAPI, and similar projects.
 *
 * Detection strategy:
 *
 *   - **Sentinel match (primary)**: `sse-signature-rewriter.js` rewrites
 *     every signature emitted by a relay / aggregated upstream to a
 *     known sentinel string before the SSE reaches the client. When
 *     Claude Code replays the assistant turn back to us, the foreign
 *     block is unambiguously identifiable by sig === sentinel — no
 *     reliance on signature length / shape, which can vary per provider
 *     (GLM-style fakes have been observed at 4 KB, well above any
 *     length-based threshold).
 *
 *   - **Length heuristic (fallback)**: signatures missing / non-string
 *     / shorter than 50 chars are also treated as foreign. This catches
 *     legacy turns logged before the rewriter shipped, plus pathological
 *     responses (provider returns empty signature).
 *
 * Real Anthropic signatures (don't match either rule) pass through.
 */

import { FOREIGN_SIGNATURE_SENTINEL } from './sse-signature-rewriter.js';

const FOREIGN_THRESHOLD = 50;

function isForeignThinkingBlock(block) {
  if (!block || block.type !== 'thinking') return false;
  const sig = block.signature;
  if (typeof sig !== 'string') return true;
  if (sig === FOREIGN_SIGNATURE_SENTINEL) return true;
  return sig.length < FOREIGN_THRESHOLD;
}

/**
 * Walk request body messages and remove foreign thinking blocks from
 * assistant content arrays. Mutates body in place. Returns the count of
 * blocks removed (0 when nothing changed).
 *
 * @param {{messages?: Array<{role: string, content: any}>}} body
 * @returns {number}
 */
export function sanitizeForeignThinkingBlocks(body) {
  if (!body || !Array.isArray(body.messages)) return 0;
  let removed = 0;
  for (const msg of body.messages) {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;
    const filtered = msg.content.filter(block => !isForeignThinkingBlock(block));
    if (filtered.length === msg.content.length) continue;
    removed += msg.content.length - filtered.length;
    // Anthropic requires assistant.content to be non-empty; if stripping
    // emptied it (block was the only content), drop a single empty text
    // block so the structure stays valid.
    msg.content = filtered.length > 0 ? filtered : [{ type: 'text', text: '' }];
  }
  return removed;
}
