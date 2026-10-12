// tests/ward-resist-log.test.mjs — Ward resistance and Ward loss in the combat log,
// and the Ward overlay that fires when Ward absorbs a magical hit.
//
//   node --test tests/ward-resist-log.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatLogEntries } from '../src/model/combatLog.js';
import { combatEffectForEvent } from '../src/model/combatEffectEvents.js';

const registries = {
  cards: new Map(),
  statuses: new Map(),
  enemies: new Map([['soldier', { name: 'Soldier' }]]),
};
const opts = { registries, players: [{ id: 'player', name: 'Ash' }], enemies: [{ id: 'e1', enemyId: 'soldier' }] };

const lines = (event) => combatLogEntries([event], opts).map(row => row.text);
const hit = (fields) => ({ type: 'damageDealt', sourceId: 'player', targetId: 'e1', ...fields });

test('damage that reaches HP lists blocked and Ward together', () => {
  assert.deepEqual(lines(hit({ amount: 7, blocked: 3, wardResisted: 4 })),
    ['Ash dealt 4 damage to Soldier (3 blocked, 4 resisted by Ward).']);
});

test('damage that reaches HP with only Ward lists the Ward share', () => {
  assert.deepEqual(lines(hit({ amount: 5, blocked: 0, wardResisted: 4 })),
    ['Ash dealt 5 damage to Soldier (4 resisted by Ward).']);
});

test('damage that reaches HP with only guard keeps the old parenthetical', () => {
  assert.deepEqual(lines(hit({ amount: 5, blocked: 2 })),
    ['Ash dealt 3 damage to Soldier (2 blocked).']);
});

test('a hit fully absorbed by guard and Ward names both', () => {
  assert.deepEqual(lines(hit({ amount: 0, blocked: 2, wardResisted: 3 })),
    ['Soldier blocked 2 damage and Ward resisted 3.']);
});

test('a hit fully absorbed by Ward alone names the Ward', () => {
  assert.deepEqual(lines(hit({ amount: 0, blocked: 0, wardResisted: 3 })),
    ["Soldier's Ward resisted 3 damage."]);
});

test('a hit with nothing absorbed keeps the old resisted line', () => {
  assert.deepEqual(lines(hit({ amount: 0, blocked: 0 })), ['Soldier resisted the attack.']);
});

test('Ward losing HP logs the drop and the new pool', () => {
  assert.deepEqual(lines({ type: 'persistentWardChanged', targetId: 'e1', spent: 2, value: 3, max: 5 }),
    ["Soldier's Ward fell by 2 (3/5)."]);
});

test('a Ward restoration adds no Ward-fell line', () => {
  assert.deepEqual(lines({ type: 'persistentWardChanged', targetId: 'e1', spent: 0, restored: 2, value: 5, max: 5 }), []);
});

test('stripping Ward is logged with its source', () => {
  assert.deepEqual(lines({ type: 'combatWardStripped', sourceId: 'player', targetId: 'e1', amount: 4 }),
    ['Ash stripped 4 Ward from Soldier.']);
});

test('a Ward-absorbed hit with no HP loss shows the Ward overlay', () => {
  assert.deepEqual(combatEffectForEvent({ type: 'damageDealt', targetId: 'e1', amount: 0, blocked: 0, wardResisted: 3 }),
    { kind: 'arcaneWard', targetId: 'e1' });
});

test('a blocked hit still returns the old guard overlay', () => {
  assert.deepEqual(combatEffectForEvent({ type: 'damageDealt', targetId: 'e1', amount: 0, blocked: 2, wardResisted: 3 }),
    { kind: 'physicalGuard', targetId: 'e1' });
});
