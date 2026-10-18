// Real standalone HTML input. Fixtures use canonical engine enemies and cards;
// no dispatch, target, animation, or reaction implementation is replaced.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.QA_BUILD_URL;
if (!url) throw new Error('QA_BUILD_URL must name the served standalone HTML');
const source = process.env.QA_SOURCE_URL || new URL('./src/', url).href;
const out = resolve(process.env.QA_OUTPUT || '/tmp/starseer-spell-qa');
mkdirSync(out, { recursive: true });
const owner = await launchBrowser({ browser: process.env.CHROME || '/usr/bin/chromium', prefix: 'starseer-spell-' });
const browser = await chromium.connectOverCDP(owner.wsUrl);
const html = await (await fetch(url)).text();
const build = { source: html.match(/const SOURCE = '([a-f0-9]+)'/)?.[1], ordinal: html.match(/const ORDINAL = '(\d+)'/)?.[1] };
const report = { url, source, build, fixtures: 'Seed B Starseer opening hand with the canonical Gilded Knight created by createRunCombat. Star Spark uses registered card instances and sufficient Mana/Actions. Actual HTML targeting and dispatch remain untouched.', cases: [], errors: [] };
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const kind of ['staffMagicStrike', 'starSpark']) {
      const device = viewport.width < 600 ? 'phone' : 'desktop';
      const context = await browser.newContext({ viewport, hasTouch: device === 'phone' });
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push({ device, kind, stack: e.stack }));
      page.on('console', message => { if (/\[combat\].*(rejected|ignored)/.test(message.text())) report.errors.push({ device, kind, message: message.text() }); });
      await page.addInitScript(() => {
        window.__spellUnhandled = [];
        window.addEventListener('unhandledrejection', e => window.__spellUnhandled.push(String(e.reason?.stack || e.reason)));
        window.__spellLongTasks = [];
        new PerformanceObserver(list => window.__spellLongTasks.push(...list.getEntries().map(e => ({ at: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
      });
      await page.goto(`${url}?shot=combat&shotClass=starseer&shotSeed=B`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.end-turn:not([disabled])');
      const before = await page.evaluate(async ({ source, kind }) => {
        const { createRunCombat } = await import(source + 'engine/runCombat.js');
        const c = window.__combat;
        const knight = createRunCombat({ registries: c.registries, rng: c.rng, run: window.__combatRunForShot,
          enemyIds: ['gildedKnight'], encounter: c.registries.encounters.get('a2_knight') });
        c.enemies = knight.enemies;
        c.enemyKnowledge = knight.enemyKnowledge;
        if (kind === 'starSpark') {
          c.piles.hand = ['spark1', 'spark2'].map(instanceId => ({ cardId: 'starSpark', instanceId, upgraded: false }));
          c.player.energy = c.player.mana = c.player.stamina = 20;
          // Registered spells plus the live rating state; no effect overrides.
          c.player.ratings.pr = Math.max(c.player.ratings.pr, 4);
        }
        window.__renderCombatForShot();
        return { hp: c.enemies[0].hp, energy: c.player.energy, mana: c.player.mana, stamina: c.player.stamina,
          ids: c.piles.hand.filter(i => kind === 'starSpark' ? i.cardId === 'starSpark' : i.profileId === 'staffMagicAttack').slice(0, 2).map(i => i.instanceId),
          eventCount: c.eventLog.length, started: performance.now() };
      }, { source, kind });
      assert.equal(before.ids.length, 2, 'two genuine damaging spell cards available');
      for (const [index, id] of before.ids.entries()) {
        await page.locator(`.hand .card[data-instance-id="${id}"]`).click();
        const target = page.locator('.enemy-target-button').filter({ hasText: 'Gilded Knight' });
        assert.equal(await target.isEnabled(), true, 'Knight is a legal spell target');
        if (index === 0) await page.screenshot({ path: resolve(out, `${device}-${kind}-selected.png`) });
        // Exercise the rendered figure hitbox separately from the target list.
        if (index === 0 && device === 'desktop') {
          const point = await page.evaluate(() => {
            const sprite = document.querySelector('.enemy.targetable .sprite'), box = sprite.getBoundingClientRect();
            for (let yi = 1; yi < 10; yi++) for (let xi = 1; xi < 10; xi++) {
              const x = box.left + box.width * xi / 10, y = box.top + box.height * yi / 10;
              const hit = document.elementFromPoint(x, y);
              if (hit?.closest('.sprite') === sprite) return { x, y };
            }
            return null;
          });
          assert.ok(point, 'enemy figure has a pointer-accessible target area');
          await page.mouse.click(point.x, point.y);
        } else await target.click();
        await page.waitForFunction(id => window.__combat.eventLog.some(e => e.type === 'cardPlayed' && e.cardInstanceId === id), id, { timeout: 10000 });
        await page.waitForFunction(() => window.__combat.pendingReaction || document.querySelector('.end-turn')?.disabled === false, null, { timeout: 15000 });
        if (await page.evaluate(() => !!window.__combat.pendingReaction)) {
          await page.screenshot({ path: resolve(out, `${device}-${kind}-reaction.png`) });
          await page.locator('.reaction-choice button').filter({ hasText: /^Resolve$/ }).click();
        }
        await page.waitForSelector('.end-turn:not([disabled])', { timeout: 15000 });
      }
      const after = await page.evaluate(before => {
        const c = window.__combat, events = c.eventLog.slice(before.eventCount);
        return { hp: c.enemies[0].hp, energy: c.player.energy, mana: c.player.mana, stamina: c.player.stamina,
          paid: events.filter(e => e.type === 'cardPlayed'), damage: events.filter(e => e.type === 'damageDealt'),
          reactions: events.filter(e => e.type === 'enemyMoveStarted' && e.reaction),
          pending: !!(c.pendingReaction || c.reactionResume || c.pendingAbilityDiscard), queue: c.queue.length,
          unhandled: window.__spellUnhandled, longTasks: window.__spellLongTasks.filter(e => e.at >= before.started) };
      }, before);
      assert.equal(after.paid.length, 2);
      for (const [pool, spent] of [['energy', 'energySpent'], ['mana', 'manaSpent'], ['stamina', 'staminaSpent']]) {
        assert.equal(after[pool], before[pool] - after.paid.reduce((n, e) => n + e[spent], 0), `${pool} charged once per spell`);
      }
      assert.ok(after.reactions.some(e => e.moveId === 'gildedGuard'), 'Knight reaction resolves');
      assert.ok(after.damage.some(e => e.sourceId === 'player' && e.targetId === 'e1'), 'spell damage receipt');
      assert.ok(after.hp < before.hp, 'Knight loses HP after defenses');
      assert.equal(after.pending, false); assert.equal(after.queue, 0); assert.deepEqual(after.unhandled, []);
      await page.screenshot({ path: resolve(out, `${device}-${kind}-resolved.png`) });
      report.cases.push({ device, kind, before, after });
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ cases: report.cases.length, errors: report.errors, out }));
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await owner.close();
}
