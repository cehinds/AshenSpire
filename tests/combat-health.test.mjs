import test from 'node:test';
import assert from 'node:assert/strict';
import { combatHealthModel } from '../src/ui/models/CombatHealthModel.js';
import { combatHealthRow } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/kit-dom.mjs';

test('protection badges are independent, Ward is first, and broken protection disappears', () => {
  for (const [defense, ward, kinds] of [[12, 8, ['ward', 'shield']], [12, 0, ['shield']], [0, 8, ['ward']], [0, 0, []]]) {
    const model = combatHealthModel({ defense, ward });
    assert.deepEqual(model.badges.map(b => b.kind), kinds);
    assert.equal(model.protected, defense > 0);
    assert.equal(model.warded, ward > 0);
  }
  assert.deepEqual(combatHealthModel({ defense: NaN, ward: -3 }).badges, []);
});

test('the compact row preserves health facts and the original total trough length', () => withKitDom(() => {
  const hp = meter({ id: 'hp', value: '64/80', cur: 64, max: 80, pct: 80, lengthPct: 72, inset: true });
  const row = combatHealthRow(hp, { defense: 12, ward: 8 }, { tooltips: false });
  assert.equal(row.style.width, '72.000%');
  assert.equal(hp.querySelector('.m-track').style.width, '100%');
  assert.equal(hp.querySelector('.m-fill').style.width, '80.00%');
  assert.equal(hp.querySelector('.m-value').textContent, '64/80');
  assert.equal(row.children.length, 3);
  assert.equal(row.children[0].dataset.defenseKind, 'ward');
  assert.equal(row.children[1].dataset.defenseKind, 'shield');
  assert.equal(hp.dataset.protected, 'true');
  assert.equal(hp.dataset.warded, 'true');
}));

test('Ward alone keeps its border while health returns to red', () => withKitDom(() => {
  const hp = meter({ id: 'hp', cur: 64, max: 80, pct: 80, inset: true });
  const row = combatHealthRow(hp, { defense: 0, ward: 8 }, { tooltips: false });
  assert.equal(hp.dataset.protected, 'false');
  assert.equal(hp.dataset.warded, 'true');
  assert.equal(row.children.length, 2);
}));
