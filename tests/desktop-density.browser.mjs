// A desktop (fine pointer) shows the rest site's options without scrolling and Auto zoom stops at fineMax.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/desktop-density.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
try {
  for (const [w, h] of [[1280, 800], [970, 1000], [1920, 1000]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${server.url}index.html?shot=rest&shotSeed=4`);
    await page.waitForSelector('#shrine-leave');
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const scrolls = [...document.querySelectorAll('.rest-screen *')].filter(e => e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      const picks = document.querySelectorAll('.rest-screen .class-pick').length;
      const leave = document.querySelector('#shrine-leave').getBoundingClientRect();
      return { fine: matchMedia('(pointer: fine)').matches, scrolls: scrolls.length, picks, leaveH: leave.height, leaveW: leave.width,
        zoom: Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) };
    });
    assert.ok(m.fine, 'the test runs with a fine pointer');
    assert.ok(m.picks >= 4, `${w}x${h}: the rest site lists its options (${m.picks})`);
    assert.equal(m.scrolls, 0, `${w}x${h}: ${m.picks} options fit without a scroll region`);
    assert.ok(m.leaveH <= 42 && m.leaveW < 200, `${w}x${h}: Continue is label-sized (${m.leaveW}x${m.leaveH})`);
    assert.ok(m.zoom <= 1.1 + 1e-9, `${w}x${h}: Auto zoom is held at 1.1 on a mouse window (${m.zoom})`);
    await page.close();
  }
  // The dialogue's context panel is sized to its one line of text; the scene band takes what it frees.
  const ev = await browser.newPage({ viewport: { width: 1920, height: 1000 } });
  await ev.goto(`${server.url}index.html?shot=event&shotSeed=4`);
  await ev.waitForSelector('.dialogue-context');
  await ev.waitForTimeout(1200);
  const d = await ev.evaluate(() => {
    const root = document.querySelector('.dialogue-screen');
    return { h: root.clientHeight, ctx: document.querySelector('.dialogue-context').offsetHeight, scene: document.querySelector('.dialogue-scene').offsetHeight };
  });
  assert.ok(d.ctx < d.h * 0.2, `dialogue context panel is sized to its text (${d.ctx} of ${d.h})`);
  assert.ok(d.scene > d.h * 0.59, `the scene band took the freed height (${d.scene} of ${d.h})`);
  console.log('desktop-density: OK'); setTimeout(() => process.exit(0), 50);
} finally { await browser.close(); await server.close?.(); }
