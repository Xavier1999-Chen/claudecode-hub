// Locks the icon-asset declarations in index.html so we don't regress to
// the SVG-only state that breaks WeChat in-app browser (see GitHub #8).
// SVG faviconly works in modern desktop browsers; mobile and especially
// WeChat need PNG fallbacks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(repoRoot, 'src/admin/frontend/index.html');
const publicDir = join(repoRoot, 'src/admin/frontend/public');

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

test('index.html declares an apple-touch-icon (iOS / WeChat iOS need this)', async () => {
  const html = await readFile(indexPath, 'utf8');
  assert.match(
    html,
    /<link\s+rel="apple-touch-icon"[^>]*href="\/[^"]+\.png"/,
    'expected <link rel="apple-touch-icon" href="/...png"> in index.html',
  );
});

test('index.html declares a 192x192 PNG icon (Android Chrome / WeChat Android)', async () => {
  const html = await readFile(indexPath, 'utf8');
  assert.match(
    html,
    /<link\s+rel="icon"\s+type="image\/png"\s+sizes="192x192"\s+href="\/[^"]+\.png"/,
    'expected <link rel="icon" type="image/png" sizes="192x192" ...>',
  );
});

test('every icon path referenced by index.html exists in public/', async () => {
  const html = await readFile(indexPath, 'utf8');
  // Match href="/foo.ext" inside any <link rel="...icon..."> tag (incl. apple-touch-icon)
  const linkRegex = /<link\s+[^>]*rel="[^"]*icon[^"]*"[^>]*href="(\/[^"]+)"/gi;
  const hrefs = [];
  for (const m of html.matchAll(linkRegex)) hrefs.push(m[1]);
  assert.ok(hrefs.length > 0, 'expected at least one icon <link> in index.html');

  for (const href of hrefs) {
    const filePath = join(publicDir, basename(href));
    assert.ok(
      await fileExists(filePath),
      `index.html references ${href} but ${filePath} does not exist`,
    );
  }
});