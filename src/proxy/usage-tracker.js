import { Transform } from 'node:stream';
import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
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
  return { in: 3, out: 15 };
}

/**
 * Creates a Transform stream that:
 * 1. Passes all chunks through unchanged.
 * 2. Accumulates token counts from message_start (input) and message_delta (output),
 *    then writes one usage record per request to usage.jsonl.
 */
export function createUsageTapper({ accountId, terminalId, model, logsDir = DEFAULT_LOGS_DIR }) {
  console.log(`[tapper] created for accountId=${accountId} terminalId=${terminalId?.slice(0,20)} model=${model}`);
  let buffer = '';
  let inTok = 0;
  let outTok = 0;
  let written = false;

  const writeUsage = async () => {
    console.log(`[tapper] writeUsage called: written=${written} inTok=${inTok} outTok=${outTok}`);
    if (written || (inTok === 0 && outTok === 0)) return;
    written = true;
    try {
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
      await mkdir(logDir, { recursive: true });
      await appendFile(join(logDir, 'usage.jsonl'), JSON.stringify(record) + '\n');
    } catch { /* write failure is non-fatal */ }
  };

  const tapper = new Transform({
    async transform(chunk, _enc, cb) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      if (lines.length > 0) console.log(`[tapper] processing ${lines.length} lines, buffer remainder=${buffer.length} chars`);

      for (const line of lines) {
        if (lines.length <= 5 || line.startsWith('data:') || line.startsWith('event:')) {
          console.log(`[tapper] line: ${JSON.stringify(line.slice(0, 150))}`);
        }
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          console.log(`[tapper] parsed event type=${event.type}`);
          if (event.type === 'message_start' && event.message?.usage) {
            inTok += event.message.usage.input_tokens ?? 0;
          }
          if (event.type === 'message_delta' && event.usage) {
            outTok += event.usage.output_tokens ?? 0;
          }
        } catch { /* skip */ }
      }

      this.push(chunk);
      cb();
    },
    async flush(cb) {
      console.log(`[tapper] flush inTok=${inTok} outTok=${outTok}`);
      await writeUsage();
      cb();
    },
  });

  tapper.on('close', () => {
    console.log(`[tapper] close inTok=${inTok} outTok=${outTok} written=${written}`);
    writeUsage();
  });

  return tapper;
}
