import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { combatMechanics } from '../src/content/generated/combatMechanics.js';
import { ResolveMechanicsTable, EffectivePierceRules, EffectiveSmashGuardRules, EffectiveBlockBreakAmount } from '../src/model/combatMechanics.js';
import { profileDamageReceipt, PierceBlockIgnored } from '../src/engine/gameProfileCombat.js';
import { ScoreCard } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';

function coreFight() {
  const profile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 42 });
  return createRunCombat({ registries, run, rng: createRng(42), enemyIds: ['wanderingSoldier'] });
}

test('guardInteraction parent -> child inheritance resolves with provenance', () => {
  assert.equal(combatMechanics.resolved.pierce.enabled, true);
  assert.equal(combatMechanics.resolved.pierce.affectsWard, false);
  assert.equal(combatMechanics.inheritedFrom.pierce.affectsWard, 'guardInteraction');
  assert.equal(combatMechanics.resolved.blockBreak.mode, 'destroyBeforeDamage');
  assert.equal(combatMechanics.inheritedFrom.blockBreak.triggersBlockBroken, 'guardInteraction');
  assert.equal(combatMechanics.resolved.smashVsDefensive.mode, 'multiplier');
  assert.equal(combatMechanics.resolved.smashVsDefensive.defendDamageMultiplier, 1.5);
});

test('disabling guardInteraction parent turns off pierce, blockBreak, and smashVsDefensive together', () => {
  const edited = structuredClone(combatMechanics.authored);
  edited.guardInteraction.enabled = false;
  const ctx = { combatMechanics: ResolveMechanicsTable(edited) };

  assert.equal(EffectivePierceRules(null, ctx), null);
  assert.equal(EffectiveSmashGuardRules(null, ctx), null);
  assert.equal(EffectiveBlockBreakAmount({ blockBreak: 8 }, 12, null, ctx), 0);
});

test('PierceBlockIgnored honors guardInteraction and pierce enabled toggles', () => {
  const combat = coreFight();
  const enemy = combat.enemies[0];
  enemy.block = 10;
  const carrier = { tags: ['pierce'], combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'piercing' } };
  const activeIgnored = PierceBlockIgnored(combat, enemy, carrier, carrier.combatProfile, 10, 10);
  assert.ok(activeIgnored > 0, 'pierce ignores Block when enabled');

  const off = structuredClone(combatMechanics.authored);
  off.pierce.enabled = false;
  combat.combatMechanics = ResolveMechanicsTable(off);
  assert.equal(PierceBlockIgnored(combat, enemy, carrier, carrier.combatProfile, 10, 10), 0, 'pierce.enabled = false disables pierce');
});

test('smashVsDefensive mode switches cleanly between multiplier and flatBreak without editing cards', () => {
  const combat = coreFight();
  const enemy = combat.enemies[0];
  enemy.combatStance = { camp: 'physical', maneuver: 'defend' };
  enemy.block = 15;
  enemy.hp = enemy.maxHp = 200;
  const smashCarrier = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'slashing' } };

  // Default mode: "multiplier" (1.5x vs Defend + blockFraction bonus, no flatBlockBroken)
  const multReceipt = profileDamageReceipt(combat, combat.player, enemy, 18, smashCarrier, { forecast: true });
  assert.equal(multReceipt.blockBrokenFlat, undefined);

  // Switch to "flatBreak" via combatMechanics JSON override
  const flatAuthored = structuredClone(combatMechanics.authored);
  flatAuthored.smashVsDefensive.mode = 'flatBreak';
  combat.combatMechanics = ResolveMechanicsTable(flatAuthored);
  const flatReceipt = profileDamageReceipt(combat, combat.player, enemy, 18, smashCarrier, { forecast: true });
  assert.ok(flatReceipt.blockBrokenFlat > 0, 'flatBreak mode destroys flat Block before normal Block soak');
  assert.ok(flatReceipt.blockRemaining < enemy.block, 'flatBreak reduces remaining Block');
  assert.ok(flatReceipt.damageReceipt.hits[0].sources.some(s => s.id === 'flat-block-break'), 'receipt records flat-block-break stage');
});

test('ScoreCard prices blockBreak for Score Studio and respects blockBreak.enabled toggle', () => {
  const baseFace = {
    name: 'Smash', cls: 'reaver', rarity: 'common', camp: 'physical', type: 'attack',
    sp: 1, mp: 0, dmg: 10, hits: 1, blk: 0, poise: 0, statuses: [], kw: [], tags: [],
    draw: 0, heal: 0, loseHp: 0, discard: 0, restoreSp: 0, restoreMp: 0, cleanse: 0,
    counter: 0, reflect: 0, pull: 0, move: 0, holdOne: 0, boost: 0, cull: 0, shuffle: 0, copy: 0, attr: 0,
  };
  const breakFace = { ...baseFace, blockBreak: 6 };
  const plainScore = ScoreCard(baseFace, scoring);
  const breakScore = ScoreCard(breakFace, scoring);
  assert.ok(breakScore.raw > plainScore.raw, 'blockBreak adds CP');
  assert.equal(breakScore.parts.blockBreak, 18, '6 blockBreak * weight 3 = 18');

  const off = structuredClone(combatMechanics.authored);
  off.guardInteraction.enabled = false;
  const offScore = ScoreCard(breakFace, scoring, { combatMechanics: ResolveMechanicsTable(off) });
  assert.equal(offScore.raw, plainScore.raw, 'disabling guardInteraction removes blockBreak CP in Score Studio');
});
