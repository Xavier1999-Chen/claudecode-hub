/**
 * Strip `thinking` content blocks from historical assistant messages.
 *
 * Anthropic's extended-thinking API returns `thinking` blocks that carry a
 * signature (HMAC) tied to the generating account. When the client replays
 * these blocks in a follow-up request, the upstream verifies the signature
 * against the CURRENT account. If the pool rotated accounts between turns
 * (OAuth → relay, relay → OAuth, or one OAuth → another), the signature
 * check fails with:
 *
 *   messages.N.content.M: Invalid `signature` in `thinking` block
 *
 * Dropping these blocks before forwarding avoids the mismatch. The model
 * re-derives thinking each turn anyway, so correctness is preserved —
 * only cross-turn thinking continuity is lost.
 *
 * @param {Buffer} bodyBuf
 * @returns {Buffer} original buffer (unchanged) or rewritten buffer
 */
export function stripThinkingBlocks(bodyBuf) {
  if (!bodyBuf || bodyBuf.length === 0) return bodyBuf;
  let parsed;
  try { parsed = JSON.parse(bodyBuf.toString()); } catch { return bodyBuf; }
  if (!Array.isArray(parsed?.messages)) return bodyBuf;

  let mutated = false;
  for (const msg of parsed.messages) {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;
    const filtered = msg.content.filter(
      b => b?.type !== 'thinking' && b?.type !== 'redacted_thinking'
    );
    if (filtered.length !== msg.content.length) {
      msg.content = filtered;
      mutated = true;
    }
  }
  if (!mutated) return bodyBuf;
  return Buffer.from(JSON.stringify(parsed));
}
