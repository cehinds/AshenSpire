// Owner ruling 2026-11-14 (amends the same day's Wave 2 rule): a Core combat card's damage number is YOUR modified damage, the same
// whichever enemy is aimed: your rating, Strength, Weak, stance bonuses and the card's own terms; nothing that belongs to the enemy
// (Block, Poise, defensive stance, Vulnerable, Evade, weakness). The per-enemy quote (perTarget) is still the HP that enemy loses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs'; // fixtures drop enemy weaknesses (SPEC 5.3)
import { withoutStanceBenefits } from './legacyStanceRules.mjs'; // Wave 2.5: these numbers pin the pre-benefit rules
import { dispatch, previewCard } from '../src/engine/combat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

// Owner, 2026-11-18: the playtest physical cut is off here; this file pins how a face relates to a quote, not the scale.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1 } } });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight({ classId = 'reaver', cardId = 'strike', enemies = [{}] } = {}) {
  const run = createRunState({ registries: reg, classId, seed: 5, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = withoutStanceBenefits(createRunCombat({ registries: reg, run, rng: createRng(5), enemyIds: enemies.map(() => 'wanderingSoldier') }));
  // 9101e627a5b: the quantified baseline predates the current stance-gated weapon-Poise rules.
  combat.fixCoreRules.poise = { drain: 'prevented' };
  combat.fixCoreRules.ward = { enabled: false };
  combat.enemies.forEach((enemy, i) => {
    const { poise = 0, block = 0, statuses = {} } = enemies[i];
    Object.assign(enemy, { hp: 500, maxHp: 500, block, barrier: 0, statuses, persistentPoise: { value: poise, max: 20 }, attributes: { dexterity: 0 } });
    delete enemy.combatStance; delete enemy.combatCounter;
  });
  combat.player.energy = 9; combat.player.mana = 9;
  // Keep the attack rating fixed while these cases vary the target's defenses.
  if (classId === 'reaver') combat.player.ratings = { ...combat.player.ratings, ar: 4 };
  const card = combat.piles.hand[0];
  card.cardId = cardId; card.upgraded = false;
  return { combat, id: card.instanceId };
}
const damageRow = (combat, id, target) => previewCard(combat, id, target).values.find(v => v.op === 'damage');
const rawRow = (combat, id) => previewCard(combat, id, undefined, undefined, { rawFace: true }).values.find(v => v.op === 'damage');
// The fixture's Strike faces 5: base 6 halved to 3, plus AR 4 and the +1 AR adjustment (8), then the player side scale floor(8 x 0.7) = 5 (owner, 2026-11-18). Poise 10 cuts that to 3.

test('Strike: the face is the same against 0 and 20 Block, with and without Poise', () => {
  const faces = [{}, { block: 20 }, { poise: 10 }, { block: 20, poise: 10 }].map(spec => {
    const { combat, id } = fight({ enemies: [spec] });
    return [damageRow(combat, id).faceValue, damageRow(combat, id, combat.enemies[0].id).faceValue, damageRow(combat, id, combat.enemies[0].id).value];
  });
  for (const row of faces) assert.deepEqual(row, [5, 5, 5]);
});

test('a defensive stance on the target does not change the face; the quote still does', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10 }] });
  const enemy = combat.enemies[0];
  const open = damageRow(combat, id, enemy.id);
  enemy.combatStance = { id: 'defend' };
  const guarded = damageRow(combat, id, enemy.id);
  assert.equal(guarded.faceValue, open.faceValue, 'face ignores the stance');
  assert.ok(guarded.perTarget[enemy.id] <= open.perTarget[enemy.id], 'the quote is the HP lost');
});

test('the quote is still the HP lost: Strike against a Poise enemy faces 5 and quotes 3', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10 }] });
  const enemy = combat.enemies[0];
  primeAccuracyRolls(combat);
  const row = damageRow(combat, id, enemy.id);
  assert.equal(row.faceValue, 5);
  assert.equal(row.perTarget[enemy.id], 3);
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: enemy.id });
  assert.equal(500 - enemy.hp, 3);
});

test('Block and Poise reach the quote, not the face', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10, block: 5 }] });
  const row = damageRow(combat, id, combat.enemies[0].id);
  assert.equal(row.faceValue, 5);
  assert.equal(row.perTarget[combat.enemies[0].id], 0, 'Block 5 soaks the whole 5');
});

test('the face rises with your attack rating (Strength) and ignores the enemy defences', () => {
  const { combat, id } = fight();
  const base = damageRow(combat, id).faceValue;
  combat.player.ratings = { ...combat.player.ratings, ar: (combat.player.ratings?.ar || 0) + 10 }; // Strength acts through attack rating
  const raised = damageRow(combat, id).faceValue;
  assert.ok(raised > base, `attack rating raises the face (${base} to ${raised})`);
  // An enemy's Poise and Block still leave it alone.
  combat.enemies[0].block = 30; combat.enemies[0].persistentPoise = { value: 10, max: 20 };
  assert.equal(damageRow(combat, id, combat.enemies[0].id).faceValue, raised);
});

test('two enemies with different defences: the face is one number whichever is aimed; each quote is its own', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10 }, {}] });
  const [a, b] = combat.enemies;
  for (const aim of [undefined, a.id, b.id]) assert.equal(damageRow(combat, id, aim).faceValue, 5, `aim ${aim}`);
  assert.equal(damageRow(combat, id, a.id).perTarget[a.id], 3);
  assert.equal(damageRow(combat, id, b.id).perTarget[b.id], 5);
});

test('outside combat (rawFace): the face is the raw number', () => {
  const { combat, id } = fight({ enemies: [{ poise: 10 }] });
  assert.equal(rawRow(combat, id).faceValue, 5);
});

test('self-target damage keeps the raw face: the player loses the full amount', () => {
  const { combat, id } = fight({ cardId: 'base.fire-cleanse', enemies: [{ poise: 10 }] });
  const self = previewCard(combat, id).values.find(v => v.op === 'damage' && v.target === 'self');
  assert.ok(self, 'self row found');
  const raw = previewCard(combat, id, undefined, undefined, { rawFace: true }).values.find(v => v.op === 'damage' && v.target === 'self');
  assert.equal(self.faceValue, raw.faceValue, 'raw, not cut by the enemy\'s Poise');
});

test('a multi-hit card faces N equal hits whatever the target holds', () => {
  const { combat, id } = fight({ classId: 'starseer', cardId: 'astralCleave', enemies: [{ poise: 10 }] });
  applyStatus(combat, combat.player, 'starstoneCharge', 1);
  const open = previewCard(combat, id, combat.enemies[0].id).values.filter(v => v.op === 'damage');
  combat.enemies[0].block = 4;
  const blocked = previewCard(combat, id, combat.enemies[0].id).values.filter(v => v.op === 'damage');
  blocked.forEach((row, i) => {
    assert.equal(row.faceValue, open[i].faceValue, 'Block does not change the face');
    assert.ok(row.hitDamages.every(n => n === row.faceValue), 'every hit reads the one figure');
  });
});

test('an X-hit card with no energy faces the raw number', () => {
  const { combat, id } = fight({ classId: 'starseer', cardId: 'supernova', enemies: [{ poise: 10 }] });
  combat.player.energy = 0; combat.player.stamina = 0;
  const row = previewCard(combat, id).values.find(v => v.op === 'damage');
  assert.equal(row.hits, 0, 'zero hits');
  assert.equal(row.faceValue, rawRow(combat, id).faceValue);
});

test('an aimed enemy that died falls back to the frontmost living enemy; the face is unchanged', () => {
  const { combat, id } = fight({ enemies: [{}, { poise: 10 }] });
  const [a, b] = combat.enemies;
  a.alive = false; a.hp = 0;
  assert.equal(previewCard(combat, id, a.id).values.find(v => v.op === 'damage').faceValue, 5);
  assert.equal(previewCard(combat, id, b.id).values.find(v => v.op === 'damage').faceValue, 5);
});

test('the rendered face of a multi-hit card reads N x M however the target is defended (cardFaceLines and combatCardSummary)', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { combatCardSummary } = await import('../src/model/playingCard.js');
  const { combat, id } = fight({ classId: 'starseer', cardId: 'supernova', enemies: [{ poise: 10, block: 5 }] });
  combat.player.energy = 3; combat.player.stamina = 3; combat.player.mana = 9;
  const preview = previewCard(combat, id, combat.enemies[0].id);
  const row = preview.values.find(v => v.op === 'damage');
  assert.equal(row.hits, 3);
  assert.ok(row.faceHitDamages.every(n => n === row.faceHitDamages[0]), 'the hits are equal');
  const strip = h => h.replace(/<[^>]+>/g, '');
  const faceText = cardFaceLines(preview.resolvedDefinition, preview, reg).map(l => strip(l.html)).join(' | ');
  assert.ok(!faceText.includes('total'), faceText);
  assert.ok(faceText.includes('×3'), faceText);
  const summary = String(combatCardSummary(preview.resolvedDefinition, preview, reg));
  assert.ok(summary.includes('×3') && !summary.includes('total'), summary);
});

test('Vulnerable on the reference enemy raises the face; the quote follows it', () => {
  const { combat, id } = fight({ enemies: [{ statuses: { vulnerable: { stacks: 1, duration: 2 } } }, {}] });
  const [a, b] = combat.enemies;
  const face = damageRow(combat, id, a.id).faceValue;
  assert.ok(face > 5, `Vulnerable raises the face above 5, got ${face}`);
  assert.equal(damageRow(combat, id).faceValue, face, 'the frontmost enemy is the reference');
  assert.equal(damageRow(combat, id, b.id).faceValue, 5, 'aiming the other enemy gives its own Vulnerable-free face');
  assert.equal(damageRow(combat, id, a.id).perTarget[a.id], face);
});
