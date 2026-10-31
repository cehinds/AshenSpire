// A sprite frame is held at least a share of the Animation step duration, so it can be seen on a phone
// (owner, 2026-10-31). The Fast pace squeezed a 9-frame swing into ~20 ms a frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionPacing, frameHoldMs, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';
import { animationTiming } from '../src/model/equipmentAnimation.js';
import { reaverAttackTiming, REAVER_ATTACK_RUNS } from '../src/ui/reaverAttack.js';

const clip = { frameMs: 100, impactIndex: 5, frames: Array.from({ length: 9 }, (_, i) => `f${i}`) };
const component = { normalLungeMs: 260, references: { attack: 'a' }, clips: { a: clip }, poseRoles: {}, frames: {} };

test('frame hold follows the step duration and the Combat speed; Instant drops it', () => {
  setAnimSpeed('fast'); setCombatPacing({ combatSpeed: 1 });
  assert.equal(frameHoldMs(), 109, '390 ms step at x1 -> 109 ms (target 90-120)');
  setCombatPacing({ combatSpeed: 1, animationStepDuration: 195 });
  assert.equal(frameHoldMs(), 55, 'Mobile fast preset');
  setCombatPacing({ combatSpeed: 2 });
  assert.ok(frameHoldMs() < 109);
  setAnimSpeed('instant'); assert.equal(frameHoldMs(), 0);
  setAnimSpeed('normal'); assert.equal(frameHoldMs({ reduced: true }), 0);
  setCombatPacing();
});

test('an authored clip never plays a frame faster than the hold, and the total grows to match', () => {
  setAnimSpeed('fast'); setCombatPacing({ combatSpeed: 1 });
  const speed = actionPacing().spriteSpeed;
  assert.equal(speed.minFrameMs, 109);
  const t = animationTiming(component, 'attack', speed);
  assert.equal(t.totalMs, 109 * 9);
  assert.equal(t.impactMs, 109 * 5);
  const before = animationTiming(component, 'attack', { ...speed, minFrameMs: 0 });
  assert.ok(before.totalMs / 9 < 40, `was ${before.totalMs / 9} ms a frame`);
  setAnimSpeed('instant'); setCombatPacing();
  assert.equal(animationTiming(component, 'attack', actionPacing().spriteSpeed).totalMs > 0, true);
  setAnimSpeed('normal');
});

test('the Reaver painting holds each of its distinct images, and impact precedes the total', () => {
  setAnimSpeed('fast'); setCombatPacing({ combatSpeed: 1 });
  const t = reaverAttackTiming(actionPacing().spriteSpeed);
  assert.equal(t.runMs.length, REAVER_ATTACK_RUNS.length);
  assert.ok(t.runMs.every(ms => ms >= 65), 'every image held >= 0.6 of 109 ms');
  assert.ok(t.impactMs > 0 && t.impactMs < t.totalMs);
  const plain = reaverAttackTiming({ ...actionPacing().spriteSpeed, minFrameMs: 0 });
  assert.equal(plain.runMs, undefined, 'without a hold the step-by-step timing is unchanged');
  setAnimSpeed('normal'); setCombatPacing();
});

test('the sprite lunge and reaction are never shorter than one held frame', () => {
  setAnimSpeed('fast'); setCombatPacing({ combatSpeed: 1.25 });
  const speed = actionPacing().spriteSpeed;
  assert.ok(speed.reactionMs >= speed.minFrameMs && speed.lungeMs >= speed.minFrameMs, JSON.stringify(speed));
  assert.equal(speed.minFrameMs, frameHoldMs());
  setAnimSpeed('instant');
  const instant = actionPacing().spriteSpeed;
  assert.equal(instant.minFrameMs, 0); assert.equal(instant.reactionMs, 0);
  setAnimSpeed('normal'); setCombatPacing();
});

import { selectedWeaponSequence, selectedWeaponSequenceTiming } from '../src/model/selectedWeaponSequences.js';

test('the pilot attack (6 frames) holds each frame, so a phone swing is no longer 16 ms a frame', () => {
  setAnimSpeed('fast'); setCombatPacing({ combatSpeed: 1.25 });
  const speed = actionPacing().spriteSpeed;
  const plain = selectedWeaponSequenceTiming(selectedWeaponSequence('attack'), { ...speed, minFrameMs: 0 });
  const held = selectedWeaponSequenceTiming(selectedWeaponSequence('attack'), speed);
  assert.ok(plain.totalMs / 6 < 20, `was ${plain.totalMs / 6} ms a frame`);
  assert.equal(held.totalMs, speed.minFrameMs * 6);
  assert.equal(held.impactMs, speed.minFrameMs * 3);
  setAnimSpeed('normal'); setCombatPacing();
});
