// The memoised statusPresentationDefinition (src/model/statusPresentation.js)
// answers exactly what the uncached sequence answers, and a change to anything
// the answer reads (the rules, the holder's bindings, the id, the definition,
// whether FixCore is on) misses instead of returning an earlier answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { fixCoreStatusDefinition } from '../src/model/fixCoreMechanics.js';
import { statusPresentationDefinition as cached, statusPresentationCacheSize, clearStatusPresentationCache } from '../src/model/statusPresentation.js';

const weak = { id: 'weak', name: 'Weak', tooltip: 'Legacy.', modifiers: { damageDealtMult: .75 } };
const thorn = { id: 'thorn', name: 'Thorn', tooltip: 'Thorny.', modifiers: { damageDealtMult: .75 } };
const evade = { id: 'evade', name: 'Evasion', tooltip: 'Legacy 3 Evasion per stack.', effects: [{ op: 'noop' }] };
const registries = { statuses: { get: id => [weak, evade].find(row => row.id === id), all: () => [weak, evade] } };
const ctxWith = (rules = structuredClone(fixCoreMechanics)) => ({ combatExpansionVersion: 2, fixCoreRules: rules, registries });
// The reference: what the code did before the cache.
const uncached = (ctx, id, definition, holder = null) => {
  const resolved = fixCoreStatusDefinition(ctx, id, definition, holder);
  if (id !== 'evade' || resolved === definition) return resolved;
  const display = text => typeof text === 'string' ? text.replace(/\bfixed Evasion\b/g, 'Evasion') : text;
  return { ...resolved, tooltip: display(resolved.tooltip), description: display(resolved.description) };
};
const agree = (ctx, id, definition, holder) => assert.deepEqual(cached(ctx, id, definition, holder), uncached(ctx, id, definition, holder));

test('missing status definitions retain their null-safe fallback with Core off or on', () => {
  for (const context of [{}, ctxWith()]) for (const definition of [undefined, null]) {
    assert.deepEqual(cached(context, 'missing', definition), uncached(context, 'missing', definition));
  }
});

test('cached presentation equals the uncached one for each status and holder, on a miss and on a hit', () => {
  clearStatusPresentationCache();
  const ctx = ctxWith();
  const scoped = { id: 'e2', mechanicBindings: [{ tag: 'combat:accuracy', parameters: { baseAC: 3 } }] };
  for (let pass = 0; pass < 2; pass++) {
    agree(ctx, 'weak', weak);
    agree(ctx, 'evade', evade);
    agree(ctx, 'evade', evade, scoped);
    agree(ctx, 'evade', evade, { id: 'e1' });
  }
  assert.match(cached(ctx, 'evade', evade, scoped).tooltip, /^Each stack adds 3 \+ DEX to Evasion/);
  assert.ok(statusPresentationCacheSize() >= 3 && statusPresentationCacheSize() <= 4, 'repeat calls share entries');
});

test('a broken key would be seen: every input the answer reads changes the answer on the next call', () => {
  clearStatusPresentationCache();
  const ctx = ctxWith();
  const before = cached(ctx, 'evade', evade).tooltip;
  ctx.fixCoreRules.accuracy.baseAC += 5;
  assert.notEqual(cached(ctx, 'evade', evade).tooltip, before, 'raw rules edited in place');
  agree(ctx, 'evade', evade);
  ctx.fixCoreRules.accuracy.baseAC -= 5;
  assert.equal(cached(ctx, 'evade', evade).tooltip, before, 'and edited back');

  const holder = { id: 'h', mechanicBindings: [{ tag: 'combat:accuracy', parameters: { baseAC: 9 } }] };
  assert.notEqual(cached(ctx, 'evade', evade, holder).tooltip, before, 'holder bindings');
  holder.mechanicBindings[0].parameters.baseAC = 4;
  assert.match(cached(ctx, 'evade', evade, holder).tooltip, /adds 4 \+ DEX/, 'holder edited in place');

  const renamed = { ...weak, name: 'Frail' };
  assert.equal(cached(ctx, 'weak', weak).name, 'Weak');
  assert.equal(cached(ctx, 'weak', renamed).name, 'Frail', 'the base definition is part of the key');
  thorn.modifiers.damageDealtMult = .5;
  try { assert.equal(cached(ctx, 'thorn', thorn).modifiers.damageDealtMult, .5, 'definition edited in place'); } finally { thorn.modifiers.damageDealtMult = .75; }

  assert.equal(cached(ctx, 'weak', weak).id, 'weak');
  assert.notDeepEqual(cached(ctx, 'weak', weak).tooltip, cached(ctx, 'evade', evade).tooltip, 'the id');

  const off = { ...ctx, combatExpansionVersion: 1 };
  assert.equal(cached(off, 'weak', weak), weak, 'FixCore off returns the caller definition untouched');
  assert.equal(cached(off, 'evade', evade), evade);
});

test('a definition that cannot round-trip through JSON is never cached', () => {
  clearStatusPresentationCache();
  const ctx = ctxWith();
  const withFn = { ...weak, onTick() {} };
  const out = cached(ctx, 'weak', withFn);
  assert.equal(out.onTick, withFn.onTick);
  const withUndefined = { ...weak, extra: undefined };
  assert.ok('extra' in cached(ctx, 'weak', withUndefined));
  const withNaN = { ...weak, scale: NaN };
  assert.ok(Number.isNaN(cached(ctx, 'weak', withNaN).scale));
  assert.equal(statusPresentationCacheSize(), 0);
});

test('callers cannot corrupt a later caller: fresh top level, frozen nested values, failures not stored', () => {
  clearStatusPresentationCache();
  const ctx = ctxWith();
  const first = cached(ctx, 'thorn', thorn);
  first.tooltip = 'scribbled'; first.extra = true;
  assert.throws(() => { first.modifiers.damageDealtMult = 9; }, TypeError);
  const second = cached(ctx, 'thorn', thorn);
  assert.notEqual(second, first);
  assert.notEqual(second.tooltip, 'scribbled');
  assert.equal(second.extra, undefined);
  assert.equal(second.modifiers.damageDealtMult, .75);
  assert.deepEqual(second, uncached(ctx, 'thorn', thorn));
  assert.equal(thorn.modifiers.damageDealtMult, .75, 'the caller definition is never frozen or edited');
  assert.equal(Object.isFrozen(thorn.modifiers), false);
  const bad = ctxWith({ ...structuredClone(fixCoreMechanics), accuracy: null });
  const before = statusPresentationCacheSize();
  try { cached(bad, 'evade', evade); } catch { /* the uncached path throws too */ }
  assert.equal(statusPresentationCacheSize(), before, 'a failing call stores nothing');
});
