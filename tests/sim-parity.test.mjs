// The simulators measure the fight a player gets (plan A1, docs/plan-polish-review-2026-09.md).
//
// src/main.js and every headless simulator build a run's fight through one
// door, engine/runCombat.js, and settle it through one exit. These checks
// hold that door: the live rules it applies, the pools it writes back, the
// bot's affordability in every pool, and that each caller still uses it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { cardPlayCosts } from '../src/engine/combat.js';
import { createRunState } from '../src/model/state.js';
import { resolveHandRules } from '../src/model/handRules.js';
import { handStatRows } from '../src/model/statRows.js';
import { resolvedRuleRow } from '../src/model/derivedStats.js';
import { resolveSwapCostRule } from '../src/model/loadout.js';
import { createRunCombat, runCombatEnd } from '../src/engine/runCombat.js';
import { affordableCards } from '../tools/simbot.mjs';

const registries = createRegistries(contentBundle);
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function fight(classId = 'starseer', settings = {}) {
  const run = createRunState({ seed: 41, classId, registries });
  const combat = createRunCombat({ registries, rng: createRng(41), run, enemyIds: ['wanderingSoldier'], settings });
  return { run, combat };
}

test('a run fight carries the rules a fresh profile gives the live game', () => {
  const { run, combat } = fight();
  // The hand's counts are the run's own stat rows since ruleset 7; a fresh
  // run's are the shipped table's.
  assert.deepEqual(combat.handRules, resolveHandRules({}, handStatRows(registries, run)), 'default hand rules');
  for (const id of ['openingHand', 'draw', 'handSize']) {
    assert.deepEqual(combat.handRules.rows[id], resolvedRuleRow(registries.derivedStatRules, id), `the shipped ${id} row`);
  }
  assert.equal(combat.swapCostRule, resolveSwapCostRule(registries, { settings: {} }), 'default swap price');
  if (registries.balance.combatRatings?.enabled) assert.ok(combat.ratingsRules, 'rating rules applied');
});

test('profile settings reach the fight through the same door', () => {
  const { combat } = fight('reaver', { 'gameConfig.handRules.retain': false });
  assert.equal(combat.handRules.retain, false);
});

test('runCombatEnd writes HP, Mana and Stamina back to the run', () => {
  const { run, combat } = fight('starseer');
  combat.player.hp = run.maxHp - 5;
  combat.player.mana = 0;
  combat.player.stamina = 1;
  runCombatEnd(run, combat);
  assert.equal(run.hp, run.maxHp - 5);
  assert.equal(run.mana, 0);
  assert.equal(run.stamina, 1);
});

test('the bot offers only cards affordable in every pool', () => {
  const { combat } = fight('starseer');
  const priced = combat.piles.hand.map((h) => ({ h, cost: cardPlayCosts(combat, h.instanceId) }));
  const stamina = priced.find(({ cost }) => cost.stamina > 0);
  assert.ok(stamina, 'the opening hand holds a card that costs Stamina');
  combat.player.stamina = stamina.cost.stamina - 1;
  const offered = affordableCards(registries, combat).map((h) => h.instanceId);
  assert.ok(!offered.includes(stamina.h.instanceId), 'a card short of Stamina is not offered');
  for (const id of offered) {
    const cost = cardPlayCosts(combat, id);
    assert.ok(cost.energy <= combat.player.energy && cost.mana <= combat.player.mana && cost.stamina <= combat.player.stamina, id);
  }
  assert.ok(offered.length > 0, 'something else in the opening hand is affordable');
  const refused = new Set([offered[0]]);
  assert.ok(!affordableCards(registries, combat, refused).some((h) => refused.has(h.instanceId)), 'a refused card is set aside');
});

test('the live game and every simulator build and settle fights through engine/runCombat.js', () => {
  const main = source('src/main.js');
  assert.match(main, /createRunCombat\(\{/, 'main.js enterCombat builds through createRunCombat');
  assert.match(main, /runCombatEnd\(run, combat\)/, 'main.js onCombatEnd settles through runCombatEnd');
  assert.doesNotMatch(main, /\bcreateCombat\(\{/, 'main.js has no second fight builder');
  for (const tool of ['tools/runsim.mjs', 'tools/balance.mjs', 'tools/measure-classes.mjs']) {
    const text = source(tool);
    assert.match(text, /createRunCombat\(\{/, `${tool} builds through createRunCombat`);
    assert.match(text, /affordableCards\(REG, /, `${tool} picks from affordableCards`);
  }
  for (const tool of ['tools/runsim.mjs', 'tools/measure-classes.mjs']) {
    assert.match(source(tool), /runCombatEnd\(run, combat\)/, `${tool} writes the pools back`);
  }
});
