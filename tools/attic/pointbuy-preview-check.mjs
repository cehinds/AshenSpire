// Run against a rebuilt preview server; Playwright must be available to Node.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { attributeRules } from '../src/content/attributes.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4277';
try {
  for (const width of [1440, 390]) for (const cls of ['starseer', 'reaver', 'rogue', 'herald']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/AshenSpire.html?shot=customize&shotClass=${cls}`);
    await page.locator('#cz-statedit').waitFor({ state: 'attached' });
    await page.locator('[data-face="character"]').evaluate(e => { if (e.getAttribute('aria-expanded') !== 'true') e.click(); });
    await page.locator('#cz-character-fold [data-face="primary"]').evaluate(e => { if (e.getAttribute('aria-expanded') !== 'true') e.click(); });
    const open = () => page.locator('#cz-statedit [data-creation-mode="pointbuy"]').click();
    const step = (stat, action) => page.locator(`.cc-stat-overlay [data-stat-id="${stat}"][data-stat-action="${action}"]`).click({ force: true });
    const pool = () => page.locator('.cc-stat-overlay .se-pool .sp-v').textContent();
    await open();
    assert.equal(await pool(), '10');
    for (const stat of ['dexterity', 'wisdom']) for (let i = 0; i < 7; i++) await step(stat, 'increase');
    assert.equal(await pool(), '0');
    assert.deepEqual(await page.locator('.cc-stat-overlay .se-value').allTextContents(), ['10','15','10','15','10']);
    await step('wisdom', 'decrease');
    assert.equal(await pool(), '1');
    await step('wisdom', 'increase');
    assert.equal(await pool(), '0');
    await page.locator('.cc-stat-overlay [data-stat-cancel]').click();
    await open();
    assert.equal(await pool(), '10');
    for (const [stat, value] of Object.entries(attributeRules.presets.pointbuy[cls])) {
      for (let i = 10; i < value; i++) await step(stat, 'increase');
    }
    assert.equal(await pool(), '0');
    const done = page.locator('.cc-stat-overlay [data-stat-done]');
    assert.notEqual(await done.getAttribute('aria-disabled'), 'true');
    await done.click();
    await page.locator('.cc-stat-overlay').waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    console.log(`PASS ${cls} ${width}px: spend, bounds, refund, reset, apply; no exceptions`);
    await page.close();
  }
} finally { await browser.close(); }
