// Pacing: the reaction gap scale, and the six stages fixed at 100 ms (actionPacing.json fixedStageMs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';

const FIXED = ['intentMs', 'wordMs', 'afterSpriteMs', 'reactionMs', 'telegraphHoldMs', 'telegraphResetMs'];

test('the six fixed stages are 100 ms at normal, with and without a reaction answer', () => {
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

test('the result word, damage numbers and reset still follow the gap, halved after a reaction', () => {
  setAnimSpeed('normal');
  setCombatPacing({ combatStepPause: 1000, combatSpeed: 1 });
  const plain = actionPacing();
  const after = actionPacing({ reaction: true });
  for (const key of ['resultMs', 'damageMs', 'resetMs']) {
    assert.equal(plain[key], plain.gapMs, key);
    assert.equal(after[key], plain.gapMs * 0.5, `${key} after a reaction`);
  }
  assert.equal(plain.gapMs, 1000);
});
