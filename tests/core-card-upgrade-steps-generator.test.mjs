// Card upgrades 2/7: the seeded step generator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollUpgradeStep, upgradeStepRng, upgradeSeed, STACK_CAPS } from '../src/model/cardUpgradeSteps.js';
import { applyUpgradeSteps, UPGRADE_STEP_KINDS } from '../src/model/cardUpgrade.js';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const byId = (id) => cards.find((c) => c.id === id);
const dmg = (amount, extra = {}) => ({ id: 't.d', name: 'D', type: 'attack', cost: 1, staminaCost: 1, manaCost: 0, keywords: [], tags: ['camp:physical'], damageSchool: 'physical',
  effects: [{ op: 'damage', target: 'enemy', amount }], ...extra });
// Roll with every possible stream value so each eligible branch is reachable.
const kindsFor = (card, applied = []) => {
  const seen = new Set();
  for (let i = 0; i < 400; i += 1) seen.add(rollUpgradeStep(card, applied, applied.length, upgradeStepRng(i, 'x', i)).k);
  return seen;
};

test('same seed gives the same step; the stream is stateless', () => {
  const a = rollUpgradeStep(dmg(6), [], 0, upgradeStepRng(77, 'inst-1', 0));
  const b = rollUpgradeStep(dmg(6), [], 0, upgradeStepRng(77, 'inst-1', 0));
  assert.deepEqual(a, b);
  assert.equal(upgradeSeed(77, 'inst-1', 0), upgradeSeed(77, 'inst-1', 0));
  assert.notEqual(upgradeSeed(77, 'inst-1', 0), upgradeSeed(77, 'inst-1', 1));
  assert.notEqual(upgradeSeed(77, 'inst-1', 0), upgradeSeed(78, 'inst-1', 0));
  assert.notEqual(upgradeSeed(77, 'inst-1', 0), upgradeSeed(77, 'inst-2', 0));
});

test('every kind the generator emits is a known step kind and never retain', () => {
  const all = new Set();
  for (const card of cards) for (const k of kindsFor(card)) all.add(k);
  for (const k of all) assert.ok(UPGRADE_STEP_KINDS.includes(k), k);
  assert.ok(!all.has('retain'));
  for (const k of ['dmg', 'blk', 'stk', 'addStatus', 'cost', 'hits']) assert.ok(all.has(k), `${k} is reachable`);
});

test('dmg step is +max(2, ceil(15%)) and blk is +max(2, ceil(20%))', () => {
  const pick = (card, kind) => { for (let i = 0; i < 400; i += 1) { const s = rollUpgradeStep(card, [], 0, upgradeStepRng(i, 'x', 0)); if (s.k === kind) return s; } };
  assert.equal(pick(dmg(6), 'dmg').n, 2);
  assert.equal(pick(dmg(40), 'dmg').n, 6);
  const blk = { ...dmg(1), effects: [{ op: 'block', target: 'self', amount: 20 }], type: 'skill' };
  assert.equal(pick(blk, 'blk').n, 4);
  assert.equal(pick({ ...blk, effects: [{ op: 'block', target: 'self', amount: 5 }] }, 'blk').n, 2);
});

test('stk only on capped statuses below their cap; others never stack', () => {
  const card = (status, stacks) => dmg(6, { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status, stacks }] });
  for (const [status, cap] of Object.entries(STACK_CAPS)) {
    assert.ok(kindsFor(card(status, cap - 1)).has('stk'), `${status} below cap`);
    assert.ok(!kindsFor(card(status, cap)).has('stk'), `${status} at cap`);
  }
  assert.ok(!kindsFor(card('evade', 1)).has('stk'));
  assert.ok(!kindsFor(dmg(6, { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'burn', stacks: { f: 'metric' } }] })).has('stk'));
});

test('addStatus only when the card applies no status, from its school', () => {
  const physical = new Set(), magic = new Set();
  for (let i = 0; i < 600; i += 1) {
    const p = rollUpgradeStep(dmg(6), [], 0, upgradeStepRng(i, 'p', 0)); if (p.k === 'addStatus') physical.add(p.status);
    const m = rollUpgradeStep(dmg(6, { tags: ['camp:spell'], damageSchool: 'magic' }), [], 0, upgradeStepRng(i, 'm', 0)); if (m.k === 'addStatus') magic.add(m.status);
  }
  assert.deepEqual([...physical].sort(), ['bleed', 'weak']);
  assert.deepEqual([...magic].sort(), ['burn', 'vulnerable']);
  assert.ok(!kindsFor(dmg(6, { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 }] })).has('addStatus'));
  assert.ok(!kindsFor(dmg(6, { tags: [], damageSchool: undefined })).has('addStatus'));
});

test('cost: at most once; SP never below 1; MP keeps mana >= 1; cost tracks staminaCost', () => {
  assert.ok(!kindsFor(dmg(6)).has('cost'), '1 SP card cannot go lower');
  const two = dmg(6, { cost: 2, staminaCost: 2 });
  const step = (() => { for (let i = 0; i < 400; i += 1) { const s = rollUpgradeStep(two, [], 0, upgradeStepRng(i, 'x', 0)); if (s.k === 'cost') return s; } })();
  assert.deepEqual(step, { k: 'cost', pool: 'sp' });
  const after = applyUpgradeSteps(two, [step]);
  assert.deepEqual([after.staminaCost, after.cost], [1, 1]);
  assert.ok(!kindsFor(two, [step]).has('cost'), 'once per card');
  const mp1 = dmg(6, { manaCost: 1 });
  assert.ok(!kindsFor(mp1).has('cost'));
  const mp3 = dmg(6, { manaCost: 3 });
  const seen = new Set(); for (let i = 0; i < 400; i += 1) { const s = rollUpgradeStep(mp3, [], 0, upgradeStepRng(i, 'x', 0)); if (s.k === 'cost') seen.add(s.pool); }
  assert.deepEqual([...seen], ['mp'].sort());
  assert.ok(!kindsFor(dmg(6, { cost: 2, staminaCost: 1 })).has('cost'), 'cost must equal staminaCost');
  assert.ok(!kindsFor(dmg(6, { cost: 'X', staminaCost: 2 })).has('cost'));
});

test('hits: once, single-hit damage <= 8, at most 3, per-hit is ceil(60%)', () => {
  const steps = new Set(); let counts = new Set();
  for (let i = 0; i < 600; i += 1) { const s = rollUpgradeStep(dmg(8), [], 0, upgradeStepRng(i, 'x', 0)); if (s.k === 'hits') { steps.add(s.per); counts.add(s.hits); } }
  assert.deepEqual([...steps], [5]);
  assert.ok([...counts].every((n) => n >= 2 && n <= 3));
  assert.ok(!kindsFor(dmg(9)).has('hits'));
  assert.ok(!kindsFor(dmg(6), [{ k: 'hits', hits: 2, per: 4 }]).has('hits'));
  assert.ok(!kindsFor(dmg(6, { effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 2 }] })).has('hits'));
});

test('power, status and curse cards take only cost or the +1 fallback', () => {
  for (const type of ['power', 'status', 'curse']) {
    const card = { id: 't.p', name: 'P', type, cost: 2, staminaCost: 2, manaCost: 0, keywords: [], tags: ['camp:physical'],
      effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'damage', target: 'enemy', amount: 3 }] };
    assert.deepEqual([...kindsFor(card)].sort(), ['cost']);
    assert.deepEqual([...kindsFor({ ...card, cost: 1, staminaCost: 1 })], ['plus']);
  }
});

test('fallback adds +1 to the primary number when nothing is eligible', () => {
  const capped = dmg(6, { effects: [{ op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 3 }] });
  assert.deepEqual(rollUpgradeStep(capped, [], 0, upgradeStepRng(1, 'x', 0)), { k: 'plus', n: 1 });
});

test('global guard: damage and block gain never exceed +100% of base across 10 upgrades (fallback +1s aside)', () => {
  const total = (c, op) => c.effects.filter((e) => e.op === op).slice(0, 1).reduce((s, e) => s + e.amount * (e.hits || 1), 0);
  for (const card of cards) {
    for (let seed = 0; seed < 12; seed += 1) {
      const steps = [];
      while (steps.length < 10) steps.push(rollUpgradeStep(card, steps, steps.length, upgradeStepRng(seed, card.id, steps.length)));
      const face = applyUpgradeSteps(card, steps);
      const fallbacks = steps.filter((s) => s.k === 'plus').length;
      for (const op of ['damage', 'block']) {
        const base = total(card, op);
        if (base) assert.ok(total(face, op) <= base * 2 + fallbacks * 3, `${card.id} ${op} ${total(face, op)} > 2x${base}`);
      }
      assert.ok(face.staminaCost >= (card.staminaCost > 0 ? 1 : 0), `${card.id} SP floor`);
      if (card.manaCost > 0) assert.ok(face.manaCost >= 1 && face.cost >= 1, `${card.id} MP floor`);
      assert.equal(face.cost, card.cost - (card.staminaCost - face.staminaCost), `${card.id} cost tracks SP`);
      assert.ok(steps.filter((s) => s.k === 'cost').length <= 1 && steps.filter((s) => s.k === 'hits').length <= 1);
      for (const e of face.effects) if (e.op === 'applyStatus' && STACK_CAPS[e.status] && Number.isFinite(e.stacks)) {
        const authored = (card.effects.find((b) => b.op === 'applyStatus' && b.status === e.status) || { stacks: 0 }).stacks;
        assert.ok(e.stacks <= Math.max(STACK_CAPS[e.status], authored) + fallbacks, `${card.id} ${e.status} cap`);
      }
    }
  }
});
