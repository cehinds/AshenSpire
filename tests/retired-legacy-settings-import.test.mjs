// Cleanup row 3e: the legacy Advanced groups (Progression, Combat, Stats, Recovery, Rewards, Shops,
// Equipment, World, Deck minus playInDeckOrder) are retired. A file exported before then still
// imports: their keys are skipped with one named warning, and Core 2's keys still apply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { parseAdvancedConfigFile, ADVANCED_CONFIG_SCHEMA_VERSION, RETIRED_LEGACY_GROUPS_WARNING } from '../src/model/advancedConfig.js';
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
  },
};

test('an old export with retired legacy keys imports with one warning and still applies Core 2 keys', () => {
  const warnings = [];
  const changes = parseAdvancedConfigFile(JSON.stringify(OLD_EXPORT), contentBundle, {}, settingsRows(), warnings, { dropRetiredLegacy: true });
  assert.deepEqual(warnings.filter((w) => w === RETIRED_LEGACY_GROUPS_WARNING), [RETIRED_LEGACY_GROUPS_WARNING]);
  assert.equal(changes.playInDeckOrder, true);
  assert.equal(changes['gameConfig.presentation.movementEnabled'], true);
  for (const key of Object.keys(changes)) assert.doesNotMatch(key, /^(settings\.)?gameConfig\.(?!prologue\.|presentation\.)|^recovery\./);
  assert.equal(changes.deckEditing, true, 'live plain-key settings still apply');
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
  const settings = { victoryReceiptSeconds: 5, rewardBattleCards: false, deckEditing: true, levelUpValue: 4 };
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
