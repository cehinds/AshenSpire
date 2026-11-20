// tests/settings-retired-rows.test.mjs — the rows Core 2 could not reach are gone (owner,
// 2026-11-20). Each value they gave is authored content now, so play is unchanged; an old
// stored or imported key is cleared or skipped, never refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { balance } from '../src/content/balance.js';
import { deckRules } from '../src/content/deckRules.js';
import { VICTORY_XP_DEFAULTS } from '../src/model/victoryXpPresentation.js';
import { parseAdvancedConfigFile, ADVANCED_CONFIG_SCHEMA_VERSION, RetiredPlainSettingKeys, isRetiredLegacySettingKey, retiredStoredSettingKeys } from '../src/model/advancedConfig.js';
import { settingsRows } from '../src/ui/screens/settings.js';

test('no retired key has a settings row', () => {
  const keys = new Set(settingsRows().map((row) => row.key));
  for (const key of RetiredPlainSettingKeys) assert.ok(!keys.has(key), key);
});

test('a stored retired key is cleared at boot; live keys stay', () => {
  const stored = Object.fromEntries(RetiredPlainSettingKeys.map((key) => [key, true]));
  Object.assign(stored, { playInDeckOrder: true, creationAutoAdvance: true, 'settings.shopSell': false });
  const gone = retiredStoredSettingKeys(stored).sort();
  assert.deepEqual(gone, [...RetiredPlainSettingKeys, 'settings.shopSell'].sort());
  assert.equal(isRetiredLegacySettingKey('playInDeckOrder'), false);
  assert.equal(isRetiredLegacySettingKey('creationAutoAdvance'), false);
});

test('an old export carrying every retired key imports, skipping them with a warning', () => {
  const overrides = Object.fromEntries(RetiredPlainSettingKeys.map((key) => [`settings.${key}`, 1]));
  overrides['settings.playInDeckOrder'] = true;
  const text = JSON.stringify({ game: 'Ashen Spire', schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION, overrides });
  const warnings = [];
  const changes = parseAdvancedConfigFile(text, contentBundle, {}, settingsRows(), warnings, { dropRetiredLegacy: true });
  assert.deepEqual(changes, { playInDeckOrder: true });
  assert.ok(warnings.length >= 1, 'the skip is named');
});

test('each removed row\'s value is authored content, at the default the row had', () => {
  assert.equal(balance.shop.sellBack, true, 'Merchant buys back');
  assert.equal(balance.rest.multiUseShrines, true, 'Multi-use Shrines');
  assert.equal(balance.levelUp.offerStatPoints, true, 'Level Up · Stat points');
  assert.equal(balance.levelUp.offerBonusCard, false, 'Level Up · Bonus card');
  assert.equal(balance.levelUp.pointsPerLevel, 1, 'Level-up value');
  assert.ok(balance.equipment.swapCostRules.some((rule) => rule.id === balance.equipment.swapCostRule), 'Weapon swap cost');
  assert.deepEqual({ ...deckRules.defaults }, { deckEditing: true, deckEditingWhere: 'free', deckMinSize: 10, deckMinUnlimited: false,
    deckMaxSize: 40, deckMaxUnlimited: true, playInDeckOrder: false, classSpellPowerCopies: 1 });
  assert.deepEqual({ seconds: VICTORY_XP_DEFAULTS.seconds, pauseMs: VICTORY_XP_DEFAULTS.pauseMs, readySeconds: VICTORY_XP_DEFAULTS.readySeconds,
    formulaTerms: VICTORY_XP_DEFAULTS.formulaTerms, visibleRows: VICTORY_XP_DEFAULTS.visibleRows },
  { seconds: 1, pauseMs: 80, readySeconds: 0.5, formulaTerms: 5, visibleRows: 4 });
});

test('Auto-advance character creation is a Developer row', () => {
  assert.equal(settingsRows().find((row) => row.key === 'creationAutoAdvance')?.advancedGroup, 'Developer');
});

test('every Advanced row is filed under a tab that exists; none points at a removed one', async () => {
  const { ADVANCED_GROUP_IDS } = await import('../src/ui/screens/settings.js');
  const { advancedSection } = await import('../src/ui/models/AdvancedSettingsGroups.js');
  const removed = ['Progression', 'Rewards', 'Equipment', 'World', 'Wireframes'];
  for (const row of settingsRows().filter((entry) => entry.cat === 'Advanced')) {
    assert.ok(!removed.includes(row.advancedGroup), `${row.key} still names the removed ${row.advancedGroup} tab`);
    if (!row.retired && !row.modal) assert.ok(ADVANCED_GROUP_IDS.includes(advancedSection(row)), `${row.key} is filed under a real tab`);
  }
});

test('the grace refill rows are retired: a stored count is cleared, the authored table applies', async () => {
  const { resolveGraceRefill } = await import('../src/ui/screens/settings.js');
  const { graceRefillTable } = await import('../src/model/gracerefill.js');
  for (const key of ['graceRefill.hp', 'settings.graceRefill.mana']) assert.equal(isRetiredLegacySettingKey(key), true, key);
  assert.ok(!settingsRows().some((row) => String(row.key).startsWith('graceRefill.')), 'no grace refill row is left');
  const authored = Object.fromEntries(graceRefillTable(balance).map((row) => [row.kind, row.count]));
  assert.deepEqual(resolveGraceRefill(), { counts: authored, bad: [] });
});
