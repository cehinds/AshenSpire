// Hands carry one weapon set (equipSlots.csv, 2026-11-01). A save written when
// they carried three keeps every piece: later-set armaments move to storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { trimExtraSets, visibleSets } from '../src/model/loadout.js';

const registries = createRegistries(contentBundle);
const hands = () => registries.equipment.slots.filter((slot) => slot.hand);

test('both hand slots ship with exactly one set and no rack rungs', () => {
  assert.equal(hands().length, 2);
  for (const slot of hands()) {
    assert.equal(slot.sets, 1, `${slot.id} sets`);
    assert.equal(visibleSets(registries, slot, { meta: { unlocked: ['rack2Right', 'rack3Left'] } }), 1);
  }
  assert.equal((registries.unlocks || []).filter((row) => row.kind === 'slot').length, 0);
});

test('a save holding armaments in hand set 2 and 3 loads, and those pieces are in storage', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const run = createRunState({ seed: 0x51a7, classId: 'reaver', registries });
  saves.saveRun(run, createRng(7));
  const armaments = registries.equipment.armaments.map((piece) => piece.id);
  const [a, b, c] = armaments.filter((id) => !run.loadout.sets.rightHand.includes(id) && !run.loadout.sets.leftHand.includes(id));
  const stored = JSON.parse(storage.getItem(RUN_KEY));
  const runJson = stored.run ?? stored;
  runJson.loadout.sets.rightHand = [runJson.loadout.sets.rightHand[0], a, null];
  runJson.loadout.sets.leftHand = [runJson.loadout.sets.leftHand[0], null, b];
  runJson.loadout.active = { ...runJson.loadout.active, rightHand: 1, leftHand: 2 };
  runJson.loadout.storage = [c];
  storage.setItem(RUN_KEY, JSON.stringify(stored));
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, 'the save still loads');
  assert.equal(loaded.loadout.sets.rightHand.length, 1);
  assert.equal(loaded.loadout.sets.leftHand.length, 1);
  assert.deepEqual(loaded.loadout.active.rightHand, 0);
  assert.deepEqual(loaded.loadout.active.leftHand, 0);
  for (const id of [a, b, c]) assert.ok(loaded.loadout.storage.includes(id), `${id} kept in storage`);
  assert.equal(new Set(loaded.loadout.storage).size, loaded.loadout.storage.length, 'no duplicates');
});

test('trimExtraSets is a no-op on a current loadout and never duplicates a stored piece', () => {
  const loadout = { sets: { rightHand: ['x'], leftHand: [null] }, active: { rightHand: 0, leftHand: 0 }, storage: [] };
  assert.deepEqual(trimExtraSets(registries, loadout), []);
  const old = { sets: { rightHand: ['x', 'y', 'z'] }, active: { rightHand: 2 }, storage: ['y'] };
  trimExtraSets(registries, old);
  assert.deepEqual(old.sets.rightHand, ['x']);
  assert.deepEqual(old.storage.sort(), ['y', 'z']);
  assert.equal(old.active.rightHand, 0);
});
