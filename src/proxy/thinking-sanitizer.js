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
 * contains thinking blocks whose signatures were either absent, empty,
 * or fabricated by the third-party upstream. Anthropic decrypts the
 * signature server-side and rejects with:
 *
 *   400 invalid_request_error
 *   "messages.N.content.M: Invalid `signature` in `thinking` block"
 *
 * Stripping the *entire* thinking block from history is safe in the
 * normal case (per Anthropic's docs: "you can omit thinking blocks from
 * previous turns ... or let the API strip them for you"), and is the
 * approach used by LiteLLM, CLIProxyAPI, and similar projects. The
 * "thinking must be passed back" 400 only fires when the request has
 * `thinking` enabled AND the conversation is mid-tool-use-loop (so the
 * assistant message starting with a tool_use must also start with a
 * thinking block). Foreign thinking blocks have already lost the
 * cryptographic chain, so passing them back was already broken; the
 * tool-loop edge case is documented as a known limitation in the README.
 *
 * Heuristic for "foreign":
 *   - signature absent, OR
 *   - signature is non-string, OR
 *   - signature shorter than the FOREIGN_THRESHOLD (real Anthropic
 *     signatures are long base64 strings, typically 200+ chars; even
 *     short fakes seen in the wild are < 50)
 *
 * Real Anthropic signatures are never modified.
 */

const FOREIGN_THRESHOLD = 50;

function isForeignThinkingBlock(block) {
  if (!block || block.type !== 'thinking') return false;
  const sig = block.signature;
  if (typeof sig !== 'string') return true;
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
