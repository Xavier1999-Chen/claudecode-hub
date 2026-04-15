import { Transform } from 'node:stream';
import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../..', import.meta.url));
const DEFAULT_LOGS_DIR = join(projectRoot, 'logs');

// Rough USD cost per million tokens (input/output) by model prefix
const COSTS = {
  'claude-opus': { in: 15, out: 75 },
  'claude-sonnet': { in: 3, out: 15 },
  'claude-haiku': { in: 0.8, out: 4 },
};

function costPerToken(model) {
  for (const [prefix, rates] of Object.entries(COSTS)) {
    if (model.includes(prefix.replace('claude-', ''))) return rates;
  }
  return { in: 3, out: 15 }; // default to sonnet pricing
}

/**
 * Creates a Transform stream that:
 * 1. Passes all chunks through unchanged.
 * 2. Detects SSE `message_delta` events and appends to usage.jsonl.
 */
export function createUsageTapper({ accountId, terminalId, model, logsDir = DEFAULT_LOGS_DIR }) {
  let buffer = '';

  const tapper = new Transform({
    async transform(chunk, _enc, cb) {
      buffer += chunk.toString();
      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'message_delta' && event.usage) {
              const { input_tokens: inTok, output_tokens: outTok } = event.usage;
              const rates = costPerToken(model);
              const usd = (inTok * rates.in + outTok * rates.out) / 1e6;
              const record = {
                ts: Date.now(),
                terminalId,
                accountId,
                mdl: model,
                in: inTok,
                out: outTok,
                usd: Math.round(usd * 1e8) / 1e8,
              };
              const logDir = join(logsDir, accountId);
              const logPath = join(logDir, 'usage.jsonl');
              await mkdir(logDir, { recursive: true });
              await appendFile(logPath, JSON.stringify(record) + '\n');
            }
          } catch {
            // Not JSON or write failed — skip
          }
        }
      }
      this.push(chunk);
      cb();
    },
    flush(cb) {
      cb();
    },
  });

  return tapper;
}
