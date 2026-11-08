// Cleanup row 3e: the legacy Advanced groups (Progression, Combat, Stats, Recovery, Rewards, Shops,
// Equipment, World, Deck minus playInDeckOrder) are retired. A file exported before then still
// imports: their keys are skipped with one named warning, and Core 2's keys still apply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { parseAdvancedConfigFile, ADVANCED_CONFIG_SCHEMA_VERSION, RETIRED_LEGACY_GROUPS_WARNING, isRetiredLegacySettingKey } from '../src/model/advancedConfig.js';
import { settingsRows } from '../src/ui/screens/settings.js';
import { profileChanges, profileText } from '../src/model/settingsSync.js';

const OLD_EXPORT = {
  game: 'Ashen Spire',
  schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION,
  overrides: {
    'gameConfig.balance.combatRounds.maxRounds': 12,
    'gameConfig.startingStats.pool': 40,
    'gameConfig.shops.market.markup': 2,
    'settings.gameConfig.handRules.starting.base': 7,
    'gameConfig.removedLongAgo.someRow': 3,
    'recovery.hp.perTurn': 2,
    'settings.levelUpValue': 4,
    'settings.deckEditing': true,
    'settings.playInDeckOrder': true,
    'gameConfig.presentation.movementEnabled': true,
    'settings.gameConfig.presentation.rowBScale': 2,
    'gameConfig.presentation.settingsWidthPercent': 90,
  },
};

test('an old export with retired legacy keys imports with one warning and still applies Core 2 keys', () => {
  const warnings = [];
  const changes = parseAdvancedConfigFile(JSON.stringify(OLD_EXPORT), contentBundle, {}, settingsRows(), warnings, { dropRetiredLegacy: true });
  assert.deepEqual(warnings.filter((w) => w === RETIRED_LEGACY_GROUPS_WARNING), [RETIRED_LEGACY_GROUPS_WARNING]);
  assert.equal(changes.playInDeckOrder, true);
  assert.equal(changes['gameConfig.presentation.settingsWidthPercent'], 90, 'the Settings panel size is still a setting');
  assert.ok(!('gameConfig.presentation.movementEnabled' in changes), 'a battlefield key loads without it');
  assert.ok(!Object.keys(changes).some((key) => /presentation\.(rowBScale|movementEnabled)/.test(key)));
  for (const key of Object.keys(changes)) assert.doesNotMatch(key, /^(settings\.)?gameConfig\.(?!prologue\.|presentation\.settings(Width|Height)Percent$)|^recovery\./);
  assert.equal(changes.deckEditing, true, 'live plain-key settings still apply');
});

test('a stored battlefield key is cleared by a profile load and counts as retired', () => {
  const rows = settingsRows();
  const keys = rows.map((row) => row.key);
  const stored = { 'gameConfig.presentation.formationRows': 3, 'settings.gameConfig.presentation.enemySpriteScale': 1.5, 'gameConfig.presentation.settingsWidthPercent': 90 };
  const result = profileChanges(profileText({}, keys), contentBundle, stored, rows, keys);
  assert.ok(result.cleared.includes('gameConfig.presentation.formationRows'));
  assert.ok(result.cleared.includes('settings.gameConfig.presentation.enemySpriteScale'));
  for (const key of Object.keys(stored)) assert.equal(isRetiredLegacySettingKey(key), key !== 'gameConfig.presentation.settingsWidthPercent', key);
});

test('without the retirement option an unknown legacy key is still refused', () => {
  assert.throws(() => parseAdvancedConfigFile(JSON.stringify(OLD_EXPORT), contentBundle, {}, settingsRows()), /Unknown setting/);
});

test('a sync profile carrying retired legacy keys loads with the warning', () => {
  const result = profileChanges(JSON.stringify(OLD_EXPORT), contentBundle, {}, settingsRows(), settingsRows().map((row) => row.key));
  assert.ok(result.warnings.includes(RETIRED_LEGACY_GROUPS_WARNING));
  assert.equal(result.changes.playInDeckOrder, true);
});

test('live non-gameConfig settings round-trip through a sync profile with no retired warning', () => {
  const rows = settingsRows();
  const keys = rows.map((row) => row.key);
  const settings = { victoryReceiptSeconds: 5, rewardLevelCards: true, deckEditing: true, levelUpValue: 4 };
  const text = profileText(settings, keys);
  const result = profileChanges(text, contentBundle, settings, rows, keys);
  for (const [key, value] of Object.entries(settings)) assert.equal(result.changes[key], value, `${key} is kept`);
  assert.deepEqual(result.cleared, []);
  assert.ok(!result.warnings.includes(RETIRED_LEGACY_GROUPS_WARNING), 'a current-build file carries no retired warning');
  const warnings = [];
  const changes = parseAdvancedConfigFile(text, contentBundle, {}, rows, warnings, { dropRetiredLegacy: true });
  assert.equal(changes.deckEditing, true);
  assert.deepEqual(warnings.filter((w) => w === RETIRED_LEGACY_GROUPS_WARNING), []);
});

test('loading a profile clears a stored retired recovery key, which has no row to own it', () => {
  const rows = settingsRows();
  const keys = rows.map((row) => row.key);
  const stored = { 'recovery.hp.afterCombat': 50, reduceFlashes: true };
  const result = profileChanges(profileText({}, keys), contentBundle, stored, rows, keys);
  assert.ok(result.cleared.includes('recovery.hp.afterCombat'));
});

test('the combat-tools grid key stays a live setting, not a retired one; formationGroups is retired', () => {
  assert.equal(isRetiredLegacySettingKey('gameConfig.presentation.showFormationGrid'), false);
  assert.equal(isRetiredLegacySettingKey('settings.gameConfig.presentation.showFormationGrid'), false);
  assert.equal(isRetiredLegacySettingKey('gameConfig.presentation.formationGroups'), true);
});

test('a stored battlefield key never drives combat, and the boot cleanup list names it', async () => {
  const { presentationConfig, retiredStoredSettingKeys } = await import('../src/model/advancedConfig.js');
  const base = presentationConfig({});
  const stored = {
    'gameConfig.presentation.rowAScale': 1.5, 'gameConfig.presentation.enemySpriteScale': 1.5, 'gameConfig.presentation.rowBScale': 2,
    'gameConfig.presentation.movementEnabled': true, 'gameConfig.presentation.formationGroups': '[]',
    'gameConfig.presentation.settingsWidthPercent': 90, 'gameConfig.presentation.showFormationGrid': true, 'muted': true,
  };
  const config = presentationConfig(stored);
  for (const key of ['rowAScale', 'enemySpriteScale', 'rowBScale', 'movementEnabled', 'formationGroups']) assert.deepEqual(config[key], base[key], key);
  assert.equal(config.settingsWidthPercent, 90);
  assert.equal(config.showFormationGrid, true);
  const gone = retiredStoredSettingKeys(stored);
  assert.deepEqual(gone.sort(), ['gameConfig.presentation.enemySpriteScale', 'gameConfig.presentation.formationGroups', 'gameConfig.presentation.movementEnabled', 'gameConfig.presentation.rowAScale', 'gameConfig.presentation.rowBScale']);
});

test('an old export carrying the retired Level Up feat and class-upgrade rows still imports, dropping only those keys', () => {
  const old = JSON.stringify({ game: 'Ashen Spire', schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION,
    overrides: { 'settings.rewardLevelFeats': true, 'settings.rewardLevelClassTree': false, 'settings.deckEditing': true } });
  const warnings = [];
  const changes = parseAdvancedConfigFile(old, contentBundle, {}, settingsRows(), warnings, { dropRetiredLegacy: true });
  assert.ok(!('rewardLevelFeats' in changes) && !('rewardLevelClassTree' in changes), 'the retired rows are dropped');
  assert.equal(changes.deckEditing, true, 'live settings in the same file still apply');
  assert.ok(warnings.includes(RETIRED_LEGACY_GROUPS_WARNING) || warnings.length >= 1, 'the drop is named');
});

test('an old export carrying a class book feat chance still imports, dropping only that key', () => {
  const old = JSON.stringify({ game: 'Ashen Spire', schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION,
    overrides: { 'gameConfig.consumables.starseerClassBook.featChance': 5, 'settings.deckEditing': true } });
  const warnings = [];
  const changes = parseAdvancedConfigFile(old, contentBundle, {}, settingsRows(), warnings, { dropRetiredLegacy: true });
  assert.ok(!Object.keys(changes).some((key) => key.includes('featChance')), 'the retired feat chance is dropped');
  assert.equal(changes.deckEditing, true, 'live settings in the same file still apply');
  assert.ok(warnings.length >= 1, 'the drop is named');
});
