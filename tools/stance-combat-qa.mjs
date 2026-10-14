#!/usr/bin/env node
// Actual-screen screenshot QA for the stance/accuracy HUD. All UI is rendered
// by mountCombat; deterministic combat objects and card instances are fixtures.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const OUT = resolve(process.env.STANCE_COMBAT_QA_OUT || 'outputs/stance-combat');
mkdirSync(OUT, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const base = 'http://127.0.0.1:' + server.server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const errors = [];
const views = {};
const report = {
  head: process.env.GITHUB_SHA || null,
  generatedAt: new Date().toISOString(),
  fixtureBoundary: 'Screenshots use the production combat route and mountCombat renderer with production card/enemy definitions. Combat state, stance/status values, card instances, and RNG stream return values are deterministic QA fixtures; these captures are not player navigation recordings.',
  viewports: { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } },
  views,
  failures: [],
  browserErrors: errors,
};
let page;
async function waitArt() {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all([...document.images].map(image => image.decode?.().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function capture(name, viewport) {
  await waitArt();
  const path = resolve(OUT, name + '.png');
  const jpg = resolve(OUT, name + '.jpg');
  await page.screenshot({ path, fullPage: false });
  await page.screenshot({ path: jpg, type: 'jpeg', quality: 82, fullPage: false });
  views[name] = {
    png: name + '.png', jpg: name + '.jpg', viewport,
    visibleText: await page.locator('body').innerText().catch(() => ''),
    viewportState: await page.evaluate(() => ({
      url: location.href, width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
    })),
  };
}
async function boot(viewport, query = '') {
  page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push('request failed: ' + request.url() + ' ' + (request.failure()?.errorText || '')));
  await page.goto(base + '/?shot=combat&shotClass=starseer&shotExpansion=ward' + query, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.combat').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('.combatant.player').waitFor({ state: 'visible', timeout: 30000 });
  await waitArt();
}
async function remount(cards, options = {}) {
  await page.evaluate(async ({ cards, options }) => {
    const { mountCombat } = await import('/src/ui/screens/combat.js');
    const { createRunState } = await import('/src/model/state.js');
    const combat = window.__combat, registries = combat.registries;
    const run = createRunState({ seed: 7814, classId: 'starseer', registries });
    combat.piles.hand = cards.map((cardId, index) => ({ instanceId: 'stance-qa-' + index, cardId, upgraded: false }));
    combat.player.energy = 10;
    combat.player.stamina = 10;
    if (options.playerStance) combat.player.combatStance = options.playerStance;
    if (options.enemyStance) combat.enemies[0].combatStance = options.enemyStance;
    if (options.unknown) {
      combat.enemies[0].knowledgeAction = { reads: { player: { visibility: 'unknown' } } };
    }
    if (options.evade) combat.enemies[0].combatEvade = { charges: 1, bonus: 100, advantage: false, disadvantage: false, expiresOnOwnerCycle: 1 };
    if (options.roll != null) combat.rng.int = stream => stream === 'combatAvoidance' ? options.roll : 20;
    mountCombat(document.querySelector('#app'), {
      registries, run, combat,
      meta: { settings: { animationSpeed: 'instant', holdConfirm: 'off', reducedMotion: true } },
      onEnd() {},
    });
    window.__stanceQaRun = run;
  }, { cards, options });
  await page.locator('.combat').waitFor({ state: 'visible' });
  await waitArt();
}
async function inspectCard(cardId, label) {
  const card = page.locator('.hand .card[data-card-id="' + cardId + '"]').first();
  await card.waitFor({ state: 'visible', timeout: 20000 });
  const info = page.locator('.card-info-button:visible').first();
  if (await info.count()) await info.click();
  else await card.click({ position: { x: 30, y: 35 } });
  const detail = page.locator('.card-inspection-modal:visible, .card-inspection-details:visible, .deck-editor-inspector:visible').first();
  await detail.waitFor({ state: 'visible', timeout: 10000 });
  await capture(label, { width: 1440, height: 1000 });
  await page.keyboard.press('Escape').catch(() => {});
}

try {
  await boot({ width: 1440, height: 1000 });
  assert.ok(await page.locator('.combatant.player .combat-health-row').count(), 'player HP row rendered');
  for (const kind of ['evade', 'poise', 'ward', 'shield']) {
    assert.ok(await page.locator('.combatant.player .combat-health-row [data-defense-kind="' + kind + '"]').count(), 'player ' + kind + ' row rendered');
  }
  await capture('combat-hud-desktop', { width: 1440, height: 1000 });

  // Production cards are mounted into the real combat screen to expose each
  // changed card face and inspection panel in a stable authored state.
  await remount(['strike', 'defend', 'frostCounter', 'crystalBarrier']);
  await inspectCard('defend', 'card-inspection-defense');
  await inspectCard('frostCounter', 'card-inspection-counter');
  await inspectCard('crystalBarrier', 'card-inspection-spell');

  // Actual route's authored hand includes a damaging card and live enemy.
  await remount(['strike'], { roll: 20 });
  const attack = page.locator('.hand .card[data-card-id="strike"]').first();
  await attack.waitFor({ state: 'visible', timeout: 20000 });
  await attack.click();
  const chance = page.locator('.combat-hit-chance:visible').first();
  await chance.waitFor({ state: 'visible', timeout: 10000 });
  await capture('selected-damage-known-enemy', { width: 1440, height: 1000 });

  await remount(['strike'], { unknown: true });
  await page.locator('.hand .card[data-card-id="strike"]').first().click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.combat-hit-chance:visible').count(), 0, 'unknown enemy hides hit percentage');
  await capture('selected-damage-unknown-enemy', { width: 1440, height: 1000 });

  await page.close();
  await boot({ width: 390, height: 844 });
  assert.ok(await page.locator('.combatant.player .combat-health-row').count(), 'phone player HP row rendered');
  await capture('combat-hud-phone', { width: 390, height: 844 });

  // Stance modes are rendered from production preview state; each capture
  // records the data-roll-mode value so desktop review can identify the case.
  for (const [mode, playerStance, enemyStance] of [
    ['neutral', { maneuver: 'attack', camp: 'physical', range: 'melee' }, { maneuver: 'attack', camp: 'physical', range: 'melee' }],
    ['advantage', { maneuver: 'attack', camp: 'physical', range: 'melee' }, { maneuver: 'evade', camp: 'physical', range: 'melee' }],
    ['disadvantage', { maneuver: 'smash', camp: 'physical', range: 'melee' }, { maneuver: 'defend', camp: 'physical', range: 'melee' }],
  ]) {
    await remount(['strike'], { playerStance, enemyStance });
    await page.locator('.hand .card[data-card-id="strike"]').first().click();
    const modeNode = page.locator('.combat-hit-chance:visible[data-roll-mode="' + mode + '"]').first();
    await modeNode.waitFor({ state: 'visible', timeout: 10000 });
    await capture('phone-hit-' + mode, { width: 390, height: 844 });
  }
  report.browserErrors = errors;
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ output: OUT, head: report.head, views: Object.keys(views) }, null, 2));
} catch (error) {
  report.failures.push({ name: 'stance-combat', message: error.message, stack: error.stack });
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  throw error;
} finally {
  await page?.close().catch(() => {});
  await browser.close();
  server.server.closeAllConnections?.();
  await new Promise(resolveClose => server.server.close(resolveClose));
}
