import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actRouteModel } from '../src/ui/models/ActRouteModel.js';

const graph = { bossId: 'boss', bossIds: ['boss', 'otherBoss'], nodes: {
  a: { id: 'a', floor: 1, type: 'fight' }, b: { id: 'b', floor: 1, type: 'merchant' },
  c: { id: 'c', floor: 2, type: 'event', resolved: { kind: 'shrine' } },
  d: { id: 'd', floor: 3, type: 'shrine' },
  boss: { id: 'boss', floor: 4, type: 'boss' }, otherBoss: { id: 'otherBoss', floor: 4, type: 'boss' },
} };

test('entrance has one empty slot per non-boss floor, with no future-kind disclosure', () => {
  const route = actRouteModel({ graph });
  assert.deepEqual(route.steps.map(({ floor, type, current }) => [floor, type, current]), [[1, null, false], [2, null, false], [3, null, false]]);
  assert.equal(route.bossVisited, false);
});
test('saved route records the actual branch and resolved encounter, with stable future slots', () => {
  const route = actRouteModel({ graph, path: ['stale', 'b', 'c', 'c'], current: 'c' });
  assert.deepEqual(route.steps.map(({ id, type, current }) => [id, type, current]), [['b', 'merchant', false], ['c', 'shrine', true], [null, null, false]]);
  assert.equal(route.bossVisited, false);
});
test('current node survives a partial legacy path without filling skipped floors', () => {
  const route = actRouteModel({ graph, path: [], current: 'd' });
  assert.deepEqual(route.steps.map((s) => s.type), [null, null, 'shrine']);
  assert.equal(route.steps[2].current, true);
});
test('either boss marks the endpoint without adding a second terminal slot', () => {
  const route = actRouteModel({ graph, path: ['a', 'c', 'd'], current: 'otherBoss' });
  assert.equal(route.steps.length, 3);
  assert.equal(route.bossVisited, true);
  assert.equal(route.steps.some((s) => s.current), false);
});
test('act changes discard old node ids and accept custom floor counts', () => {
  const next = { nodes: { x: { id: 'x', floor: 10, type: 'fight' } } };
  assert.deepEqual(actRouteModel({ graph: next, path: ['a', 'c'], current: 'd' }).steps.map((s) => s.type), [null]);
  assert.deepEqual(actRouteModel().steps, []);
});
