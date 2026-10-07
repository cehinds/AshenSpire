import test from 'node:test';
import assert from 'node:assert/strict';
import { needsSettingsChoice, keepLocalSettings, seedSettingsDefaults, SEED_KEY, commitSettingsChoice } from '../src/model/settingsDefaults.js';
import { allResettableKeys, resetKeys, settingsRows } from '../src/ui/screens/settings.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

const rows = [{ key: 'musicVolume', type: 'range', def: 0.35 }, { key: 'reduceFlashes', type: 'toggle', def: false }];

test('fresh profiles and navigation state do not ask; real preferences ask once per build', () => {
  assert.equal(needsSettingsChoice({}, '905', rows), false);
  assert.equal(needsSettingsChoice({ settings: { settingsCategory: 'Advanced', prologueSeen: true } }, '905', rows), false);
  const meta = { settings: { reduceFlashes: true }, settingsChoiceBuild: '904' };
  assert.equal(needsSettingsChoice(meta, '905', rows), true);
  assert.equal(needsSettingsChoice({ ...meta, settingsChoiceBuild: '905' }, '905', rows), false);
  assert.equal(needsSettingsChoice({ settings: { musicVolume: 0.7 } }, '905', rows, { musicVolume: 0.7 }), false);
  assert.equal(needsSettingsChoice({ settings: { reduceFlashes: true } }, '905', settingsRows()), true, 'implicit toggle rows count too');
});

test('keeping local preserves old promoted values across later boots while filling missing defaults', () => {
  const settings = { musicVolume: 0.2, reduceFlashes: true, [SEED_KEY]: { musicVolume: 0.2 } };
  const defaults = { values: { musicVolume: 0.6, animSpeed: 'auto' } };
  const changes = keepLocalSettings(settings, defaults);
  const kept = { ...settings, ...changes };
  assert.equal(kept.musicVolume, 0.2);
  assert.equal(kept.reduceFlashes, true);
  assert.equal(kept.animSpeed, 'auto');
  assert.equal(Object.hasOwn(kept[SEED_KEY], 'musicVolume'), false);
  assert.deepEqual(seedSettingsDefaults(kept, defaults), {});
});

test('default reset and build acknowledgement round-trip without changing profile progress', () => {
  const saves = createSaveManager(createMemoryStorage());
  const meta = saves.loadMeta();
  meta.results = [{ result: 'victory', seed: 'keep' }];
  meta.settings = { reduceFlashes: true, musicVolume: 0.1 };
  assert.equal(saves.saveMeta(meta).ok, true);
  resetKeys(meta.settings, changed => {
    Object.assign(meta.settings, changed);
    return saves.saveMeta(meta);
  }, allResettableKeys(), undefined, { promoted: { musicVolume: 0.35 } });
  meta.settingsChoiceBuild = '905';
  assert.equal(saves.saveMeta(meta).ok, true);
  const reloaded = saves.loadMeta();
  assert.equal(reloaded.settingsChoiceBuild, '905');
  assert.deepEqual(reloaded.results, meta.results);
  assert.equal(reloaded.settings.musicVolume, 0.35);
  assert.equal(reloaded.settings.reduceFlashes, undefined);
  assert.equal(needsSettingsChoice(reloaded, '905', settingsRows()), false);
});

test('a refused or throwing settings/acknowledgement write restores preferences and leaves the choice pending', () => {
  for (const failure of ['apply-false', 'apply-throw', 'ack-false', 'ack-throw']) {
    const original = { settings: { reduceFlashes: true, [SEED_KEY]: { musicVolume: 0.2 } }, results: ['retained'], settingsChoiceBuild: '904' };
    let stored = structuredClone(original);
    let live = structuredClone(original);
    const result = commitSettingsChoice(original, '905', {
      apply: () => {
        live.settings.reduceFlashes = false;
        stored = structuredClone(live);
        if (failure === 'apply-throw') throw new Error('quota');
        return { ok: failure !== 'apply-false' };
      },
      load: () => stored,
      save: meta => {
        if (meta.settingsChoiceBuild === '905') {
          if (failure === 'ack-throw') throw new Error('security');
          if (failure === 'ack-false') return { ok: false };
        }
        stored = structuredClone(meta);
        return { ok: true };
      },
      restore: meta => { live = meta; },
    });
    assert.equal(result.ok, false, failure);
    assert.deepEqual(stored, original, failure);
    assert.deepEqual(live, original, failure);
    assert.equal(needsSettingsChoice(stored, '905', rows), true, failure);
  }
});
