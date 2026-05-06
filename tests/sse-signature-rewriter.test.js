import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { FOREIGN_SIGNATURE_SENTINEL, createForeignSignatureRewriter } from '../src/proxy/sse-signature-rewriter.js';

async function runThrough(rewriter, chunks) {
  const out = [];
  return new Promise((resolve, reject) => {
    rewriter.on('data', c => out.push(c.toString('utf8')));
    rewriter.on('end', () => resolve(out.join('')));
    rewriter.on('error', reject);
    Readable.from(chunks).pipe(rewriter);
  });
}

test('rewrites signature_delta to sentinel', async () => {
  const rewriter = createForeignSignatureRewriter();
  const sse = 'event: content_block_delta\n'
    + 'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"long_fake_4kb_signature_blob"}}\n\n';
  const out = await runThrough(rewriter, [sse]);
  assert.match(out, new RegExp(`"signature":"${FOREIGN_SIGNATURE_SENTINEL}"`));
  assert.doesNotMatch(out, /long_fake_4kb_signature_blob/);
});

test('preserves thinking_delta content (only signature is touched)', async () => {
  const rewriter = createForeignSignatureRewriter();
  const sse = 'event: content_block_delta\n'
    + 'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"reasoning..."}}\n\n';
  const out = await runThrough(rewriter, [sse]);
  assert.match(out, /"thinking":"reasoning\.\.\."/);
  assert.doesNotMatch(out, new RegExp(FOREIGN_SIGNATURE_SENTINEL));
});

test('preserves content_block_start (no signature there yet)', async () => {
  const rewriter = createForeignSignatureRewriter();
  const sse = 'event: content_block_start\n'
    + 'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n';
  const out = await runThrough(rewriter, [sse]);
  assert.equal(out, sse);
});

test('preserves text_delta and unrelated event types', async () => {
  const rewriter = createForeignSignatureRewriter();
  const sse = 'event: content_block_delta\n'
    + 'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hello"}}\n\n'
    + 'event: message_stop\n'
    + 'data: {"type":"message_stop"}\n\n';
  const out = await runThrough(rewriter, [sse]);
  assert.equal(out, sse);
});

test('handles multiple signature_delta events in one stream', async () => {
  const rewriter = createForeignSignatureRewriter();
  const sse = 'event: content_block_delta\n'
    + 'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig1"}}\n\n'
    + 'event: content_block_delta\n'
    + 'data: {"type":"content_block_delta","index":1,"delta":{"type":"signature_delta","signature":"sig2"}}\n\n';
  const out = await runThrough(rewriter, [sse]);
  // Both signatures rewritten
  const matches = out.match(new RegExp(FOREIGN_SIGNATURE_SENTINEL, 'g'));
  assert.equal(matches?.length, 2);
  assert.doesNotMatch(out, /sig1|sig2/);
});

test('handles chunks split mid-event (boundary not on \\n\\n)', async () => {
  const rewriter = createForeignSignatureRewriter();
  // Split arbitrarily mid-JSON
  const event1 = 'event: content_block_delta\n'
    + 'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"will_be_replaced"}}\n\n';
  const out = await runThrough(rewriter, [
    event1.slice(0, 30),
    event1.slice(30, 80),
    event1.slice(80),
  ]);
  assert.match(out, new RegExp(`"signature":"${FOREIGN_SIGNATURE_SENTINEL}"`));
  assert.doesNotMatch(out, /will_be_replaced/);
});

test('handles chunks split between events', async () => {
  const rewriter = createForeignSignatureRewriter();
  const sse = 'event: content_block_delta\n'
    + 'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"a"}}\n\n'
    + 'event: content_block_delta\n'
    + 'data: {"type":"content_block_delta","index":1,"delta":{"type":"signature_delta","signature":"b"}}\n\n';
  // Cut exactly between events
  const cut = sse.indexOf('\n\n') + 2;
  const out = await runThrough(rewriter, [sse.slice(0, cut), sse.slice(cut)]);
  const matches = out.match(new RegExp(FOREIGN_SIGNATURE_SENTINEL, 'g'));
  assert.equal(matches?.length, 2);
});

test('passes malformed JSON data: lines through unchanged (defensive)', async () => {
  const rewriter = createForeignSignatureRewriter();
  // signature_delta token present but JSON is broken
  const sse = 'data: {broken signature_delta json\n\n';
  const out = await runThrough(rewriter, [sse]);
  assert.equal(out, sse);
});

test('does not touch non-data lines (event:, comments, blanks)', async () => {
  const rewriter = createForeignSignatureRewriter();
  const sse = ': comment\nevent: ping\n\n';
  const out = await runThrough(rewriter, [sse]);
  assert.equal(out, sse);
});

test('flushes trailing fragment without \\n\\n terminator', async () => {
  const rewriter = createForeignSignatureRewriter();
  // Last fragment has no terminator (e.g. upstream ended early) — must still
  // forward whatever was buffered so the client sees it.
  const sse = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"trail"}}';
  const out = await runThrough(rewriter, [sse]);
  assert.match(out, new RegExp(`"signature":"${FOREIGN_SIGNATURE_SENTINEL}"`));
});
