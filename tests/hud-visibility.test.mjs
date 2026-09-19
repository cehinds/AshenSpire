import test from 'node:test';
import assert from 'node:assert/strict';
import { HUD_VISIBILITY_SETTINGS, resolveHudVisibility, applyHudVisibility } from '../src/ui/models/HudVisibilityModel.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { settingsRow, settingsRowHtml } from '../src/ui/screens/settings.js';

test('HUD defaults and malformed values preserve the existing visible layout', () => {
  const defaults = resolveHudVisibility();
  assert.equal(Object.keys(defaults).length, 5);
  assert.ok(Object.values(defaults).every(value => value === true));
  for (const value of [null, 0, 'false', {}, undefined]) {
    assert.deepEqual(resolveHudVisibility(Object.fromEntries(HUD_VISIBILITY_SETTINGS.map(row => [row.key, value]))), defaults);
  }
  assert.ok(!HUD_VISIBILITY_SETTINGS.some(row => /menu|armoury/i.test(row.key)));
});

test('HUD choices survive profile storage and apply reversible attributes', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const meta = saves.loadMeta();
  meta.settings = Object.fromEntries(HUD_VISIBILITY_SETTINGS.map(row => [row.key, false]));
  assert.notEqual(saves.saveMeta(meta)?.ok, false);
  const restored = createSaveManager(storage).loadMeta().settings;
  const root = { dataset: {} };
  applyHudVisibility(root, restored);
  assert.ok(HUD_VISIBILITY_SETTINGS.every(row => root.dataset[row.key] === 'false'));
  applyHudVisibility(root, {});
  assert.ok(HUD_VISIBILITY_SETTINGS.every(row => root.dataset[row.key] === 'true'));
});

test('each HUD preference has a working Display toggle', () => {
  for (const expected of HUD_VISIBILITY_SETTINGS) {
    const row = settingsRow(expected.key);
    assert.equal(row.cat, 'Display');
    assert.equal(row.def, true);
    const rendered = settingsRowHtml({ [row.key]: false }, row);
    assert.ok(rendered.includes(expected.label));
    assert.ok(rendered.includes(expected.key));
  }
});
