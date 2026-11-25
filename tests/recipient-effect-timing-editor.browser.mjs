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
      plan: plan.map(({ recipe, ids, start, end }) => ({ shape: recipe.shape || recipe.phase, category: recipe.category, ids, start, end })),
      rows: [...document.querySelectorAll('#result-timeline li')].map(row => ({
        shape: row.dataset.shape, category: row.dataset.category, start: Number(row.dataset.start), end: Number(row.dataset.end),
      })),
    };
  });
  await page.goto('http://127.0.0.1:' + port + '/tools/recipient-effects-runtime-preview.html');
  await page.waitForFunction(() => window.recipientRuntimePreview);
  assert.equal(await page.title(), 'Recipient effects timing');
  const baseline = await view();
  const categoryOrder = ['castingMovement', 'attackImpacts', 'defenseReactions', 'buffsStatuses'];
  assert.deepEqual(baseline.timing.categoryQueues, {
    enabled: true, order: categoryOrder, staggerMs: 10, overlapMs: 10,
    maxPerCategory: Object.fromEntries(categoryOrder.map(category => [category, 2])), maxGlobal: 3, maxPerActor: 2,
  });
  assert.equal(baseline.timing.opacity, .8);
  assert.equal(await page.locator('#demo').inputValue(), 'stress');
  assert.deepEqual(baseline.rows, baseline.plan.map(({ shape, category, start, end }) => ({ shape, category, start, end })));
  const groups = categoryOrder.map(category => baseline.plan.filter(clip => clip.category === category));
  for (const clips of groups) {
    assert.ok(clips.length >= 3, 'the scenario overflows every category');
    assert.equal(clips[1].start - clips[0].start, 10, 'the first pair starts one stagger apart');
    assert.ok(clips[2].start >= Math.min(clips[0].end, clips[1].end), 'the third clip waits for a slot');
  }
  for (let i = 1; i < groups.length; i += 1) {
    const priorEnd = Math.max(...groups[i - 1].map(clip => clip.end));
    assert.equal(groups[i][0].start, priorEnd - 10, 'category transition uses the available overlap');
  }
  const supportPair = await page.evaluate(() => {
    const plan = window.recipientRuntimePreview.plan;
    const heal = plan.find(clip => clip.recipe.shape === 'heal-plus');
    const skill = plan.find(clip => clip.recipe.primaryKey === heal.recipe.afterPrimaryKey);
    return { start: heal.start, lastFrameAt: skill.lastFrameAt };
  });
  assert.ok(supportPair.start >= supportPair.lastFrameAt, 'the busy queues cannot admit healing before its support clip reaches the final frame');
  for (const { start } of baseline.plan) {
    const active = baseline.plan.filter(clip => clip.start <= start && clip.end > start);
    assert.ok(active.length <= 3);
    for (const category of categoryOrder) assert.ok(active.filter(clip => clip.category === category).length <= 2);
    const actors = new Set(active.flatMap(clip => clip.ids));
    for (const actor of actors) assert.ok(active.filter(clip => clip.ids.includes(actor)).length <= 2);
  }

  await page.locator('#category-actor').fill('1');
  await page.waitForFunction(() => {
    const hits = window.recipientRuntimePreview.plan.filter(clip =>
      clip.recipe.category === 'attackImpacts' && clip.ids.includes('enemy-1'));
    return hits.length === 2 && hits[1].start >= hits[0].end;
  });
  await page.locator('#category-actor').fill('2');
  await page.locator('#category-cap-castingMovement').fill('1');
  await page.waitForFunction(() => {
    const casting = window.recipientRuntimePreview.plan.filter(clip => clip.recipe.category === 'castingMovement');
    return casting.length === 3 && casting[1].start >= casting[0].end;
  });
  await page.locator('#category-cap-castingMovement').fill('2');
  await page.locator('#category-global').fill('1');
  await page.waitForFunction(end => window.recipientRuntimePreview.durationMs > end, baseline.durationMs);
  const serialized = await view();
  assert.ok(serialized.plan.every((clip, i) => !i || clip.start >= serialized.plan[i - 1].end));
  assert.deepEqual(serialized.plan.map(clip => clip.end - clip.start).sort(), baseline.plan.map(clip => clip.end - clip.start).sort());
  assert.match(await page.locator('#timing-status').innerText(), /Unsaved changes.*Read-only/);
  assert.ok(await page.locator('#save-timing').isDisabled());

  await page.locator('#category-stagger').fill('24');
  await page.locator('#category-overlap').fill('19');
  await page.getByRole('button', { name: 'Move buffs and statuses up' }).click();
  const targetOrder = [categoryOrder[0], categoryOrder[1], categoryOrder[3], categoryOrder[2]];
  await page.waitForFunction(() => window.recipientRuntimePreview.timing.categoryQueues.order[2] === 'buffsStatuses');
  assert.deepEqual((await view()).timing.categoryQueues.order, targetOrder);
  await page.locator('#timing-opacity').evaluate(input => {
    input.value = '0.45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => window.recipientRuntimePreview.timing.opacity === .45);
  await page.evaluate(() => window.recipientRuntimePreview.scrub(10));
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
  assert.deepEqual(JSON.parse(Buffer.concat(chunks)), {
    ...baseline.timing, opacity: .45,
    categoryQueues: { ...baseline.timing.categoryQueues, order: targetOrder, maxGlobal: 1, staggerMs: 24, overlapMs: 19 },
  });
  assert.match(await page.locator('#timing-status').innerText(), /Unsaved changes/);
  await page.locator('#reset-timing').click();
  await page.waitForFunction(() => window.recipientRuntimePreview.timing.categoryQueues.maxGlobal === 3);
  assert.deepEqual((await view()).timing, baseline.timing);

  await page.locator('#category-enabled').uncheck();
  assert.ok(await page.locator('#legacy-timing').isVisible());
  await page.locator('#timing-cap').fill('2');
  await page.locator('#timing-overlap').fill('40');
  assert.equal(await page.locator('#timing-gap').inputValue(), '0');
  await page.locator('#timing-cap').fill('1');
  assert.ok(await page.locator('#timing-overlap').isDisabled());

  const legacy = await page.evaluate(() => window.recipientRuntimePreview.configure({ action: 'attack', outcome: 'ward-shatter' }));
  assert.equal(await page.locator('#demo').inputValue(), 'single');
  assert.ok(legacy.recipes.some(recipe => recipe.shape === 'ward-shatter'));
  const reach = await page.evaluate(async () => {
    const editor = window.recipientRuntimePreview;
    await editor.configure({ action: 'casting', camp: 'spell', range: 'reach', outcome: 'hit',
      timing: { ...editor.timing, scope: 'recipient', gapMs: 30 } });
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
  const categoryHealing = await page.evaluate(async () => {
    const editor = window.recipientRuntimePreview;
    const timing = editor.timing;
    await editor.configure({ camp: 'physical', action: 'skill', outcome: 'heal',
      timing: { ...timing, categoryQueues: { ...timing.categoryQueues, enabled: true } } });
    return editor.plan;
  });
  const plus = categoryHealing.find(clip => clip.recipe.shape === 'heal-plus');
  const support = categoryHealing.find(clip => clip.recipe.primaryKey === plus.recipe.afterPrimaryKey);
  assert.equal(plus.start, support.lastFrameAt, 'a standalone heal follows its support on the final frame');
  const sweep = await page.evaluate(async () => {
    const editor = window.recipientRuntimePreview;
    await editor.configure({ action: 'sweep', camp: 'physical', range: 'reach', outcome: 'hit' });
    return editor.plan;
  });
  assert.equal(sweep[0].recipe.phase, 'delivery');
  assert.equal(sweep[0].recipe.mount, 'group');
  assert.deepEqual(sweep[0].ids, ['enemy-1', 'enemy-2', 'enemy-3']);

  await page.locator('#reset-timing').click();
  await page.locator('#demo').selectOption('stress');
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
  await frame.locator('#category-stagger').fill('64');
  await frame.locator('#timing-status').getByText('Unsaved changes.', { exact: false }).waitFor();
  await frame.locator('#play').click();
  assert.ok(await frame.locator('#pause').isEnabled());
  await page.locator('.studio-tab[data-tab="weights"]').click();
  assert.equal(await effectsTab.getAttribute('aria-selected'), 'false');
  assert.ok(await frame.locator('#pause').isDisabled(), 'switching Studio workspaces pauses the preview');
  await effectsTab.click();
  assert.equal(await frame.locator('#category-stagger').inputValue(), '64');
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
