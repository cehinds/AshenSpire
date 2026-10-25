import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { readNewGameProfile, resolveNewGameProfile } from '../src/ui/components/gameProfileSelector.js';
import { allResettableKeys, resetKeys, generalGroups } from '../src/ui/screens/settings.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { validateResolvedGameProfile, gameDigest, dataClone } from '../engine/kernel/gameConfig.js';

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

test('a Rest-first author fails at resolve time once the Core bundle sets firstFloor', () => {
  const restFirst = { formatVersion: 1, core: 'ashen.core@1.0.0', modules: { routes: { restFloors: [1, 6] } } };
  assert.throws(() => resolveGameProfile(restFirst), e => e.path === '$/modules/routes/firstFloor' && /firstFloor/.test(e.message));
  const fallback = resolveGameProfile('core');
  assert.equal(readNewGameProfile({ newGameProfile: JSON.stringify(restFirst) }, fallback), fallback, 'a stored Rest-first author falls back instead of crashing New Game');
  const explicit = { ...restFirst, modules: { routes: { restFloors: [1, 6], firstFloor: null } } };
  assert.doesNotThrow(() => resolveGameProfile(explicit), 'the Rest-first route stays authorable by clearing firstFloor');
});

test('a stored snapshot with an old Rest-first preset is refused when loaded', () => {
  const core = dataClone(resolveGameProfile('core'));
  delete core.hash;
  core.modules.routes.restFloors = [1, 9];
  core.modules.routes.restsPerAct = 2;
  core.content.routes.restsPerAct = 2;
  core.modules.routes.firstFloor = 'fight';
  core.content.routes.restFloors = [1, 9];
  const snapshot = { ...core, hash: gameDigest(core) };
  assert.throws(() => validateResolvedGameProfile(snapshot), e => e.path === '$/modules/routes/firstFloor' && /firstFloor/.test(e.message));
  const cleared = dataClone(core);
  cleared.modules.routes.firstFloor = null;
  assert.doesNotThrow(() => validateResolvedGameProfile({ ...cleared, hash: gameDigest(cleared) }), 'clearing firstFloor keeps the Rest-first snapshot valid');
});

for (const reset of ['all', 'group']) test(`${reset} reset clears both future-game preferences durably`, () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const meta = saves.loadMeta();
  meta.settings = { newGameProfile: JSON.stringify(author), importedGameProfile: JSON.stringify(author), musicVolume: 0.2 };
  assert.equal(saves.saveMeta(meta).ok, true);
  const keys = reset === 'all' ? allResettableKeys() : [...generalGroups('Game rules').values()].flat().map(row => row.key);
  const snapshot = resetKeys(meta.settings, changes => {
    Object.assign(meta.settings, changes);
    return saves.saveMeta(meta);
  }, keys, 'Rules reset', { promoted: {} });
  const reloaded = createSaveManager(storage).loadMeta().settings;
  assert.equal(reloaded.newGameProfile, undefined);
  assert.equal(reloaded.importedGameProfile, undefined);
  assert.equal(readNewGameProfile(reloaded).hash, resolveGameProfile('default').hash);
  assert.equal(snapshot.newGameProfile, JSON.stringify(author));
  assert.equal(snapshot.importedGameProfile, JSON.stringify(author));
  if (reset === 'group') assert.equal(reloaded.musicVolume, 0.2);
});
