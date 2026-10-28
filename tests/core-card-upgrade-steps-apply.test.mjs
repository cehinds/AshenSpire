// Card upgrades 1/7: applying stored upgrade steps to a card definition.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUpgradeSteps, upgradedDefinition, upgradeCount, upgradeStepsOf, upgradeSignature } from '../src/model/cardUpgrade.js';

const strike = Object.freeze({
  id: 't.strike', name: 'Strike', cost: 1, staminaCost: 2, manaCost: 0, type: 'attack', keywords: [],
  textTemplate: 'Deal {damage} damage.',
  effects: Object.freeze([Object.freeze({ op: 'damage', target: 'enemy', amount: 6 })]),
  upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 9 }] },
});

test('no steps returns the base card itself', () => {
  assert.equal(applyUpgradeSteps(strike, []), strike);
});

test('upgradeCount and steps: old upgraded flag reads as one authored step', () => {
  assert.equal(upgradeCount({}), 0);
  assert.equal(upgradeCount({ upgraded: false }), 0);
  assert.equal(upgradeCount({ upgraded: true }), 1);
  assert.deepEqual(upgradeStepsOf({ upgraded: true }), [{ k: 'authored' }]);
  assert.equal(upgradeCount({ upgraded: true, upgradeSteps: [{ k: 'authored' }, { k: 'dmg', n: 2 }] }), 2);
  assert.equal(upgradeSignature({}), '0');
  assert.equal(upgradeSignature({ upgraded: true }), '1');
  assert.equal(upgradeSignature({ upgradeSteps: [{ k: 'authored' }] }), '1');
  assert.notEqual(upgradeSignature({ upgradeSteps: [{ k: 'authored' }, { k: 'dmg', n: 2 }] }), '1');
});

test('one authored step equals today\'s upgradedDefinition', () => {
  assert.deepEqual(applyUpgradeSteps(strike, [{ k: 'authored' }]), upgradedDefinition(strike));
  assert.equal(applyUpgradeSteps(strike, [{ k: 'authored' }]).name, 'Strike+');
});

test('a rolled first step starts from the base, not the authored block', () => {
  const card = applyUpgradeSteps(strike, [{ k: 'dmg', n: 2 }]);
  assert.equal(card.effects[0].amount, 8);
  assert.equal(card.name, 'Strike+');
  assert.equal(card.upgraded, true);
});

test('two or more upgrades are named Name+N and stack on the authored face', () => {
  const two = applyUpgradeSteps(strike, [{ k: 'authored' }, { k: 'dmg', n: 2 }]);
  assert.equal(two.name, 'Strike+2');
  assert.equal(two.effects[0].amount, 11);
  const three = applyUpgradeSteps(strike, [{ k: 'authored' }, { k: 'dmg', n: 2 }, { k: 'dmg', n: 1 }]);
  assert.equal(three.name, 'Strike+3');
  assert.equal(three.effects[0].amount, 12);
  assert.equal(strike.effects[0].amount, 6, 'the frozen base is never mutated');
});

test('each step kind changes exactly its number', () => {
  const card = { ...strike, effects: [
    { op: 'damage', target: 'enemy', amount: 6 }, { op: 'block', target: 'self', amount: 5 },
    { op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 1 }], staminaCost: 2, cost: 2, manaCost: 3 };
  const run = (step) => applyUpgradeSteps(card, [{ k: 'dmg', n: 0 }, step]);
  assert.equal(run({ k: 'dmg', n: 2 }).effects[0].amount, 8);
  assert.equal(run({ k: 'blk', n: 3 }).effects[1].amount, 8);
  assert.equal(run({ k: 'stk', status: 'burn', n: 1 }).effects[2].stacks, 2);
  const added = run({ k: 'addStatus', status: 'weak', stacks: 1 });
  assert.deepEqual(added.effects[3], { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 });
  const sp = run({ k: 'cost', pool: 'sp' });
  assert.deepEqual([sp.staminaCost, sp.cost, sp.manaCost], [1, 1, 3]);
  const mp = run({ k: 'cost', pool: 'mp' });
  assert.deepEqual([mp.staminaCost, mp.cost, mp.manaCost], [2, 2, 2]);
  const hits = run({ k: 'hits', hits: 2, per: 4 });
  assert.deepEqual([hits.effects[0].amount, hits.effects[0].hits], [4, 2]);
  assert.equal(hits.textTemplate, 'Deal {damage} damage {hits} times.');
  assert.throws(() => run({ k: 'plus', n: 1 }), /Unknown card upgrade step/);
});

test('unknown kinds and a late authored step throw', () => {
  assert.throws(() => applyUpgradeSteps(strike, [{ k: 'dmg', n: 1 }, { k: 'bogus' }]), /Unknown card upgrade step/);
  assert.throws(() => applyUpgradeSteps(strike, [{ k: 'dmg', n: 1 }, { k: 'authored' }]), /first step/);
});
