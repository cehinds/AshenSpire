import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// A card drawn during playback is built with its Upcast toggle disabled (busy). The hand then keeps the
// element and refreshes it in place (liveWiring), so updateCard must re-read the lock or the toggle stays dead.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const start = source.indexOf('    updateCard: (el, entry) => {');
const end = source.indexOf('\n    },', start);
assert.ok(start >= 0 && end > start, 'updateCard handler present');
const handler = source.slice(start, end + 7).trim().replace(/^updateCard:\s*/, '').replace(/,$/, '');

function run(state) {
  const toggle = { disabled: true };
  const el = { querySelector: selector => selector === '.card-upcast' ? toggle : null };
  const relived = [];
  const context = { cardRelive: new WeakMap([[el, entry => relived.push(entry)]]), combat: { result: null }, busy: true, enemyPlayback: false, ...state };
  const fn = runInNewContext(`(${handler})`, context);
  return { toggle, el, fn, context, relived };
}

test('kept card re-enables its Upcast toggle once playback ends', () => {
  const t = run({});
  t.context.busy = false;
  t.fn(t.el, { id: 'a' });
  assert.equal(t.toggle.disabled, false);
  assert.equal(t.relived.length, 1, 'the wiring still receives the entry');
});

test('kept card keeps Upcast disabled while busy, during enemy playback or after the combat result', () => {
  for (const state of [{ busy: true }, { busy: false, enemyPlayback: true }, { busy: false, combat: { result: 'won' } }]) {
    const t = run(state);
    t.toggle.disabled = false;
    t.fn(t.el, {});
    assert.equal(t.toggle.disabled, true, JSON.stringify(state));
  }
});

test('a card with no upcast control refreshes without error', () => {
  const t = run({ busy: false });
  t.fn({ querySelector: () => null }, {});
});
