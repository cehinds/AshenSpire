import test from 'node:test';
import assert from 'node:assert/strict';
import { coopRangePreview } from '../src/ui/models/CoopRangePreviewModel.js';
import { rangeHitLabel } from '../src/ui/models/CombatRangeActionModel.js';
const target = (id, chance) => ({ targetId: id, band: 1, currentInRange: false, currentHitChance: 0, inRange: true, hitChance: chance });
const quote = (id, advanceCost) => ({ enabled: true, selectedRoute: 'advance', targets: [target(id, 80)], routes: [
  { id: 'advance', available: true, affordable: false, advanceSp: 1, costs: { energy: advanceCost, stamina: advanceCost, mana: 1 }, targets: [target(id, 80)] },
  { id: 'throw', available: true, affordable: true, advanceSp: 0, costs: { energy: 2, stamina: 2, mana: 1 }, targets: [target(id, 70)] },
] });
test('co-op reads exact target/route SP and observer odds from the host without mutation', () => {
  const preview = { cost: 3, manaCost: 1, staminaCost: 3, range: quote('e1', 3), rangeByTarget: { e1: quote('e1', 3), e2: quote('e2', 4) } };
  const before = structuredClone(preview);
  const advanced = coopRangePreview(preview, { targetId: 'e2' });
  assert.equal(advanced.cost, 4); assert.equal(advanced.staminaCost, 4);
  const thrown = coopRangePreview(preview, { targetId: 'e2', rangeRoute: 'throw' });
  assert.equal(thrown.cost, 2); assert.equal(thrown.manaCost, 1); assert.equal(thrown.range.selectedRoute, 'throw');
  assert.equal(rangeHitLabel(thrown, { targetId: 'e2' }), 'Out of range · 0%');
  assert.equal(rangeHitLabel(thrown, { targetId: 'e2', current: false }), '70%');
  assert.deepEqual(preview, before);
});
test('a missing target or unknown route cannot reuse a different host quote', () => {
  const preview = { range: quote('e1', 3) };
  assert.equal(coopRangePreview(preview, { targetId: 'e2' }).rangeQuoteUnavailable, true);
  assert.equal(coopRangePreview(preview, { targetId: 'e1', rangeRoute: 'invented' }).rangeQuoteUnavailable, true);
  assert.equal(coopRangePreview({ cost: 1 }, { rangeRoute: 'throw' }).cost, 1, 'historical non-range host receipt remains unchanged');
});
