// Card-upgrade redesign (owner, 2026-11-19): group roll, rarity odds and step sizes (SPEC "Upgrade rarity").
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollUpgradeOptions, upgradeStepRng, UpgradeGroupShares, UpgradeRarityOdds, RarityOfStep } from '../src/model/cardUpgradeSteps.js';
import { applyUpgradeSteps, upgradeStepsProblems } from '../src/model/cardUpgrade.js';

const smash = (extra = {}) => ({ id: 't.s', name: 'S', type: 'attack', cost: 3, staminaCost: 3, manaCost: 0, keywords: [], tags: ['camp:physical', 'maneuver:attack'], damageSchool: 'physical',
  effects: [{ op: 'damage', target: 'enemy', amount: 12 }], ...extra });
const sizes = (card, kind, stepIndex = 9, rolls = 600) => {
  const seen = new Map();
  for (let i = 0; i < rolls; i += 1) for (const s of rollUpgradeOptions(card, [], stepIndex, upgradeStepRng(i, 'r', 0), {}, 30)) if (s.k === kind) seen.set(RarityOfStep(s), s);
  return seen;
};

test('group shares and rarity odds follow the upgrade number', () => {
  assert.deepEqual([1, 3, 4, 6, 8, 10].map((n) => { const g = UpgradeGroupShares(n); return [g.ease, g.eff, g.new, g.identity]; }),
    [[40, 35, 20, 5], [40, 35, 20, 5], [30, 30, 30, 10], [20, 30, 35, 15], [15, 20, 45, 20], [15, 20, 45, 20]]);
  assert.deepEqual([1, 3, 4, 5, 6, 7, 8, 10].map(UpgradeRarityOdds), [[70, 25, 5], [70, 25, 5], [45, 40, 15], [45, 40, 15], [25, 45, 30], [25, 45, 30], [10, 40, 50], [10, 40, 50]]);
  for (let n = 1; n <= 10; n += 1) { const g = UpgradeGroupShares(n); assert.equal(g.ease + g.eff + g.new + g.identity, 100); }
});

test('damage steps add one, two or three Improved stacks, inside the +100% guard', () => {
  const seen = sizes(smash(), 'dmg');
  assert.deepEqual([...seen.keys()].sort(), ['common', 'rare', 'uncommon']);
  assert.deepEqual([seen.get('common').n, seen.get('uncommon').n, seen.get('rare').n], [1, 3, 4]);
  assert.equal(seen.get('common').r, undefined, 'a common step stores no r');
  assert.equal(seen.get('rare').r, 'rare');
  // Small damage starts still gain at least one point per stack.
  const strike = sizes(smash({ effects: [{ op: 'damage', target: 'enemy', amount: 6 }] }), 'dmg');
  assert.deepEqual([strike.get('common').n, strike.get('uncommon').n, strike.get('rare').n], [1, 2, 3]);
  const tiny = sizes(smash({ effects: [{ op: 'damage', target: 'enemy', amount: 1 }] }), 'dmg');
  assert.ok(tiny.size > 0);
  assert.ok([...tiny.values()].every(step => step.n === 1), 'the +100% guard caps even a rare step at one on base one');
});

test('status rarity adds one, two or three stacks; cost cuts take one from each selected pool', () => {
  const burn = smash({ effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 1 }] });
  const stk = sizes(burn, 'stk');
  assert.deepEqual([stk.get('common').n, stk.get('uncommon').n, stk.get('rare').n], [1, 2, 3]);
  const two = smash({ manaCost: 3, cost: 3 });
  const combo = sizes(two, 'combo').get('uncommon');
  assert.deepEqual(combo.steps.map((s) => `${s.k}:${s.pool}`), ['cost:sp', 'cost:mp']);
  const costs = sizes(smash(), 'cost');
  assert.deepEqual([...costs.keys()], ['common']);
  assert.equal(applyUpgradeSteps(smash(), [costs.get('common')]).staminaCost, 2);
  const applied = applyUpgradeSteps(two, [combo]);
  assert.deepEqual([applied.staminaCost, applied.manaCost], [2, 2]);
});

test('an ease is common as is, uncommon with a draw, rare with a rare-size step', () => {
  const card = smash({ keywords: ['exhaust'] });
  const out = new Map();
  for (let i = 0; i < 800; i += 1) for (const s of rollUpgradeOptions(card, [], 9, upgradeStepRng(i, 'e', 0), {}, 30)) {
    const inner = s.k === 'combo' ? s.steps[0] : s;
    if (inner.k === 'fx' && inner.fx === 'unexhaust') out.set(RarityOfStep(s), s);
  }
  assert.equal(out.get('common').fx, 'unexhaust');
  assert.deepEqual(out.get('uncommon').steps.map((s) => s.fx), ['unexhaust', 'draw']);
  const rare = out.get('rare');
  assert.equal(rare.steps[0].fx, 'unexhaust');
  assert.ok(['cost', 'dmg', 'blk'].includes(rare.steps[1].k));
  assert.deepEqual(applyUpgradeSteps(card, [rare]).keywords, []);
  assert.deepEqual(upgradeStepsProblems({ upgraded: true, upgradeSteps: [rare, out.get('uncommon')] }, 'x'), []);
});

test('a step saved before rarity (no r) validates and applies as before; a bad r is refused', () => {
  const old = [{ k: 'dmg', n: 2 }, { k: 'fx', fx: 'target', other: true }];
  assert.deepEqual(upgradeStepsProblems({ upgraded: true, upgradeSteps: old }, 'x'), []);
  const face = applyUpgradeSteps(smash(), old);
  assert.equal(face.effects[0].amount, 14);
  assert.equal(face.effects[1].amount, 7, 'a target step with no share keeps its half');
  assert.equal(RarityOfStep(old[0]), 'common');
  assert.ok(upgradeStepsProblems({ upgraded: true, upgradeSteps: [{ k: 'dmg', n: 2, r: 'epic' }] }, 'x').length);
  const shared = applyUpgradeSteps(smash(), [{ k: 'fx', fx: 'target', other: true, share: 0.75, r: 'rare' }]);
  assert.equal(shared.effects[1].amount, 9);
});
