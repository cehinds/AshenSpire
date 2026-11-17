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
