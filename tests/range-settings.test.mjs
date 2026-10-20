import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeSettingsRows } from '../src/ui/models/RangeSettingsModel.js';
import { settingsRows, generalGroups, settingsRowHtml, resolveNumberRow, resetKeys, rowModified, categoryHtml, settingsSearchHits } from '../src/ui/screens/settings.js';
import { settingsRowAvailable } from '../src/ui/models/SettingsCapabilitiesModel.js';
import { RANGE_SETTING_KEYS, snapshotRangePolicy } from '../src/model/combatEngagement.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { readNewGameProfile } from '../src/ui/components/gameProfileSelector.js';
import { createRunState } from '../src/model/state.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { profileKeys } from '../src/model/settingsSync.js';
import { advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

const keys = Object.values(RANGE_SETTING_KEYS), rows = rangeSettingsRows();
const authored = { version: 1, enabled: false, advanceSpPerBand: 0, reachPrecisionBonus: 4, throwPrecisionPenalty: 2 };

test('range descriptors use canonical keys and authored defaults including explicit zero', () => {
  assert.deepEqual(rows.map(row => row.key), keys);
  assert.deepEqual(rows.map(row => row.def), [true, 1, 1, 1]);
  assert.deepEqual(rangeSettingsRows(authored).map(row => row.def), [false, 0, 4, 2]);
  for (const row of rows) {
    assert.match(row.note, /Applies to new runs; saved runs retain their rules/);
    assert.equal(settingsRows().filter(r => r.key === row.key).length, 1);
    if (row.type === 'number') {
      assert.deepEqual([row.min, row.max, row.step, row.integer], [0, Number.MAX_SAFE_INTEGER, 1, true]);
      assert.equal(resolveNumberRow({ [row.key]: 0 }, row), 0);
      assert.equal(resolveNumberRow({ [row.key]: Number.MAX_SAFE_INTEGER }, row), Number.MAX_SAFE_INTEGER);
      assert.equal(resolveNumberRow({ [row.key]: -1 }, row), 0);
    }
  }
});

test('Range is one visible Core-only Combat topic with honest on/off and zero controls', () => {
  const core = resolveGameProfile('core'), current = resolveGameProfile('current');
  assert.deepEqual(generalGroups('Combat', core).get('Range').map(row => row.key), keys);
  assert.equal(generalGroups('Combat', current).has('Range'), false);
  for (const row of rows) {
    assert.equal(settingsRowAvailable(row, core), true);
    assert.equal(settingsRowAvailable(row, current), false);
  }
  const toggle = rows[0];
  assert.match(settingsRowHtml({}, toggle), /aria-checked="true"/);
  assert.match(settingsRowHtml({ rangeMechanics: false }, toggle), /aria-checked="false"/);
  for (const row of rows.slice(1)) assert.match(settingsRowHtml({ [row.key]: 0 }, row), /class="set-num"[^>]*value="0"[^>]*min="0"/);
});

test('range choices persist/export/import unchanged and reset through the normal settings door', () => {
  const settings = Object.fromEntries(rows.map(row => [row.key, row.type === 'number' ? 0 : false]));
  assert.ok(keys.every(key => profileKeys(settingsRows()).includes(key)));
  const saves = createSaveManager(createMemoryStorage()), meta = saves.loadMeta();
  meta.settings = settings;
  assert.equal(saves.saveMeta(meta).ok, true);
  assert.deepEqual(Object.fromEntries(keys.map(key => [key, saves.loadMeta().settings[key]])), settings);
  const text = advancedConfigExport(settings, {}, keys);
  assert.deepEqual(parseAdvancedConfigFile(text, contentBundle, {}, rows), settings);
  for (const bad of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = advancedConfigExport({ rangeAdvanceSpPerBand: bad }, {}, keys);
    assert.throws(() => parseAdvancedConfigFile(invalid, contentBundle, {}, rows), /Invalid/);
  }
  resetKeys(settings, changes => Object.assign(settings, changes), keys, 'Range reset', { promoted: {} });
  assert.ok(keys.every(key => settings[key] === undefined));
});

test('settings produce a new policy snapshot without altering a policy already in use', () => {
  const settings = { rangeMechanics: true, rangeAdvanceSpPerBand: 0, rangeReachPrecisionBonus: 0, rangeThrowPrecisionPenalty: 0 };
  const first = snapshotRangePolicy(authored, settings), saved = structuredClone(first);
  settings.rangeMechanics = false;
  settings.rangeAdvanceSpPerBand = 3;
  const next = snapshotRangePolicy(authored, settings);
  assert.deepEqual(first, saved);
  assert.deepEqual(first, { version: 1, enabled: true, advanceSpPerBand: 0, reachPrecisionBonus: 0, throwPrecisionPenalty: 0 });
  assert.equal(next.enabled, false);
  assert.equal(next.advanceSpPerBand, 3);
  assert.equal(snapshotRangePolicy(authored).enabled, false);
});


test('an imported Core author supplies unset controls and the next real run snapshot', () => {
  const profile = structuredClone(resolveGameProfile('core'));
  profile.fixCoreRules = { ...fixCoreMechanics, range: authored };
  delete profile.hash;
  profile.hash = gameDigest(profile);
  const settings = { newGameProfile: JSON.stringify(profile) };
  assert.match(settingsRowHtml(settings, rows[0]), /aria-checked="false"/);
  assert.deepEqual(rows.slice(1).map(row => resolveNumberRow(settings, row)), [0, 4, 2]);
  assert.equal(rowModified({ ...settings, rangeReachPrecisionBonus: 4 }, rows[2], {}), false);
  assert.equal(rowModified({ ...settings, rangeReachPrecisionBonus: 0 }, rows[2], {}), true);
  const selected = readNewGameProfile(settings);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, selected)), selected);
  const run = createRunState({ seed: 1, classId: 'reaver', registries, profileMeta: { settings } });
  assert.deepEqual(run.rangePolicy, authored);
  settings.rangeMechanics = true;
  settings.rangeAdvanceSpPerBand = 0;
  settings.rangeReachPrecisionBonus = 0;
  settings.rangeThrowPrecisionPenalty = 0;
  const next = createRunState({ seed: 2, classId: 'reaver', registries, profileMeta: { settings } });
  assert.deepEqual(next.rangePolicy, { version: 1, enabled: true, advanceSpPerBand: 0, reachPrecisionBonus: 0, throwPrecisionPenalty: 0 });
  assert.deepEqual(run.rangePolicy, authored, 'an active run keeps its snapshot');
  delete settings.newGameProfile;
  assert.deepEqual(rows.slice(1).map(row => row.defaultFor(settings)), [1, 1, 1], 'changing author invalidates the panel default cache');
});


test('future-run Range controls follow the selected author while other capabilities follow the active run', () => {
  const core = resolveGameProfile('core'), legacy = resolveGameProfile('current');
  const settings = { newGameProfile: 'core', settingsGeneralCategory: 'Combat', 'settingsGeneralTopic.Combat': 'Range' };
  assert.ok(rows.every(row => settingsRowAvailable(row, legacy, core)));
  assert.ok(rows.every(row => !settingsRowAvailable(row, core, legacy)));
  const ordinary = settingsRows().find(row => row.key === 'askToUpcastAfterTarget');
  assert.equal(settingsRowAvailable(ordinary, legacy, core), true);
  assert.equal(settingsRowAvailable(ordinary, core, legacy), false);
  assert.deepEqual(generalGroups('Combat', legacy, core).get('Range').map(row => row.key), keys);
  const html = categoryHtml('General', settings, null, null, null, null, '', false, legacy, core);
  assert.ok(keys.every(key => html.includes(`data-key="${key}"`)));
  assert.ok(settingsSearchHits('Range mechanics', true, settings, { profile: legacy, nextProfile: core }).some(hit => hit.row.key === 'rangeMechanics'));
  settings.newGameProfile = 'current';
  assert.ok(!settingsSearchHits('Range mechanics', true, settings, { profile: core, nextProfile: legacy }).some(hit => hit.row.key === 'rangeMechanics'));
  assert.doesNotMatch(categoryHtml('General', settings, null, null, null, null, '', false, core, legacy), /data-key="rangeMechanics"/);
});
