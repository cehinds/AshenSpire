import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCardArtStyle, cardArtStyle, resolveCardArtStyle, registerCardArtRefresh } from '../src/ui/cardArtStyle.js';
import { settingsRows, resetKeys } from '../src/ui/screens/settings.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

test('card artwork defaults to Simple and refreshes mounted surfaces only when style changes', () => {
  applyCardArtStyle({});
  assert.equal(resolveCardArtStyle({cardArtStyle:'unknown'}), 'Simple');
  const card = {dataset:{}}, discarded = {dataset:{}};
  let paints = 0;
  registerCardArtRefresh(card, () => { paints++; });
  registerCardArtRefresh(discarded, () => { throw new Error('detached card refreshed'); });
  const root = {querySelectorAll: () => [card]};
  assert.equal(applyCardArtStyle({cardArtStyle:'Legacy'}, root), true);
  assert.equal(cardArtStyle(), 'Legacy');
  assert.equal(applyCardArtStyle({cardArtStyle:'Legacy'}, root), false);
  assert.equal(paints, 1);
  applyCardArtStyle({}, root);
  assert.equal(paints, 2);
});

test('Legacy survives save reload and a settings reset returns to Simple', () => {
  const row = settingsRows().find(row => row.key === 'cardArtStyle');
  assert.deepEqual(row.choices, ['Simple','Legacy']);
  assert.equal(row.def, 'Simple');
  const saves = createSaveManager(createMemoryStorage());
  const meta = saves.loadMeta();
  meta.settings = {cardArtStyle:'Legacy'};
  assert.equal(saves.saveMeta(meta).ok, true);
  assert.equal(resolveCardArtStyle(saves.loadMeta().settings), 'Legacy');
  resetKeys(meta.settings, changes => {
    Object.assign(meta.settings, changes);
    return saves.saveMeta(meta);
  }, ['cardArtStyle'], undefined, {promoted:{}});
  assert.equal(resolveCardArtStyle(saves.loadMeta().settings), 'Simple');
});
