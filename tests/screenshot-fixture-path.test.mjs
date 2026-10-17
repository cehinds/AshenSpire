import test from 'node:test';
import assert from 'node:assert/strict';
import { screenshotRoutePath } from '../src/ui/models/ScreenshotFixtureModel.js';

test('screenshot route poses follow a connected branch instead of visiting every lane', () => {
  const graph = { startIds: ['a', 'b'], nodes: {
    a: { floor: 1, next: ['c'] }, b: { floor: 1, next: ['d'] },
    c: { floor: 2, next: ['e'] }, d: { floor: 2, next: ['f'] },
    e: { floor: 3, next: [] }, f: { floor: 3, next: [] },
  } };
  for (const target of Object.keys(graph.nodes)) {
    const path = screenshotRoutePath(graph, target);
    assert.equal(path.length, graph.nodes[target].floor);
    assert.equal(path.at(-1), target);
    for (let at = 1; at < path.length; at++) assert.ok(graph.nodes[path[at - 1]].next.includes(path[at]));
  }
  assert.deepEqual(screenshotRoutePath(graph, 'f'), ['b', 'd', 'f']);
  assert.throws(() => screenshotRoutePath(graph, 'missing'), /not reachable/);
});
