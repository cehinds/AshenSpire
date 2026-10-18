import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileWardBlock } from '../src/model/blockPresentation.js';
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

test('playback shows the prepared Evade, not the foundation Evade, as a combat Evade row', () => {
  const combat = { eventLog: [], player: { id: 'player', combatEvade: evade({ charges: 1 }) }, enemies: [] };
  const disp = { logLength: 0, ents: { player: { id: 'player', combatOwnerCycle: 1 } } };
  // Exercise the screen's actual beat reducer without mounting its DOM.
  const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const start = screen.indexOf('  function applyBeatToDisp(beat) {');
  const end = screen.indexOf('  // ---------- rendering ----------', start);
  const applyBeat = new Function('disp', 'combat', 'getEntity', 'reconcileWardBlock', `${screen.slice(start, end)}; return applyBeatToDisp;`)(disp, combat,
    (c, id) => id === 'player' ? c.player : c.enemies.find(e => e.id === id), reconcileWardBlock);
  applyBeat({ events: [{ type: 'evadeGained', sourceId: 'player', charges: 2 }] });
  assert.equal(disp.ents.player.combatEvade, undefined, 'the foundation Evade (combatRules.js) adds no prepared-Evade row');
  applyBeat({ events: [{ type: 'evadeGained', sourceId: 'player', charges: 1, combatEvade: true }] });
  assert.equal(disp.ents.player.combatEvade.charges, 1);
  assert.deepEqual(combatTacticsRows(disp.ents.player).map(row => row.id), ['combat-evade']);
});
