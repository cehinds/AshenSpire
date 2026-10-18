import test from 'node:test';
import assert from 'node:assert/strict';
import { assignCells } from '../src/ui/models/targetCellAssignment.js';

const eligible = (cell, target) => !cell.owners?.length || cell.owners.every(id => id === target.id);
const distance = (target, cell) => (cell.left - target.x) ** 2 + (cell.top - target.y) ** 2;

test('assignCells finds a complete assignment that greedy nearest-first misses', () => {
  // Target a is nearest to cell 0, but cell 0 is b's only eligible cell.
  const targets = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }];
  const cells = [
    { left: 0, top: 0, width: 1, height: 1, owners: ['b'] },
    { left: 10, top: 0, width: 1, height: 1, owners: [] },
  ];
  assert.deepEqual(assignCells(targets, cells, { eligible, distance }), [
    { id: 'a', left: 10, top: 0, width: 1, height: 1, owners: [] },
    { id: 'b', left: 0, top: 0, width: 1, height: 1, owners: ['b'] },
  ]);
});

test('assignCells returns placements in the original target order', () => {
  const targets = [{ id: 'far', x: 100, y: 0 }, { id: 'near', x: 0, y: 0 }];
  const cells = [{ left: 0, top: 0, width: 1, height: 1 }, { left: 100, top: 0, width: 1, height: 1 }];
  assert.deepEqual(assignCells(targets, cells, { eligible, distance }).map(p => p.id), ['far', 'near']);
});

test('assignCells prefers the nearest cell when no conflict forces otherwise', () => {
  const targets = [{ id: 'a', x: 0, y: 0 }];
  const cells = [{ left: 9, top: 0, width: 1, height: 1 }, { left: 2, top: 0, width: 1, height: 1 }];
  assert.equal(assignCells(targets, cells, { eligible, distance })[0].left, 2);
});

test('assignCells returns null when no complete one-to-one assignment exists', () => {
  const targets = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 0 }];
  const cells = [{ left: 0, top: 0, width: 1, height: 1 }];
  assert.equal(assignCells(targets, cells, { eligible, distance }), null);
});

test('assignCells returns null when a target has no eligible cell', () => {
  const targets = [{ id: 'a', x: 0, y: 0 }];
  const cells = [{ left: 0, top: 0, width: 1, height: 1, owners: ['b'] }];
  assert.equal(assignCells(targets, cells, { eligible, distance }), null);
});

test('assignCells gives up with null once the node cap is exceeded', () => {
  // Thirty identical targets over twenty-nine cells: no assignment exists and the
  // search would otherwise explore an enormous tree.
  const targets = Array.from({ length: 30 }, (_, index) => ({ id: index, x: 0, y: 0 }));
  const cells = Array.from({ length: 29 }, (_, index) => ({ left: index, top: 0, width: 1, height: 1 }));
  assert.equal(assignCells(targets, cells, { eligible, distance }), null);
});

test('assignCells with no targets returns an empty assignment', () => {
  assert.deepEqual(assignCells([], [], { eligible, distance }), []);
});
