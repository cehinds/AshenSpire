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
function fixture() {
  const calls = { validate: 0, mastery: 0, warnings: [] };
  const contentBundle = { amount: 5 };
  const deps = {
    createContentValidationCache, contentBundle,
    applyGameProfileToContent: (bundle, profile) => ({ ...bundle, profile: structuredClone(profile), ...(profile.invalid ? { invalid: true } : {}) }),
    isConfiguredRun: profile => profile.mode === 'configured',
    configuredContentBundle: (bundle, configuration) => ({ ...bundle, ...configuration }),
    validateContent: bundle => { calls.validate++; return { ok: !bundle.invalid, errors: bundle.invalid ? [{ path: 'amount', msg: 'invalid amount' }] : [] }; },
    advancedConfigStructuralProblems: (bundle, configuration) => configuration.structural ? ['invalid structure'] : [],
    createRegistries: bundle => ({ rows: structuredClone(bundle), mutable: new Map(), classes: { all: () => [] } }),
    bindGameProfileRegistries: (registry, profile) => ({ ...registry, profile }),
    registriesForClassMastery: (registry, run) => { calls.mastery++; return { ...registry, mastery: run?.mastery ?? 0 }; },
    configureTooltipGlossary: () => {}, setClassGlyphs: () => {},
    console: { warn: (...args) => calls.warnings.push(args) }
  };
  const create = new Function(...Object.keys(deps), `let registryGameProfile; let registries; ${production}; return rebuildRegistries;`);
  return { rebuild: create(...Object.values(deps)), calls };
}

test('actual rebuild reuses validation but creates fresh registries and recomputes changed mastery', () => {
  const { rebuild, calls } = fixture(), profile = { id: 'current', mode: 'legacy', lock: { runtime: 'a' } };
  const first = rebuild({ amount: 7 }, { mastery: 1 }, profile);
  first.mutable.set('foreign', true); first.rows.amount = 999;
  const second = rebuild({ amount: 7 }, { mastery: 2 }, structuredClone(profile));
  assert.equal(calls.validate, 1); assert.equal(calls.mastery, 2);
  assert.equal(second.rows.amount, 7); assert.equal(second.mastery, 2);
  assert.equal(second.mutable.has('foreign'), false); assert.notEqual(second.mutable, first.mutable);
  rebuild({ amount: 8 }, null, profile); assert.equal(calls.validate, 2);
  rebuild({ amount: 8 }, null, { ...profile, lock: { runtime: 'b' } }); assert.equal(calls.validate, 3);
});

test('actual invalid legacy configurations keep loud defaults fallback on each attempt', () => {
  const { rebuild, calls } = fixture(), profile = { id: 'current', mode: 'legacy' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const fallback = rebuild({ invalid: true }, null, profile);
    assert.equal(fallback.rows.amount, 5); assert.equal(fallback.rows.invalid, undefined);
  }
  assert.equal(calls.validate, 2); assert.equal(calls.warnings.length, 2);
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
