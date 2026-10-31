// Owner, 2026-10-31: magic damage hits Poise FIRST (1:1) and then Block; physical hits Block first and then Poise (75/25).
// Pure receipts on the live Core profile, Ward off (shipped data).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { applyReceiptToPreviewTarget } from '../src/engine/combatDamagePreview.js';
import { guardHitFloatParts } from '../src/ui/fx.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function liveCore() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  delete combat.player.combatStance;
  return combat;
}
function hit(carrier, { block = 0, poise = 0, barrier = 0, amount = 10 } = {}) {
  const combat = liveCore(), target = combat.enemies[0];
  Object.assign(target, { block, barrier, persistentWard: null, persistentPoise: { value: poise, max: Math.max(20, poise) }, gameProfilePoise: 0, statuses: {} });
  delete target.combatStance;
  delete target.weaknesses; // enemy weaknesses (SPEC 5.3) are tested in enemy-weaknesses.test.mjs; this suite isolates the Poise/Block order
  const receipt = profileDamageReceipt(combat, combat.player, target, amount, { ...carrier, skipRatingBonus: true }, { roll: 0 });
  return { receipt, combat, target, poiseAfter: poise - receipt.poiseMitigated, blockAfter: receipt.blockRemaining };
}
const physical = { combatProfile: { camp: 'physical', damageType: 'slashing' } };
const spell = { combatProfile: { camp: 'spell', damageType: 'fire', magicShare: 1 } };
const arcane = { combatProfile: { camp: 'spell', damageType: 'arcane' }, magicShare: 0.5 };

test('(a) pure spell 10 vs Poise 6, Block 5: Poise 6->0 first, the 4 left meets Block 5->1, HP 0', () => {
  const r = hit(spell, { poise: 6, block: 5 });
  assert.equal(r.receipt.magicPoise, 6);
  assert.equal(r.poiseAfter, 0);
  assert.equal(r.blockAfter, 1);
  assert.equal(r.receipt.blocked, 4);
  assert.equal(r.receipt.hpLoss, 0);
  const ids = r.receipt.damageReceipt.hits[0].sources.map(s => s.id);
  assert.ok(ids.indexOf('poise-magic') >= 0 && ids.indexOf('poise-magic') < ids.indexOf('block-magic'), 'receipt shows Poise before Block');
});

test('(b) pure spell 10 vs Poise 2, Block 5: Poise 2->0, Block 5->0, HP 3', () => {
  const r = hit(spell, { poise: 2, block: 5 });
  assert.equal(r.receipt.magicPoise, 2);
  assert.equal(r.poiseAfter, 0);
  assert.equal(r.blockAfter, 0);
  assert.equal(r.receipt.hpLoss, 3);
});

test('(c) physical 10 vs Poise 6, Block 5: Block 5->0 first, then the 5 meets Poise (HP floor(0.75x5)=3, Poise 6->4)', () => {
  const r = hit(physical, { poise: 6, block: 5 });
  assert.equal(r.receipt.magicPoise, 0);
  assert.equal(r.blockAfter, 0);
  assert.equal(r.receipt.hpLoss, 3);
  assert.equal(r.poiseAfter, 4);
});

test('a spell costs more Poise than the same physical hit', () => {
  assert.ok(hit(spell, { poise: 20 }).receipt.poiseMitigated > hit(physical, { poise: 20 }).receipt.poiseMitigated);
  assert.equal(hit(spell, { poise: 20 }).receipt.poiseMitigated, 10, 'full amount as Poise damage');
  assert.equal(hit(spell, { poise: 20 }).receipt.hpLoss, 0);
});

test('(d) mixed arcane 10 (5 physical, 5 magic) vs Poise 6, Block 5: physical through Block, magic through the Poise left', () => {
  const r = hit(arcane, { poise: 6, block: 5 });
  assert.equal(r.receipt.damageReceipt.hits[0].physical, 5);
  assert.equal(r.receipt.damageReceipt.hits[0].magical, 5);
  // physical 5: Block 5->0; magic 5: Poise 6->1 first, then nothing left for Block. HP 0.
  assert.equal(r.receipt.magicPoise, 5);
  assert.equal(r.blockAfter, 0);
  assert.equal(r.poiseAfter, 1);
  assert.equal(r.receipt.hpLoss, 0);
  const b = hit(arcane, { poise: 6, block: 2 });
  // physical 5: Block 2 soaks 2, 3 meets Poise (HP 3->floor(2.25)=2, Poise 6->5); magic 5: Poise 5->0 first, remaining 0.
  assert.equal(b.receipt.blockRemaining, 0);
  assert.equal(b.poiseAfter, 0);
});

test('Barrier meets the magic left after Poise and Block; the preview mirror equals the live apply', () => {
  const r = hit(spell, { poise: 3, block: 2, barrier: 3 });
  assert.equal(r.receipt.magicPoise, 3);
  assert.equal(r.receipt.blocked, 2);
  assert.equal(r.receipt.barrierMitigated, 3);
  assert.equal(r.receipt.hpLoss, 2);
  const defender = { block: 2, barrier: 3, persistentPoise: { value: 3, max: 20 } };
  applyReceiptToPreviewTarget(r.combat, defender, r.receipt);
  assert.deepEqual([defender.block, defender.barrier, defender.persistentPoise.value], [0, 0, 0]);
});

test('the float splits magic Poise from absorbed Poise', () => {
  const parts = guardHitFloatParts({ amount: 10, poiseAbsorbed: 6, magicPoise: 6, blocked: 4 });
  assert.equal(parts.magicPoise.text, 'Poise 6');
  assert.equal(parts.poise, null);
});

test('a pierce hit spends the same Block as the same mixed hit without pierce (arcane 10, Block 10, Poise 5)', () => {
  const plain = hit(arcane, { poise: 5, block: 10 });
  const pierced = hit({ ...arcane, tags: ['pierce'] }, { poise: 5, block: 10 });
  assert.ok(pierced.receipt.pierceBypassed > 0, 'fixture: the hit pierces');
  assert.equal(plain.blockAfter, 5);
  assert.equal(pierced.blockAfter, plain.blockAfter, 'Block remaining is identical with and without pierce');
  assert.ok(pierced.receipt.hpLoss >= plain.receipt.hpLoss, 'pierce never costs less HP');
});

test('the log reports the whole hit when a spell is absorbed by Poise (10 -> "for 10", fully absorbed too)', async () => {
  const { combatLogEntries } = await import('../src/model/combatLog.js');
  const text = event => JSON.stringify(combatLogEntries([{ type: 'damageDealt', sourceId: 'p', targetId: 'e', ...event }], { registries: reg }));
  const partly = hit(spell, { poise: 6, block: 5 });
  const ev = r => ({ amount: r.receipt.amount, blocked: r.receipt.blocked, hpLoss: r.receipt.hpLoss, poiseAbsorbed: r.receipt.poiseMitigated, magicPoise: r.receipt.magicPoise, poiseRemaining: r.poiseAfter, blockRemaining: r.blockAfter });
  assert.match(text(ev(partly)), /for 10/);
  const full = hit(spell, { poise: 20 });
  assert.match(text(ev(full)), /for 10/);
});
