import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/kit-dom.mjs';
import { isSwitchInput, isTypingTarget } from '../src/ui/input.js';

test('a checkbox switch is not a typing target; text fields still are', () => {
  withKitDom(() => {
    const make = (tag, attrs = {}) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
    const sw = make('input', { type: 'checkbox', role: 'switch' });
    assert.equal(isSwitchInput(sw), true);
    assert.equal(isTypingTarget(sw), false, 'arrows and Enter keep working on a focused switch');
    assert.equal(isTypingTarget(make('input', { type: 'checkbox' })), false);
    assert.equal(isTypingTarget(make('input', { type: 'text' })), true);
    assert.equal(isTypingTarget(make('input', { type: 'number' })), true);
    assert.equal(isTypingTarget(make('textarea')), true);
    assert.equal(isTypingTarget(make('button')), false);
  });
});

test('Enter on a focused switch clicks it before the game cursor sees the key', () => {
  const src = readFileSync(new URL('../src/ui/input.js', import.meta.url), 'utf8');
  const at = src.indexOf('isSwitchInput(ev.target) && ev.key === CONFIRM_KEY');
  assert.ok(at > 0 && src.slice(at, at + 160).includes('ev.target.click()'));
  assert.ok(at < src.indexOf('if (!typing && ev.key === CONFIRM_KEY)'));
});
