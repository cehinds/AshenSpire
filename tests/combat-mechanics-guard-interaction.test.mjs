import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatMechanics } from '../src/content/generated/combatMechanics.js';
import { ResolveMechanicsTable, EffectivePierceRules, EffectiveSmashGuardRules, EffectiveBlockBreakAmount } from '../src/model/combatMechanics.js';
import { profileDamageReceipt, PierceBlockIgnored, PierceStacks } from '../src/engine/gameProfileCombat.js';
import { BaseFace, ScoreCard, PrepareCardScorer } from '../src/model/combatPower.js';
import { CardDefinitionToScoreFace, PrepareUpgradeStepCpContext, EvaluateUpgradeStepCp } from '../src/model/cardUpgradeCp.js';
import { scoringContract } from './helpers/scoring-contract.mjs';
import { fight } from './helpers/drawback-contract.mjs';

const rules = () => ({
  guardInteraction: { enabled: true, affectsWard: false },
  pierce: { extends: 'guardInteraction', mode: 'bypass', blockIgnoredPerStack: 2, blockBypassFraction: .25,
    builtInElements: ['fire'], skinStatus: 'stoneHide', earthSource: 'earth' },
  blockBreak: { extends: 'guardInteraction', mode: 'destroyBeforeDamage', blockBreakRatio: .5, damageScale: .5 },
  smashVsDefensive: { extends: 'guardInteraction', mode: 'multiplier', damageMultiplier: 2,
    defendDamageMultiplier: 2, blockFraction: .5, poiseFraction: 0 },
});
const context = (patch = {}) => ({ combatMechanics: ResolveMechanicsTable({ ...rules(), ...patch }) });
function coreFight() {
  const combat = fight([]);
  combat.combatMechanics = context().combatMechanics;
  combat.fixCoreRules.pierce = { blockIgnoredPerStack: 2, blockBypassFraction: .25, builtInElements: ['fire'], skinStatus: 'stoneHide', earthSource: 'earth' };
  combat.fixCoreRules.smashVsDefensive = { damageMultiplier: 2, defendDamageMultiplier: 2, blockFraction: .5, poiseFraction: 0 };
  combat.fixCoreRules.elements = { ...combat.fixCoreRules.elements, enabled: false };
  combat.fixCoreRules.stanceBenefits = { ...combat.fixCoreRules.stanceBenefits, neutral: { damageTakenMultiplier: 1 } };
  combat.fixCoreRules.stance = { ...combat.fixCoreRules.stance, effectivenessMultiplier: 1 };
  combat.gameProfile = { ...combat.gameProfile, modules: { ...combat.gameProfile.modules,
    stances: { mode: 'configured', include: ['attack', 'smash', 'defend'], matchups: { smash: ['defend'] }, advantageMultiplier: 1, defenseMitigation: 0 } } };
  const enemy = combat.enemies[0];
  Object.assign(enemy, { block: 10, hp: 200, maxHp: 200, barrier: 0, statuses: {}, itemProps: {},
    ratings: { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 }, persistentPoise: { value: 0, max: 0 }, persistentWard: { value: 0, max: 0 },
    damageResistanceFlat: {}, damageWeaknessPercent: {} });
  delete enemy.weaknesses;
  return combat;
}
const carrier = { skipRatingBonus: true, tags: [], combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'slashing' } };

test('every current authored guard entry reaches the compiled table without fixed balance assumptions', () => {
  const source = JSON.parse(readFileSync(new URL('../content/source/mechanics/guardInteraction.json', import.meta.url), 'utf8'));
  for (const [id, row] of Object.entries(source)) assert.deepEqual(combatMechanics.authored[id], row, id);
  // The companion inheritance suite independently checks all resolved fields and their owners.
  assert.ok(Object.keys(source).length > 0);
});

test('controlled guard parent toggles descendants while explicit child overrides survive', () => {
  const off = context({ guardInteraction: { enabled: false } });
  assert.equal(EffectivePierceRules(null, off), null);
  assert.equal(EffectiveSmashGuardRules(null, off), null);
  assert.equal(EffectiveBlockBreakAmount({ blockBreak: 8 }, 12, null, off), 0);
  const child = context({ guardInteraction: { enabled: false }, pierce: { ...rules().pierce, enabled: true } });
  assert.equal(EffectivePierceRules(null, child).enabled, true);
});

test('saved numeric guard rules stay exact by default and explicit context rows override them', () => {
  const saved = { pierce: { blockIgnoredPerStack: 7, builtInElements: ['cold'] },
    smashVsDefensive: { damageMultiplier: 3, defendDamageMultiplier: 4, blockFraction: .125 } };
  const before = structuredClone(saved);
  const oldPierce = EffectivePierceRules(saved);
  assert.equal(oldPierce.blockIgnoredPerStack, 7);
  assert.deepEqual(oldPierce.builtInElements, ['cold']);
  assert.equal(oldPierce.skinStatus, undefined, 'no new generated numeric fields backfilled into recorded rules');
  assert.equal(EffectiveSmashGuardRules(saved).damageMultiplier, 3);
  for (const ctx of [context(), { gameProfile: context() }]) {
    assert.equal(EffectivePierceRules(saved, ctx).blockIgnoredPerStack, 2);
    assert.deepEqual(EffectivePierceRules(saved, ctx).builtInElements, ['fire']);
    assert.equal(EffectiveSmashGuardRules(saved, ctx).damageMultiplier, 2);
  }
  assert.deepEqual(saved, before);
});

test('Pierce count and ignored Block share explicit numeric, element, skin and enabled rules', () => {
  const c = coreFight(), enemy = c.enemies[0];
  const hit = { tags: ['school:fire'], combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'fire' }, pierceStacks: 3 };
  enemy.statuses.stoneHide = { stacks: 1 };
  const before = structuredClone(enemy), out = {};
  assert.equal(PierceStacks(c, enemy, hit), 2);
  assert.equal(PierceBlockIgnored(c, enemy, hit, hit.combatProfile, 20, 10, out), 4);
  assert.equal(out.spent, 1);
  assert.equal(PierceBlockIgnored(c, enemy, { ...hit, combatReaction: true }, hit.combatProfile, 20, 10), 0);
  c.combatMechanics.resolved.pierce.blockIgnoredPerStack = 3;
  assert.equal(PierceBlockIgnored(c, enemy, hit, hit.combatProfile, 20, 10), 6);
  c.combatMechanics.resolved.pierce.enabled = false;
  assert.equal(PierceStacks(c, enemy, hit), 0);
  assert.equal(PierceBlockIgnored(c, enemy, hit, hit.combatProfile, 20, 10), 0);
  assert.deepEqual(enemy, before);
});

test('flat break floors explicit amounts, caps at held Block and derives only in the selected Smash modes', () => {
  const ctx = context(), smash = EffectiveSmashGuardRules(null, ctx);
  assert.equal(EffectiveBlockBreakAmount({ blockBreak: 3.9 }, 20, smash, ctx), 3);
  assert.equal(EffectiveBlockBreakAmount({}, 19, smash, ctx), 0);
  for (const mode of ['flatBreak', 'both']) assert.equal(EffectiveBlockBreakAmount({}, 19, { ...smash, mode }, ctx), 9);
  assert.equal(EffectiveBlockBreakAmount({}, -4, { ...smash, mode: 'flatBreak' }, ctx), 0);
  const c = coreFight(), enemy = c.enemies[0];
  enemy.combatStance = { maneuver: 'neutral', camp: 'physical' };
  const before = structuredClone(enemy);
  const receipt = profileDamageReceipt(c, c.player, enemy, 4, { ...carrier, blockBreak: 50 }, { forecast: true });
  assert.equal(receipt.blockBrokenFlat, 10);
  assert.equal(receipt.blockRemaining, 0);
  assert.equal(receipt.hpLoss, 4);
  assert.deepEqual(enemy, before);
});

test('controlled Smash modes apply multiplier, flat scale and break stages independently without changing pools', () => {
  const c = coreFight(), enemy = c.enemies[0];
  enemy.combatStance = { maneuver: 'defend', camp: 'physical' };
  const before = structuredClone(enemy);
  const receipts = {};
  for (const mode of ['multiplier', 'flatBreak', 'both']) {
    c.combatMechanics.resolved.smashVsDefensive.mode = mode;
    receipts[mode] = profileDamageReceipt(c, c.player, enemy, 20, carrier, { forecast: true });
  }
  assert.equal(receipts.multiplier.blockBrokenFlat, undefined);
  assert.equal(receipts.multiplier.hpLoss, 30, '20*2 - 10 absorbed');
  assert.equal(receipts.flatBreak.blockBrokenFlat, 10);
  assert.equal(receipts.flatBreak.hpLoss, 10, '20*.5 with ten Block destroyed before absorption');
  assert.equal(receipts.both.blockBrokenFlat, 10);
  assert.equal(receipts.both.hpLoss, 40, 'multiplier plus flat break');
  assert.ok(receipts.flatBreak.damageReceipt.hits[0].sources.some(row => row.id === 'break-block'));
  assert.deepEqual(enemy, before);
});

test('Block-break scalar CP reaches ordinary/prepared scorers and per-call rules without changing authored data', () => {
  const weights = scoringContract(); weights.effects.blockBreak = { weight: 2, per: 1 }; weights.effectCount = { weight: 0 };
  const def = { id: 'fixture.blockbreak', name: 'Probe', type: 'attack', rarity: 'common', class: 'reaver', cost: 0,
    blockBreak: 6, effects: [] };
  const before = structuredClone(def), ctx = context(), off = context({ blockBreak: { enabled: false } });
  const face = CardDefinitionToScoreFace(def, { scoring: weights });
  assert.equal(face.blockBreak, 6);
  assert.equal(ScoreCard(face, weights, ctx).parts.blockBreak, 12);
  assert.equal(ScoreCard({ ...BaseFace(), sp: 0, blockBreak: 6 }, weights, ctx).parts.blockBreak, 12);
  const score = PrepareCardScorer(weights);
  for (const mechanicsContext of [ctx, off, ctx]) {
    assert.deepEqual(score(face, mechanicsContext), ScoreCard(face, weights, mechanicsContext));
    assert.equal(score(face, mechanicsContext).parts.blockBreak, mechanicsContext === off ? undefined : 12);
    const args = { baseDef: def, currentDef: def, scoring: weights, mechanicsContext };
    const ordinary = PrepareUpgradeStepCpContext(args), compiled = PrepareUpgradeStepCpContext({ ...args, scoreCard: score });
    assert.equal(compiled.rawBefore, ordinary.rawBefore);
    const request = { ...args, step: { k: 'fx', fx: 'draw', n: 1 } };
    assert.deepEqual(EvaluateUpgradeStepCp({ ...request, context: ordinary }), EvaluateUpgradeStepCp({ ...request, context: compiled }));
  }
  assert.deepEqual(def, before);
});
