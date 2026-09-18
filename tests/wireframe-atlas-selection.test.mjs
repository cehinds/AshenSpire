import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasEnterKind, pickAtlasNode, projectAtlasContext } from '../src/ui/models/AtlasSelectionModel.js';

const known = new Set(['crownfall', 'ashen-gate', 'old-mill', 'far-tower']);
const reachable = new Set(['ashen-gate', 'old-mill']);
const sets = { known, reachable, currentId: 'crownfall' };

test('Enter travels an open road, opens the current place, and is refused elsewhere', () => {
  assert.equal(atlasEnterKind('ashen-gate', sets), 'travel');
  assert.equal(atlasEnterKind('crownfall', sets), 'open');
  assert.equal(atlasEnterKind('far-tower', sets), null);
  assert.equal(atlasEnterKind(null, sets), null);
});

test('a first tap selects; tapping the selected place again enters it', () => {
  const first = pickAtlasNode({ selectedId: 'crownfall' }, 'ashen-gate', sets);
  assert.deepEqual({ ...first }, { selectedId: 'ashen-gate', action: null });
  const switched = pickAtlasNode(first, 'old-mill', sets);
  assert.deepEqual({ ...switched }, { selectedId: 'old-mill', action: null });
  assert.deepEqual({ ...pickAtlasNode(switched, 'old-mill', sets) }, { selectedId: 'old-mill', action: 'enter' });
  assert.deepEqual({ ...pickAtlasNode({ selectedId: 'crownfall' }, 'crownfall', sets) }, { selectedId: 'crownfall', action: 'enter' });
});

test('a known place without a road can be read but not entered; undiscovered places are ignored', () => {
  const far = pickAtlasNode({ selectedId: 'crownfall' }, 'far-tower', sets);
  assert.deepEqual({ ...far }, { selectedId: 'far-tower', action: null });
  assert.deepEqual({ ...pickAtlasNode(far, 'far-tower', sets) }, { selectedId: 'far-tower', action: 'inspect' });
  assert.deepEqual({ ...pickAtlasNode(far, 'hidden-keep', sets) }, { selectedId: 'far-tower', action: null });
  assert.equal(pickAtlasNode({}, 'hidden-keep', sets).selectedId, null);
});

test('context names the place and whether a road, your position, or nothing lets you enter', () => {
  const place = (id) => ({ id, name: id.toUpperCase(), regionName: 'Ashen Crown', description: 'A place.' });
  const road = projectAtlasContext({ place: place('ashen-gate'), ...sets });
  assert.deepEqual([road.name, road.regionName, road.status, road.enter, road.canEnter], ['ASHEN-GATE', 'Ashen Crown', 'road', 'travel', true]);
  const here = projectAtlasContext({ place: place('crownfall'), ...sets });
  assert.deepEqual([here.status, here.enter, here.canEnter], ['here', 'open', true]);
  const far = projectAtlasContext({ place: place('far-tower'), ...sets });
  assert.deepEqual([far.status, far.enter, far.canEnter], ['far', null, false]);
  assert.deepEqual({ ...projectAtlasContext({}) }, { empty: true, canEnter: false, enter: null });
  assert.ok(Object.isFrozen(road));
});
