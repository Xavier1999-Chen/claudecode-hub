/**
 * Strip thinking blocks whose signatures came from a non-Anthropic upstream
 * before forwarding the conversation history to a real Anthropic OAuth
 * account. Anthropic decrypts signatures cryptographically and 400s on any
 * blob it didn't produce ("Invalid `signature` in `thinking` block"); per
 * Anthropic's docs, omitting prior-turn thinking blocks is safe.
 *
 * Detection:
 *   - **Sentinel match (primary)**: sse-signature-rewriter.js rewrites
 *     every relay/aggregated signature to FOREIGN_SIGNATURE_SENTINEL on
 *     inbound, so on replay we just check sig === sentinel.
 *   - **Length fallback**: signatures missing, non-string, or < 50 chars
 *     are also stripped — covers legacy turns from before the rewriter
 *     shipped and pathological providers that return empty signatures.
 *
 * Real Anthropic signatures (long base64 blobs that match neither rule)
 * pass through untouched.
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
