import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContentValidationCache } from '../src/model/contentValidationCache.js';

// Exercise the actual browser orchestrator function headlessly. Its screen
// callbacks stay outside this slice; the projection and mutable registry seams
// are observable without importing main.js's DOM bootstrap.
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const cacheStart = main.indexOf('const cachedContentValidation =');
const start = cacheStart < 0 ? main.indexOf('function rebuildRegistries(') : cacheStart;
const end = main.indexOf('\n}\n\n// Dev screenshot hook', start) + 2;
assert.ok(start >= 0 && end > start, 'production rebuild function is present');
const production = main.slice(start, end);
function fixture({ warm = true, authored = { amount: 5 } } = {}) {
  const calls = { validate: 0, mastery: 0, warnings: [], reported: [], options: [] };
  const contentBundle = authored;
  const deps = {
    createContentValidationCache, contentBundle,
    applyGameProfileToContent: (bundle, profile) => ({ ...bundle, profile: structuredClone(profile), ...(profile.invalid ? { invalid: true } : {}) }),
    isConfiguredRun: profile => profile.mode === 'configured',
    configuredContentBundle: (bundle, configuration) => ({ ...bundle, ...configuration }),
    validateContent: (bundle, options) => { calls.validate++; calls.options.push(options); return { ok: !bundle.invalid, errors: bundle.invalid ? [{ path: 'amount', msg: 'invalid amount' }] : [] }; },
    advancedConfigStructuralProblems: (bundle, configuration) => configuration.structural ? ['invalid structure'] : [],
    createRegistries: bundle => ({ rows: structuredClone(bundle), mutable: new Map(), classes: { all: () => [] } }),
    bindGameProfileRegistries: (registry, profile) => ({ ...registry, profile }),
    registriesForClassMastery: (registry, run) => { calls.mastery++; return { ...registry, mastery: run?.mastery ?? 0 }; },
    configureTooltipGlossary: () => {}, setClassGlyphs: () => {},
    reportContentValidationFailure: errors => calls.reported.push(errors),
    console: { warn: (...args) => calls.warnings.push(args) }
  };
  const create = new Function(...Object.keys(deps), `let registryGameProfile; let registries; ${production}; return rebuildRegistries;`);
  const rebuild = create(...Object.values(deps));
  if (warm) { // spend one build so each test starts from a warm cache
    rebuild({ warm: true }, null, { id: 'warm', mode: 'legacy' });
    for (const key of ['validate', 'mastery']) calls[key] = 0;
    calls.warnings.length = calls.reported.length = calls.options.length = 0;
  }
  return { rebuild, calls };
}

test('actual rebuild reuses validation and registries for an unchanged profile and settings, and recomputes mastery', () => {
  const { rebuild, calls } = fixture(), profile = { id: 'current', mode: 'legacy', hash: 'sha256:a', lock: { runtime: 'a' } };
  const first = rebuild({ amount: 7 }, { mastery: 1 }, profile);
  const second = rebuild({ amount: 7 }, { mastery: 2 }, structuredClone(profile));
  assert.equal(calls.validate, 1); assert.equal(calls.mastery, 2);
  assert.equal(second.rows.amount, 7); assert.equal(second.mastery, 2); assert.equal(first.mastery, 1);
  assert.equal(second.mutable, first.mutable, 'the unchanged build is reused, not rebuilt');
  rebuild({ amount: 8 }, null, profile); assert.equal(calls.validate, 2);
  const changed = rebuild({ amount: 8 }, null, { ...profile, hash: 'sha256:b', lock: { runtime: 'b' } });
  assert.equal(calls.validate, 3); assert.notEqual(changed.mutable, second.mutable);
});

test('a settings change that alters nothing in the key still rebuilds when any setting differs', () => {
  const { rebuild } = fixture(), profile = { id: 'current', mode: 'legacy' };
  const a = rebuild({ amount: 7, other: 1 }, null, profile);
  assert.notEqual(rebuild({ amount: 7, other: 2 }, null, profile).mutable, a.mutable);
  assert.notEqual(rebuild({ amount: 7, other: 2 }, null, { id: 'other', mode: 'legacy' }).mutable, a.mutable);
});

test('the first build of a configured profile validates synchronously, reports and refuses invalid content', () => {
  const { rebuild, calls } = fixture({ warm: false });
  const profile = { id: 'core', mode: 'configured', invalid: true };
  assert.throws(() => rebuild({}, null, profile), /Invalid game profile core/);
  assert.equal(calls.validate, 1);
  assert.deepEqual(calls.options, [undefined], 'boot validates whole, class mastery included');
  assert.equal(calls.reported.length, 1); assert.equal(calls.reported[0][0].path, 'amount');
  const ok = fixture({ warm: false });
  ok.rebuild({}, null, { id: 'core', mode: 'configured' });
  assert.equal(ok.calls.validate, 1); assert.equal(ok.calls.reported.length, 0);
});

test('the first build of saved legacy settings validates whole, so a failure still falls back', () => {
  const { rebuild, calls } = fixture({ warm: false });
  const fallback = rebuild({ invalid: true }, null, { id: 'current', mode: 'legacy' });
  assert.equal(fallback.rows.invalid, undefined);
  assert.deepEqual(calls.options, [undefined, undefined], 'the settings build, then the authored fallback, validate whole');
  assert.equal(calls.reported.length, 0, 'valid authored content raises no banner: the settings were at fault');
});

test('a legacy fallback onto broken authored content raises the content banner', () => {
  const { rebuild, calls } = fixture({ warm: false, authored: { amount: 5, invalid: true } });
  rebuild({}, null, { id: 'current', mode: 'legacy' });
  assert.equal(calls.reported.length, 1, 'the authored bundle failed, not the settings: say so loudly');
  assert.equal(calls.reported[0][0].path, 'amount');
});

test('actual invalid legacy configurations keep loud defaults fallback on each attempt', () => {
  const { rebuild, calls } = fixture(), profile = { id: 'current', mode: 'legacy' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const fallback = rebuild({ invalid: true }, null, profile);
    assert.equal(fallback.rows.amount, 5); assert.equal(fallback.rows.invalid, undefined);
  }
  assert.equal(calls.validate, 4, 'each attempt validates the settings and the authored fallback'); assert.equal(calls.warnings.length, 2);
  assert.match(calls.warnings[0].join(' '), /configuration unchanged/i);
  rebuild({ structural: true }, null, profile);
  assert.equal(calls.warnings.length, 3);
});

test('actual invalid configured profiles still throw loudly and are revalidated', () => {
  const { rebuild, calls } = fixture();
  const profile = { id: 'core', mode: 'configured', invalid: true };
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.throws(() => rebuild({}, null, profile), /Invalid game profile core: amount: invalid amount/);
  }
  assert.equal(calls.validate, 2); assert.equal(calls.warnings.length, 2);
});
