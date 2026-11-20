// PLAYWRIGHT_MODULE=/path/to/playwright node tests/enemy-level-budget.browser.mjs
// Real Core combat factories and UI inputs; no injected combat or DOM state.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
import { SFX_MANIFEST, SFX_RECIPES } from '../src/content/sfx.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = resolve(process.env.QA_OUT || 'scratch/qa/enemy-level-budget');
mkdirSync(out, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true, host: '127.0.0.1' });
const browser = await chromium.launch();
const results = [], errors = [], warnings = [], failedResponses = [];
const art = JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url)));
function optionalAudioProbe(url) {
  try {
    const parsed = new URL(url), match = /^\/assets\/sfx\/([^/]+)\.ogg$/.exec(parsed.pathname);
    if (parsed.origin !== new URL(server.url).origin || !match) return false;
    const id = decodeURIComponent(match[1]);
    return Object.hasOwn(SFX_RECIPES, id) && !Object.hasOwn(SFX_MANIFEST, id)
      && !art.assets[`assets/sfx/${id}.ogg`];
  } catch { return false; }
}
const acts = [
  [['wanderingSoldier', 1], ['wyrmAspirant', 2], ['fellWarden', 3]],
  [['gildedKnight', 2], ['courtDuelist', 3], ['stitchedKing', 4]],
  [['ashRevenant', 3], ['wyrmLord', 4], ['ashheartDragon', 5]],
];
const stats = page => page.evaluate(() => window.__combat.enemies.map(e => ({
  id: e.id, enemyId: e.enemyId, level: e.level, own: e.ownAttributes,
  bonus: e.attributeBonuses, attributes: e.attributes, maxHp: e.maxHp,
})));
async function hold(page, locator) {
  const b = await locator.boundingBox();
  assert.ok(b, 'hold target is laid out');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * .6);
  await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
}
async function open(page, ids) {
  await page.goto(`${server.url}index.html?shot=combat&gameProfile=core&shotSeed=4&shotEnemies=${ids.join(',')}&shotHand=5`);
  await page.waitForFunction(() => !!window.__combat);
  await page.waitForSelector('.combatant.enemy .sprite');
  await page.waitForTimeout(1200);
}
try {
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 600, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });
    page.on('console', m => {
      if (m.type() !== 'error') return;
      // Chromium blocks the automatic opening haptic until a trusted user gesture.
      const expected = /^Blocked call to navigator\.vibrate/.test(m.text())
        || (/^Failed to load resource:.*404/.test(m.text()) && optionalAudioProbe(m.location().url));
      (expected ? warnings : errors).push(m.text());
    });
    for (const [act, fixtures] of (process.env.QA_FLOW_ONLY ? [] : acts.entries())) {
      await open(page, fixtures.map(([id]) => id));
      const before = await stats(page);
      await page.screenshot({ path: `${out}/${width}-act${act + 1}-combat.png` });
      for (const [index, [id, level]] of fixtures.entries()) {
        let e = before[index];
        assert.equal(e.enemyId, id); assert.equal(e.level, level);
        assert.equal(Object.values(e.own).reduce((a, b) => a + b, 0), 5 + level);
        for (const [key, value] of Object.entries(e.own)) {
          assert.ok(value >= 1, `${id}: own ${key} stays above the floor`);
          assert.equal(e.attributes[key], Math.max(0, value + e.bonus[key]));
        }
        // Inspect a single actor so overlapping sprite hitboxes cannot select a neighbour.
        await open(page, [id]);
        e = (await stats(page))[0];
        await hold(page, page.locator('.combatant.enemy .sprite'));
        const door = page.locator('.combatant-door'); await door.waitFor();
        assert.match(await door.innerText(), new RegExp(`LEVEL ${level}\\b`));
        const row = door.locator('[data-fact="attributes"]');
        await row.scrollIntoViewIfNeeded();
        const expected = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'].map((key, n) =>
          `${['STR', 'DEX', 'CON', 'WIS', 'INT'][n]} ${e.own[key]}${e.bonus[key] ? `${e.bonus[key] > 0 ? '+' : '−'}${Math.abs(e.bonus[key])}` : ''}`).join(' · ');
        assert.equal(await row.locator('.as-status').innerText(), expected);
        const fit = await row.evaluate(node => {
          const label = node.querySelector('.r-label'), r = node.getBoundingClientRect();
          const host = node.closest('.combatant-inspector-details').getBoundingClientRect();
          return { labelFits: label.scrollWidth <= label.clientWidth + 1, valueFits: node.scrollWidth <= node.clientWidth + 1,
            visible: r.left >= host.left - 1 && r.right <= host.right + 1 && r.top >= host.top - 1 && r.bottom <= host.bottom + 1 };
        });
        assert.deepEqual(fit, { labelFits: true, valueFits: true, visible: true }, `${width} ${id}: full attribute row readable`);
        if (index === 0) await page.screenshot({ path: `${out}/${width}-act${act + 1}-inspector.png` });
        await door.getByRole('button', { name: 'Close', exact: true }).click();
        await door.waitFor({ state: 'detached' });
        assert.deepEqual(await stats(page), [e], 'inspection does not mutate enemy stats');
      }
      results.push({ width, act: act + 1, enemies: before });
    }
    if (process.env.QA_INSPECTION_ONLY) { await page.close(); continue; }
    await open(page, ['wanderingSoldier']);
    const before = await stats(page), hp = await page.evaluate(() => window.__combat.enemies[0].hp);
    // Seed 4's first strike legitimately misses (d20=4 vs Evasion 9).
    // Resolve the next available strike rather than treating a legal miss as a broken input.
    for (let attempt = 0; attempt < 2; attempt++) {
      const resolved = await page.evaluate(() => window.__combat.eventLog.filter(e => e.type === 'cardResolved').length);
      await page.locator('.hand .card[data-card-id="core.strike"]').first().click();
      await page.waitForTimeout(600);
      const target = await page.locator('.combatant.enemy .sprite').boundingBox();
      await page.mouse.click(target.x + target.width / 2, target.y + target.height * .6);
      await page.waitForFunction(n => window.__combat.eventLog.filter(e => e.type === 'cardResolved').length > n, resolved);
      await page.waitForFunction(() => !document.querySelector('.end-turn').disabled);
      if (await page.evaluate(hp => window.__combat.enemies[0].hp < hp, hp)) break;
    }
    assert.ok(await page.evaluate(hp => window.__combat.enemies[0].hp < hp, hp), 'a resolved strike deals damage');
    await page.waitForFunction(() => !document.querySelector('.end-turn').disabled);
    const turn = await page.evaluate(() => window.__combat.turn);
    await hold(page, page.locator('.end-turn'));
    await page.waitForFunction(turn => window.__combat.turn > turn && !document.querySelector('.end-turn').disabled, turn);
    assert.deepEqual(await stats(page), before, 'attack and enemy turn preserve level and own/gear stats');
    results.push({ width, attackAndTurn: 'PASS' });
    await page.screenshot({ path: `${out}/${width}-after-turn.png` });
    await page.close();
  }
  assert.deepEqual(errors, [], 'no unexpected browser errors beyond documented haptic and optional audio notices');
  assert.deepEqual(failedResponses.filter(r => r.status !== 404 || !optionalAudioProbe(r.url)), [], 'only absent optional synthesized audio samples may return 404');
  console.log(`PASS: ${results.filter(r => r.act).length} act/tier boards with three inspected enemies each, ${results.filter(r => r.attackAndTurn).length} attack/turn flows; ${warnings.length} documented browser/audio notices`);
} finally {
  writeFileSync(`${out}/checks.json`, JSON.stringify({ results, errors, warnings, failedResponses }, null, 2));
  await browser.close(); server.server.close();
}
