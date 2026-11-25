// Run with PLAYWRIGHT_MODULE/CHROME when Playwright and Chrome are already installed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const { server, port } = await serve({ root, host: '127.0.0.1', port: 0, open: false, quiet: true });
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const view = () => page.evaluate(() => {
    const { timing, plan, durationMs } = window.recipientRuntimePreview;
    return {
      timing,
      durationMs,
      plan: plan.map(({ recipe, ids, start, end }) => ({ shape: recipe.shape, ids, start, end })),
      rows: [...document.querySelectorAll('#result-timeline li')].map(row => ({
        shape: row.dataset.shape, start: Number(row.dataset.start), end: Number(row.dataset.end),
      })),
    };
  });
  await page.goto('http://127.0.0.1:' + port + '/tools/recipient-effects-runtime-preview.html');
  await page.waitForFunction(() => window.recipientRuntimePreview);
  assert.equal(await page.title(), 'Recipient effects timing');
  const baseline = await view();
  assert.deepEqual(baseline.timing, { scope: 'battlefield', maxConcurrent: 1, gapMs: 30, overlapMs: 0, opacity: .8 });
  assert.ok(baseline.plan.length >= 6);
  assert.deepEqual(baseline.rows, baseline.plan.map(({ shape, start, end }) => ({ shape, start, end })));
  assert.ok(baseline.plan.every((clip, index) => index === 0 || clip.start - baseline.plan[index - 1].end >= 30));

  await page.locator('#timing-scope').selectOption('recipient');
  await page.waitForFunction(end => window.recipientRuntimePreview.durationMs < end, baseline.durationMs);
  const recipient = await view();
  assert.ok(recipient.plan.some((clip, index) => recipient.plan.slice(0, index).some(older => older.end > clip.start && !older.ids.some(id => clip.ids.includes(id)))));
  assert.deepEqual(recipient.plan.map(clip => clip.end - clip.start), baseline.plan.map(clip => clip.end - clip.start));
  assert.match(await page.locator('#timing-status').innerText(), /Unsaved changes.*Read-only/);
  assert.ok(await page.locator('#save-timing').isDisabled());

  await page.locator('#demo').selectOption('sequence');
  await page.locator('#timing-cap').fill('2');
  await page.locator('#timing-overlap').fill('40');
  await page.waitForFunction(() => window.recipientRuntimePreview.plan[1]?.start === window.recipientRuntimePreview.plan[0]?.end - 40);
  assert.equal(await page.locator('#timing-gap').inputValue(), '0');
  const overlapping = await view();
  await page.locator('#timing-opacity').evaluate(input => {
    input.value = '0.45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => window.recipientRuntimePreview.timing.opacity === .45);
  await page.evaluate(time => window.recipientRuntimePreview.scrub(time), overlapping.plan[1].start);
  await page.waitForFunction(() => [...document.querySelectorAll('.recipient-effect')].some(effect => effect.style.opacity === '0.45'));
  await page.locator('#play').click();
  await page.waitForFunction(() => !document.querySelector('#pause').disabled);
  await page.locator('#pause').click();
  assert.ok(await page.locator('#pause').isDisabled());

  const downloadEvent = page.waitForEvent('download');
  await page.locator('#download-timing').click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { scope: 'recipient', maxConcurrent: 2, gapMs: 0, overlapMs: 40, opacity: .45 });
  assert.match(await page.locator('#timing-status').innerText(), /Unsaved changes/);

  await page.locator('#timing-cap').fill('1');
  assert.ok(await page.locator('#timing-overlap').isDisabled());
  assert.equal(await page.locator('#timing-overlap').inputValue(), '0');
  await page.locator('#reset-timing').click();
  await page.waitForFunction(() => window.recipientRuntimePreview.timing.scope === 'battlefield');
  assert.deepEqual((await view()).timing, baseline.timing);

  const legacy = await page.evaluate(() => window.recipientRuntimePreview.configure({ action: 'attack', outcome: 'ward-shatter' }));
  assert.equal(await page.locator('#demo').inputValue(), 'single');
  assert.ok(legacy.recipes.some(recipe => recipe.shape === 'ward-shatter'));
  const reach = await page.evaluate(async () => {
    const editor = window.recipientRuntimePreview;
    await editor.configure({ action: 'casting', camp: 'spell', range: 'reach', outcome: 'hit',
      timing: { ...editor.timing, scope: 'recipient' } });
    return editor.plan;
  });
  assert.deepEqual(reach.map(entry => entry.recipe.phase), ['windup', 'delivery', 'contact']);
  assert.equal(new Set(reach.map(entry => entry.recipe.actionKey)).size, 1);
  assert.equal(reach[1].durationMs, reach[1].recipe.delivery.durationMs);
  assert.equal(reach[1].start, reach[0].end + 30);
  assert.equal(reach[2].start, reach[1].end + 30);
  await page.evaluate(time => window.recipientRuntimePreview.scrub(time), reach[1].start);
  assert.equal(await page.locator('#effect-layer .recipient-delivery').count(), 1);
  const healing = await page.evaluate(async () => {
    const editor = window.recipientRuntimePreview;
    await editor.configure({ outcome: 'heal' });
    return editor.plan;
  });
  assert.ok(healing.some(entry => entry.recipe.shape === 'heal-plus'));
  assert.ok(healing.every(entry => entry.recipe.phase !== 'delivery'), 'support receipts do not generate a Reach delivery');
  const sweep = await page.evaluate(async () => {
    const editor = window.recipientRuntimePreview;
    await editor.configure({ action: 'sweep', camp: 'physical', range: 'reach', outcome: 'hit' });
    return editor.plan;
  });
  assert.equal(sweep[0].recipe.phase, 'delivery');
  assert.equal(sweep[0].recipe.mount, 'group');
  assert.deepEqual(sweep[0].ids, ['enemy-1', 'enemy-2', 'enemy-3']);

  await page.locator('#reset-timing').click();
  await page.locator('#demo').selectOption('recipients');
  await page.waitForFunction(() => window.recipientRuntimePreview.plan.length >= 6);
  const output = process.env.RECIPIENT_EFFECTS_QA_OUT;
  if (output) {
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, 'effects-timing-desktop.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.locator('#timing-editor').isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  if (output) await page.screenshot({ path: join(output, 'effects-timing-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:' + port + '/tools/score-studio/');
  const iframe = page.locator('#effects-timing-frame');
  const effectsTab = page.locator('#effects-tab-button');
  assert.equal(await iframe.getAttribute('src'), null, 'Effects is mounted on first activation');
  await effectsTab.click();
  assert.equal(await effectsTab.getAttribute('aria-selected'), 'true');
  const frame = iframe.contentFrame();
  await frame.locator('#result-timeline li').first().waitFor();
  await frame.locator('#timing-gap').fill('64');
  await frame.locator('#timing-status').getByText('Unsaved changes.', { exact: false }).waitFor();
  await frame.locator('#play').click();
  assert.ok(await frame.locator('#pause').isEnabled());
  await page.locator('.studio-tab[data-tab="weights"]').click();
  assert.equal(await effectsTab.getAttribute('aria-selected'), 'false');
  assert.ok(await frame.locator('#pause').isDisabled(), 'switching Studio workspaces pauses the preview');
  await effectsTab.click();
  assert.equal(await frame.locator('#timing-gap').inputValue(), '64');
  assert.ok(await frame.locator('#pause').isDisabled(), 'returning does not restart playback');
  assert.match(await frame.locator('#timing-status').innerText(), /Unsaved changes/);
  if (output) await page.screenshot({ path: join(output, 'score-studio-effects-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await effectsTab.getByText('Effects', { exact: true }).isVisible(), true);
  assert.ok((await iframe.boundingBox()).width <= 390);
  if (output) await page.screenshot({ path: join(output, 'score-studio-effects-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Effects timing browser checks passed.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
