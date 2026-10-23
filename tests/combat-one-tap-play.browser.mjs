// One tap plays a card when its target is unambiguous, but only when the player
// has opted in to oneTapPlay (owner, 2026-10-18 14:15: "make sure I don't auto
// play a card when I click on it once"; 14:32: "keep the switch but make it
// default to not be 1 tap"). Default settings:
//   - a single tap on a self card or a single-enemy card SELECTS and plays nothing.
// With oneTapPlay true (opt-in):
//   - a self card plays on one tap, whatever the enemy count;
//   - a single-target attack plays on its one tap when exactly one enemy lives;
//   - with two living enemies the first tap SELECTS and plays nothing.
// Run: PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-one-tap-play.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];

// Seed 4 deals Defend (self), Strike (one enemy), Smash, Counter, Strike.
async function board(enemyCount, seed = 4, settings = null) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.BASE_URL || server.url}index.html?shot=combat&gameProfile=core&shotSeed=${seed}&shotEnemyCount=${enemyCount}&shotHand=5${settings ? `&shotSettings=${encodeURIComponent(JSON.stringify(settings))}` : ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__combat);
  return page;
}
const state = page => page.evaluate(() => ({
  hand: window.__combat.piles.hand.map(card => card.cardId),
  energy: window.__combat.player.energy,
  enemyHp: window.__combat.enemies.map(enemy => enemy.hp),
}));
const tapCard = async (page, cardId) => {
  const card = page.locator(`.hand .card[data-card-id="${cardId}"]`).first();
  const box = await card.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

try {
  {
    // DEFAULT settings (oneTapPlay off): a single tap never plays a card.
    const page = await board(1);
    const before = await state(page);
    await tapCard(page, 'core.strike');
    await page.waitForTimeout(900);
    assert.deepEqual(await state(page), before, 'default, 1 enemy: a single tap on Strike plays nothing');
    assert.ok(await page.locator('.hand .card.selected[data-card-id="core.strike"]').count() > 0, 'default, 1 enemy: the tap selects Strike');
    await page.waitForTimeout(1500);
    await tapCard(page, 'core.strike');
    await page.waitForTimeout(900);
    assert.equal((await state(page)).hand.length, before.hand.length - 1, 'default, 1 enemy: the NEXT tap on the selected Strike plays it, with no timing window');
    await page.close();
  }
  {
    const page = await board(2);
    const before = await state(page);
    await tapCard(page, 'core.defend');
    await page.waitForTimeout(900);
    assert.deepEqual(await state(page), before, 'default, self card: a single tap selects and plays nothing');
    assert.ok(await page.locator('.hand .card.selected[data-card-id="core.defend"]').count() > 0, 'default, self card: the tap selects Defend');
    await page.waitForTimeout(1500);
    await tapCard(page, 'core.defend');
    await page.waitForTimeout(900);
    assert.equal((await state(page)).hand.length, before.hand.length - 1, 'default, self card: Defend plays on exactly the second tap');
    await page.close();
  }
  {
    // OPT-IN: oneTapPlay true restores the single-tap play for an unambiguous target.
    const page = await board(1, 4, { oneTapPlay: true });
    const before = await state(page);
    // Default one-tap play must still yield to the numeric receipt inspector.
    const damage = page.locator('.hand .card[data-card-id="core.strike"]').last().locator('[data-damage-receipt]').first();
    const numberBox = await damage.boundingBox();
    assert.ok(numberBox, 'the default one-tap card exposes a damage inspector');
    await page.mouse.click(numberBox.x + numberBox.width / 2, numberBox.y + numberBox.height / 2);
    const tip = page.locator('.as-tip:visible').first();
    await tip.waitFor({state:'visible'});
    assert.match(await tip.textContent(), /Damage calculation/);
    assert.deepEqual(await state(page), before, 'inspecting damage cannot play a one-tap card');
    await page.keyboard.press('Escape');
    await tapCard(page, 'core.strike');
    await page.waitForTimeout(900);
    const after = await state(page);
    assert.equal(after.hand.length, before.hand.length - 1, '1v1: one tap on Strike played it');
    assert.ok(after.energy < before.energy, '1v1: and spent its cost');
    const resolution = await page.evaluate(() => {
      const combat = window.__combat;
      const events = combat.eventLog.filter(event => event.sourceId === 'player' && event.cardId === 'core.strike');
      return { targetId:combat.enemies[0].id,
        plays:events.filter(event => event.type === 'cardPlayed').map(event => event.targetId),
        attempts:events.filter(event => ['attackHit','attackMissed'].includes(event.type)).map(event => event.targetId) };
    });
    assert.deepEqual(resolution.plays, [resolution.targetId], '1v1: exactly one Strike was dispatched against the sole enemy');
    assert.ok(resolution.attempts.length > 0, 'the real engine resolved a hit attempt, including a possible range miss');
    assert.ok(resolution.attempts.every(targetId => targetId === resolution.targetId), 'every hit attempt belongs to the sole enemy');
    await page.close();
  }
  {
    const page = await board(2, 4, { oneTapPlay: true });
    const before = await state(page);
    await tapCard(page, 'core.strike');
    await page.waitForTimeout(900);
    const after = await state(page);
    assert.deepEqual(after, before, '2 enemies: one tap on Strike plays nothing');
    assert.ok(await page.locator('.hand .card.selected[data-card-id="core.strike"]').count() > 0, '2 enemies: it selects, and the player chooses the target');
    await page.close();
  }
  {
    const page = await board(2, 4, { oneTapPlay: true });
    const before = await state(page);
    await tapCard(page, 'core.defend');
    await page.waitForTimeout(900);
    const after = await state(page);
    assert.equal(after.hand.length, before.hand.length - 1, 'self card: one tap played Defend even with two enemies');
    assert.ok(after.energy < before.energy, 'self card: and spent its cost');
    await page.close();
  }
  {
    // A COMPLETED HOLD SELECTS, never plays (it is what reveals the info and Upcast controls).
    const page = await board(2, 4, { oneTapPlay: true });
    const before = await state(page);
    const box = await page.locator('.hand .card[data-card-id="core.defend"]').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();
    await page.waitForTimeout(500);
    assert.deepEqual(await state(page), before, 'a completed hold on a self card dispatches no playCard');
    assert.ok(await page.locator('.hand .card.selected[data-card-id="core.defend"]').count() > 0, 'and leaves it selected');
    // ...and the next tap on the selected card plays it.
    await tapCard(page, 'core.defend');
    await page.waitForTimeout(900);
    assert.equal((await state(page)).hand.length, before.hand.length - 1, 'the tap after a hold plays the selected self card');
    await page.close();
  }
  {
    // A sweep (all-enemy) card has nothing to choose: one tap plays it with two enemies alive.
    const page = await board(2, 7, { oneTapPlay: true });
    const before = await state(page);
    await tapCard(page, 'core.sweep');
    await page.waitForTimeout(900);
    const after = await state(page);
    assert.equal(after.hand.length, before.hand.length - 1, 'sweep: one tap played an all-enemy card');
    assert.ok(after.energy < before.energy, 'sweep: and spent its cost');
    await page.close();
  }
  {
    // End Turn's beat is CARD-ONLY. In a v2 fight a control-recovery action keeps
    // the pulse lit, but with no playable card the End Turn press is still one tap.
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.BASE_URL || server.url}index.html?shot=combat&gameProfile=core&shotSeed=4&shotEnemyCount=1&shotExpansion=sleep`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__combat);
    const before = await page.evaluate(() => {
      const combat = window.__combat;
      combat.piles.hand = [];
      combat.player.energy = Math.max(combat.player.energy, 3);
      return { turn: combat.turn, phase: combat.phase, version: combat.combatExpansionVersion };
    });
    assert.equal(before.version, 2, 'fixture: an expansion v2 fight');
    const box = await page.locator('.end-turn').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.confirmation-modal').count(), 0, 'no review opens');
    const after = await page.evaluate(() => ({ turn: window.__combat.turn, phase: window.__combat.phase }));
    assert.ok(after.turn > before.turn || after.phase !== before.phase, 'one tap ended the turn');
    await page.close();
  }
  {
    // With one-tap play OFF the hold still never plays, and the NEXT tap does.
    const page = await board(2, 4, { oneTapPlay: false });
    const before = await state(page);
    const box = await page.locator('.hand .card[data-card-id="core.defend"]').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();
    await page.waitForTimeout(500);
    assert.deepEqual(await state(page), before, 'setting off: a completed hold plays nothing');
    assert.ok(await page.locator('.hand .card.selected[data-card-id="core.defend"]').count() > 0, 'setting off: it leaves the card selected');
    await tapCard(page, 'core.defend');
    await page.waitForTimeout(900);
    assert.equal((await state(page)).hand.length, before.hand.length - 1, 'setting off: the NEXT tap on the hold-selected card plays it');
    await page.close();
  }
  {
    // The card hold is a SELECTION gesture: with the confirm dial OFF a long press
    // still selects (it does not collapse to a tap that plays), a short press plays.
    const page = await board(2, 4, { holdConfirm: 'off', oneTapPlay: true });
    const before = await state(page);
    const box = await page.locator('.hand .card[data-card-id="core.defend"]').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();
    await page.waitForTimeout(500);
    assert.deepEqual(await state(page), before, 'dial off: a long press on a self card dispatches no playCard');
    assert.ok(await page.locator('.hand .card.selected[data-card-id="core.defend"]').count() > 0, 'dial off: it selects the card');
    await page.close();
    const page2 = await board(2, 4, { holdConfirm: 'off', oneTapPlay: true });
    const before2 = await state(page2);
    await tapCard(page2, 'core.defend');
    await page2.waitForTimeout(900);
    assert.equal((await state(page2)).hand.length, before2.hand.length - 1, 'dial off: a short press plays the self card');
    await page2.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS combat-one-tap-play');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  server?.close?.();
  process.exit(process.exitCode || 0);
}
