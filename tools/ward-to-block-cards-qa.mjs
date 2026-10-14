#!/usr/bin/env node
// Capture six production card surfaces before and after opening their real inspector.
// Deterministic QA state is used only for the deck editor and level-choice surface.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const OUT = resolve(process.env.WARD_CARD_QA_OUT || 'outputs/ward-to-block');
mkdirSync(OUT, { recursive: true });
const root = process.cwd();
const server = await serve({ root, port: 0, open: false });
const base = `http://127.0.0.1:${server.server.address().port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => errors.push(`request failed: ${request.url()} ${request.failure()?.errorText || ''}`));
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  generatedAt: new Date().toISOString(),
  viewport: { width: 1440, height: 1000 },
  fixtureBoundary: 'Customize, rewards, shop and combat use the application screenshot routes. Deck editor and level options use the production screen modules with a deterministic Reaver run; those two are mounted QA states, not player navigation recordings.',
  views: {},
  failures: [],
  browserErrors: errors,
};
const wait = ms => page.waitForTimeout(ms);
const textOf = async selector => page.locator(selector).first().innerText().catch(() => '');
async function capture(name, stage, data) {
  const png = `${name}-${stage}.png`;
  const jpg = `${name}-${stage}.jpg`;
  await page.screenshot({ path: resolve(OUT, png), fullPage: false });
  await page.screenshot({ path: resolve(OUT, jpg), type: 'jpeg', quality: 80, fullPage: false });
  return { png, jpg, visibleText: await page.locator('body').innerText(), ...data };
}
async function inspector(cardSelector = '.card, .equipment-poker-card, .reward-choice-face') {
  const card = page.locator(cardSelector).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 20000 });
  // A real pointer action on the rendered face. The shared desktop card surface
  // opens inspection from its art/name region; no DOM event is synthesized.
  const box = await card.boundingBox();
  assert.ok(box && box.width > 70 && box.height > 70, 'card face is visible and large enough to inspect');
  await card.click({ position: { x: Math.min(70, box.width / 2), y: Math.min(90, box.height / 2) } });
  await wait(120);
  if (await page.locator('.card-inspection-modal').count() === 0) {
    const info = page.locator('.card-info-button:visible').first();
    if (await info.count()) await info.click();
  }
  const detail = page.locator('.card-inspection-modal, .card-inspection-details, .deck-editor-inspector').filter({ visible: true }).first();
  await detail.waitFor({ state: 'visible', timeout: 10000 });
  return { compactText: await card.innerText().catch(() => ''), inspectionText: await detail.innerText() };
}
async function attempt(name, operation) { try { await operation(); } catch (error) { report.failures.push({ name, message: error.message, stack: error.stack }); console.error('CAPTURE FAILED ' + name + ': ' + error.message); } }
async function standardView(name, route, landmark, options = {}) {
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.locator(landmark).first().waitFor({ state: 'visible', timeout: 60000 });
  await wait(options.settle || 350);
  if (options.prepare) await options.prepare();
  const before = await capture(name, 'compact', { compactText: await textOf(options.compactSelector || '.card, .equipment-poker-card, .reward-choice-face') });
  const inspection = await inspector(options.cardSelector);
  const after = await capture(name, 'inspection', inspection);
  report.views[name] = { before, after };
}
try {
  await attempt('character-creation', async () => {
    await standardView('character-creation', '/?shot=customize', '.customize', {
      prepare: async () => {
        const tab = page.locator('#cz-tab-equipment');
        if (await tab.count()) await tab.click();
        const fold = page.locator('#cz-equipment-fold summary').first();
        if (await fold.count() && !(await page.locator('#cz-equipment-fold').evaluate(n => n.open))) await fold.click();
        await page.locator('.equipment-poker-card, .card').first().waitFor({ state: 'visible', timeout: 20000 });
      },
      cardSelector: '.equipment-poker-card, .card',
    });

  });

  await attempt('deck-editing', async () => {
    // Production deck editor over a deterministic run; the selected card's
    // explicit Inspect action opens the editor's own inspector pane.
    await page.goto(base + '/?shot=customize', { waitUntil: 'domcontentloaded' });
    await page.locator('.customize').waitFor({ state: 'visible', timeout: 60000 });
    await page.evaluate(async () => {
      const { contentBundle } = await import('/src/content/index.js');
      const { createRegistries } = await import('/src/model/registries.js');
      const { createRunState } = await import('/src/model/state.js');
      const { mountDeckEditor } = await import('/src/ui/screens/deckEditor.js');
      const registries = createRegistries(contentBundle);
      const run = createRunState({ seed: 7814, classId: 'starseer', registries });
      window.__wardCardQa = { registries, run };
      mountDeckEditor(document.body, { registries, run, settings: { deckMinSize: 0 } });
    });
    await page.locator('.deck-editor-veil').waitFor({ state: 'visible', timeout: 20000 });
    await wait(350);
    const deckCompact = await capture('deck-editing', 'compact', { compactText: await textOf('.deck-editor') });
    const deckCard = page.locator('.deck-editor-main:visible').first();
    await deckCard.waitFor({ state: 'visible', timeout: 20000 });
    await deckCard.click();
    const inspectButton = page.locator('.deck-editor-inline-inspect:visible').first();
    await inspectButton.waitFor({ state: 'visible', timeout: 10000 });
    await inspectButton.click();
    const deckDetail = page.locator('.deck-editor-inspector:visible').first();
    await deckDetail.waitFor({ state: 'visible', timeout: 10000 });
    report.views['deck-editing'] = {
      before: deckCompact,
      after: await capture('deck-editing', 'inspection', {
        compactText: await deckCard.innerText().catch(() => ''),
        inspectionText: await deckDetail.innerText(),
      }),
    };

  });

  await attempt('rewards', async () => {
    await standardView('rewards', '/?shot=reward', '.reward-menu, .reward-door, .reward-screen', { cardSelector: '.card, .reward-choice-face' });
  });
  await attempt('store', async () => {
    await standardView('store', '/?shot=shop', '.shop, .shop-workspace, #shop-relics', { cardSelector: '.card, .shop-inspect-card' });
  });

  await attempt('level-options', async () => {
    // Real production level-up screen. The QA offer deliberately contains two
    // level choices so the normal Level up control opens its chooser.
    await page.goto(base + '/?shot=reward', { waitUntil: 'domcontentloaded' });
    await page.locator('.reward-menu, .reward-door, .reward-screen').first().waitFor({ state: 'visible', timeout: 60000 });
    await page.evaluate(async () => {
      const { contentBundle } = await import('/src/content/index.js');
      const { createRegistries } = await import('/src/model/registries.js');
      const { createRunState } = await import('/src/model/state.js');
      const { mountRewards } = await import('/src/ui/screens/reward.js');
      const { mergeProgressionRewards } = await import('/src/model/deferredProgression.js');
      const { pendingRewardCheckpoint } = await import('/src/model/rewardSourcePolicy.js');
      const registries = createRegistries(contentBundle);
      const run = createRunState({ seed: 7814, classId: 'starseer', registries });
      run.level = { level: 1, xp: 555, unspentPoints: 0 };
      run.skills = {};
      const offer = mergeProgressionRewards({}, {
        title: 'LEVEL OPTIONS QA',
        xpGains: { level: 555, tracks: {} },
        levelChoices: [
          { ordinal: 0, options: [{ kind: 'feat', id: 'fieldStudy' }, { kind: 'feat', id: 'weaponDrill' }] },
          { ordinal: 1, options: [{ kind: 'feat', id: 'vitalRenewal' }] },
        ],
      }, run);
      const checkpoint = pendingRewardCheckpoint(offer, { source: 'elite', after: 'map' });
      checkpoint.expanded = true;
      document.body.replaceChildren();
      mountRewards(document.body, { registries, run, rewards: offer, checkpoint,
        saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0, levelUpRefillPauseMs: 0 } }) },
        onClaimLevel: () => {}, onPersist: () => {}, onDone: () => {},
      });
      window.__wardLevelQa = { registries, run, offer };
    });
    await page.locator('.reward-level-up').waitFor({ state: 'visible', timeout: 20000 });
    await wait(300);
    const levelBefore = await capture('level-options', 'compact', { compactText: await textOf('.reward-menu') });
    await page.locator('.reward-level-up').click();
    await page.locator('.reward-door, .reward-level-rewards').first().waitFor({ state: 'visible', timeout: 10000 });
    await wait(300);
    const levelInspection = await inspector('.reward-level-rewards .card, .reward-level-rewards .reward-level-offer, .reward-level-rewards [data-key]');
    report.views['level-options'] = {
      before: levelBefore,
      after: await capture('level-options', 'inspection', levelInspection),
    };

  });

  await attempt('combat', async () => {
    await standardView('combat', '/?shot=combat', '.combat', { cardSelector: '.hand .card' });
  });

  report.browserErrors = errors;
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  assert.equal(report.failures.length, 0, report.failures.map(f => f.name + ': ' + f.message).join('\n'));
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ output: OUT, head: report.head, views: Object.keys(report.views), files: Object.values(report.views).flatMap(v => [v.before.png, v.before.jpg, v.after.png, v.after.jpg]) }, null, 2));
} finally {
  await browser.close();
  server.server.closeAllConnections?.();
  await new Promise(resolveClose => server.server.close(resolveClose));
}
