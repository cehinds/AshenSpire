// Owner, 2026-11-18: face numbers are BLACK by default, including everything the character carries outside the fight (attributes, gear, level,
// the global multipliers). A number is GREEN only when something in the fight raises it (a boost, the current stance's bonus, a relic or card
// trigger active now) and RED only when something in the fight lowers it (Weak, Frail, ...). The baseline is the same card's face outside combat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { ChangeAttribute } from '../src/engine/liveStats.js';
import { applyStatus } from '../src/engine/statuses.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const profile = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };

function fight(classId) {
  const run = createRunState({ registries, classId, seed: 31, profileMeta: META });
  run.relics = [];
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  primeAccuracyRolls(combat, { count: 2 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const enemy = combat.enemies[0];
  enemy.weaknesses = [];
  enemy.hp = enemy.maxHp = 5000;
  return { run, combat, enemy };
}
const classes = (html) => [...html.matchAll(/<span class="(val[^"]*)">(\d+)<\/span>/g)].map(match => match[1].replace('val', '').trim() || 'black');
function damageClasses({ combat, enemy }, cardId) {
  combat.piles.hand.push({ instanceId: `c-${cardId}-${combat.piles.hand.length}`, cardId });
  const inst = combat.piles.hand.at(-1);
  const preview = previewCard(combat, inst.instanceId, enemy.id);
  const line = cardFaceLines(registries.cards.get(cardId), preview, registries, null).find(row => row.kind === 'damage');
  return classes(line.html);
}

test('a face outside combat is always black', () => {
  const { run } = fight('starseer');
  const text = cardFaceLines(registries.cards.get('core.venomSpray'), undefined, registries, run).map(row => row.html).join('');
  assert.ok(!/class="val (up|down)"/.test(text));
  assert.ok(/class="val"/.test(text));
});

test('attributes and gear alone leave a combat number black', () => {
  const world = fight('starseer');
  // The static face (run rules) and the live preview agree on core.venomSpray, so the figure carries no mark.
  const live = damageClasses(world, 'core.venomSpray');
  assert.deepEqual(live, ['black'], 'the always-on Divine WIS bonus is part of the baseline');
  assert.equal(damageClasses(world, 'core.venomSpray').length, 1);
});

test('a fight boost turns the number green', () => {
  const world = fight('starseer');
  ChangeAttribute(world.combat, world.combat.player, 'wisdom', 4);
  assert.deepEqual(damageClasses(world, 'core.venomSpray'), ['up']);
});

test('a fight debuff on the player turns the number red', () => {
  const world = fight('starseer');
  ChangeAttribute(world.combat, world.combat.player, 'wisdom', -2);
  assert.deepEqual(damageClasses(world, 'core.venomSpray'), ['down']);
});

test('the current stance bonus turns a physical attack green', () => {
  const world = fight('reaver');
  assert.deepEqual(damageClasses(world, 'core.strike'), ['up'], 'Attack stance and its matching bonus are in-combat effects');
});

test('Weak turns a physical attack without a stance bonus red', () => {
  const weak = fight('reaver');
  applyStatus(weak.combat, weak.combat.player, 'weak', 2, weak.combat.player);
  assert.deepEqual(damageClasses(fight('reaver'), 'core.sweep'), ['black'], 'Sweep carries no stance bonus: attributes alone leave it black');
  assert.deepEqual(damageClasses(weak, 'core.sweep'), ['down'], 'Weak cuts the STR bonus below the face outside combat');
});

test('the plain-text face never carries a mark', () => {
  const { run } = fight('reaver');
  assert.ok(!/val (up|down)/.test(cardPlainText(registries, { cardId: 'core.strike' }, { rules: run })));
});

test('a triggered relic effect that raises a hit turns the number green', () => {
  const world = fight('reaver');
  // A relic or card trigger that fires in the fight changes a number the same way any in-combat boost does: here the Reaver's STR rises for the turn.
  assert.deepEqual(damageClasses(world, 'core.sweep'), ['black']);
  ChangeAttribute(world.combat, world.combat.player, 'strength', 3, { thisTurn: true });
  assert.deepEqual(damageClasses(world, 'core.sweep'), ['up']);
});
