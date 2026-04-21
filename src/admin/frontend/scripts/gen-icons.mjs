// One-shot icon generator. Renders public/favicon.svg into PNGs at the
// sizes mobile platforms (especially WeChat in-app browser) need to avoid
// falling back to an auto-generated coloured-letter icon. See GitHub #8.
//
// Usage: `npm run gen:icons` from src/admin/frontend.
// Re-run after editing favicon.svg; commit the resulting PNGs.

import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

const SIZES = [
  { size: 180, name: 'icon-180.png' }, // apple-touch-icon
  { size: 192, name: 'icon-192.png' }, // Android Chrome / WeChat Android
  { size: 512, name: 'icon-512.png' }, // PWA / large fallback
];

const svgSource = await readFile(join(publicDir, 'favicon.svg'), 'utf8');

for (const { size, name } of SIZES) {
  const png = new Resvg(svgSource, { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
  await writeFile(join(publicDir, name), png);
  console.log(`✓ wrote public/${name} (${size}×${size}, ${png.length} bytes)`);
}
