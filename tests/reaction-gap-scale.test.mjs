// Pacing: the reaction gap scale, and the nine stages fixed at 100 ms (actionPacing.json fixedStageMs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_PACING } from '../src/model/autoCombatPolicy.js';
import { actionPacing, clampGapScale, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';

const FIXED = ['intentMs', 'wordMs', 'afterSpriteMs', 'resultMs', 'reactionMs', 'damageMs', 'resetMs', 'telegraphHoldMs', 'telegraphResetMs'];

test('the nine fixed stages are 100 ms at normal, with and without a reaction answer', () => {
  setAnimSpeed('normal');
  setCombatPacing({ combatStepPause: 1000, combatSpeed: 2 });
  for (const reaction of [false, true]) {
    const pace = actionPacing({ reaction });
    for (const key of FIXED) assert.equal(pace[key], 100, `${key} reaction=${reaction}`);
  }
});

test('the fixed stages are 0 under Reduced motion and Instant', () => {
  setCombatPacing({ combatStepPause: 1000, combatSpeed: 1 });
  setAnimSpeed('normal');
  const reduced = actionPacing({ reduced: true });
  for (const key of FIXED) assert.equal(reduced[key], 0, key);
  setAnimSpeed('instant');
  const instant = actionPacing();
  for (const key of FIXED) assert.equal(instant[key], 0, key);
  setAnimSpeed('normal');
});

test('the gap alone is halved after a reaction; no fixed stage follows it', () => {
  setAnimSpeed('normal');
  setCombatPacing({ combatStepPause: 1000, combatSpeed: 1 });
  const plain = actionPacing();
  const after = actionPacing({ reaction: true });
  assert.equal(plain.gapMs, 1000);
  assert.equal(after.gapMs, 500);
  for (const key of FIXED) assert.equal(after[key], 100, key);
});

test('an invalid reactionGapScale clamps to [0,1] or falls back to 1', () => {
  for (const [raw, expected] of [[NaN, 1], [-1, 0], [5, 1], ['x', 1], [undefined, 1], [null, 1], [0.5, 0.5], [0, 0]]) {
    assert.equal(clampGapScale(raw), expected, String(raw));
  }
  setAnimSpeed('normal');
  setCombatPacing({ combatStepPause: 1000, combatSpeed: 1 });
  assert.equal(actionPacing({ reaction: true }).gapMs, 1000 * clampGapScale(ACTION_PACING.reactionGapScale));
});
