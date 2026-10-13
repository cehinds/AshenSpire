import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCombatStance, combatStanceRow, combatTacticsRows, preparedEvadeCharges, preparedEvadeRow } from '../src/model/combatTacticsDisplay.js';

const evade = (extra = {}) => ({ charges: 2, bonus: 0, advantage: false, disadvantage: false, expiresOnOwnerCycle: 4, ...extra });

test('a prepared Evade reads as "Evade ×N" with its charge rules', () => {
  const entity = { combatOwnerCycle: 3, combatEvade: evade() };
  assert.equal(preparedEvadeCharges(entity), 2);
  const row = preparedEvadeRow(entity);
  assert.equal(row.name, 'Evade ×2');
  assert.equal(row.kind, 'evade');
  assert.match(row.detail, /2 charges remaining/);
  assert.match(preparedEvadeRow({ combatEvade: evade({ charges: 1, expiresOnOwnerCycle: 1 }) }).detail, /1 charge remaining/);
});

test('spent, expired or status-bound Evade without its status shows nothing', () => {
  assert.equal(preparedEvadeCharges({}), 0);
  assert.equal(preparedEvadeCharges({ combatEvade: evade({ charges: 0 }) }), 0);
  assert.equal(preparedEvadeCharges({ combatOwnerCycle: 4, combatEvade: evade() }), 0);
  assert.equal(preparedEvadeCharges({ combatOwnerCycle: 3, combatEvade: evade({ whileStatus: 'hidden' }), statuses: {} }), 0);
  assert.equal(preparedEvadeCharges({ combatOwnerCycle: 3, combatEvade: evade({ whileStatus: 'hidden' }), statuses: { hidden: { stacks: 1 } } }), 2);
  assert.equal(preparedEvadeRow({ combatEvade: evade({ charges: 0 }) }), null);
});

test('the combat stance names its maneuver, camp and reach', () => {
  const entity = { combatStance: { maneuver: 'counter', camp: 'physical', reach: 'contact' } };
  const row = combatStanceRow(entity);
  assert.equal(row.name, 'Counter stance');
  assert.equal(row.kind, 'stance');
  assert.equal(row.maneuver, 'counter');
  assert.match(row.detail, /Physical · Contact reach\./);
  assert.equal(combatStanceRow({ combatStance: { maneuver: 'casting', camp: 'spell', reach: 'far', school: 'fire' } }).name, 'Casting stance');
});

test('an expired stance is gone; stance lists before Evade', () => {
  assert.equal(activeCombatStance({ combatOwnerCycle: 2, combatStance: { maneuver: 'defend', expiresOnOwnerCycle: 2 } }), null);
  assert.equal(combatStanceRow({}), null);
  const rows = combatTacticsRows({ combatOwnerCycle: 1, combatStance: { maneuver: 'defend', camp: 'physical', reach: 'contact' }, combatEvade: evade({ charges: 1, expiresOnOwnerCycle: 2 }) });
  assert.deepEqual(rows.map(row => row.id), ['combat-stance', 'combat-evade']);
});
