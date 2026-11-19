// Card-upgrade redesign (owner, 2026-11-19), step 4: a signed `stk` lowers a drawback; a Power is eligible for the ease group.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollUpgradeOptions, upgradeStepRng, rarityOfStep } from '../src/model/cardUpgradeSteps.js';
import { applyUpgradeSteps, upgradeStepsProblems } from '../src/model/cardUpgrade.js';

const card = (extra = {}) => ({ id: 't.c', name: 'C', type: 'skill', cost: 1, staminaCost: 1, manaCost: 0, keywords: [], tags: ['camp:physical', 'maneuver:defend'], damageSchool: 'physical',
  effects: [{ op: 'block', target: 'self', amount: 8 }], ...extra });
const easeSteps = (c, rolls = 600) => {
  const out = new Map();
  for (let i = 0; i < rolls; i += 1) for (const s of rollUpgradeOptions(c, [], 0, upgradeStepRng(i, 'ease', 0), {}, 30)) {
    const first = s.k === 'combo' ? s.steps[0] : s;
    if (first.k === 'stk' && first.n < 0) out.set(rarityOfStep(s), s);
  }
  return out;
};
const stkOf = (s) => (s.k === 'combo' ? s.steps[0] : s);

test('a self debuff, an enemy buff, a discard and added cards each offer a signed stk, dropped at 0', () => {
  const selfDebuff = card({ textTemplate: 'Gain {block} Block. Gain 2 Frail.', effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'self', status: 'frail', stacks: 2 }] });
  const one = easeSteps(selfDebuff).get('common');
  assert.deepEqual(one, { k: 'stk', status: 'frail', side: 'self', n: -1 });
  const eased = applyUpgradeSteps(selfDebuff, [one]);
  assert.equal(eased.effects[1].stacks, 1);
  const gone = applyUpgradeSteps(selfDebuff, [one, one]);
  assert.equal(gone.effects.length, 1, 'the effect is dropped at 0');
  assert.equal(gone.textTemplate, 'Gain {block} Block.', 'and so is its sentence');

  const enemyBuff = card({ effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'enemy', status: 'strength', stacks: 1 }] });
  assert.equal(applyUpgradeSteps(enemyBuff, [easeSteps(enemyBuff).get('common')]).effects.length, 1);

  const discard = card({ effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'discard', amount: 2, random: true }] });
  const d = easeSteps(discard).get('common');
  assert.deepEqual(d, { k: 'stk', op: 'discard', n: -1 });
  assert.equal(applyUpgradeSteps(discard, [d]).effects[1].amount, 1);

  const wound = card({ effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'addCard', card: 'wound', count: 1, pile: 'discard' }] });
  assert.equal(applyUpgradeSteps(wound, [easeSteps(wound).get('common')]).effects.length, 1);
});

test('a Copy or Cycle step is not a drawback; the uncommon ease removes it outright and draws', () => {
  const plain = card();
  assert.equal(easeSteps(plain).size, 0);
  const copied = [{ k: 'fx', fx: 'copy' }, { k: 'fx', fx: 'cycle', n: 1 }];
  const rolled = new Set();
  for (let i = 0; i < 200; i += 1) for (const s of rollUpgradeOptions(plain, copied, 3, upgradeStepRng(i, 'x', 0), {}, 30)) if (s.k === 'stk') rolled.add(s.op);
  assert.equal(rolled.size, 0);
  const debuff = card({ effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 2 }] });
  const unc = [...[0]].map(() => { for (let i = 0; i < 900; i += 1) for (const s of rollUpgradeOptions(debuff, [], 9, upgradeStepRng(i, 'u', 0), {}, 30)) if (s.k === 'combo' && s.r === 'uncommon' && stkOf(s).k === 'stk') return s; })[0];
  assert.deepEqual(unc.steps.map((s) => s.k === 'stk' ? s.n : s.fx), [-2, 'draw']);
  assert.equal(applyUpgradeSteps(debuff, [unc]).effects.some((e) => e.status === 'weak'), false);
  assert.deepEqual(upgradeStepsProblems({ upgraded: true, upgradeSteps: [unc, { k: 'stk', op: 'discard', n: -1 }] }, 'x'), []);
  assert.ok(upgradeStepsProblems({ upgraded: true, upgradeSteps: [{ k: 'stk', op: 'discard', n: 1 }] }, 'x').length);
});

test('a Power may roll ease (Ethereal, a rising cost, a debuff) but never unexhaust', () => {
  const power = card({ type: 'power', cost: 2, staminaCost: 2, keywords: ['ethereal'], costGrowth: { stamina: 1, perUse: 1, max: 2 }, effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 1 }] });
  const kinds = new Set();
  for (let i = 0; i < 400; i += 1) for (const s of rollUpgradeOptions(power, [], 0, upgradeStepRng(i, 'p', 0), {}, 30)) { const f = s.k === 'combo' ? s.steps[0] : s; kinds.add(f.k === 'fx' ? f.fx : f.k); }
  assert.ok(['unethereal', 'steady', 'stk', 'cost'].every((k) => kinds.has(k)), [...kinds].join());
  assert.ok(!kinds.has('unexhaust') && !kinds.has('dmg') && !kinds.has('block'));
});
