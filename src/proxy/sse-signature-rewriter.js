import { Transform } from 'node:stream';

/**
 * Sentinel marking thinking-block signatures that came from a non-Anthropic
 * upstream (relay / aggregated provider). When the proxy later forwards the
 * conversation history to a real Anthropic OAuth account,
 * thinking-sanitizer.js detects this sentinel and strips the entire block —
 * Anthropic decrypts signatures cryptographically and rejects anything it
 * didn't produce.
 *
 * Real signatures are long base64 blobs and never naturally collide.
 */
export const FOREIGN_SIGNATURE_SENTINEL = '__hub_foreign_signature__';

/**
 * Streaming Transform: watches an Anthropic-format SSE response and rewrites
 * every thinking-block signature to FOREIGN_SIGNATURE_SENTINEL before the
 * stream reaches the client. Use it on the SSE pipe coming back from relay /
 * aggregated accounts only — real Anthropic OAuth responses must be left
 * untouched so legitimate signatures survive for multi-turn continuation.
 *
 * Three signature locations are covered:
 *   1. Anthropic spec: `content_block_delta` with `delta.type =
 *      "signature_delta"` and `delta.signature`.
 *   2. Some Kimi/GLM-style upstreams: `content_block_start` with embedded
 *      `content_block.type === "thinking"` and a `content_block.signature`.
 *   3. Same shape as (2) but on `content_block_stop`.
 *
 * Both `data: {...}` (Anthropic spec, with space) and `data:{...}` (observed
 * on Kimi-based aggregated providers, no space) are accepted. SSE event
 * boundaries are `\n\n`; an incomplete trailing event is buffered until the
 * next chunk completes it. Lines whose `data:` JSON fails to parse pass
 * through unchanged so we never break the stream.
 */
export function createForeignSignatureRewriter() {
  let pending = '';

  function rewriteEvent(eventText) {
    return eventText.split('\n').map(line => {
      if (!line.startsWith('data:')) return line;
      const jsonStr = line.slice(5).trimStart();
      if (!jsonStr.includes('signature')) return line;
      try {
        const obj = JSON.parse(jsonStr);
        if (obj?.type === 'content_block_delta'
            && obj?.delta?.type === 'signature_delta'
            && typeof obj.delta.signature === 'string') {
          obj.delta.signature = FOREIGN_SIGNATURE_SENTINEL;
          return 'data: ' + JSON.stringify(obj);
        }
        if ((obj?.type === 'content_block_start' || obj?.type === 'content_block_stop')
            && obj?.content_block?.type === 'thinking'
            && typeof obj.content_block.signature === 'string') {
          obj.content_block.signature = FOREIGN_SIGNATURE_SENTINEL;
          return 'data: ' + JSON.stringify(obj);
        }
      } catch { /* malformed JSON — pass through unchanged */ }
      return line;
    }).join('\n');
  }

  return new Transform({
    transform(chunk, _encoding, callback) {
      pending += chunk.toString('utf8');
      const parts = pending.split('\n\n');
      pending = parts.pop() ?? '';
      if (parts.length === 0) return callback();
      const out = parts.map(rewriteEvent).join('\n\n') + '\n\n';
      callback(null, Buffer.from(out, 'utf8'));
    },
    flush(callback) {
      if (!pending) return callback();
      const out = rewriteEvent(pending);
      pending = '';
      callback(null, Buffer.from(out, 'utf8'));
    },
  });
}
