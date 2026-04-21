// Locks the fix for the in-page brand mark: U+2733 (✳) renders as a green
// emoji glyph on iOS regardless of CSS color, so the desktop's orange logo
// became a green box on iPhone / WeChat. Replaced with an inline SVG
// component (LogoMark). This test stops it from sneaking back in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(repoRoot, 'src/admin/frontend/src/components');

async function readJsxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.jsx')) files.push(join(dir, e.name));
  }
  return files;
}

test('no JSX file ships the bare ✳ (U+2733) glyph — use <LogoMark /> instead', async () => {
  const files = await readJsxFiles(componentsDir);
  assert.ok(files.length > 0, 'expected to find some .jsx files under components/');

  const offenders = [];
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    if (src.includes('\u2733')) offenders.push(file);
  }
  assert.deepEqual(
    offenders,
    [],
    `these files still contain the bare ✳ character:\n  ${offenders.join('\n  ')}\n` +
      `iOS renders ✳ as a green emoji regardless of CSS color. Use <LogoMark /> instead.`,
  );
});
