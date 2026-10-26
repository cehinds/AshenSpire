import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { separateOverheadIntents } from '../src/ui/components/overheadIntentSeparation.js';

// 844x390: the back-row enemy's intent (0-9 and its sword) stood over the
// player's hourglass. The player's glyph slides clear; nothing else moves.
const item = (id, left, width, extra = {}) => ({ id, left, right: left + width, top: 43, bottom: 80, ...extra });
const bounds = { left: 0, right: 844 };

test('overlapping player glyph slides to the nearest free side of the enemy intent', () => {
  const shifts = separateOverheadIntents([item('player', 189, 44, { movable: true }), item('e2', 203, 61)], bounds);
  assert.equal(shifts.get('e2'), 0);
  assert.ok(shifts.get('player') < 0, 'the glyph stays on its own side, to the left');
  const moved = 189 + shifts.get('player');
  assert.ok(moved + 44 <= 203 - 4 + 1e-9, 'a 4px gap from the enemy intent');
});

test('clear intents are left where they are', () => {
  const shifts = separateOverheadIntents([item('player', 100, 44, { movable: true }), item('e1', 610, 61), item('e2', 203, 61)], bounds);
  assert.deepEqual([...shifts.values()], [0, 0, 0]);
});

test('a slide never leaves the field or lands on a third intent', () => {
  const shifts = separateOverheadIntents([item('player', 10, 44, { movable: true }), item('e2', 20, 61), item('e3', 90, 61)], { left: 0, right: 300 });
  const at = 10 + shifts.get('player');
  assert.ok(at >= 0 && at + 44 <= 300);
  for (const [l, r] of [[20, 81], [90, 151]]) assert.ok(at + 44 <= l || at >= r, 'clear of every other intent');
});

test('the stage wires the separation and the stylesheet applies the offset', () => {
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/combat-target-responsive.css', import.meta.url), 'utf8');
  assert.match(stage, /separateRackedIntents\(racked, zoom\)/);
  assert.match(css, /left:var\(--combat-intent-shift,auto\)!important/);
});
