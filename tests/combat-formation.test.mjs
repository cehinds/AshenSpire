import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation, COMBAT_LAYOUT } from '../src/ui/models/CombatFormationModel.js';
const ids = n => Array.from({ length: n }, (_, i) => `e${i}`);
test('single and roomy enemy groups stay right aligned in one row', () => {
  for (const count of [1, 3, 6]) {
    const p = combatFormation({ width: 1440, height: 405, friends: ['p'], enemies: ids(count) });
    assert.ok(p.slots.slice(1).every(s => s.row === 0 && s.x > 1440 * .4));
    assert.ok(p.slots.at(-1).x > 1440 * .85);
  }
});
test('shared space is allocated by crowding, with grounded shallow overflow', () => {
  for (const width of [320, 390, 794, 1440]) for (const allies of [1, 2, 3]) {
    const p = combatFormation({ width, height: 380, friends: ids(allies).map(x => 'p' + x), enemies: ids(6) });
    assert.ok(p.friendlyWidth + p.enemyWidth <= width + .01);
    assert.ok(p.slots.every(s => s.x - s.width / 2 >= 0 && s.x + s.width / 2 <= width));
    assert.ok(p.slots.every(s => s.ground >= 380 * .4 && s.ground <= p.ground));
    assert.ok(p.slots.every(s => s.depth === (s.row ? .8 : 1)));
    assert.ok(p.ground - Math.min(...p.slots.map(s => s.ground)) <= 50);
  }
});
test('layout budgets sum to viewport and allocation ignores transient states', () => {
  assert.equal(COMBAT_LAYOUT.hud + COMBAT_LAYOUT.field + COMBAT_LAYOUT.hand + COMBAT_LAYOUT.controls, 100);
  const input = { width: 794, height: 402, friends: ['p'], enemies: ids(4) };
  assert.deepEqual(combatFormation(input), combatFormation({ ...input, phase: 'enemy', defeated: ['e1'] }));
});
