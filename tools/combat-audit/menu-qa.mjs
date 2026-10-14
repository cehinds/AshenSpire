// Real pointer/touch menu audit against the canonical standalone build.
// MENU_URL=http://127.0.0.1:4413/AshenSpire.html node tools/combat-audit/menu-qa.mjs
// MENU_PHASE=before measures the original More > Quit route; after enforces final panel.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.env.MENU_URL || 'http://127.0.0.1:4413/AshenSpire.html';
const phase = process.env.MENU_PHASE || 'after';
const out = resolve(process.env.MENU_OUT || '/workspace/scratch/full-combat-audit/menu');
mkdirSync(out, { recursive: true });
const results = { url, phase, load: readFileSync('/proc/loadavg', 'utf8').trim(), devices: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  for (const phone of [false, true]) {
    const device = phone ? 'phone-touch' : 'desktop-mouse';
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: phone, hasTouch: phone });
    const page = await context.newPage();
    const report = { device, boots: [], actions: [], errors: [], findings: [] };
    results.devices.push(report);
    page.on('pageerror', (e) => report.errors.push(e.message));
    const press = (locator) => phone ? locator.tap() : locator.click();
    const measure = async (name, selector, done) => {
      const target = page.locator(selector).first();
      await target.scrollIntoViewIfNeeded();
      await page.evaluate(({ done }) => {
        window.__menuMeasure = { start: null, end: null, longtasks: [] };
        const measure = window.__menuMeasure;
        measure.observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) measure.longtasks.push({ start: e.startTime, duration: e.duration }); });
        measure.observer.observe({ type: 'longtask', buffered: false });
        addEventListener('pointerdown', () => {
          measure.start = performance.now();
          const poll = () => { if (document.querySelector(done)) measure.end = performance.now(); else requestAnimationFrame(poll); };
          requestAnimationFrame(poll);
        }, { once: true, capture: true });
      }, { done });
      await press(target);
      await page.waitForFunction(() => window.__menuMeasure?.end != null, null, { timeout: 10000 });
      await page.waitForTimeout(20);
      const timing = await page.evaluate(() => { const m = window.__menuMeasure; m.observer.disconnect(); return { milliseconds: +(m.end - m.start).toFixed(1), longTasks: m.longtasks.filter(e => e.start >= m.start && e.start <= m.end) }; });
      report.actions.push({ name, ...timing });
      console.log(device, name, timing.milliseconds);
    };
    for (const cache of ['cold', 'warm']) {
      const began = Date.now();
      await page.goto(url);
      await page.waitForSelector('.startup-gate');
      const gateMs = Date.now() - began;
      const clicked = Date.now();
      await press(page.locator('.startup-gate'));
      await page.waitForSelector('.title-screen', { timeout: 25000 });
      report.boots.push({ cache, gateMs, firstMenuMs: Date.now() - began, gateRevealMs: Date.now() - clicked });
    }
    const entries = await page.locator('.title-menu > li > button').evaluateAll((buttons) => buttons.map(b => ({ label: b.textContent.trim(), action: b.dataset.titleAction, disabled: b.disabled })));
    report.entries = entries;
    if (entries.some(e => e.action === 'lan')) throw new Error('Paused co-op entry is visible');
    if (phase !== 'before' && entries.at(-1)?.action !== 'quit') throw new Error('Quit is not the final main-menu panel');
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${out}/${phase}-${device}-menu.png` });
    await measure('Begin the climb', '#new-game', '.title-modal-veil');
    await measure('Select save slot', '[data-slot-pick="2"]', '[data-slot-pick="2"][aria-pressed="true"], [data-slot-pick="2"].is-selected');
    await measure('New Game back', '.title-modal-back', 'body:not(:has(.modal-veil)) .title-screen');
    for (const [name, selector, done] of [
      ['Load', '.title-menu #load-game', '.title-modal-veil'],
      ['Run history', '#run-history', '#hx-back'],
      ['Compendium', '#armaments', '#cp-back'],
      ['Bestiary', '#bestiary', ':is(.screen:not(.title-screen) [data-back], #set-close)'],
      ['Settings', '#settings', '#set-close'],
    ]) {
      await measure(name, selector, done);
      const backSelector = name === 'Settings' ? '.settings-modal .modal-close' : '.title-modal-veil .title-modal-back, .screen:not(.title-screen) [data-back]';
      const back = page.locator(backSelector).first();
      if (!await back.count()) throw new Error(`No back control from ${name}`);
      await measure(`${name} back`, backSelector, 'body:not(:has(.modal-veil)) .title-screen');
    }
    await press(page.locator('.title-more summary'));
    for (const [name, selector, opened, back] of [
      ['Custom climb', '#custom-run', '#cr-back', '#cr-back'],
      ['Profile', '#profile', '.profile-archive-modal', '.profile-archive-modal .prof-back'],
      ['Download & saves', '#download-game', '.offline-play-modal', '.offline-play-modal .modal-close'],
    ]) {
      await measure(name, selector, opened);
      await measure(`${name} back`, back, `body:not(:has(.modal-veil)) .title-screen`);
      // Closing a secondary modal restores the already-open More drawer.
      if (!await page.locator('.title-more[open]').count()) await press(page.locator('.title-more summary'));
    }
    if (phase !== 'before') await press(page.locator('.title-more summary'));
    await measure('Quit', '#quit-game', '.farewell');
    await page.waitForFunction(() => document.querySelector('#farewell-status')?.textContent.includes('browser kept') || document.querySelector('.farewell .subtitle')?.textContent.includes('may close'), { timeout: 3000 });
    report.quitFallback = await page.locator('.farewell .subtitle').textContent();
    await page.screenshot({ path: `${out}/${phase}-${device}-quit.png` });
    await measure('Quit return to title', '#farewell-back', '.startup-gate');
    await context.close();
    console.log(JSON.stringify(report));
  }
} finally {
  writeFileSync(`${out}/${phase}-results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
