// Playtest 2026-11-17: an enemy's intent is one row with room for five actions; a row over a fighter at the screen's
// edge slides along its line to stay inside the combat screen instead of wrapping (and losing its top) on a phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IntentRowNudge } from '../src/ui/components/intentRowFit.js';

const space = { minimum: 4, maximum: 386 };

test('a row that fits is not moved', () => {
  assert.equal(IntentRowNudge({ left: 100, right: 300 }, space), 0);
});

test('a row past either edge slides just far enough back inside', () => {
  assert.equal(IntentRowNudge({ left: 200, right: 451 }, space), -65);
  assert.equal(IntentRowNudge({ left: -20, right: 120 }, space), 24);
});

test('a row wider than the screen keeps its left edge inside', () => {
  assert.equal(IntentRowNudge({ left: 0, right: 500 }, space), 4);
});

test('the enemy intent row never wraps and follows the nudge', () => {
  const css = readFileSync(new URL('../styles/combat-mini-hud.css', import.meta.url), 'utf8');
  assert.match(css, /\.intent \.intent-actions,[\s\S]*?flex-wrap: nowrap !important/);
  assert.match(css, /translate: calc\(-50% \+ var\(--intent-nudge, 0px\)\) 0 !important/);
});

// Review on #2814: the nudge moves the row only under the target HUD (combat-mini-hud.css). With that HUD off the row
// stays put, so a nudge read back as applied grew on every render.
const fakeScreen = ({ targetHud, rowLeft, rowRight }) => {
  const values = new Map();
  const style = { getPropertyValue: k => values.get(k) || '', setProperty: (k, v) => values.set(k, v), removeProperty: k => values.delete(k) };
  const applied = () => (targetHud === 'true' ? parseFloat(values.get('--intent-nudge')) || 0 : 0);
  const part = { getBoundingClientRect: () => ({ left: rowLeft + applied(), right: rowRight + applied(), width: rowRight - rowLeft }) };
  const intent = { style, offsetWidth: 100, getBoundingClientRect: () => ({ width: 100 }), querySelectorAll: () => [part] };
  return { intent, values, screen: { dataset: { targetHud }, getBoundingClientRect: () => ({ left: 0, right: 390 }), querySelectorAll: () => [intent] } };
};

test('with the target HUD off no nudge is written, however often the row is fitted', async () => {
  const { KeepIntentRowsInside } = await import('../src/ui/components/intentRowFit.js');
  const off = fakeScreen({ targetHud: 'false', rowLeft: 200, rowRight: 451 });
  off.values.set('--intent-nudge', '-30px');
  for (let i = 0; i < 5; i++) KeepIntentRowsInside(off.screen);
  assert.equal(off.values.has('--intent-nudge'), false, 'a stale nudge is cleared and none is added');
});

test('with the target HUD on the nudge settles and does not grow across renders', async () => {
  const { KeepIntentRowsInside } = await import('../src/ui/components/intentRowFit.js');
  const on = fakeScreen({ targetHud: 'true', rowLeft: 200, rowRight: 451 });
  const seen = [];
  for (let i = 0; i < 5; i++) { KeepIntentRowsInside(on.screen); seen.push(on.values.get('--intent-nudge')); }
  assert.deepEqual(seen, Array(5).fill('-65px'));
});
