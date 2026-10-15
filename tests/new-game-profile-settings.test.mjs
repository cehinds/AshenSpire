import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { readNewGameProfile, resolveNewGameProfile } from '../src/ui/components/gameProfileSelector.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';

const author = { formatVersion: 1, core: 'ashen.core@1.0.0', modules: { routes: { prebossNodes: 5, restFloors: [2, 4] } } };

test('new-game rule preferences persist author JSON and resolve after reload', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const meta = saves.loadMeta();
  const text = JSON.stringify(author);
  resolveNewGameProfile(text);
  meta.settings = { newGameProfile: text, importedGameProfile: text };
  assert.equal(saves.saveMeta(meta).ok, true);
  const reloaded = createSaveManager(storage).loadMeta().settings;
  assert.equal(reloaded.newGameProfile, text);
  assert.equal(JSON.parse(reloaded.newGameProfile).runtimeHash, undefined);
  assert.equal(readNewGameProfile(reloaded).hash, resolveGameProfile(author).hash);
  reloaded.newGameProfile = 'current';
  assert.equal(readNewGameProfile(reloaded).id, 'current');
  assert.equal(reloaded.importedGameProfile, text, 'the imported author survives choosing a built-in');
});

test('invalid imported rules are rejected and stale preferences fall back safely', () => {
  assert.throws(() => resolveNewGameProfile('{'), SyntaxError);
  assert.throws(() => resolveNewGameProfile(JSON.stringify({ ...author, modules: { unknown: true } })));
  const fallback = resolveGameProfile('core');
  assert.equal(readNewGameProfile({ newGameProfile: '{' }, fallback), fallback);
  assert.equal(readNewGameProfile({}, fallback), fallback);
});
