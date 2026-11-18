// Owner, 2026-11-18 (element matrix): Lightning has Pierce built in, except against Block an Earth card laid; Stone Skin cuts each Pierce hit's
// bypass by 1 per stack and is gone at the start of its owner's turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { profileDamageReceipt, PierceBypass } from '../src/engine/gameProfileCombat.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { applyStatus, decayAtTurnStart } from '../src/engine/statuses.js';

const unlocks = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
function world() {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: unlocks });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 50, statuses: {}, persistentPoise: { value: 0, max: 0 } });
  delete enemy.combatStance;
  return { combat, enemy, player: combat.player };
}
const lightning = { tags: ['camp:spell', 'school:lightning', 'classification.attack'], combatProfile: { camp: 'spell', range: 'melee', tags: ['school:lightning'] } };
const plain = { tags: ['camp:physical', 'maneuver:attack', 'classification.attack'] };

test('Lightning carries Pierce without a tag; a plain hit does not', () => {
  const { combat, enemy, player } = world();
  assert.ok(PierceBypass(combat, enemy, lightning.combatProfile, lightning, 20, 20) > 0);
  assert.equal(PierceBypass(combat, enemy, {}, plain, 20, 20), 0);
  const a = profileDamageReceipt(combat, player, enemy, 20, lightning);
  const b = profileDamageReceipt(combat, player, enemy, 20, plain);
  assert.ok(a.pierceBypassed > 0, 'a Lightning hit passes some Block');
  assert.equal(b.pierceBypassed, 0);
});

test('Block an Earth card laid is not bypassed by a built-in Pierce', () => {
  const { combat, enemy, player } = world();
  enemy.earthBlock = 50;
  assert.equal(PierceBypass(combat, enemy, lightning.combatProfile, lightning, 40, 40), 0);
  assert.equal(profileDamageReceipt(combat, player, enemy, 40, lightning).pierceBypassed, 0);
  enemy.earthBlock = 0;
  assert.ok(profileDamageReceipt(combat, player, enemy, 40, lightning).pierceBypassed > 0);
});

// Owner, 2026-11-18 (ruling 21): 1 Stone Skin stack cancels 1 Pierce stack and both are spent.
const piercing = stacks => ({ tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], gear: { pierce: stacks } });
function spend(skin, pierce) {
  const { combat, enemy, player } = world();
  enemy.block = 50;
  if (skin) applyStatus(combat, enemy, 'stoneHide', skin, enemy);
  const quoted = profileDamageReceipt(combat, player, enemy, 40, piercing(pierce));
  assert.equal(enemy.statuses.stoneHide?.stacks || 0, skin, 'a quote spends nothing');
  applyAttackDamage(combat, player, enemy, 40, piercing(pierce).tags, piercing(pierce));
  return { bypass: quoted.pierceBypassed, left: enemy.statuses.stoneHide?.stacks || 0 };
}

test('Pierce 3 against Stone Skin 2 leaves Pierce 1 and no Stone Skin', () => {
  assert.deepEqual(spend(2, 3), { bypass: 1, left: 0 });
});

test('Pierce 3 against Stone Skin 4 leaves no Pierce and 1 Stone Skin', () => {
  assert.deepEqual(spend(4, 3), { bypass: 0, left: 1 });
});

test('with no Stone Skin the whole Pierce passes and nothing is spent; a tagged or Lightning hit meets Stone Skin the same way', () => {
  assert.deepEqual(spend(0, 3), { bypass: 3, left: 0 });
  const { combat, enemy, player } = world();
  const open = profileDamageReceipt(combat, player, enemy, 40, lightning).pierceBypassed;
  applyStatus(combat, enemy, 'stoneHide', 1, enemy);
  assert.equal(profileDamageReceipt(combat, player, enemy, 40, lightning).pierceBypassed, open - 1);
});

test('preview equals play: the quoted HP loss is what the hit then costs', () => {
  const { combat, enemy, player } = world();
  applyStatus(combat, enemy, 'stoneHide', 1, enemy);
  const quote = previewDamageHits(combat, player, enemy, 20, lightning.tags, lightning, 1);
  const before = enemy.hp;
  applyAttackDamage(combat, player, enemy, 20, lightning.tags, lightning);
  assert.equal(before - enemy.hp, quote.hpLoss);
  assert.ok(quote.hpLoss > 0, 'the fixture reaches HP through the Pierce');
});

test('Stone Skin is gone at the start of its owner\'s turn', () => {
  const { combat, player } = world();
  applyStatus(combat, player, 'stoneHide', 3, player);
  assert.equal(player.statuses.stoneHide.stacks, 3);
  player.fixCoreDecayRound = null;
  decayAtTurnStart(combat, player);
  assert.ok(!player.statuses.stoneHide || player.statuses.stoneHide.stacks === 0);
});
