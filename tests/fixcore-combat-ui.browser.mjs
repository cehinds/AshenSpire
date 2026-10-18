// Explicit presentation fixture over the real Core 2 engine and renderers.
// This is not a played-through encounter. No screenshot or raw dump is tracked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = `${(process.env.BASE_URL || server.url).replace(/\/$/, '')}/`;
const out = process.env.FIXCORE_UI_OUT || '/tmp/fixcore-combat-ui';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const results = [], errors = [];
try {
  for (const [width, height] of [[390, 844], [1024, 768], [1440, 900], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}index.html?shot=combat&gameProfile=core`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__combat);
    console.log(`Core 2 UI fixture: ${width}×${height}`);
    const fixture = await page.evaluate(async () => {
      const combat = window.__combat;
      const { fixCoreEnabled } = await import('/src/model/fixCoreMechanics.js');
      const { previewCard } = await import('/src/engine/combat.js');
      if (!fixCoreEnabled(combat)) throw new Error('UI fixture requires the live Core 2 FixCore gate');
      const id = document.querySelector('.combatant.enemy').dataset.eid;
      const enemy = combat.enemies.find(row => row.id === id);
      enemy.persistentPoise = { value: 12, max: 12 };
      enemy.persistentWard = { value: 8, max: 8 };
      enemy.block = 3;
      enemy.statuses = { ...enemy.statuses, weak: { stacks: 2 }, vulnerable: { stacks: 3 }, staggered: { stacks: 1 }, evade: { stacks: 2 } };
      // A cached successful read exercises the public known-information UI.
      for (const foe of combat.enemies) foe.knowledgeAction = { reads: { player: { visibility: 'exact', perception: { roll: 20, wisdom: 3, dc: 5, total: 23, passed: true } } } };
      combat.player.maxMana = 24; combat.player.mana = 6;
      combat.piles.hand.push({ cardId: 'twinbladeFlurry', instanceId: 'qa.multi', upgraded: false });
      window.__renderCombatForShot();
      const preview = previewCard(combat, 'qa.multi', id);
      const damage = preview.values.find(row => row.op === 'damage');
      return { targetId: id, faceHits: damage.hitDamages, total: damage.totalDamage, receipt: damage.damageReceipt };
    });
    assert.ok(fixture.receipt?.hits.length > 1);
    assert.equal(fixture.total, fixture.receipt.totalDamage, 'Core 2 face and receipt share net HP damage');
    const card = page.locator('.hand .card[data-instance-id="qa.multi"]');
    const lane = await card.locator('.hand-hit-lane').boundingBox();
    await page.mouse.click(lane.x + lane.width / 2, lane.y + lane.height * .42);
    assert.equal(await card.getAttribute('aria-pressed'), 'true');
    const enemy = page.locator(`.combatant.enemy[data-eid="${fixture.targetId}"]`);
    // Transparent sprite canvases extend beyond the painted actor. Hover its
    // measured body, which is also the target HUD's positioning authority.
    const body = await enemy.evaluate(async node => {
      const { currentSpriteBodyBounds } = await import('/src/ui/components/combatSpriteGeometry.js');
      return currentSpriteBodyBounds(node.querySelector('.sprite'));
    });
    await page.mouse.move((body.left + body.right) / 2, (body.headY ?? body.top) + 8);
    await page.waitForTimeout(650);
    assert.ok(await card.locator('[data-damage-receipt]').count());
    assert.match(await card.locator('.card-hit-chances').textContent(), /\d+(?:\.\d+)?%/);
    const panel = page.locator(`.target-hud-detail[data-eid="${fixture.targetId}"]`);
    const pips = await panel.locator('.combat-health-badge').evaluateAll(nodes => nodes.map(node => ({
      kind: node.dataset.defenseKind, value: node.querySelector('.combat-health-badge-value').textContent,
      width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height,
    })));
    assert.deepEqual(pips.map(({ kind, value }) => [kind, value]), [['evade', '2'], ['poise', '12'], ['ward', '8'], ['shield', '3']]);
    for (const pip of pips) assert.ok(Math.abs(pip.width - pip.height) < 1, `${pip.kind} keeps its aspect`);
    assert.equal(await panel.locator('[data-res="poise"]').count(), 0, 'pressure is not shown as remaining Poise');
    const textFit = await card.locator('[data-card-binding="rules"]').evaluate(node => ({
      text: node.textContent, font: parseFloat(getComputedStyle(node).fontSize),
      height: node.getBoundingClientRect().height, scrollHeight: node.scrollHeight,
    }));
    assert.match(textFit.text, /3 hits|×\s*3/);
    assert.ok(textFit.font >= 8, 'multi-hit text remains readable');
    await page.screenshot({ path: resolve(out, `target-${width}.png`) });
    const damage = await card.locator('[data-damage-receipt]').first().boundingBox();
    const played = await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length);
    await page.touchscreen.tap(damage.x + damage.width / 2, damage.y + damage.height / 2);
    await page.waitForTimeout(100);
    assert.match(await page.locator('.as-tip:visible').first().textContent(), /Damage calculation/);
    assert.equal(await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length), played, 'touching damage never plays the card');
    await page.screenshot({ path: resolve(out, `damage-${width}.png`) });
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      for (const enemy of window.__combat.enemies) enemy.knowledgeAction.reads.player.visibility = 'unknown';
      window.__renderCombatForShot();
    });
    assert.equal(await card.locator('.card-hit-chances').count(), 0, 'failed reads hide selected-card odds');
    const mana = await page.locator('.energy-orb svg image').evaluateAll(nodes => nodes.filter(node => ['diamond','spent'].includes(node.dataset.orbPart)).map(node => ({ kind:node.dataset.orbPart, x:Number(node.getAttribute('x')), y:Number(node.getAttribute('y')), w:Number(node.getAttribute('width')), h:Number(node.getAttribute('height')) })));
    assert.equal(mana.filter(gem => gem.kind === 'diamond').length,6);
    assert.equal(mana.filter(gem => gem.kind === 'spent').length,18);
    await page.locator('[data-combat-tool="log"]').click();
    await page.waitForTimeout(80);
    const log = page.locator('.combat-log-modal');
    assert.equal(await log.isVisible(),true);
    assert.equal(await log.evaluate(node => node.parentElement.parentElement === document.body),true,'expanded log shares the body modal portal');
    await page.screenshot({ path: resolve(out, `log-${width}.png`) });
    await page.keyboard.press('Escape');
    const end = page.locator('.end-turn'), endBox = await end.boundingBox();
    await page.mouse.move(endBox.x+endBox.width/2,endBox.y+endBox.height/2);
    await page.mouse.down(); await page.waitForTimeout(180);
    assert.match(await end.locator('.hold-hint').textContent(),/^\d+%$/);
    await end.dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse',bubbles:true});
    await page.mouse.up(); await page.waitForTimeout(50);
    assert.equal(await end.locator('.hold-hint').textContent(),'HOLD');
    results.push({ width, height, fixture, pips, textFit, mana });
    await page.close();
  }
  // The rounds preview is a separate supported legacy fixture. An idle plan
  // must reach End Turn instead of stalling on its first queued card.
  const autoPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  autoPage.on('pageerror', error => errors.push(error.message));
  await autoPage.goto(`${base}index.html?shot=combat&gameProfile=core`, { waitUntil: 'networkidle' });
  await autoPage.waitForFunction(() => !!window.__combat);
  await autoPage.evaluate(async () => {
    const [{contentBundle},{createRegistries},{createRunState},{createRng},{createRunCombat},{mountCombat},{COMBAT_ROUNDS_KEY}] = await Promise.all([
      import('/src/content/index.js'),import('/src/model/registries.js'),import('/src/model/state.js'),
      import('/src/engine/rng.js'),import('/src/engine/runCombat.js'),import('/src/ui/screens/combat.js'),import('/src/model/combatRounds.js'),
    ]);
    const registries = createRegistries(contentBundle);
    const settings = { autoCombat:true, combatActionDelay:0, combatSpeed:8, animSpeed:'instant' };
    const run = createRunState({seed:5,classId:'reaver',registries,combatExpansionVersion:1,profileMeta:{settings:{[COMBAT_ROUNDS_KEY]:true}}});
    run.stats = {damageDealt:0,damageTaken:0};
    const combat = createRunCombat({registries,rng:createRng(5),run,enemyIds:['wanderingSoldier'],settings:{}});
    if (!combat.combatRounds) throw new Error('Autoplay regression requires a planned rounds queue');
    window.__autoRegression = {combat,settings,initialTurn:combat.turn,samples:[]};
    window.__autoRegression.timer = setInterval(() => {
      window.__autoRegression.samples.push({turn:combat.turn,queue:(combat.combatRounds.playerQueue || []).map(card=>card.instanceId)});
    },20);
    mountCombat(document.getElementById('app'),{registries,run,combat,meta:{settings},readSettings:()=>settings,onEnd:()=>{}});
  });
  await autoPage.waitForFunction(() => window.__autoRegression.combat.turn > window.__autoRegression.initialTurn || !!window.__autoRegression.combat.result, null, {timeout:15000});
  const autoplay = await autoPage.evaluate(() => {
    const state = window.__autoRegression;
    state.settings.autoCombat = false; clearInterval(state.timer);
    return {turn:state.combat.turn,initialTurn:state.initialTurn,result:state.combat.result,samples:state.samples};
  });
  assert.ok(autoplay.samples.some(sample=>sample.queue.length>0),'autoplay queued a legal planned card');
  assert.ok(autoplay.turn>autoplay.initialTurn || autoplay.result,'autoplay completed the planned round');
  assert.ok(autoplay.samples.every(sample=>new Set(sample.queue).size===sample.queue.length),'planned cards are not queued repeatedly');
  results.push({autoplay});
  await autoPage.close();
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(resolve(out, 'checks.json'), JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  await server?.close();
}
console.log('FixCore combat UI browser checks passed (4 viewports + planned-round autoplay).');
