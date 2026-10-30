// Exercise the real, uninterrupted main.js boot prefix through audio setup.
// Imported services use explicit boundary fixtures; no browser or timings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = relative => readFileSync(new URL('../' + relative, import.meta.url), 'utf8');
const main = read('src/main.js');
const audioLine = 'const audio = initAudio(activeSettings);';
assert.equal(main.split(audioLine).length, 2, 'unique end of boot-registry prefix');
const imports = /^[ \t]*import\s+['"]([^'"]+)['"](?:[ \t]*;)*[ \t]*$|^[ \t]*import\b(?:[\s\S]*?)from\s*['"]([^'"]+)['"](?:[ \t]*;)*[ \t]*$/gm;
const clean = text => text.replace(imports, '').replace(/^export /gm, '');
const prefix = clean(main.slice(0, main.indexOf(audioLine) + audioLine.length));
const plain = value => JSON.parse(JSON.stringify(value));

function boot(options = {}) {
  const events = [], created = [], glossaries = [], glyphs = [], banners = [];
  const context = vm.createContext({ URLSearchParams, structuredClone });
  // Fixture input belongs to the VM realm, like real module-owned objects.
  context.fixtureText = JSON.stringify({
    settings: {}, migrated: {}, promoted: {},
    profiles: {
      default: { id: 'default', hash: 'default', foundation: { mode: 'configured' } },
      core: { id: 'core', hash: 'core', foundation: { mode: 'configured' } },
      legacy: { id: 'legacy', hash: 'legacy', foundation: { mode: 'legacy' } },
    },
    ...options,
  });
  const f = vm.runInContext('JSON.parse(fixtureText)', context);
  let meta = { settings: f.settings };
  const record = (name, value) => { events.push({ name, value }); return value; };
  const storage = { setItem() {}, removeItem() {} };
  const saves = {
    loadMeta: () => record('load-meta', meta),
    saveMeta(value) { meta = value; record('save-meta', value); },
    profileStatus: () => ({ ok: true }),
  };
  const raw = Object.freeze({ kind: 'raw', classes: [{ id: 'raw', glyph: 'raw' }] });
  Object.assign(context, {
    DEBUG_CHROME_READY: true,
    document: { getElementById: () => ({}) },
    location: { search: f.search || '' },
    window: { localStorage: storage }, navigator: { locks: null },
    console: { warn: (...args) => record('warn', args), error: (...args) => record('error', args) },
    surfaceReport: () => [], failureBanner: (...args) => { banners.push(args); record('banner', args); },
    contentBundle: raw,
    resolveGameProfile(value) {
      record('resolve-profile', value);
      const profile = typeof value === 'string' ? f.profiles[value] : value;
      if (!profile?.id) throw new Error('unknown fixture profile');
      return Object.freeze(profile);
    },
    isConfiguredRun: subject => subject?.foundation?.mode === 'configured',
    applyGameProfileToContent(bundle, profile) {
      assert.equal(bundle, raw);
      return record('project-profile', { ...bundle, kind: 'authored', profile: profile.id });
    },
    configuredContentBundle(authored, settings) {
      return record('configure', { ...authored, kind: 'configured', settings: plain(settings) });
    },
    validateContent(bundle) {
      record('validate', bundle);
      const bad = bundle.kind === 'raw' ? f.badRaw : f.badConfigured;
      return { ok: !bad, errors: bad ? [{ path: '$.fixture', msg: 'invalid fixture' }] : [] };
    },
    advancedConfigStructuralProblems: () => record('structural', f.structuralProblem ? ['invalid structure'] : []),
    createRegistries(bundle) {
      const result = { bundle, classes: { all: () => [{ id: bundle.profile || 'raw', glyph: bundle.profile || 'raw' }] } };
      created.push(result); return record('construct', result);
    },
    bindGameProfileRegistries(registry, profile) { return record('bind', { ...registry, gameProfile: profile }); },
    registriesForClassMastery(registry, masteryRun) { return record('mastery', { ...registry, masteryRun }); },
    configureTooltipGlossary(registry) { assert(registry); glossaries.push(registry); record('glossary', registry); },
    setClassGlyphs(classes) { glyphs.push(classes); record('glyphs', classes); },
    createMemoryStorage: () => record('memory-storage', storage),
    createSaveManager: () => record('save-manager', saves),
    createBrowserSaveManager: () => record('browser-save-manager', saves),
    bringProfileForward(value, bundle, save) {
      assert.equal(bundle, raw); Object.assign(value.settings, f.migrated);
      record('migrate', value.settings);
      if (Object.keys(f.migrated).length) save(value);
      return value.settings;
    },
    BUILD_VERSION: 'fixture', SETTINGS_DEFAULTS: { values: f.promoted },
    promotionDebug: () => false, promotionFor: value => value,
    settingsRows: () => record('settings-rows', []),
    needsSettingsChoice: () => !!f.settingsChoicePending,
    seedSettingsDefaults: () => record('seed-defaults', f.promoted),
    showSettingsNotice: (...args) => record('notice', args),
    initAudio(settings) { return record('audio', plain(settings)); },
    migrateEffectsSetting: () => false, // main.js folds the retired Rendering quality into Effects at boot; not under test here
  });
  vm.runInContext(clean(read('src/model/contentValidationCache.js'))
    + '\nglobalThis.createContentValidationCache = createContentValidationCache;', context);
  // Use the actual saved-profile chooser, including invalid-author fallback.
  vm.runInContext(clean(read('src/ui/components/gameProfileSelector.js'))
    + '\nglobalThis.readNewGameProfile = readNewGameProfile;', context);
  if (f.preview) context.__ASHEN_GAME_PROFILE_PREVIEW__ = f.preview;
  let error;
  try {
    vm.runInContext('"use strict";\n' + prefix + '\nglobalThis.bootResult = { registries, selectedGameProfile, activeSettings, settingsChoicePending, rebuildRegistries };', context, { filename: 'actual-main-boot-prefix.js' });
  } catch (caught) { error = caught; }
  return { ...context.bootResult, error, events, created, glossaries, glyphs, banners,
    named: name => events.filter(event => event.name === name),
  };
}

function presentationReady(r) {
  assert.equal(r.error, undefined);
  assert.equal(r.created.length, 1, 'one settings-selected initial construction');
  assert.equal(r.glossaries.length, 1); assert.equal(r.glyphs.length, 1);
  assert.equal(r.glossaries[0], r.registries, 'final bound/mastery registry owns glossary');
  assert.deepEqual(r.glyphs[0], r.registries.classes.all());
  const names = r.events.map(event => event.name);
  for (const prior of ['migrate', 'settings-rows', 'validate'])
    assert(names.indexOf(prior) < names.indexOf('construct'), prior + ' precedes construction');
  assert(names.indexOf('construct') < names.indexOf('bind'));
  assert(names.indexOf('bind') < names.indexOf('glossary'));
  assert(names.indexOf('glossary') < names.indexOf('glyphs'));
  assert(names.indexOf('glyphs') < names.indexOf('audio'));
}

test('default configured boot builds once and registers final vocabulary/glyphs before audio', () => {
  const r = boot(); presentationReady(r);
  assert.equal(r.registries.gameProfile.id, 'default');
  assert.equal(r.named('validate').length, 1);
  assert.equal(r.named('configure').length, 0, 'configured profiles bypass legacy settings projection');
  assert.equal(r.named('mastery').length, 0);
});

test('legacy boot builds once from migrated settings plus promoted defaults, then applies mastery', () => {
  const r = boot({ search: '?gameProfile=legacy', settings: { retained: 7 }, migrated: { migrated: 8 }, promoted: { promoted: 9 } });
  presentationReady(r);
  assert.deepEqual(r.registries.bundle.settings, { retained: 7, migrated: 8, promoted: 9 });
  assert.equal(r.named('structural').length, 1); assert.equal(r.named('mastery').length, 1);
  assert.equal(r.registries.gameProfile.id, 'legacy');
});

test('saved profile is chosen after migration and is the only constructed profile', () => {
  const r = boot({ migrated: { newGameProfile: 'core' } }); presentationReady(r);
  assert.equal(r.registries.gameProfile.id, 'core');
  assert.deepEqual(r.named('project-profile').map(event => event.value.profile), ['core']);
});

test('explicit URL/workbench/preview profiles retain precedence over saved profile', () => {
  for (const explicit of [{ search: '?gameProfile=core' }, { search: '?wb.gameProfile=core' }, { preview: 'core' }]) {
    const r = boot({ ...explicit, settings: { newGameProfile: 'legacy' } }); presentationReady(r);
    assert.equal(r.registries.gameProfile.id, 'core');
    assert.deepEqual(r.named('project-profile').map(event => event.value.profile), ['core']);
  }
});

test('invalid saved author keeps the resolved default without an extra construction', () => {
  const r = boot({ settings: { newGameProfile: 'not-a-profile' } }); presentationReady(r);
  assert.equal(r.registries.gameProfile.id, 'default');
});

for (const invalid of [{ badConfigured: true }, { structuralProblem: true }]) {
  test('invalid legacy configuration retains validated authored fallback: ' + JSON.stringify(invalid), () => {
    const r = boot({ ...invalid, search: '?gameProfile=legacy' }); presentationReady(r);
    assert.equal(r.registries.bundle.kind, 'raw');
    assert.deepEqual(r.named('validate').map(event => event.value.kind), ['configured', 'raw']);
    assert.equal(r.named('notice').length, 1); assert.equal(r.named('warn').length, 1);
  });
}

test('invalid configured profile refuses before construction, glossary, glyphs or audio', () => {
  const r = boot({ badConfigured: true });
  assert.match(r.error?.message || '', /Invalid game profile default/);
  assert.equal(r.created.length, 0); assert.equal(r.glossaries.length, 0); assert.equal(r.glyphs.length, 0);
  assert.equal(r.named('audio').length, 0); assert.equal(r.named('validate').length, 1);
  assert.equal(r.banners[0][0], 'boot:content'); assert.equal(r.named('notice').length, 1);
});

test('invalid authored legacy data keeps its existing loud validation failure', () => {
  const r = boot({ search: '?gameProfile=legacy', badConfigured: true, badRaw: true }); presentationReady(r);
  assert.equal(r.banners[0][0], 'boot:content'); assert.equal(r.registries.bundle.kind, 'raw');
  assert.equal(r.named('validate').length, 2);
});

test('pending settings choice does not apply promoted defaults before the initial build', () => {
  const r = boot({ search: '?gameProfile=legacy', settings: { retained: 7 }, promoted: { retained: 9 }, settingsChoicePending: true });
  presentationReady(r); assert.equal(r.settingsChoicePending, true);
  assert.deepEqual(r.registries.bundle.settings, { retained: 7 });
  assert.equal(r.named('seed-defaults').length, 0);
});

test('later identical rebuild keeps existing cache behavior and refreshes presentation ownership', () => {
  const r = boot(); presentationReady(r);
  const before = r.registries;
  const again = r.rebuildRegistries(r.activeSettings, null, r.selectedGameProfile);
  assert.equal(again, before); assert.equal(r.created.length, 1); assert.equal(r.named('validate').length, 1);
  assert.equal(r.glossaries.at(-1), again); assert.deepEqual(r.glyphs.at(-1), again.classes.all());
});
