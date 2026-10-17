import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ui/input.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function visible(el)'), source.indexOf('\nfunction setFocus('));
function control(id, { hidden = false, inert = false, chrome = false, flask = false } = {}) {
  return { id, dataset: {}, isConnected: true, measures: 0,
    getBoundingClientRect() { this.measures++; return { width: hidden ? 0 : 44, height: 44 }; },
    closest: selector => selector === '[inert]' ? inert : chrome,
    matches: selector => selector === '.flask-slot' && flask,
  };
}
function fixture(controls, { modal = null, tooltip = [] } = {}) {
  const app = { id: 'app', classList: { contains: () => false }, querySelectorAll: () => controls };
  return runInNewContext(functions + '\n({ findByKey, focusables })', {
    topVeil: () => modal,
    document: { getElementById: () => app, querySelectorAll: () => tooltip },
    getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    FOCUS_SELECTOR: 'controls', CHROME: 'chrome',
  });
}

test('focus memory restores a logical key without measuring unrelated controls', () => {
  const unrelated = Array.from({ length: 40 }, (_, n) => control(`other-${n}`));
  const target = control('remembered');
  const { findByKey } = fixture([...unrelated, target]);
  assert.equal(findByKey('#remembered'), target);
  assert.equal(target.measures, 1);
  assert.ok(unrelated.every(node => node.measures === 0));
  assert.equal(findByKey('#missing'), null);
  assert.ok(unrelated.every(node => node.measures === 0));
});

test('matching duplicates retain order while hidden, inert and chrome exclusions still apply', () => {
  const hidden = control('same', { hidden: true }), inert = control('same', { inert: true });
  const chrome = control('same', { chrome: true }), first = control('same'), second = control('same');
  const { findByKey } = fixture([hidden, inert, chrome, first, second]);
  assert.equal(findByKey('#same'), first);
  assert.equal(inert.measures, 0);
  const flask = control('same', { chrome: true, flask: true });
  assert.equal(fixture([flask, first]).findByKey('#same'), flask);
});

test('restoration respects the active modal scope and app tooltip candidates', () => {
  const outside = control('same'), inside = control('same', { chrome: true });
  const modal = { classList: { contains: name => name === 'modal-veil' }, querySelectorAll: () => [inside] };
  assert.equal(fixture([outside], { modal }).findByKey('#same'), inside);
  assert.equal(outside.measures, 0);
  const tooltip = control('tooltip');
  assert.equal(fixture([outside], { tooltip: [tooltip] }).findByKey('#tooltip'), tooltip);
});

test('normal navigation still measures and returns the complete eligible list', () => {
  const first = control('one'), second = control('two'), hidden = control('hidden', { hidden: true });
  const { focusables } = fixture([first, second, hidden]);
  assert.deepEqual(Array.from(focusables()), [first, second]);
  assert.equal(first.measures, 1); assert.equal(second.measures, 1); assert.equal(hidden.measures, 1);
});
