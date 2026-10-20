import test from 'node:test';
import assert from 'node:assert/strict';
import { combatRangeActionPlan, rangeHitLabel } from '../src/ui/models/CombatRangeActionModel.js';
const target = { targetId: 'e1', band: 1, currentInRange: false, currentHitChance: 0, inRange: true, hitChance: 73.25, precisionDelta: 0 };
const quote = () => ({ range: { enabled: true, selectedRoute: 'advance', targets: [target], routes: [
  { id: 'advance', available: true, affordable: false, advanceSp: 1, precisionDelta: 0, costs: { energy: 3, stamina: 3, mana: 0 }, targets: [target] },
  { id: 'throw', available: true, affordable: true, advanceSp: 0, precisionDelta: -1, costs: { energy: 2, stamina: 2, mana: 0 }, targets: [{ ...target, hitChance: 66.5, precisionDelta: -1 }] },
] } });
test('current unreachable chance stays zero, separate from quoted after-route odds', () => {
  const q = quote();
  assert.equal(rangeHitLabel(q), 'Out of range · 0%');
  assert.equal(rangeHitLabel(q, { current: false }), '73.25%');
  const plan = combatRangeActionPlan(q, { targetName: () => 'Soldier' });
  assert.equal(plan.routes[0].label, 'Advance · +1 SP');
  assert.equal(plan.routes[0].total, 'Total 3 SP');
  assert.match(plan.routes[0].odds[0].text, /Soldier · Reach · Out of range · 0% → After Advance 73.25%/);
  assert.equal(plan.routes[1].label, 'Throw · -1 Precision');
  assert.equal(plan.routes[1].total, 'Total 2 SP');
  assert.equal(plan.selectedRoute, 'advance', 'unaffordable Advance never silently selects Throw');
});
test('disabled mechanics have no attachment and a refused Throw is never repriced as Advance', () => {
  assert.equal(combatRangeActionPlan({}), null);
  const q = quote(); q.range.selectedRoute = 'throw'; q.range.routes[1].available = false; q.range.routes[1].reason = 'range';
  const plan = combatRangeActionPlan(q);
  assert.equal(plan.selectedRoute, 'throw'); assert.equal(plan.routes[1].available, false);
  assert.equal(plan.routes[1].reason, 'range'); assert.equal(plan.routes[1].total, 'Total 2 SP');
});
test('multi-target approach prints every engine-quoted target and chance', () => {
  const q = quote(); q.range.routes[0].targets.push({ ...target, targetId: 'e2', band: 2, hitChance: 41.1 });
  const plan = combatRangeActionPlan(q);
  assert.equal(plan.routes[0].odds.length, 2); assert.match(plan.routes[0].odds[1].text, /e2 · Ranged.*41.1%/);
});
