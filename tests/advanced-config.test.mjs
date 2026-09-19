import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import {
  advancedConfigRows,
  advancedConfigProblems,
  advancedConfigSnapshot,
  advancedConfigExport,
  configuredContentBundle,
  presentationConfig,
  saveAdvancedConfigFile,
} from '../src/model/advancedConfig.js';

test('advanced configuration inventory is complete, grouped, and uniquely keyed', () => {
  const rows = advancedConfigRows(contentBundle);
  assert(rows.length > 250);
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
  for (const classDef of contentBundle.classes) {
    for (const attribute of contentBundle.attributes) {
      assert(rows.some((row) => row.key.endsWith(`.${classDef.id}.${attribute.id}`)));
    }
  }
  assert(rows.some((row) => row.key === 'gameConfig.progression.levelCostMultiplier'));
  assert(rows.some((row) => row.key === 'gameConfig.presentation.playerSpriteScale'));
});

test('configured bundle overlays starting stats and progression without mutating authored content', () => {
  const configured = configuredContentBundle(contentBundle, {
    'gameConfig.attributeRules.presets.tuned.reaver.strength': 15,
    'gameConfig.attributeRules.presets.tuned.reaver.dexterity': 9,
    'gameConfig.balance.levelUp.firstCost': 60,
    'gameConfig.progression.levelCostMultiplier': 2,
    'gameConfig.progression.rewardMultiplier': 0.5,
    'gameConfig.derivedStatRules.defaults.pointsPerTier': 3,
  });
  assert.equal(configured.attributeRules.presets.tuned.reaver.strength, 15);
  assert.equal(contentBundle.attributeRules.presets.tuned.reaver.strength, 13);
  assert.equal(configured.balance.levelUp.firstCost, 120);
  assert.equal(configured.balance.rewards.cinders.normal[0], Math.round(contentBundle.balance.rewards.cinders.normal[0] * 0.5));
  assert.equal(configured.derivedStatRules.defaults.pointsPerTier, 3);
});

test('an incomplete class-stat edit is named and keeps the last valid authored preset active', () => {
  const settings = { 'gameConfig.attributeRules.presets.tuned.reaver.strength': 15 };
  assert.match(advancedConfigProblems(contentBundle, settings)[0], /Reaver.*total 55/);
  const configured = configuredContentBundle(contentBundle, settings);
  assert.deepEqual(configured.attributeRules.presets.tuned.reaver, contentBundle.attributeRules.presets.tuned.reaver);
});

test('snapshot and export contain only versioned game-config overrides in deterministic order', () => {
  const settings = {
    volume: 20,
    'gameConfig.presentation.enemySpriteScale': 1.2,
    'gameConfig.balance.startingCinders': 99,
  };
  const snapshot = advancedConfigSnapshot(settings);
  assert.deepEqual(Object.keys(snapshot.overrides), [
    'gameConfig.balance.startingCinders',
    'gameConfig.presentation.enemySpriteScale',
  ]);
  const exported = JSON.parse(advancedConfigExport({ ...settings, cardMotif: 'band' }, { contentVersion: 'test' }, ['cardMotif']));
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.game, 'Ashen Spire');
  assert.equal(exported.overrides['settings.cardMotif'], 'band');
  const { ['settings.cardMotif']: ignored, ...runtimeOverrides } = exported.overrides;
  assert.deepEqual(runtimeOverrides, snapshot.overrides);
});

test('presentation config clamps numbers and refuses unknown rows', () => {
  const config = presentationConfig({
    'gameConfig.presentation.playerSpriteScale': 8,
    'gameConfig.presentation.enemySpawnRow': 'back',
    'gameConfig.presentation.playerSpawnRow': 'sideways',
  });
  assert.equal(config.playerSpriteScale, 2);
  assert.equal(config.enemySpawnRow, 'back');
  assert.equal(config.playerSpawnRow, 'middle');
});

test('desktop export uses Save As and writes the deterministic JSON', async () => {
  let written = '';
  const result = await saveAdvancedConfigFile({ 'gameConfig.balance.startingCinders': 7 }, {
    window: {
      showSaveFilePicker: async () => ({
        createWritable: async () => ({ write: async (value) => { written = value; }, close: async () => {} }),
      }),
    },
    document: {},
  });
  assert.equal(result.method, 'save-as');
  assert.equal(JSON.parse(written).overrides['gameConfig.balance.startingCinders'], 7);
});

test('mobile and unsupported desktop export fall back to a local browser download', async () => {
  let clicked = false;
  let revoked = false;
  const anchor = { hidden: false, click: () => { clicked = true; }, remove: () => {} };
  const result = await saveAdvancedConfigFile({}, {
    window: {
      URL: { createObjectURL: () => 'blob:config', revokeObjectURL: () => { revoked = true; } },
      setTimeout: (callback) => callback(),
    },
    document: { createElement: () => anchor, body: { appendChild: () => {} } },
  });
  assert.equal(result.method, 'download');
  assert.equal(anchor.download, 'ashen-spire-game-config.json');
  assert(clicked);
  assert(revoked);
});
