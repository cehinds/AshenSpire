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
import { applyStatus } from '../src/engine/statuses.js';
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

// Magic hits Poise first, 1:1 (owner, 2026-10-31): the face is the raw number less the Poise it meets, not x0.75.
test('Arcane Spark: face 7 (11 less 4 Poise) against a Poise enemy', () => {
  const { combat, id } = fight({ classId: 'starseer', cardId: 'starSpark', enemies: [{ poise: 4 }] });
  combat.player.ratings = { ...combat.player.ratings, pr: (combat.player.ratings?.pr || 0) + 1 }; // lifts the raw face from 10 to 11
  const raw = previewCard(combat, id, undefined, undefined, { rawFace: true }).values.find(v => v.op === 'damage').faceValue;
  assert.equal(raw, 11);
  assert.equal(damageRow(combat, id).faceValue, 7);
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

test('self-target damage keeps the raw face: the player loses the full amount', () => {
  const { combat, id } = fight({ cardId: 'base.fire-cleanse', enemies: [{ poise: 10 }] });
  const rows = previewCard(combat, id).values.filter(v => v.op === 'damage' && v.faceValue != null);
  assert.ok(rows.length, 'the card has a self damage row');
  const self = previewCard(combat, id).values.find(v => v.op === 'damage' && v.target === 'self');
  assert.ok(self, 'self row found');
  const raw = previewCard(combat, id, undefined, undefined, { rawFace: true }).values.find(v => v.op === 'damage' && v.target === 'self');
  assert.equal(self.faceValue, raw.faceValue, 'raw, not cut by the enemy\'s Poise');
});

test('a Poise-draining card: every damage face equals the targeted row (no Block), later hits see the drained state', () => {
  const { combat, id } = fight({ classId: 'starseer', cardId: 'astralCleave', enemies: [{ poise: 10 }] });
  applyStatus(combat, combat.player, 'starstoneCharge', 1);
  const aimed = previewCard(combat, id, combat.enemies[0].id).values.filter(v => v.op === 'damage');
  assert.ok(aimed.length >= 2);
  for (const row of aimed) assert.equal(row.faceValue, row.hitDamages[0], 'face equals the targeted first hit');
  combat.enemies[0].block = 4;
  const blocked = previewCard(combat, id, combat.enemies[0].id).values.filter(v => v.op === 'damage');
  blocked.forEach((row, i) => assert.equal(row.faceValue, aimed[i].faceValue, 'Block does not move the face'));
});

test('an X-hit card with no energy still faces the after-Poise number', () => {
  const { combat, id } = fight({ classId: 'starseer', cardId: 'supernova', enemies: [{ poise: 10 }] });
  combat.player.energy = 0; combat.player.stamina = 0;
  const row = previewCard(combat, id).values.find(v => v.op === 'damage');
  const raw = previewCard(combat, id, undefined, undefined, { rawFace: true }).values.find(v => v.op === 'damage').faceValue;
  assert.equal(row.hits, 0, 'zero hits');
  assert.equal(row.faceValue, Math.max(0, raw - 10), 'a spell meets Poise 1:1');
});

test('an aimed enemy that died falls back to the frontmost living enemy', () => {
  const { combat, id } = fight({ enemies: [{}, { poise: 10 }] });
  const [a, b] = combat.enemies;
  a.alive = false; a.hp = 0;
  assert.equal(previewCard(combat, id, a.id).values.find(v => v.op === 'damage').faceValue, 9);
  assert.equal(previewCard(combat, id, b.id).values.find(v => v.op === 'damage').faceValue, 9);
});

test('the rendered face sequence and total are the before-Block ones (cardFaceLines and combatCardSummary)', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { combatCardSummary } = await import('../src/model/playingCard.js');
  const { combat, id } = fight({ classId: 'starseer', cardId: 'supernova', enemies: [{ poise: 10, block: 5 }] });
  combat.player.energy = 3; combat.player.stamina = 3; combat.player.mana = 9;
  const preview = previewCard(combat, id, combat.enemies[0].id);
  const row = preview.values.find(v => v.op === 'damage');
  assert.equal(row.hits, 3);
  assert.ok(row.faceHitDamages.some(n => n !== row.faceHitDamages[0]), 'the hits differ');
  assert.notDeepEqual(Array.from(row.hitDamages), Array.from(row.faceHitDamages), 'Block changes the targeted hits');
  const want = row.faceHitDamages.join(' + ');
  const total = row.faceHitDamages.reduce((a, b) => a + b, 0);
  const strip = h => h.replace(/<[^>]+>/g, '');
  const faceText = cardFaceLines(preview.resolvedDefinition, preview, reg).map(l => strip(l.html)).join(' | ');
  assert.ok(faceText.includes(want) && faceText.includes(`${total} total`), faceText);
  const summary = combatCardSummary(preview.resolvedDefinition, preview, reg);
  assert.ok(String(summary).includes(want) && String(summary).includes(`${total} total`), String(summary));
});
