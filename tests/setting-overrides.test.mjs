// tests/setting-overrides.test.mjs — a specific value wins over a global one,
// by a switch, and a row that does nothing right now is disabled.
//
// Owner, 2026-09-23: "changes to specific stats should over write global stats
// with … a toggle to over write global per stat … Disable fields if toggle
// isn't on". (The every-stat "points per increase" switch this file also
// covered left with the tier dial itself — ruleset 6, #1253.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { advancedConfigRows, configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile, isRetiredLegacySettingKey } from '../src/model/advancedConfig.js';
import { resolveEquipmentRequirements } from '../src/model/startingStatConfig.js';
import { validateContent } from '../src/model/validate.js';
import { categoryHandler, closedGate, gateSentence, settingsRow, settingsRows } from '../src/ui/screens/settings.js';

const OWN_REQUIREMENT = 'gameConfig.own.equipmentRequirements.greatsword.strength';
const rows = categoryHandler('Advanced').rows;
const row = (key) => rows.find((candidate) => candidate.key === key) || settingsRow(key);

test('every new switch is a known key, so a configuration file carrying them imports', () => {
  const file = { [OWN_REQUIREMENT]: true, 'gameConfig.own.balance.rewards.rarityWeightsByClass.herald': false };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(file), contentBundle), file);
  assert.ok(advancedConfigRows(contentBundle).some((candidate) => candidate.key === OWN_REQUIREMENT));
});

test('an item switched on with nothing typed uses its authored requirement, as the row shows', () => {
  const key = 'gameConfig.equipmentRequirements.greatsword.strength';
  const own = `gameConfig.own.${key.slice('gameConfig.'.length)}`;
  const scaled = { 'gameConfig.equipmentRequirements.scale': 0.5 };
  const minimum = (settings) => (resolveEquipmentRequirements(contentBundle, settings) || contentBundle.equipment.equipmentRequirements)
    .find((candidate) => candidate.itemId === 'greatsword' && candidate.attributeId === 'strength').minimum;
  assert.equal(minimum(scaled), 2, 'off: authored 3 × 0.5, rounded');
  assert.equal(minimum({ ...scaled, [own]: true }), 3, 'on, untouched: the authored 3 the enabled row shows');
  assert.equal(minimum({ ...scaled, [own]: true, [key]: 4 }), 4);
});

// Codex, on #1260: rows disabled while ratings are off cannot be corrected,
// so their values are not judged until ratings come back on.
test('invalid rating values are not judged while ratings are off', async () => {
  const { advancedConfigStructuralProblems } = await import('../src/model/advancedConfig.js');
  const broken = { 'gameConfig.combatRatings.impact.lightMaxWeight': 100, 'gameConfig.combatRatings.impact.mediumMaxWeight': 50 };
  assert.ok(advancedConfigStructuralProblems(contentBundle, broken).length > 0, 'with ratings on, the pair is refused');
  assert.deepEqual(advancedConfigStructuralProblems(contentBundle, { ...broken, 'gameConfig.combatRatings.enabled': false }), [],
    'with ratings off, the dormant pair refuses nothing');
});

// Owner, 2026-11-05: the Battlefield settings are retired, so there are no formation movement rows
// left to gate; movementEnabled and its siblings are retired stored keys.
test('no formation movement rows remain, and movementEnabled is a retired key', () => {
  const keys = settingsRows().map((r) => r.key);
  assert.deepEqual(keys.filter((k) => /presentation\.(movement|tileActivation|moveActivation|selectionColor)/.test(k)), []);
  for (const leaf of ['movementEnabled', 'movementNeedsSelection', 'movementCostsAction', 'tileActivation', 'moveActivation']) {
    assert.equal(isRetiredLegacySettingKey(`gameConfig.presentation.${leaf}`), true, leaf);
  }
});

// Codex, on #1260: the mirror of the dormant-ratings case. With ratings on,
// the older poise rows are disabled, so a stored value there — even one
// validation refuses — is not applied and cannot discard the configuration.
test('a value whose feature is switched off is not applied or judged', () => {
  const stored = { 'gameConfig.balance.stagger.player.statuses.weak': 0, 'gameConfig.balance.rewards.cardChoices': 4 };
  const ratingsOn = configuredContentBundle(contentBundle, stored);
  assert.equal(validateContent(ratingsOn).ok, true, 'ratings on: the dormant 0 is not in the bundle');
  assert.equal(ratingsOn.balance.stagger.player.statuses.weak, contentBundle.balance.stagger.player.statuses.weak);
  assert.equal(ratingsOn.balance.rewards.cardChoices, 4, 'and unrelated tuning is kept');
  const ratingsOff = configuredContentBundle(contentBundle, { ...stored, 'gameConfig.combatRatings.enabled': false });
  assert.equal(ratingsOff.balance.stagger.player.statuses.weak, 0, 'ratings off: the row is live and its value applies');
});

// Review of #1260: a run saved before combat ratings existed is played with
// ratings off, so its poise and stagger tuning is in force and must be applied,
// even though its stored settings do not say ratings are off.
test('a snapshot from before ratings keeps its poise and stagger tuning', () => {
  const overrides = { 'gameConfig.balance.stagger.player.statuses.weak': 3, 'gameConfig.derivedStatRules.rules.poise.base': 7 };
  const legacy = configuredContentBundle(contentBundle, { schemaVersion: 1, overrides });
  assert.equal(legacy.balance.combatRatings.enabled, false);
  assert.equal(legacy.balance.stagger.player.statuses.weak, 3);
  assert.equal(legacy.derivedStatRules.rules.poise.base, 7);
  const current = configuredContentBundle(contentBundle, { schemaVersion: 1, ratingsVersion: 1, overrides });
  assert.equal(current.balance.combatRatings.enabled, true);
  assert.equal(current.balance.stagger.player.statuses.weak, contentBundle.balance.stagger.player.statuses.weak, 'ratings on: set aside');
});
