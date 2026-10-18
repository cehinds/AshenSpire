// Screenshot fixtures must mount the surface named by ?shot, even when the
// seeded route starts with another activity. Run against source or a built URL.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { serve } from '../serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const local = process.env.SHOT_QA_URL ? null : await serve({ root: path.resolve('.'), port: 0, open: false, quiet: true });
const base = process.env.SHOT_QA_URL || `http://127.0.0.1:${local.port}/`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
try {
  for (const shot of ['combat', 'shop']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = new URL(base); url.searchParams.set('gameProfile', 'core'); url.searchParams.set('shot', shot); url.searchParams.set('shotSeed', '3');
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    if (shot === 'combat') {
      await page.waitForFunction(() => Boolean(window.__combat), null, { timeout: 20000 });
      const connected = await page.evaluate(() => {
        const run = window.__combatRunForShot;
        return run.path.length === run.floor && run.path.every((id, at) => !at || run.mapGraph.nodes[run.path[at - 1]].next.includes(id));
      });
      assert.equal(connected, true, 'combat pose retains one connected route through its floor');
    }
    else await page.waitForSelector('.merchant-workspace', { timeout: 20000 });
    assert.deepEqual(errors, [], `${shot} fixture page errors`);
    await page.close();
  }
  console.log('Core seed 3 screenshot fixtures mount combat and shop.');
} finally { await browser.close(); if (local) await new Promise(resolve => local.server.close(resolve)); }
