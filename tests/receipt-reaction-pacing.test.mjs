// The sprite reaction a receipt plays uses the same paced speed (frame hold) the timeline reserves with.
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionPacing, reactionPlayMs, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';

test('reaction playback receives the paced speed and matches the reserved total', () => {
  setAnimSpeed('fast'); setCombatPacing({ combatSpeed: 1 });
  const seen = [];
  const stage = { reactionTiming: (kind, speed) => { seen.push(speed); return { totalMs: Math.max(3, 9) * Math.max(speed.minFrameMs, 1) }; } };
  const reserved = stage.reactionTiming('fully-defended', actionPacing().spriteSpeed).totalMs;
  const played = reactionPlayMs(stage, 'fully-defended');
  assert.ok(seen.at(-1).minFrameMs > 0, 'frame hold is active');
  assert.equal(played, reserved);
  assert.equal(reactionPlayMs({}, 'x'), 280, 'fallback');
  setAnimSpeed('normal'); setCombatPacing();
});
