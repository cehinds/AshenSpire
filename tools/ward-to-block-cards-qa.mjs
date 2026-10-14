#!/usr/bin/env node
// Capture six production card surfaces before and after opening their real inspector.
// Deterministic QA state is used for deck, reward, store and level-card production surfaces.
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
  fixtureBoundary: 'Character creation uses the application screenshot route; deck editor, reward card choices and level-card options use production screen modules with deterministic Starseer state; combat uses the application combat route with deterministic hand pose. Store opens the real Remove a card service; if the authored shot lacks an unlocked offer, mountShop uses deterministic stock and cinders. The QA deck adds real Frost Counter and Force Counter card instances so the changed faces are visible. These are QA states, not player navigation recordings.',
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
    const info = page.locator('.card-info-button:visible').first();
    await info.waitFor({ state: 'visible', timeout: 4000 });
    if (strategy === 'keyboard') await info.press('Enter'); else await info.click();
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
    const deckCompact = await capture('deck-editing', 'compact', { compactText: await deckCard.innerText().catch(() => '') });
    const inspectButton = page.locator('.deck-editor-inline-inspect:visible').first();
    await inspectButton.waitFor({ state: 'visible', timeout: 10000 });
    await inspectButton.click();
    const deckDetail = page.locator('.deck-editor-inspector:visible').first();
    await deckDetail.waitFor({ state: 'visible', timeout: 10000 });
    const deckAfter = await capture('deck-editing', 'inspection', {
      compactText: await deckCard.innerText().catch(() => ''),
      inspectionText: await deckDetail.innerText(),
    });
    const deckDetails = await captureDetails('deck-editing', '.deck-editor-rules:visible, .deck-editor-rules .combat-rule-hint:visible');
    report.views['deck-editing'] = { before: deckCompact, after: deckAfter, details: deckDetails };

  });

  await attempt('rewards', async () => {
    await standardView('rewards', '/?shot=reward&shotClass=starseer', '.reward-menu, .reward-door, .reward-screen', {
      prepare: async () => {
        // Mount the real reward screen with authored card instances so the QA
        // surface always includes a changed defensive card, independent of RNG.
        await page.evaluate(async () => {
          const { contentBundle } = await import('/src/content/index.js');
          const { createRegistries } = await import('/src/model/registries.js');
          const { createRunState } = await import('/src/model/state.js');
          const { createRng } = await import('/src/engine/rng.js');
          const { mountRewards } = await import('/src/ui/screens/reward.js');
          const registries = createRegistries(contentBundle);
          const run = createRunState({ seed: 7814, classId: 'starseer', registries });
          const rewards = { title: 'WARD CARD QA', cardIds: ['frostCounter', 'forceCounter'] };
          document.body.replaceChildren();
          mountRewards(document.body, {
            registries, run, rewards, rng: createRng(7814),
            saves: { loadMeta: () => ({ settings: {} }) },
            onCollectArmament() {}, onPersist() {}, onDone() {},
          });
        });
        await page.locator('.reward-kind[data-kind="card"]').waitFor({ state: 'visible', timeout: 15000 });
        await page.locator('.reward-kind[data-kind="card"]').click();
        await page.locator('.reward-row .reward-choice-face.card:has-text("Frost Counter")').waitFor({ state: 'visible', timeout: 15000 });
      },
      cardSelector: '.reward-row .reward-choice-face.card:has-text("Frost Counter"), .reward-row .reward-choice-face.card:has-text("Crystal Barrier"), .reward-row .reward-choice-face.card:has-text("Frost Veil"), .reward-row .reward-choice-face.card:has-text("Force Counter")', compactSelector: '.reward-row .reward-choice-face.card:has-text("Frost Counter"), .reward-row .reward-choice-face.card:has-text("Crystal Barrier"), .reward-row .reward-choice-face.card:has-text("Frost Veil"), .reward-row .reward-choice-face.card:has-text("Force Counter")',
    });
  });
  await attempt('store', async () => {
    await standardView('store', '/?shot=shop&shotClass=starseer', '.shop, .shop-workspace, #shop-relics', {
    prepare: async () => {
      let remove = page.locator('#remove-opt');
      if (!(await remove.isVisible().catch(() => false)) || await remove.evaluate(n => n.classList.contains('locked'))) {
        await page.evaluate(async () => {
          const { contentBundle } = await import('/src/content/index.js');
          const { createRegistries } = await import('/src/model/registries.js');
          const { createRunState, createCardInstance, createIdGen } = await import('/src/model/state.js');
          const { createRng } = await import('/src/engine/rng.js');
          const { buildShopStock } = await import('/src/engine/encounters.js');
          const { mountShop } = await import('/src/ui/screens/shop.js');
          const registries = createRegistries(contentBundle);
          const run = createRunState({ seed: 7814, classId: 'starseer', registries });
          run.cinders = 1000;
          const gen = createIdGen('ward-shop');
          run.deck.push(createCardInstance('frostCounter', false, gen), createCardInstance('forceCounter', false, gen));
          run.shopStock = buildShopStock(registries, createRng(7814), run);
          document.querySelector('#app').replaceChildren();
          mountShop(document.querySelector('#app'), { registries, run, meta: { settings: {} }, onLeave() {}, onChanged() {} });
        });
        remove = page.locator('#remove-opt');
      }
      const servicesTab = page.locator('.shop-railitem[data-shop-category="services"]');
      await servicesTab.waitFor({ state: 'visible', timeout: 10000 });
      await servicesTab.click();
      await remove.waitFor({ state: 'visible', timeout: 10000 });
      await remove.click();
      await page.locator('#remove-grid .card').filter({ hasText: 'Frost Counter' }).first().waitFor({ state: 'visible', timeout: 10000 });
    },
    cardSelector: '#remove-grid .card:has-text("Frost Counter")',
    compactSelector: '#remove-grid .card:has-text("Frost Counter")',
  });
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
      const { claimBankedLevel } = await import('/src/model/levelup.js');
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
        levelCards: [{ ordinal: 0, requiredLevel: 2, cardIds: ['frostCounter', 'forceCounter'] }],
      }, run);
      const checkpoint = pendingRewardCheckpoint(offer, { source: 'elite', after: 'map' });
      checkpoint.expanded = true;
      document.body.replaceChildren();
      mountRewards(document.body, { registries, run, rewards: offer, checkpoint,
        saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0, levelUpRefillPauseMs: 0 } }) },
        onClaimLevel: () => claimBankedLevel(registries, run), onPersist: () => {}, onDone: () => {},
      });
      window.__wardLevelQa = { registries, run, offer };
    });
    await page.locator('.reward-level-up').waitFor({ state: 'visible', timeout: 20000 });
    await wait(300);
    await page.locator('.reward-level-up').click();
    const levelRow = page.locator('.reward-level-rewards .reward-kind[data-key="levelCard:0"]');
    await levelRow.waitFor({ state: 'visible', timeout: 10000 });
    await wait(300);
    await levelRow.click();
    await page.locator('.reward-row .reward-choice-face.card').first().waitFor({ state: 'visible', timeout: 15000 });
    const levelBefore = await capture('level-options', 'compact', { compactText: await textOf('.reward-row .reward-choice-face.card') });
    const levelInspection = await inspector('.reward-row .reward-choice-face.card');
    const levelAfter = await capture('level-options', 'inspection', levelInspection);
    const levelDetails = await captureDetails('level-options');
    report.views['level-options'] = { before: levelBefore, after: levelAfter, details: levelDetails };

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
