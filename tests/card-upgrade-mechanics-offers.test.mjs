import test from 'node:test';
import assert from 'node:assert/strict';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { ResolveMechanicsTable } from '../src/model/combatMechanics.js';
import { scoringContract } from './helpers/scoring-contract.mjs';

// A sole authored menu entry makes actual offer membership deterministic.
// Generous explicit CP operands keep this a drawback-eligibility contract.
for (const type of ['power', 'skill']) test(type + ' offers Steady for inherited positive growth, but not explicit zero or disabled growth', () => {
  const scoring = scoringContract();
  scoring.tierUnlocks = { enabled: false };
  scoring.rank = { unrankedMax: 0, width: 10000, maxRank: 10, maxCp: 100000 };
  scoring.costs = { sp: { weight: 0 }, mp: { weight: 0 } };
  const mechanics = enabled => ({ combatMechanics: ResolveMechanicsTable({ costGrowth: { enabled, scope: 'instance', stamina: 1, mana: 0, perUse: 1, maxSteps: 3 } }) });
  const base = { id: 'fixture.offer.' + type, type, class: 'reaver', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0,
    effects: [], keywords: [], tags: [], costGrowth: {}, upgradeMenu: ['fx:steady'] };
  const before = structuredClone(base);
  const offers = (card, mechanicsContext) => rollUpgradeOptions(card, [], 0, upgradeStepRng(77, card.id, 0),
    { scoring, playerLevel: 10, tierUnlocks: false, mechanicsContext }, 1);
  const inherited = offers(base, mechanics(true));
  assert.equal(inherited.length, 1);
  assert.equal(inherited[0].k, 'fx');
  assert.equal(inherited[0].fx, 'steady');
  assert.deepEqual(offers({ ...base, costGrowth: { stamina: 0, mana: 0 } }, mechanics(true)), []);
  assert.deepEqual(offers(base, mechanics(false)), []);
  assert.deepEqual(base, before);
});
