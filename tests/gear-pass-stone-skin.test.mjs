// Owner, 2026-11-18 (element matrix): Lightning has Pierce built in, except against Block an Earth card laid; Stone Skin cuts each Pierce hit's
// bypass by 1 per stack and is gone at the start of its owner's turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { profileDamageReceipt, PierceBlockIgnored, PierceStacks } from '../src/engine/gameProfileCombat.js';
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
  assert.ok(PierceBlockIgnored(combat, enemy, lightning, lightning.combatProfile, 20, 20) > 0);
  assert.equal(PierceBlockIgnored(combat, enemy, plain, {}, 20, 20), 0);
  const a = profileDamageReceipt(combat, player, enemy, 20, lightning);
  const b = profileDamageReceipt(combat, player, enemy, 20, plain);
  assert.ok(a.pierceBypassed > 0, 'a Lightning hit passes some Block');
  assert.equal(b.pierceBypassed, 0);
});

test('Block an Earth card laid is not bypassed by a built-in Pierce', () => {
  const { combat, enemy, player } = world();
  enemy.earthBlock = 50;
  assert.equal(PierceBlockIgnored(combat, enemy, lightning, lightning.combatProfile, 40, 40), 0);
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
  const carrier = { ...plain, tags: [...plain.tags, 'pierce'], pierceStacks: pierce };
  const quoted = profileDamageReceipt(combat, player, enemy, 40, carrier);
  assert.equal(PierceStacks(combat, enemy, carrier), Math.max(0, pierce - skin));
  assert.deepEqual(profileDamageReceipt(combat, player, enemy, 40, carrier), quoted, 'repeated preview is pure');
  assert.equal(enemy.statuses.stoneHide?.stacks || 0, skin, 'a quote spends nothing');
  const before = enemy.hp;
  applyAttackDamage(combat, player, enemy, 40, carrier.tags, carrier);
  assert.equal(before - enemy.hp, quoted.hpLoss, 'preview equals live');
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
  assert.equal(quote.hpLoss, 0, 'Stone Skin cancels the single Lightning Pierce stack');
});

test('Stone Skin is gone at the start of its owner\'s turn', () => {
  const { combat, player } = world();
  applyStatus(combat, player, 'stoneHide', 3, player);
  assert.equal(player.statuses.stoneHide.stacks, 3);
  player.fixCoreDecayRound = null;
  decayAtTurnStart(combat, player);
  assert.ok(!player.statuses.stoneHide || player.statuses.stoneHide.stacks === 0);
});

test('a three-hit card spends Stone Skin hit by hit in the quote too: Pierce 1, Stone Skin 2 passes only the third hit', () => {
  const card = { tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], gear: { pierce: 1 } };
  const setup = () => {
    const { combat, enemy, player } = world();
    enemy.block = 30;
    applyStatus(combat, enemy, 'stoneHide', 2, enemy);
    return { combat, enemy, player };
  };
  const quoted = setup();
  const quote = previewDamageHits(quoted.combat, quoted.player, quoted.enemy, 20, card.tags, card, 3);
  const live = setup();
  const before = live.enemy.hp;
  for (let hit = 0; hit < 3; hit++) applyAttackDamage(live.combat, live.player, live.enemy, 20, card.tags, card);
  assert.equal(quote.hpLoss, before - live.enemy.hp, 'the quote equals the three hits');
  assert.equal(live.enemy.statuses.stoneHide?.stacks || 0, 0);
  assert.equal(quoted.enemy.statuses.stoneHide.stacks, 2, 'the quote spent nothing on the real target');
});

test('Diamond Skin retains Block and Stone Skin cancels Pierce under their original save keys', () => {
  assert.equal(registries.statuses.get('stoneskin').name, 'Diamond Skin');
  assert.equal(registries.statuses.get('stoneskin').modifiers.retainBlock, true);
  assert.equal(registries.statuses.get('stoneHide').name, 'Stone Skin');
  assert.equal(registries.statuses.get('stoneHide').stackMode, 'add');
});

// Review finding (LOW): Stone Skin is spent only against Pierce that would actually have passed Block.
test('against 0 Block no Stone Skin is spent; with Block the 3 v 2 and 3 v 4 rules still hold, preview equal to live', () => {
  const { combat, enemy, player } = world();
  enemy.block = 0;
  applyStatus(combat, enemy, 'stoneHide', 2, enemy);
  const carrier = { ...plain, tags: [...plain.tags, 'pierce'], pierceStacks: 3 };
  const quoted = profileDamageReceipt(combat, player, enemy, 40, carrier);
  assert.equal(quoted.skinSpent, undefined, 'Block 0 spends no skin');
  applyAttackDamage(combat, player, enemy, 40, carrier.tags, carrier);
  assert.equal(enemy.statuses.stoneHide?.stacks, 2, 'the live hit keeps both stacks');
  for (const [skin, pierce, bypass, left] of [[2, 3, 1, 0], [4, 3, 0, 1]]) {
    const w = world();
    w.enemy.block = 50;
    applyStatus(w.combat, w.enemy, 'stoneHide', skin, w.enemy);
    const c = { ...plain, tags: [...plain.tags, 'pierce'], pierceStacks: pierce };
    assert.equal(profileDamageReceipt(w.combat, w.player, w.enemy, 40, c).pierceBypassed, bypass);
    applyAttackDamage(w.combat, w.player, w.enemy, 40, c.tags, c);
    assert.equal(w.enemy.statuses.stoneHide?.stacks || 0, left);
  }
});
