#!/usr/bin/env node
// Capture five production card surfaces before and after opening their real inspector.
// Deterministic QA state is used for deck, store and combat production surfaces.
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
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(60000);
const errors = [];
const ignoredExpectedFailures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => {
  const reason = request.failure()?.errorText || '';
  const url = new URL(request.url());
  if (reason === 'net::ERR_ABORTED' && url.pathname === '/music/shop/shop.mp3') {
    ignoredExpectedFailures.push({ url: request.url(), reason, note: 'Shop audio is aborted when the capture navigates away.' });
  } else {
    errors.push(`request failed: ${request.url()} ${reason}`);
  }
});
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  generatedAt: new Date().toISOString(),
  viewport: { width: 1440, height: 1000 },
  fixtureBoundary: 'Character creation uses the application screenshot route; deck editor uses a production screen module with deterministic Starseer state; combat uses the application combat route with deterministic hand pose. Store opens the real Remove a card service; if the authored shot lacks an unlocked offer, mountShop uses deterministic stock and cinders. The QA deck adds real Frost Counter and Force Counter card instances so the changed faces are visible. These are QA states, not player navigation recordings.',
  views: {},
  failures: [],
  browserErrors: errors,
  ignoredExpectedFailures,
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
async function waitForStableVisible(locator) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  // The modal's veil can still be fading after its own element is visible.
  await locator.evaluate(async element => {
    const animations = [];
    for (let node = element; node; node = node.parentElement) animations.push(...node.getAnimations());
    await Promise.all(animations
      .filter(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map(animation => animation.finished.catch(() => {})));
  });
  const handle = await locator.elementHandle();
  await page.waitForFunction(element => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility !== 'visible' || Number(style.opacity) < 0.98) return false;
    }
    return true;
  }, handle, { timeout: 10000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function captureDetails(name, selector = '.card-inspection-modal .ti-meta') {
  const detail = page.locator(selector).filter({ visible: true }).first();
  await detail.waitFor({ state: 'visible', timeout: 10000 });
  await detail.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await wait(200);
  return capture(name, 'details', { inspectionText: await textOf('.card-inspection-details, .deck-editor-rules') });
}
async function inspector(cardSelector = '.card, .equipment-poker-card, .reward-choice-face', strategy = 'pointer') {
  const card = page.locator(cardSelector).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 20000 });
  if (strategy === 'keyboard') {
    // Combat cards can arm an action on pointer-up. Keyboard focus and the
    // Information button open inspection without invoking the card action.
    await card.focus();
    await card.press('Tab');
  } else {
    const box = await card.boundingBox();
    assert.ok(box && box.width > 70 && box.height > 70, 'card face is visible and large enough to inspect');
    await card.click({ position: { x: Math.min(70, box.width / 2), y: Math.min(90, box.height / 2) } });
  }
  await wait(200);
  if (await page.locator('.card-inspection-modal').count() === 0) {
    const target = page.locator('.hand .card:visible, .card:visible').first();
    await target.waitFor({ state: 'visible', timeout: 4000 });
    if (strategy === 'keyboard') { await target.focus(); await page.keyboard.press('i'); } else await target.click({ button: 'right' });
  }
  const detail = page.locator('.card-inspection-modal, .card-inspection-details, .deck-editor-inspector').filter({ visible: true }).first();
  await waitForStableVisible(detail);
  return { compactText: await card.innerText().catch(() => ''), inspectionText: await detail.innerText() };
}
async function attempt(name, operation) { try { await operation(); } catch (error) { report.failures.push({ name, message: error.message, stack: error.stack }); console.error('CAPTURE FAILED ' + name + ': ' + error.message); } }
async function standardView(name, route, landmark, options = {}) {
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.locator(landmark).first().waitFor({ state: 'visible', timeout: 60000 });
  await wait(options.settle || 350);
  if (options.prepare) await options.prepare();
  const before = await capture(name, 'compact', { compactText: await textOf(options.compactSelector || '.card, .equipment-poker-card, .reward-choice-face') });
  const inspection = await inspector(options.cardSelector, options.strategy);
  const after = await capture(name, 'inspection', inspection);
  const details = await captureDetails(name);
  report.views[name] = { before, after, details };
}
try {
  await attempt('character-creation', async () => {
    await standardView('character-creation', '/?shot=customize&shotClass=starseer', '.customize', {
      prepare: async () => {
        const classCard = page.locator('#cz-classes .cz-class[data-class="starseer"]');
        if (await classCard.count()) await classCard.click();
        const tab = page.locator('#cz-tab-spells');
        await tab.waitFor({ state: 'visible', timeout: 15000 });
        await tab.click();
        const defensiveChoice = page.locator('#cz-spell-choices .cc-ability-choice[data-card-id="crystalBarrier"] .card, #cz-spell-choices .cc-ability-choice[data-card-id="frostVeil"] .card, #cz-spell-choices .cc-ability-choice[data-card-id="umbralWard"] .card').first();
        await defensiveChoice.waitFor({ state: 'visible', timeout: 20000 });
      },
      cardSelector: '#cz-spell-choices .cc-ability-choice[data-card-id="crystalBarrier"] .card, #cz-spell-choices .cc-ability-choice[data-card-id="frostVeil"] .card, #cz-spell-choices .cc-ability-choice[data-card-id="umbralWard"] .card',
      compactSelector: '#cz-spell-choices .cc-ability-choice[data-card-id="crystalBarrier"] .card, #cz-spell-choices .cc-ability-choice[data-card-id="frostVeil"] .card, #cz-spell-choices .cc-ability-choice[data-card-id="umbralWard"] .card',
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
      const { createRunState, createCardInstance, createIdGen } = await import('/src/model/state.js');
      const { mountDeckEditor } = await import('/src/ui/screens/deckEditor.js');
      const registries = createRegistries(contentBundle);
      const run = createRunState({ seed: 7814, classId: 'starseer', registries });
      const gen = createIdGen('ward-deck');
      run.deck.push(createCardInstance('frostCounter', false, gen), createCardInstance('forceCounter', false, gen));
      window.__wardCardQa = { registries, run };
      mountDeckEditor(document.body, { registries, run, settings: { deckMinSize: 0 } });
    });
    await page.locator('.deck-editor-veil').waitFor({ state: 'visible', timeout: 20000 });
    await wait(350);
    const deckCard = page.locator('.deck-editor-main:visible').filter({ hasText: 'Frost Counter' }).first();
    await deckCard.waitFor({ state: 'visible', timeout: 20000 });
    await deckCard.click();
    await page.waitForFunction(element => element.getAttribute('aria-pressed') === 'true', await deckCard.elementHandle(), { timeout: 10000 });
    await deckCard.click({ button: 'right' });
    const deckDetail = page.locator('.deck-editor-inspector:visible').first();
    await waitForStableVisible(deckDetail);
    const deckCompact = await capture('deck-editing', 'compact', { compactText: await deckCard.innerText().catch(() => '') });
    const deckAfter = await capture('deck-editing', 'inspection', {
      compactText: await deckCard.innerText().catch(() => ''),
      inspectionText: await deckDetail.innerText(),
    });
    const deckDetails = await captureDetails('deck-editing', '.deck-editor-rules:visible, .deck-editor-rules .combat-rule-hint:visible');
    report.views['deck-editing'] = { before: deckCompact, after: deckAfter, details: deckDetails };

  });

  await attempt('combat', async () => {
    await standardView('combat', '/?shot=combat&shotClass=starseer&shotExpansion=ward', '.combat', { cardSelector: '.hand .card[data-card-id="barrageCounter"]', strategy: 'keyboard' });
  });

  report.browserErrors = errors;
  report.ignoredExpectedFailures = ignoredExpectedFailures;
  report.ignoredExpectedFailures = ignoredExpectedFailures;
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  assert.equal(report.failures.length, 0, report.failures.map(f => f.name + ': ' + f.message).join('\n'));
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ output: OUT, head: report.head, views: Object.keys(report.views), files: Object.values(report.views).flatMap(v => [v.before.png, v.before.jpg, v.after.png, v.after.jpg]) }, null, 2));
} finally {
  await browser.close();
  server.server.closeAllConnections?.();
  await new Promise(resolveClose => server.server.close(resolveClose));
}
