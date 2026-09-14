import test from 'node:test';
import assert from 'node:assert/strict';
import {
  armouryRailItems, armouryPaneSplit, inventoryEligibility, inventoryComparison, inventoryFooterPlan,
} from '../src/ui/models/ArmouryWorkspaceModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const VIEWS = ['grid', 'rack', 'hybrid', 'cards'];
const LABELS = { grid: 'Character', rack: 'Equipment', hybrid: 'Inventory', cards: 'Cards' };

test('the rail keeps the saved view ids, their order and one selection', () => {
  const items = armouryRailItems({ views: VIEWS, activeView: 'hybrid', labels: LABELS });
  assert.deepEqual(items.map((i) => i.id), VIEWS);
  assert.deepEqual(items.map((i) => i.label), ['Character', 'Equipment', 'Inventory', 'Cards']);
  assert.deepEqual(items.filter((i) => i.selected).map((i) => i.id), ['hybrid']);
  assert.throws(() => armouryRailItems({ views: VIEWS, activeView: 'racks' }), /Unknown Armoury view/);
});

test('the pane splits into columns on wide hosts and rows on phones, from config', () => {
  const wide = armouryPaneSplit({ responsive: 'desktop' });
  assert.equal(wide.axis, 'columns');
  assert.equal(wide.collection, wireframeUi.armoury.collectionShare);
  assert.equal(wide.collection + wide.detail, 1);
  assert.equal(wide.collectionTrack, `${wide.collection}fr`);
  const phone = armouryPaneSplit({ responsive: 'phone' });
  assert.equal(phone.axis, 'rows');
  assert.equal(phone.collection, wireframeUi.armoury.compactCollectionShare);
  assert.equal(armouryPaneSplit({}, { collectionShare: 0.4, compactCollectionShare: 0.45 }).detailTrack, '0.6fr');
  assert.throws(() => armouryPaneSplit({}, { collectionShare: 1, compactCollectionShare: 0.5 }), /between 0 and 1/);
});

test('eligibility quotes the loadout refusal, and a requirement shortfall is a fact, not a refusal', () => {
  const target = { kind: 'equip', slotLabel: 'Right Hand' };
  assert.equal(inventoryEligibility({}).state, 'none');
  assert.deepEqual(
    { ...inventoryEligibility({ target, seal: { ok: false, reason: 'Stays fastened.' }, transition: { ok: true } }), shortfalls: undefined },
    { state: 'blocked', reason: 'Stays fastened.', shortfalls: undefined },
  );
  assert.equal(inventoryEligibility({ target, seal: { ok: true }, transition: { ok: false, reason: 'Gone.' } }).reason, 'Gone.');
  const short = inventoryEligibility({
    target, seal: { ok: true }, transition: { ok: true },
    requirement: { failures: [{ attributeId: 'str', required: 12, actual: 10, baseRequired: 12 }] },
  });
  assert.equal(short.state, 'short');
  assert.deepEqual(short.shortfalls, [{ attributeId: 'str', required: 12, actual: 10 }]);
  assert.equal(inventoryEligibility({ target, seal: { ok: true }, transition: { ok: true }, requirement: { failures: [] } }).state, 'ready');
});

test('the comparison lists only moved values and names what the position holds', () => {
  const candidate = {
    roles: [
      { role: 'attack', beforeValue: 5, afterValue: 7 },
      { role: 'guard', beforeValue: 3, afterValue: 3 },
    ],
  };
  const replaced = inventoryComparison({
    candidate, target: { kind: 'equip', slotLabel: 'Right Hand' }, occupantName: 'Iron Sword', roleLabels: { attack: 'Strike' },
  });
  assert.deepEqual(replaced.relation, { kind: 'replaces', name: 'Iron Sword', slot: 'Right Hand' });
  assert.deepEqual(replaced.roles, [{ role: 'attack', label: 'Strike', before: 5, after: 7 }]);
  assert.equal(inventoryComparison({ candidate, target: { kind: 'equip', slotLabel: 'Left Hand' } }).relation.kind, 'fills');
  assert.equal(inventoryComparison({ candidate, target: { kind: 'unequip', slotLabel: 'Left Hand' }, occupantName: 'Buckler' }).relation.kind, 'removes');
  assert.equal(inventoryComparison({ candidate: { roles: [] }, target: { kind: 'equip' } }).unchanged, true);
  assert.equal(inventoryComparison({ candidate: null, target: { kind: 'equip' } }), null);
});

test('the footer offers the selected item action only when one exists, and keeps a refusal', () => {
  assert.equal(inventoryFooterPlan({}).primary, null);
  assert.equal(inventoryFooterPlan({ target: { kind: 'equip' }, actionLabel: '' }).primary, null);
  const ready = inventoryFooterPlan({ target: { kind: 'equip' }, actionLabel: 'Equip to Right Hand', eligibility: { state: 'ready' } });
  assert.deepEqual({ ...ready.primary }, { label: 'Equip to Right Hand', kind: 'equip', blocked: false, reason: '' });
  const blocked = inventoryFooterPlan({ target: { kind: 'equip' }, actionLabel: 'Equip to Right Hand', eligibility: { state: 'blocked', reason: 'Stays fastened.' } });
  assert.equal(blocked.primary.blocked, true);
  assert.equal(blocked.primary.reason, 'Stays fastened.');
});

test('projection never changes what it reads', () => {
  const candidate = { roles: [{ role: 'attack', beforeValue: 1, afterValue: 2 }] };
  const requirement = { failures: [{ attributeId: 'str', required: 3, actual: 1 }] };
  const before = JSON.stringify({ candidate, requirement });
  inventoryComparison({ candidate, target: { kind: 'equip', slotLabel: 'x' } });
  inventoryEligibility({ target: { kind: 'equip' }, requirement });
  assert.equal(JSON.stringify({ candidate, requirement }), before);
});
