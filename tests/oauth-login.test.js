import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildTmuxNewSessionArgs } from '../src/admin/oauth-login.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const baseOpts = {
  tmuxSession: 'hub-test',
  configDir: '/tmp/hub-acc-test',
  claudePath: '/usr/bin/claude',
};

function indexOfPair(args, flag, value) {
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === flag && args[i + 1] === value) return i;
  }
  return -1;
}

test('buildTmuxNewSessionArgs: baseline args include session, config dir, and login command', () => {
  const args = buildTmuxNewSessionArgs({ ...baseOpts, env: {} });

  assert.ok(indexOfPair(args, '-s', 'hub-test') !== -1, 'must include "-s hub-test" as adjacent elements');
  assert.ok(
    indexOfPair(args, '-e', 'CLAUDE_CONFIG_DIR=/tmp/hub-acc-test') !== -1,
    'must include "-e CLAUDE_CONFIG_DIR=..." as adjacent elements',
  );
  assert.equal(args[args.length - 1], '/usr/bin/claude login', 'last arg must be the claude login command');
  assert.equal(args[0], 'new-session');
});

test('buildTmuxNewSessionArgs: forwards all six proxy env keys as separate argv elements', () => {
  const env = {
    HTTPS_PROXY: 'http://p:8080',
    https_proxy: 'http://p:8080',
    HTTP_PROXY: 'http://p:8081',
    http_proxy: 'http://p:8081',
    NO_PROXY: 'localhost,127.0.0.1',
    no_proxy: 'localhost,127.0.0.1',
  };
  const args = buildTmuxNewSessionArgs({ ...baseOpts, env });

  for (const [key, value] of Object.entries(env)) {
    assert.ok(
      indexOfPair(args, '-e', `${key}=${value}`) !== -1,
      `must pass "-e ${key}=${value}" as two adjacent argv elements (not a merged shell string)`,
    );
  }
});

test('buildTmuxNewSessionArgs: omits proxy -e flags for unset keys', () => {
  const args = buildTmuxNewSessionArgs({ ...baseOpts, env: {} });
  const hasProxyFlag = args.some(a => /^(HTTPS?|NO)_PROXY=|^(https?|no)_proxy=/.test(a));
  assert.equal(hasProxyFlag, false, 'no proxy -e flag should be emitted when env is empty');
});

test('buildTmuxNewSessionArgs: preserves shell metacharacters verbatim (no shell interpretation)', () => {
  // A proxy URL containing chars that /bin/sh would interpret: $, space, ;, backtick, quote
  const malicious = 'http://user:p$word with space;rm -rf /@proxy:8080';
  const args = buildTmuxNewSessionArgs({
    ...baseOpts,
    env: { HTTPS_PROXY: malicious },
  });

  // The value must appear as one intact argv element — not split on spaces, no $ expansion.
  assert.ok(
    indexOfPair(args, '-e', `HTTPS_PROXY=${malicious}`) !== -1,
    'malicious proxy value must survive as a single argv element, proving argv-form bypasses the shell',
  );
});

test('startTmuxLogin JSDoc mentions proxy env forwarding', async () => {
  const src = await readFile(join(repoRoot, 'src/admin/oauth-login.js'), 'utf8');
  const match = src.match(/\/\*\*([\s\S]*?)\*\/\s*export\s+async\s+function\s+startTmuxLogin/);
  assert.ok(match, 'expected JSDoc block immediately before startTmuxLogin');
  assert.match(match[1], /proxy/i, 'JSDoc should document the proxy env forwarding side effect');
});