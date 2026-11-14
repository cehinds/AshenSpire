// The stance-change flash: a brief sigil over the actor, data-driven, skipped under Reduced motion, never blocks input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stanceFlashPlan, stanceFlashIcon, showStanceFlash } from '../src/ui/stanceFlash.js';
import { ACTION_PACING } from '../src/model/autoCombatPolicy.js';
import { withKitDom } from './helpers/dom.mjs';

test('the flash is about 250 ms and its durations are data', () => {
  assert.deepEqual({ ...ACTION_PACING.stanceFlash }, { fadeInMs: 80, holdMs: 90, fadeOutMs: 80, opacity: 0.6 });
  assert.deepEqual(stanceFlashPlan(), { fadeInMs: 80, holdMs: 90, fadeOutMs: 80, opacity: 0.6, totalMs: 250 });
  assert.equal(stanceFlashPlan({ fadeInMs: 10, holdMs: 0, fadeOutMs: 5, opacity: 2 }).opacity, 1, 'opacity is clamped');
});
test('Reduced motion, Instant and a zero-length flash draw nothing', () => {
  assert.equal(stanceFlashPlan(undefined, { reduced: true }), null);
  assert.equal(stanceFlashPlan({ fadeInMs: 0, holdMs: 0, fadeOutMs: 0, opacity: 0.6 }), null);
});
test('a stance change names the sigil it shows, and an unknown stance shows none', () => {
  assert.equal(stanceFlashIcon({ maneuver: 'smash' }), 'smash');
  assert.equal(stanceFlashIcon({ stance: 'counter' }), 'counter');
  assert.equal(stanceFlashIcon({ maneuver: 'staggered' }), null);
  assert.equal(stanceFlashIcon({}), null);
});
test('the overlay is created over the sprite, ignores the pointer, fades to 60% and is removed', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  withKitDom(dom => {
    const sprite = dom.document.createElement('div');
    const el = showStanceFlash(sprite, { maneuver: 'smash' });
    assert.ok(el && sprite.contains(el), 'created inside the sprite');
    assert.equal(el.style.pointerEvents, 'none', 'never blocks input');
    assert.equal(el.getAttribute('aria-hidden'), 'true');
    assert.ok(el.querySelector('svg'), 'the stance sigil');
    t.mock.timers.tick(5);
    assert.equal(el.style.opacity, '0.6');
    t.mock.timers.tick(200);
    assert.equal(el.style.opacity, '0', 'faded out');
    t.mock.timers.tick(80);
    assert.equal(sprite.contains(el), false, 'removed when it has faded');
  });
});
test('Reduced motion skips the overlay', () => {
  withKitDom(dom => {
    const sprite = dom.document.createElement('div');
    assert.equal(showStanceFlash(sprite, { maneuver: 'smash' }, { reduced: true }), null);
    assert.equal(sprite.children.length, 0);
  });
});
