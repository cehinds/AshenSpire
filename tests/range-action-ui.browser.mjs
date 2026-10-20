// Explicit authored Core Rogue fixture. Native pointer/keyboard input exercises
// the real renderer/commit; the initial pair is posed at Reach, not a playthrough.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
import { launchBrowser } from '../tools/browser.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true, lan: false });
const base = `${(process.env.BASE_URL || server.url).replace(/\/$/, '')}/`;
const out = process.env.RANGE_UI_OUT || '/tmp/range-action-ui';
mkdirSync(out, { recursive: true });
const launched = await launchBrowser({ prefix: 'range-ui-', browser: process.env.CHROME });
const browser = await chromium.connectOverCDP(launched.wsUrl);
const results = [], errors = [], failedResponses = [];
async function setup(page, stamina = 1) {
  return page.evaluate(async stamina => {
    const [{ contentBundle }, { createRegistries }, { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries },
      { createRunState }, { createRunCombat }, { createRng }, { mountCombat }, { movedEngagementState }, { previewCard }] = await Promise.all([
      import('/src/content/index.js'), import('/src/model/registries.js'), import('/src/model/gameProfile.js'),
      import('/src/model/state.js'), import('/src/engine/runCombat.js'), import('/src/engine/rng.js'), import('/src/ui/screens/combat.js'),
      import('/src/model/combatEngagement.js'), import('/src/engine/combat.js'),
    ]);
    const profile = resolveGameProfile('core');
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const settings = { oneTapPlay: false, autoCombat: false, animSpeed: 'instant', combatSpeed: 8, holdConfirm: 'off' };
    const run = createRunState({ registries, classId: 'rogue', seed: 777,
      profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } }, settings } });
    run.stats = { damageDealt: 0, damageTaken: 0 };
    const combat = createRunCombat({ registries, run, rng: createRng(777), enemyIds: ['wanderingSoldier'], settings });
    combat.rangeState = movedEngagementState(combat.rangeState, 'player:player', 'enemy:e1', 1);
    combat.player.stamina = stamina;
    combat.player.hp = combat.player.maxHp = 100;
    combat.enemies[0].hp = combat.enemies[0].maxHp = 100;
    const piles = ['hand', 'draw', 'discard', 'exhaust'];
    const strike = piles.flatMap(pile => combat.piles[pile]).find(card => card.cardId === 'core.strike');
    if (!strike) throw Error('Authored Rogue starting deck has no Strike');
    for (const pile of piles) combat.piles[pile] = combat.piles[pile].filter(card => card.instanceId !== strike.instanceId);
    combat.piles.hand.unshift(strike);
    const movementDef = profile.content.cards.find(card => card.effects?.length && card.effects.every(effect => effect.op === 'moveEngagement') && card.effects[0].bands === -1);
    if (!movementDef) throw Error('Authored profile has no pure Advance card');
    combat.piles.hand.push({ instanceId: 'qa.authored.advance', cardId: movementDef.id, upgraded: false });
    window.__rangeUiFixture = { combat, run, settings, strike: strike.instanceId, advance: 'qa.authored.advance', before: combat.eventLog.filter(event => event.type === 'cardPlayed').length };
    mountCombat(document.getElementById('app'), { registries, run, combat, meta: { settings }, readSettings: () => settings, onEnd: () => {} });
    return { strike: strike.instanceId, advance: 'qa.authored.advance', quote: previewCard(combat, strike.instanceId, 'e1'), movement: movementDef.id };
  }, stamina);
}
async function selectByTouch(page, id) {
  const card = page.locator(`.hand .card[data-instance-id="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  const box = await card.locator('.hand-hit-lane').boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * .4);
  return card;
}
const state = page => page.evaluate(() => {
  const { combat, before } = window.__rangeUiFixture;
  return { stamina: combat.player.stamina, plays: combat.eventLog.filter(event => event.type === 'cardPlayed').length - before,
    band: combat.rangeState.engagements[JSON.stringify(['enemy:e1', 'player:player'])], rng: combat.rng.getCounters() };
});
try {
  const viewports = [[320, 844], [1280, 800], [1920, 1080], [768, 1024]].filter(([width]) => !process.env.RANGE_UI_ONLY || process.env.RANGE_UI_ONLY.split(',').includes(String(width)));
  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failedResponses.push({ width, url: response.url(), status: response.status() }); });
    page.on('console', message => { if (message.type() === 'error') console.log(`console ${width}: ${message.text()}`); });
    await page.goto(`${base}index.html?shot=combat&gameProfile=core`, { waitUntil: 'networkidle' });
    try { await page.waitForFunction(() => !!window.__combat, null, { timeout: 15000 }); }
    catch (error) {
      await page.screenshot({ path: resolve(out, `startup-failure-${width}.png`) });
      console.log('Startup failure:', await page.locator('body').innerText()); throw error;
    }
    const fixture = await setup(page);
    assert.equal(fixture.quote.range.routes.find(route => route.id === 'advance').affordable, false);
    assert.equal(fixture.quote.range.routes.find(route => route.id === 'throw').available, true);
    const before = await state(page);
    await selectByTouch(page, fixture.strike);
    const panel = page.locator('.combat-range-action');
    await panel.waitFor({ state: 'visible', timeout: 15000 });
    const hitBadge = page.locator('.combat-hit-chance').first();
    assert.match(await hitBadge.textContent(), /^Out of range · 0%$/);
    const labelRects = await hitBadge.evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
    });
    assert.ok(labelRects.length);
    for (const rect of labelRects) assert.ok(rect.left >= 0 && rect.right <= width && rect.top >= 0 && rect.bottom <= height, JSON.stringify(rect));
    const advance = panel.locator('[data-range-route="advance"]'), thrown = panel.locator('[data-range-route="throw"]');
    assert.match(await advance.textContent(), /Advance · \+1 SP · Total 2 SP/);
    assert.match(await thrown.textContent(), /Throw · -1 Precision · Total 1 SP/);
    assert.equal(await advance.getAttribute('aria-pressed'), 'true');
    const geometry = await panel.evaluate(node => {
      const box = node.getBoundingClientRect();
      const controls = [...node.querySelectorAll('button')].map(button => {
        const b = button.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { width: b.width, height: b.height, left: b.left, right: b.right, top: b.top, bottom: b.bottom, unobstructed: hit === button || button.contains(hit) };
      });
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, controls };
    });
    assert.ok(geometry.left >= 0 && geometry.right <= width + 1 && geometry.top >= 0 && geometry.bottom <= height, JSON.stringify(geometry));
    for (const button of geometry.controls) { assert.ok(button.width >= 44 && button.height >= 44, JSON.stringify(button)); assert.equal(button.unobstructed, true); }
    await page.screenshot({ path: resolve(out, `advance-${width}x${height}.png`) });
    await advance.focus();
    await page.keyboard.press('Tab');
    assert.equal(await thrown.evaluate(node => document.activeElement === node), true, 'native Tab reaches Throw');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-range-route="throw"]')?.getAttribute('aria-pressed') === 'true');
    assert.deepEqual(await state(page), before, 'route keyboard choice never spends, rolls, or plays');
    const throwBox = await page.locator('[data-range-route="throw"]').boundingBox();
    await page.touchscreen.tap(throwBox.x + throwBox.width / 2, throwBox.y + throwBox.height / 2);
    assert.deepEqual(await state(page), before, 'route touch never commits a card');
    await page.screenshot({ path: resolve(out, `throw-${width}x${height}.png`) });
    const destination = await page.evaluate(async () => {
      const frame = document.querySelector('.combatant.enemy[data-eid="e1"]');
      const { currentSpriteBodyBounds } = await import('/src/ui/components/combatSpriteGeometry.js');
      const box = currentSpriteBodyBounds(frame.querySelector('.sprite'));
      for (const dy of [.4, .6, .25]) for (const dx of [.5, .35, .65]) {
        const x = box.left + (box.right - box.left) * dx, y = box.top + (box.bottom - box.top) * dy;
        const hit = document.elementFromPoint(x, y);
        if (hit?.closest('.combatant.enemy') === frame && !hit.closest('button')) return { x, y };
      }
      throw Error('No unobstructed native enemy body destination');
    });
    await page.touchscreen.tap(destination.x, destination.y);
    await page.waitForFunction(() => window.__rangeUiFixture.combat.eventLog.filter(event => event.type === 'cardPlayed').length > window.__rangeUiFixture.before, null, { timeout: 15000 });
    const after = await state(page);
    assert.equal(after.plays, 1); assert.equal(after.stamina, 0); assert.equal(after.band, 1, 'Throw never persists an approach');
    await setup(page, 3);
    await selectByTouch(page, 'qa.authored.advance');
    assert.equal(await page.locator('.combat-range-action').count(), 0, 'persistent authored movement has no ordinary surcharge attachment');
    assert.equal(await page.locator('.combat-hit-chance').count(), 0, 'persistent movement never claims an Accuracy roll');
    results.push({ width, height, geometry, before, after, movement: fixture.movement });
    console.log(`range UI ${width}x${height}: native route selection, current 0%, Throw payment and movement badge checks passed`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(resolve(out, 'checks.json'), JSON.stringify({ results, errors, failedResponses }, null, 2));
  await browser.close();
  await launched.close();
  if (server) await new Promise((resolve, reject) => server.server.close(error => error ? reject(error) : resolve()));
}
console.log(`Range action UI: ${results.length} layouts passed.`);
