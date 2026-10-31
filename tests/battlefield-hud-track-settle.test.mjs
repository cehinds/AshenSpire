import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The HUD-follow loop ends early after two unmoved frames, but not right after a pose class lands: an eased
// lunge reads the same as rest for its first frame, and stopping there left the HUD behind for the whole lunge.
// Runs the shipped window, early-stop and settle code with stub geometry.
const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const start = source.indexOf('  const TRACK_WINDOW_MS');
const end = source.indexOf('\n  }\n', source.indexOf('  function trackPlayerHud()', start)) + 4;
assert.ok(start > 0 && end > start);

function loop(effectsAreOff = false) {
  let now = 0, frames = [], x = 0, animations = [];
  const sprite = { getAnimations: () => animations };
  const env = {
    performance: { now: () => now },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
    document: { documentElement: { dataset: {} } },
    field: { isConnected: true, querySelector: () => ({}), querySelectorAll: () => [sprite], closest: () => ({ dataset: { targetHud: 'true' } }) },
    currentSpriteBodyBounds: () => ({ left: x, right: x + 10, top: 0, bottom: 10, headY: 0, feetY: 10 }),
    reducedMotionRequested: () => false, effectsOff: () => effectsAreOff, invalidateSpriteRects() {}, stageFor: () => null,
    placePlayerHud() {}, placeHitBadges() {}, placeEnemyInspect() {}, schedule() {}, settledTargetCores: null,
  };
  const body = `let trackingRequest = 0, inspectTick = 0;\n${source.slice(start, end)}\nreturn { extendTracking, trackPlayerHud, running: () => trackingRequest };`;
  const api = new Function(...Object.keys(env), body)(...Object.values(env));
  const step = () => { now += 16; const next = frames.shift(); next?.(); };
  return { api, step, move: px => { x += px; }, frames: () => frames.length, animate: list => { animations = list; } };
}

test('a pose that lands just as the bodies settle is still followed once it moves', () => {
  const l = loop();
  l.api.extendTracking(); l.api.trackPlayerHud();   // window opens, first frame places
  l.step();                                          // unmoved: stable 1
  l.api.extendTracking();                            // an attack class lands while the window runs
  l.step(); l.step();                                // the lunge is still at 0% for these frames
  assert.ok(l.frames() > 0, 'tracking does not stop inside the settle time after a change');
  for (let i = 0; i < 6; i++) { l.move(2); l.step(); }
  assert.ok(l.frames() > 0, 'the moving lunge keeps the loop running');
});

test('with nothing moving, the loop still stops shortly after the settle time', () => {
  const l = loop();
  l.api.extendTracking(); l.api.trackPlayerHud();
  let steps = 0;
  while (l.frames() && steps < 60) { l.step(); steps++; }
  assert.equal(l.frames(), 0, 'it stops');
  assert.ok(steps * 16 <= 200, `it stops within the settle time plus two frames (took ${steps} frames)`);
});

test('a classic figure holding mid-action keeps the loop running until its animation ends', () => {
  const l = loop();
  const hit = { playState: 'running', effect: { getTiming: () => ({ iterations: 1 }) } };
  const bob = { playState: 'running', effect: { getTiming: () => ({ iterations: Infinity }) } };
  l.animate([hit, bob]);
  l.api.extendTracking(); l.api.trackPlayerHud();
  for (let i = 0; i < 20; i++) l.step();            // the hit holds its displaced pose: nothing moves
  assert.ok(l.frames() > 0, 'a running finite CSS action counts as busy');
  l.animate([bob]);                                  // the hit ends; only the idle bob remains
  for (let i = 0; i < 4; i++) l.step();
  assert.equal(l.frames(), 0, 'the endless idle bob alone does not keep tracking');
});

test('with Effects off the HUD settles and schedules no per-frame tracking', () => {
  const l = loop(true);
  l.api.extendTracking(); l.api.trackPlayerHud();
  assert.equal(l.frames(), 0, 'no animation frame is requested');
  assert.equal(l.api.running(), 0);
  const on = loop(false);
  on.api.extendTracking(); on.api.trackPlayerHud();
  assert.ok(on.frames() > 0, 'Effects on still follows the move');
});
