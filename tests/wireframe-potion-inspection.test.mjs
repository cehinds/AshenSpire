import test from 'node:test';
import assert from 'node:assert/strict';
import { potionInspectionView } from '../src/ui/models/PotionInspectionModel.js';
import { flaskActionPlan } from '../src/model/flaskActions.js';

const useRow = (plan) => plan.actions.find((row) => row.id === 'use');

test('a usable potion offers Use as its one action and states no refusal', () => {
  const view = potionInspectionView({ charges: 2, use: useRow(flaskActionPlan({ context: 'combat', canUse: true })) });
  assert.equal(view.chargeLine, '2 charges remaining.');
  assert.deepEqual({ ...view.action }, { id: 'use', label: 'Use', enabled: true, reason: '' });
  assert.equal(view.eligibility, null);
});

test('a potion that cannot be used here says why, and Use stays visible but disabled', () => {
  const view = potionInspectionView({ charges: 1, use: useRow(flaskActionPlan({ context: 'run', canUse: false, useReason: 'Only in combat' })) });
  assert.equal(view.chargeLine, '1 charge remaining.');
  assert.equal(view.action.enabled, false);
  assert.equal(view.eligibility, 'Only in combat');
});

test('a read-only surface has no action and no eligibility line; unknown charges are omitted', () => {
  const view = potionInspectionView({});
  assert.equal(view.action, null);
  assert.equal(view.eligibility, null);
  assert.equal(view.chargeLine, null);
  assert.equal(potionInspectionView({ charges: -1 }).chargeLine, null);
});
