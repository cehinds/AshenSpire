// Smash breaks a flat amount of Block (owner, 2026-11-20): a damage effect's `breakBlock` removes that much Block first, then the hit's
// damage meets what is left. An evaded hit breaks nothing; a multi-hit card breaks once per target.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat as createRunCombatWithBenefits } from './withoutWeaknesses.mjs';
import { withoutStanceBenefits } from './legacyStanceRules.mjs';
import { applyAttackDamage, executeAction } from '../src/engine/actions.js';
import { profileDamageReceipt, HitBreakCarrier } from '../src/engine/gameProfileCombat.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { damageReceiptLines } from '../src/ui/components/damageReceipt.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

// The damage scales are off so the worked example reads in whole card numbers.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { baseDamageMultiplier: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
function live({ block = 10, poise = 0 } = {}) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = withoutStanceBenefits(createRunCombatWithBenefits({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] }));
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block, barrier: 0, statuses: {}, persistentPoise: { value: poise, max: 20 }, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  delete target.combatCounter; delete target.combatStance;
  return { combat, target };
}
const hit = (combat, target, amount, carrier) => { primeAccuracyRolls(combat); applyAttackDamage(combat, combat.player, target, amount, [], carrier); return combat.eventLog.filter(row => row.type === 'damageDealt').at(-1); };
const breaking = n => HitBreakCarrier(smash, { op: 'damage', amount: 8, breakBlock: n });

test('Break 8 Block, Deal 8 against 10 Block: Block 10 -> 2, then 2 absorbed and 6 HP lost', () => {
  const { combat, target } = live();
  const event = hit(combat, target, 8, breaking(8));
  assert.equal(event.blockBroken, 8);
  assert.equal(event.blocked, 2);
  assert.equal(500 - target.hp, 6);
  assert.equal(target.block, 0);
  assert.ok(damageReceiptLines(event.damageReceipt).some(line => line.includes('Break Block −8')));
});

test('the break never takes more Block than the target has', () => {
  const { combat, target } = live({ block: 3 });
  const event = hit(combat, target, 8, breaking(8));
  assert.equal(event.blockBroken, 3);
  assert.equal(500 - target.hp, 8);
});

test('an evaded Smash breaks nothing and deals nothing', () => {
  const { combat, target } = live();
  const receipt = profileDamageReceipt(combat, combat.player, target, 8, breaking(8), { roll: 1 });
  assert.equal(receipt.evaded, true);
  assert.equal(receipt.broken, undefined);
  assert.equal(receipt.hpLoss, 0);
  assert.equal(receipt.blockRemaining, 10);
});

test('breakPoise removes that much Poise on top of the hit', () => {
  const { combat, target } = live({ block: 0, poise: 10 });
  const plain = profileDamageReceipt(combat, combat.player, target, 8, smash);
  const receipt = profileDamageReceipt(combat, combat.player, target, 8, HitBreakCarrier(smash, { op: 'damage', amount: 8, breakPoise: 4 }));
  assert.deepEqual(receipt.broken, { block: 0, poise: 4 });
  const plainLoss = (plain.poiseDrain || 0) + plain.poiseMitigated;
  const breakingLoss = receipt.poiseDrain + receipt.poiseMitigated;
  assert.equal(breakingLoss - plainLoss, 4);
});

test('the receipt lists a Poise break once, beside the hit\'s own Poise damage', () => {
  const { combat, target } = live({ block: 0, poise: 10 });
  const plain = profileDamageReceipt(combat, combat.player, target, 8, smash);
  const breakCarrier = HitBreakCarrier(smash, { op: 'damage', amount: 8, breakPoise: 4 });
  const receipt = profileDamageReceipt(combat, combat.player, target, 8, breakCarrier);
  const [entry] = receipt.damageReceipt.hits;
  assert.equal(entry.poiseBroken, 4);
  assert.equal(entry.poiseDamage, plain.poiseDrain);
  assert.equal(entry.poiseBroken + entry.poiseDamage, receipt.poiseDrain);
  const lines = damageReceiptLines(receipt.damageReceipt);
  const breakLines = lines.filter(line => line.includes('Break Poise'));
  assert.equal(breakLines.length, 1, 'the break prints once across the whole receipt');
  const summary = lines.find(line => line.includes('Break Poise −'));
  assert.equal(summary.match(/Break Poise −4/g).length, 1);
  assert.equal(summary.includes(`Poise damage ${plain.poiseDrain}`), true);
});

test('a multi-hit Smash breaks once: the preview and the live play agree', () => {
  const { combat, target } = live({ block: 12 });
  const preview = previewDamageHits(combat, combat.player, target, 5, [], breaking(6), 2);
  // Hit 1: Block 12 -> 6 after the break, 5 absorbed (1 left). Hit 2: no break, 1 absorbed, 4 HP.
  assert.deepEqual(preview.hitDamages, [0, 4]);
  assert.equal(HitBreakCarrier(breaking(6), { op: 'damage', breakBlock: 6 }, 1).breakBlock, undefined, 'a later hit carries no break');
});

test('live: a two-hit Smash breaks Block on its first hit only', () => {
  const { combat, target } = live({ block: 12 });
  primeAccuracyRolls(combat);
  executeAction(combat, { effect: { op: 'damage', amount: 5, hits: 2, target: 'enemy', breakBlock: 6 }, source: combat.player, owner: combat.player, target,
    card: { skipRatingBonus: true, combatProfile: { maneuver: 'smash', camp: 'physical', range: 'melee' } } });
  const events = combat.eventLog.filter(row => row.type === 'damageDealt');
  assert.deepEqual(events.map(e => e.blockBroken || 0), [6, 0]);
  assert.equal(500 - target.hp, 4);
});

test('Smash cards read "Break N Block. Deal N damage." on the face and in their text', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { cardPlainText } = await import('../src/ui/components/card.js');
  const core = resolveGameProfile('core');
  const shipped = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
  const def = shipped.cards.get('core.smash');
  // Owner ruling 2026-11-28: the stored damage is the 1:1 number the card plays.
  const stored = {
    op: 'damage',
    target: 'enemy',
    amount: 1,
    breakBlock: 8,
  };
  assert.deepEqual(def.effects.find(e => e.op === 'damage'), stored);
  const face = cardFaceLines(def, null, shipped, null).map(line => line.html.replace(/<[^>]+>/g, ''));
  assert.match(face.slice(0, 2).join('. '), /^Break 8 Block\. Deal \d+ damage$/);
  assert.match(cardPlainText(shipped, { cardId: 'core.smash' }), /^Break 8 Block\. Deal \d+ damage\./);
});
