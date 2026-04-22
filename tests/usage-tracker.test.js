import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createUsageTapper } from '../src/proxy/usage-tracker.js';

let dir;
test.before(async () => { dir = await mkdtemp(join(tmpdir(), 'hub-usage-')); });
test.after(async () => { await rm(dir, { recursive: true }); });

test('parses SSE message_start + message_delta and writes usage.jsonl', async () => {
  const start = {
    type: 'message_start',
    message: { usage: { input_tokens: 100 } },
  };
  const delta = {
    type: 'message_delta',
    usage: { output_tokens: 50 },
  };
  const sse = `data: ${JSON.stringify(start)}\n\ndata: ${JSON.stringify(delta)}\n\n`;
  const chunks = [];

  const tapper = createUsageTapper({
    accountId: 'acc_1',
    terminalId: 'sk-hub-abc',
    model: 'claude-sonnet-4-6',
    logsDir: dir,
  });

  const source = Readable.from([Buffer.from(sse)]);
  await pipeline(source, tapper, async function*(stream) {
    for await (const chunk of stream) chunks.push(chunk);
  });

  const logPath = join(dir, 'acc_1', 'usage.jsonl');
  const lines = (await readFile(logPath, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.accountId, 'acc_1');
  assert.equal(record.terminalId, 'sk-hub-abc');
  assert.equal(record.in, 100);
  assert.equal(record.out, 50);
  assert.match(record.mdl, /sonnet/);
  assert.ok(typeof record.ts === 'number');
  assert.ok(typeof record.usd === 'number');
});

test('passes chunks through unchanged', async () => {
  const sse = 'data: {"type":"ping"}\n\n';
  const chunks = [];
  const tapper = createUsageTapper({
    accountId: 'acc_2',
    terminalId: 'sk-hub-xyz',
    model: 'claude-haiku-4-5',
    logsDir: dir,
  });
  const source = Readable.from([Buffer.from(sse)]);
  await pipeline(source, tapper, async function*(stream) {
    for await (const chunk of stream) chunks.push(chunk.toString());
  });
  assert.equal(chunks.join(''), sse);
});

test('writes usage on close even if flush is not called (client disconnect)', async () => {
  const start = { type: 'message_start', message: { usage: { input_tokens: 200 } } };
  const delta = { type: 'message_delta', usage: { output_tokens: 80 } };
  const sse = `data: ${JSON.stringify(start)}\n\ndata: ${JSON.stringify(delta)}\n\n`;

  const tapper = createUsageTapper({
    accountId: 'acc_3',
    terminalId: 'sk-hub-close',
    model: 'claude-opus-4-7',
    logsDir: dir,
  });

  tapper.write(Buffer.from(sse));
  tapper.destroy();

  await new Promise(r => setTimeout(r, 100));

  const logPath = join(dir, 'acc_3', 'usage.jsonl');
  const lines = (await readFile(logPath, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.in, 200);
  assert.equal(record.out, 80);
});
