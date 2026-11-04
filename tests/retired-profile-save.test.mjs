// A run pinned to a retired profile (legacy `current`, Core 1) or to none is refused on load and its
// saved bytes are never touched; a Core 2 run still loads. Owner decision 2026-11-04.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, serializeRun } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage, runKey } from '../src/engine/save.js';

function registriesFor(id) {
  const profile = resolveGameProfile(id);
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
}
function stored(id) {
  const registries = registriesFor(id);
  return { registries, json: serializeRun(createRunState({ registries, seed: 7, classId: 'reaver' })) };
}
function refuseCase(json, registries) {
  const storage = createMemoryStorage();
  storage.setItem(runKey(1), json);
  const saves = createSaveManager(storage);
  assert.equal(saves.loadRun(registries, 1), null);
  assert.equal(saves.runStatus().state, 'profile-mismatch');
  assert.match(saves.runStatus().reason, /^retired game mode/);
  assert.equal(storage.getItem(runKey(1)), json, 'the saved bytes are untouched');
  assert.equal(saves.listArchives?.().length ?? 0, 0, 'nothing was archived');
}

test('a save pinned to the legacy current profile is refused and kept', () => {
  const { registries, json } = stored('current');
  refuseCase(json, registries);
});
test('a Core 1 save is refused and kept', () => {
  const { registries, json } = stored('ashen.core@1.0.0');
  refuseCase(json, registries);
});
test('peekRunGameProfile of a profile-less save is null, which main.js refuses as retired', () => {
  const { registries, json } = stored('core');
  const bare = JSON.parse(json); delete bare.gameProfile; delete bare.gameProfileRef;
  const storage = createMemoryStorage(); const text = JSON.stringify(bare);
  storage.setItem(runKey(1), text);
  assert.equal(createSaveManager(storage).peekRunGameProfile(1), null);
  assert.equal(storage.getItem(runKey(1)), text);
});
test('a Core 2 save still loads', () => {
  const { registries, json } = stored('core');
  const storage = createMemoryStorage(); storage.setItem(runKey(1), json);
  const saves = createSaveManager(storage);
  assert.ok(saves.loadRun(registries, 1));
});
