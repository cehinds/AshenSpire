import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const start = source.indexOf('  function wireCardInput(');
const end = source.indexOf('\n  }', start);
assert.ok(start >= 0 && end > start);
// Run the native wiring and its onTap callback. Expose the legacy local
// confirm callback as well without replacing any input or refusal decisions.
const wire = source.slice(start, end + 4).replace('return armHold(el, {', 'this.confirm = confirm; return armHold(el, {');

function harness({ affordable = false, range = false, queued = false, blocked = null,
  energy = 0, mana = 1, stamina = 2, cost = 3, manaCost = 4, staminaCost = 5, costIsX = false,
  needsTarget = false, oneTapPlay = false, busy = false } = {}) {
  const logs = [], tips = [], calls = [];
  const el = { addEventListener() {}, appendChild() {} };
  const inst = { instanceId: 'native-c1' };
  const pv = { cost, manaCost, staminaCost, costIsX, needsTarget };
  const context = {
    registries: { balance: { ui: { touchFlick: {} } } },
    combat: { player: { id: 'player', alive: true, energy, mana, stamina }, enemies: [{ id: 'e1', alive: true }] },
    canChooseRangeRoute: () => range, isUnplayable: () => !!blocked,
    unplayableReason: () => blocked, cardTargets: () => ({ mode: 'none' }),
    resolveCombatCard: () => ({}), upcastRanksByCard: new Map(),
    friendlyTargetPlan: () => ({ legalIds: [] }), friendlyTargetMode: () => 'none',
    document: { createElement: () => ({ setAttribute() {} }) },
    armHold: (_el, options) => options,
    logIgnored: (what, why) => logs.push({ what, why }), dlog: (...args) => logs.push(args),
    showTooltipFor: (_el, html) => tips.push(html), esc: value => value,
    isRoundQueued: () => queued, unqueueCard: () => calls.push('unqueue'),
    busy, selected: null, selfArm: null, selectedFlask: 'old-flask',
    armSelf: id => calls.push(`arm:${id}`), syncCardSelection: () => calls.push('sync'),
    meta: { settings: { oneTapPlay } }, readSettings: () => ({ oneTapPlay }),
    playCard: (...args) => calls.push(['play', ...args]), $: () => null,
  };
  // Keep the context containing the actual callbacks and mutable selection.
  const scope = { ...context, el, inst, pv };
  runInNewContext(`${wire}\nthis.handlers = wireCardInput(el, inst, pv, affordable);`, Object.assign(scope, { affordable }));
  return { logs, tips, calls, scope, tap: scope.handlers.onTap, confirm: scope.confirm };
}

for (const input of ['tap', 'confirm']) {
  test(`native ${input} logs one refused card with preview costs and live pools`, () => {
    const h = harness();
    h[input]();
    assert.equal(h.logs.length, 1);
    assert.equal(h.logs[0].what, `card ${input} native-c1`);
    assert.match(h.logs[0].why, /unaffordable; cost energy=3, mana=4, stamina=5; available energy=0, mana=1, stamina=2/);
    assert.deepEqual(h.calls, []);
    assert.equal(h.tips.length, input === 'tap' ? 1 : 0);
  });

  test(`native ${input} includes an unplayable reason and zero minimum for X cost`, () => {
    const h = harness({ blocked: 'This card cannot be played.', costIsX: true });
    h[input]();
    assert.equal(h.logs.length, 1);
    assert.match(h.logs[0].why, /unaffordable: This card cannot be played\.; cost energy=0/);
  });

  test(`native ${input} still selects a valid range route without refusal`, () => {
    const h = harness({ range: true, needsTarget: true });
    h[input]();
    assert.equal(h.scope.selected, 'native-c1');
    assert.deepEqual(h.calls, ['sync']);
    assert.deepEqual(h.logs, []);
  });

  test(`native ${input} takes a queued card back before affordability`, () => {
    const h = harness({ queued: true });
    h[input]();
    assert.deepEqual(h.calls, ['unqueue']);
    assert.deepEqual(h.logs, []);
    assert.deepEqual(h.tips, []);
  });
}

test('native affordable tap preserves selection followed by play without a refusal', () => {
  const h = harness({ affordable: true, needsTarget: true });
  h.tap();
  h.tap();
  assert.deepEqual(h.calls, ['sync', ['play', 'native-c1', 'e1']]);
  assert.deepEqual(h.logs, []);
});

test('native busy tap keeps its existing ignored diagnostic without affordability noise', () => {
  const h = harness({ busy: true });
  h.tap();
  assert.deepEqual(h.logs, [['ignored', 'card tap', 'busy']]);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.tips, []);
});
