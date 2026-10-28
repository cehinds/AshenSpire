// Owner ruling 2026-10-28: a Core combat card's damage number is what the hit does after the enemy's Poise
// (and Vulnerable/Weak), not the raw pre-defence number. The enemy's Block and Barrier are never subtracted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight({ classId = 'reaver', cardId = 'strike', enemies = [{}] } = {}) {
  const run = createRunState({ registries: reg, classId, seed: 5, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(5), enemyIds: enemies.map(() => 'wanderingSoldier') });
  combat.enemies.forEach((enemy, i) => {
    const { poise = 0, block = 0, statuses = {} } = enemies[i];
    Object.assign(enemy, { hp: 500, maxHp: 500, block, barrier: 0, statuses, persistentPoise: { value: poise, max: 20 }, attributes: { dexterity: 0 } });
    delete enemy.combatStance; delete enemy.combatCounter;
  });
  combat.player.energy = 9; combat.player.mana = 9;
  const card = combat.piles.hand[0];
  card.cardId = cardId; card.upgraded = false;
  return { combat, id: card.instanceId };
}
const damageRow = (combat, id, target) => previewCard(combat, id, target).values.find(v => v.op === 'damage');

test('Strike against a Poise enemy: the face is 9 (12 x 0.75) and the hit does 9', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10 }] });
  const enemy = combat.enemies[0];
  primeAccuracyRolls(combat);
  assert.equal(damageRow(combat, id).faceValue, 9, 'untargeted face');
  assert.equal(damageRow(combat, id, enemy.id).faceValue, 9, 'targeted face');
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: enemy.id });
  assert.equal(500 - enemy.hp, 9);
});

test('Arcane Spark: face 8 (11 x 0.75) against a Poise enemy', () => {
  const { combat, id } = fight({ classId: 'starseer', cardId: 'starSpark', enemies: [{ poise: 10 }] });
  combat.player.ratings = { ...combat.player.ratings, pr: (combat.player.ratings?.pr || 0) + 1 }; // lifts the raw face from 10 to 11
  const raw = previewCard(combat, id, undefined, undefined, { rawFace: true }).values.find(v => v.op === 'damage').faceValue;
  assert.equal(raw, 11);
  assert.equal(damageRow(combat, id).faceValue, 8);
});

test('no Poise and no defence: the face is the raw number', () => {
  const { combat, id } = fight();
  assert.equal(damageRow(combat, id).faceValue, 12);
});

test('Block is never subtracted from the face', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10, block: 5 }] });
  const row = damageRow(combat, id, combat.enemies[0].id);
  assert.equal(row.faceValue, 9, 'face ignores Block');
  assert.equal(row.value, 5, 'the targeted hit still lands net of Block');
});

test('Vulnerable is part of the face', () => {
  const { combat, id } = fight({ enemies: [{ statuses: { vulnerable: { stacks: 1, duration: 2 } } }] });
  const face = damageRow(combat, id).faceValue;
  assert.ok(face > 12, `Vulnerable raises the face above the raw 12, got ${face}`);
  assert.equal(face, damageRow(combat, id, combat.enemies[0].id).value, 'the face is the targeted hit when there is no Block');
});

test('two enemies with different defences: selecting each shows that enemy\'s figure; no selection uses the frontmost', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10 }, {}] });
  const [a, b] = combat.enemies;
  assert.equal(damageRow(combat, id).faceValue, 9, 'frontmost has Poise');
  assert.equal(damageRow(combat, id, a.id).faceValue, 9);
  assert.equal(damageRow(combat, id, b.id).faceValue, 12);
  assert.equal(damageRow(combat, id, a.id).value, 9, 'face equals the targeted preview (no Block)');
  assert.equal(damageRow(combat, id, b.id).value, 12);
});

test('outside combat (rawFace): the face is the raw number', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10 }] });
  const row = previewCard(combat, id, undefined, undefined, { rawFace: true }).values.find(v => v.op === 'damage');
  assert.equal(row.faceValue, 12);
});
