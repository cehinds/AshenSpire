import test from 'node:test';
import assert from 'node:assert/strict';
import { pickMapNode, projectMapContext } from '../src/ui/models/MapSelectionModel.js';

const reachable = new Set(['f1c0', 'f1c2']);
const at = (now) => ({ now, repeatDelayMs: 150 }); // = w4b-map.json behavior.repeatPickDelayMs

test('a first pick selects; picking the selected node again enters', () => {
  const first = pickMapNode({}, 'f1c0', reachable, at(0));
  assert.deepEqual({ ...first }, { selectedId: 'f1c0', selectedAt: 0, enter: false });
  const switched = pickMapNode(first, 'f1c2', reachable, at(100));
  assert.deepEqual({ ...switched }, { selectedId: 'f1c2', selectedAt: 100, enter: false });
  const again = pickMapNode(switched, 'f1c2', reachable, at(600));
  assert.deepEqual({ ...again }, { selectedId: 'f1c2', selectedAt: 100, enter: true });
});

test('a repeat pick under 150 ms (touch bounce) does not travel; a natural double tap at 200 ms does', () => {
  const first = pickMapNode({}, 'f1c0', reachable, at(1000));
  const bounce = pickMapNode(first, 'f1c0', reachable, at(1100));
  assert.deepEqual({ ...bounce }, { selectedId: 'f1c0', selectedAt: 1000, enter: false });
  const natural = pickMapNode(first, 'f1c0', reachable, at(1200));
  assert.deepEqual({ ...natural }, { selectedId: 'f1c0', selectedAt: 1000, enter: true });
});

test('an unreachable node never becomes the selection or enters', () => {
  const state = pickMapNode({}, 'f1c0', reachable, at(0));
  const refused = pickMapNode(state, 'f5c1', reachable, at(900));
  assert.deepEqual({ ...refused }, { selectedId: 'f1c0', selectedAt: 0, enter: false });
  assert.equal(pickMapNode({}, 'f5c1', reachable).selectedId, null);
});

test('context reads the shown kind, not the hidden one, with boss destination and key reveal', () => {
  const kinds = { monster: { name: 'Monster', blurb: 'A fight.' }, event: { name: 'Unknown', blurb: 'Anything.' }, boss: { name: 'Boss', blurb: 'The act boss.' } };
  const fogged = projectMapContext({ node: { type: 'monster', floor: 3 }, reading: { shownType: 'event' }, reachable: true }, kinds);
  assert.deepEqual([fogged.kindName, fogged.blurb, fogged.floor, fogged.canEnter], ['Unknown', 'Anything.', 3, true]);
  const boss = projectMapContext({ node: { type: 'boss', floor: 15, destinationLabel: 'The Stitched King' }, reading: { shownType: 'boss', revealed: true }, reachable: false }, kinds);
  assert.deepEqual([boss.destination, boss.revealed, boss.canEnter], ['The Stitched King', true, false]);
  assert.deepEqual({ ...projectMapContext({}, kinds) }, { empty: true, canEnter: false });
  // No reading: the hidden kind does not leak.
  assert.equal(projectMapContext({ node: { type: 'elite', floor: 4 } }, kinds).kindName, 'Unknown');
});
