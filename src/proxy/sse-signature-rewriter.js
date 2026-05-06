import { Transform } from 'node:stream';

/**
 * Sentinel string used to mark thinking-block signatures that came from a
 * non-Anthropic upstream (relay / aggregated provider). When the proxy later
 * forwards the conversation history to a real Anthropic OAuth account,
 * thinking-sanitizer.js looks for this sentinel and strips the entire block,
 * because Anthropic decrypts signatures cryptographically and rejects anything
 * it didn't produce.
 *
 * The sentinel is deliberately short and unmistakable — real Anthropic and
 * real third-party signatures are long base64/binary blobs and would never
 * naturally collide with this string.
 */
export const FOREIGN_SIGNATURE_SENTINEL = '__hub_foreign_signature__';

/**
 * Streaming Transform that watches an Anthropic-format SSE response and
 * rewrites the `signature` value of every `signature_delta` event so the
 * downstream client (and any conversation history derived from it) carries
 * the sentinel instead of the upstream's actual signature.
 *
 * Use this on the SSE pipe coming back from relay / aggregated accounts.
 * Do NOT use it on real Anthropic OAuth responses — those signatures are
 * legitimate and must be preserved for multi-turn continuation.
 *
 * Implementation notes:
 * - SSE event boundaries are `\n\n`. We split by those, modify, recombine.
 * - Anything in the trailing buffer (incomplete event) is held until the
 *   next chunk completes it, then processed.
 * - We only mutate `data:` lines that successfully JSON-parse to a
 *   `content_block_delta` event with `delta.type === 'signature_delta'`.
 *   Non-matching lines pass through byte-for-byte.
 * - When `data:` JSON parsing fails (truncated / malformed), the original
 *   line is forwarded unchanged so we never break the stream.
 */
export function createForeignSignatureRewriter() {
  let pending = '';
  let dumped = 0;

  function rewriteEvent(eventText) {
    return eventText.split('\n').map(line => {
      if (!line.startsWith('data:')) return line;
      // Some upstreams (e.g. Kimi-based aggregated providers) emit
      // `data:{...}` with no space; Anthropic spec uses `data: {...}`
      // with a space. Accept both.
      const jsonStr = line.slice(5).trimStart();
      if (!jsonStr.includes('signature')) return line;
      // Diagnostic dump: first 3 sig-bearing lines per request, truncated.
      if (dumped < 3) {
        dumped++;
        console.log(`[sse-rewriter] sig-bearing data line #${dumped} (len=${jsonStr.length}):`,
          jsonStr.slice(0, 400));
      }
      try {
        const obj = JSON.parse(jsonStr);
        // Form 1 (Anthropic streaming spec): signature arrives in
        // content_block_delta with delta.type === 'signature_delta'.
        if (obj?.type === 'content_block_delta'
            && obj?.delta?.type === 'signature_delta'
            && typeof obj.delta.signature === 'string') {
          console.log(`[sse-rewriter] rewrote signature_delta (orig len=${obj.delta.signature.length})`);
          obj.delta.signature = FOREIGN_SIGNATURE_SENTINEL;
          return 'data: ' + JSON.stringify(obj);
        }
        // Form 2 (some non-standard upstreams): signature embedded
        // directly inside a content_block_start of type=thinking.
        if (obj?.type === 'content_block_start'
            && obj?.content_block?.type === 'thinking'
            && typeof obj.content_block.signature === 'string') {
          console.log(`[sse-rewriter] rewrote content_block_start.thinking.signature (orig len=${obj.content_block.signature.length})`);
          obj.content_block.signature = FOREIGN_SIGNATURE_SENTINEL;
          return 'data: ' + JSON.stringify(obj);
        }
        // Form 3 (other non-standard): signature in content_block_stop.
        if (obj?.type === 'content_block_stop'
            && obj?.content_block?.type === 'thinking'
            && typeof obj.content_block.signature === 'string') {
          console.log(`[sse-rewriter] rewrote content_block_stop.thinking.signature (orig len=${obj.content_block.signature.length})`);
          obj.content_block.signature = FOREIGN_SIGNATURE_SENTINEL;
          return 'data: ' + JSON.stringify(obj);
        }
      } catch { /* leave the line as-is on parse failure */ }
      return line;
    }).join('\n');
  }

  return new Transform({
    transform(chunk, _encoding, callback) {
      pending += chunk.toString('utf8');
      const parts = pending.split('\n\n');
      // Keep the last (possibly incomplete) part in the buffer until it
      // gets terminated by a future \n\n.
      pending = parts.pop() ?? '';
      if (parts.length === 0) return callback();
      const out = parts.map(rewriteEvent).join('\n\n') + '\n\n';
      callback(null, Buffer.from(out, 'utf8'));
    },
    flush(callback) {
      if (!pending) return callback();
      // Final fragment — rewrite if it's a full event, otherwise emit raw.
      const out = rewriteEvent(pending);
      pending = '';
      callback(null, Buffer.from(out, 'utf8'));
    },
  });
}
