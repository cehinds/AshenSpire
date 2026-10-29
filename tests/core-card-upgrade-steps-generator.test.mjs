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
  for (let i = 0; i < 400; i += 1) seen.add(rollUpgradeStep(card, applied, applied.length, upgradeStepRng(i, 'x', i))?.k ?? 'none');
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
  for (const k of all) assert.ok(k === 'none' || UPGRADE_STEP_KINDS.includes(k), k);
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
  for (let i = 0; i < 600; i += 1) { const s = rollUpgradeStep(dmg(8, { cost: 3, staminaCost: 3 }), [], 0, upgradeStepRng(i, 'x', 0)); if (s.k === 'hits') { steps.add(s.per); counts.add(s.hits); } }
  assert.deepEqual([...steps], [5]);
  assert.ok([...counts].every((n) => n >= 2 && n <= 3));
  assert.ok(!kindsFor(dmg(9)).has('hits'));
  assert.ok(!kindsFor(dmg(6), [{ k: 'hits', hits: 2, per: 4 }]).has('hits'));
  assert.ok(!kindsFor(dmg(6, { effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 2 }] })).has('hits'));
});

test('hits never raises the SP a card costs to play: its Core hit floor must fit the SP it already pays', () => {
  // A 1-SP plain card would pay 2 or 3 SP for 2 or 3 hits, so it never rolls hits.
  assert.ok(!kindsFor(dmg(6)).has('hits'));
  // 2 SP covers 2 hits (floor 2) but not 3 (floor 3).
  const two = new Set();
  for (let i = 0; i < 600; i += 1) { const s = rollUpgradeStep(dmg(6, { cost: 2, staminaCost: 2 }), [], 0, upgradeStepRng(i, 'x', 0)); if (s.k === 'hits') two.add(s.hits); }
  assert.deepEqual([...two], [2]);
  // A finesse card has a one-hit offset: 2 hits cost 1 SP, 3 cost 2.
  const fin = new Set();
  for (let i = 0; i < 600; i += 1) { const s = rollUpgradeStep(dmg(6, { tags: ['camp:physical', 'finesse'] }), [], 0, upgradeStepRng(i, 'x', 0)); if (s.k === 'hits') fin.add(s.hits); }
  assert.deepEqual([...fin], [2]);
  // A card with its hits already printed gets no cost step that its hit floor would undo.
  const volley = dmg(2, { cost: 3, staminaCost: 3, effects: [{ op: 'damage', target: 'enemy', amount: 2, hits: 3 }] });
  assert.ok(!kindsFor(volley).has('cost'));
});

test('power, status and curse cards take only cost, then are maxed (null)', () => {
  for (const type of ['power', 'status', 'curse']) {
    const card = { id: 't.p', name: 'P', type, cost: 2, staminaCost: 2, manaCost: 0, keywords: [], tags: ['camp:physical'],
      effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'damage', target: 'enemy', amount: 3 }] };
    assert.deepEqual([...kindsFor(card)].sort(), ['cost']);
    assert.deepEqual([...kindsFor({ ...card, cost: 1, staminaCost: 1 })], ['none']);
  }
});

test('when nothing is eligible the card is maxed: the roll is null, never a filler step', () => {
  const capped = dmg(6, { effects: [{ op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 3 }] });
  assert.equal(rollUpgradeStep(capped, [], 0, upgradeStepRng(1, 'x', 0)), null);
  // Rolling until null always ends, and never past the cap of 10 steps a card can hold.
  const steps = [];
  for (let i = 0; i < 40; i += 1) { const s = rollUpgradeStep(dmg(6), steps, steps.length, upgradeStepRng(3, 'x', steps.length)); if (!s) break; steps.push(s); }
  assert.ok(steps.length > 0 && steps.length < 40);
});

test('conditional status effects are never stacked', () => {
  const card = dmg(6, { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 1, if: { x: 1 } }] });
  assert.ok(!kindsFor(card).has('stk'));
});

test('over many rolls, cost and hits each land at most once per card and cost keeps tracking staminaCost', () => {
  const rich = dmg(8, { cost: 3, staminaCost: 3, manaCost: 3, effects: [{ op: 'damage', target: 'enemy', amount: 8 }, { op: 'block', target: 'self', amount: 20 }] });
  let costs = 0;
  for (let seed = 0; seed < 200; seed += 1) {
    const steps = [];
    while (steps.length < 10) { const s = rollUpgradeStep(rich, steps, steps.length, upgradeStepRng(seed, 'rich', steps.length)); if (!s) break; steps.push(s); }
    const face = applyUpgradeSteps(rich, steps);
    assert.ok(steps.filter((s) => s.k === 'cost').length <= 1, 'cost once');
    assert.ok(steps.filter((s) => s.k === 'hits').length <= 1, 'hits once');
    assert.equal(face.cost, face.staminaCost, 'cost equals staminaCost');
    assert.ok(face.staminaCost >= 1 && face.manaCost >= 1);
    costs += steps.filter((s) => s.k === 'cost').length;
  }
  assert.ok(costs > 20, 'the cost step is actually exercised');
});
