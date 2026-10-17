import { createRequire } from 'node:module';
const require = createRequire('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const names = ['day', 'night', 'fog', 'stormy', 'swamp', 'hot', 'rain', 'cold'];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 4096, height: 4096 }, deviceScaleFactor: 1, colorScheme: 'light' });
  await page.setContent('<!doctype html><html><head><style>html,body{margin:0;padding:0;width:4096px;height:4096px;background:transparent;overflow:hidden}img{display:block;width:4096px;height:4096px}</style></head><body><img id="filter"></body></html>');
  for (const name of names) {
    const svg = await readFile(join(here, `filter-${name}.svg`));
    await page.locator('#filter').evaluate((img, data) => { img.src = `data:image/svg+xml;base64,${data}`; }, svg.toString('base64'));
    await page.locator('#filter').evaluate(img => img.decode());
    await page.screenshot({ path: join(here, `filter-${name}.png`), clip: { x: 0, y: 0, width: 4096, height: 4096 }, omitBackground: true });
  }
  console.log(`Rendered ${names.length} 4096x4096 PNG overlays from their SVG sources with Chromium.`);
} finally {
  await browser.close();
}
