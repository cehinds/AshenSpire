import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStatus } from '../src/engine/statuses.js';
import { statuses } from '../src/content/statuses.js';
import { combatStatusRules } from '../src/content/combatStatusRules.js';

function setup(definitions = statuses) {
  const events = [];
  const target = { id: 'recipient', kind: 'player', alive: true, statuses: {} };
  const ctx = { registries: { statuses: new Map(definitions.map(row => [row.id, row])) },
    emit: (type, payload) => events.push({ type, ...payload }), enqueue() {} };
  return { ctx, target, events };
}

for (const [mode, requests, totals] of [
  ['add', [3, 2], [3, 5]],
  ['refresh', [3, 2, 5], [3, 3, 5]],
  ['unique', [3, 2], [1, 1]],
]) test(`${mode} receipts retain requested stacks and expose actual before/after totals`, () => {
  const { ctx, target, events } = setup([{ id: 'testBuff', stackMode: mode, decay: { duration: 2 } }]);
  for (const amount of requests) applyStatus(ctx, target, 'testBuff', amount);
  assert.deepEqual(events.map(e => e.stacks), requests, 'the established receipt field keeps its semantics');
  assert.deepEqual(events.map(e => e.total), totals);
  assert.deepEqual(events.map(e => e.previousTotal), [0, ...totals.slice(0, -1)]);
  assert.equal(target.statuses.testBuff.duration, 2, 'duration refresh is unchanged');
});

test('foundation capped grants expose only the remaining gain, then zero gain', () => {
  const { ctx, target, events } = setup([{ id: 'capped', stackMode: 'add', decay: 'none', stacking: { mode: 'add', cap: 5 } }]);
  ctx.foundation = true;
  for (const amount of [3, 10, 10]) applyStatus(ctx, target, 'capped', amount);
  assert.deepEqual(events.map(e => [e.stacks, e.previousTotal, e.total]), [[3, 0, 3], [10, 3, 5], [10, 5, 5]]);
  assert.equal(target.statuses.capped.stacks, 5);
});

test('expansion active receipts retain capped added stacks and omit full-cap reapplications', () => {
  const { ctx, target, events } = setup();
  ctx.combatExpansionVersion = 2;
  ctx.combatStatusRules = combatStatusRules;
  applyStatus(ctx, target, 'sleep', 2);
  applyStatus(ctx, target, 'sleep', 99);
  applyStatus(ctx, target, 'sleep', 99);
  assert.deepEqual(events.filter(e => e.type === 'statusApplied').map(e => [e.stacks, e.previousTotal, e.total]), [[2, 0, 2], [1, 2, 3]]);
  assert.equal(target.statuses.sleep.stacks, 3);
});
