// The stance-change flash: a brief sigil over the actor, data-driven, skipped under Reduced motion, never blocks input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stanceFlashPlan, stanceFlashIcon, showStanceFlash, createStanceOverlay } from '../src/ui/stanceFlash.js';
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

// ---- the player's overlay: up while a stance-changing card is selected, lingering through the play (owner, 2026-11-13) ----
function overlayRig(t, reduced = false) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const rig = {};
  withKitDom(dom => {
    rig.sprite = dom.document.createElement('div');
    rig.overlay = createStanceOverlay({ reduced: () => reduced });
    rig.overlay.bind(() => rig.sprite);
  });
  return rig;
}
const live = rig => rig.sprite.querySelector('.stance-flash');
test('selecting a stance-changing card shows the sigil; a same-stance card shows none', t => {
  const rig = overlayRig(t);
  withKitDom(() => {
    rig.overlay.select(null);
    assert.equal(live(rig), null, 'a same-stance selection passes null');
    rig.overlay.select('smash');
    const el = live(rig);
    assert.ok(el);
    assert.equal(el.dataset.stance, 'smash');
    assert.equal(el.style.pointerEvents, 'none');
    t.mock.timers.tick(1);
    assert.equal(el.style.opacity, '0.6');
  });
});
test('it switches sigil between stance-changing cards and fades out when the selection ends', t => {
  const rig = overlayRig(t);
  withKitDom(() => {
    rig.overlay.select('smash');
    const el = live(rig);
    rig.overlay.select('counter');
    assert.equal(live(rig), el, 'the same element');
    assert.equal(el.dataset.stance, 'counter');
    rig.overlay.select(null);
    assert.equal(el.style.opacity, '0', 'fading out');
    assert.equal(rig.overlay.active, false);
    t.mock.timers.tick(100);
    assert.equal(live(rig), null, 'removed after fadeOutMs');
  });
});
test('it persists into the play and fades out when the swing ends, whatever the selection does meanwhile', t => {
  const rig = overlayRig(t);
  withKitDom(() => {
    rig.overlay.select('smash');
    rig.overlay.hold();
    rig.overlay.select(null);            // the play clears the selection
    rig.overlay.select('counter');       // and another card selected meanwhile does not touch it
    const el = live(rig);
    assert.ok(el && el.dataset.stance === 'smash');
    t.mock.timers.tick(2000);            // cardPlayed, cost, action word, swing...
    assert.equal(live(rig), el);
    assert.equal(el.style.opacity, '0.6');
    rig.overlay.release();               // the swing clip completed
    assert.equal(el.style.opacity, '0');
    t.mock.timers.tick(100);
    assert.equal(live(rig), null);
  });
});
test('a refused or cancelled play removes it at once', t => {
  const rig = overlayRig(t);
  withKitDom(() => {
    rig.overlay.select('smash');
    rig.overlay.clear();
    assert.equal(live(rig), null);
    rig.overlay.select('smash'); rig.overlay.hold(); rig.overlay.clear();
    assert.equal(live(rig), null);
    rig.overlay.select('smash');
    assert.ok(live(rig), 'a new selection after the refusal works again');
  });
});
test('Reduced motion and Instant draw no overlay at all', t => {
  const rig = overlayRig(t, true);
  withKitDom(() => {
    rig.overlay.select('smash');
    assert.equal(live(rig), null);
    assert.equal(rig.sprite.children.length, 0);
  });
});

// ---- the exit style: enlarge (default) or linger, as data ----
import { overlayPlan } from '../src/ui/stanceFlash.js';
test('the overlay style is data: enlarge by default, linger on request, nothing under Reduced motion', () => {
  assert.deepEqual({ ...ACTION_PACING.stanceOverlay }, { style: 'enlarge', opacity: 0.6, fadeInMs: 80, enlargeScale: 1.4, enlargeOpacity: 0.3, fadeOutMs: 80 });
  assert.equal(overlayPlan().style, 'enlarge');
  assert.equal(overlayPlan({ ...ACTION_PACING.stanceOverlay, style: 'linger' }).style, 'linger');
  assert.equal(overlayPlan({ style: 'junk' }).style, 'enlarge');
  assert.equal(overlayPlan(undefined, { reduced: true }), null);
});
function styledRig(t, style) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const rig = {};
  withKitDom(dom => {
    rig.sprite = dom.document.createElement('div');
    rig.overlay = createStanceOverlay({ config: () => ({ ...ACTION_PACING.stanceOverlay, style }) });
    rig.overlay.bind(() => rig.sprite);
  });
  return rig;
}
test('enlarge: when the swing starts the held sigil grows and dims over the clip, then fades out when it ends', t => {
  const rig = styledRig(t, 'enlarge');
  withKitDom(() => {
    rig.overlay.select('smash'); rig.overlay.hold();
    const el = live(rig);
    t.mock.timers.tick(100);
    assert.deepEqual([el.style.opacity, el.style.transform], ['0.6', 'scale(1)']);
    rig.overlay.begin(550);
    assert.equal(el.style.transform, 'scale(1.4)');
    assert.equal(el.style.opacity, '0.3');
    assert.match(el.style.transition, /transform 550ms linear/, 'transform and opacity only, over the clip duration');
    assert.equal(el.style.pointerEvents, 'none');
    t.mock.timers.tick(550);
    rig.overlay.release();
    assert.equal(el.style.opacity, '0');
    t.mock.timers.tick(100);
    assert.equal(live(rig), null);
  });
});
test('linger: the held sigil stays at its opacity and scale through the swing, then fades out when it ends', t => {
  const rig = styledRig(t, 'linger');
  withKitDom(() => {
    rig.overlay.select('smash'); rig.overlay.hold();
    const el = live(rig);
    t.mock.timers.tick(100);
    rig.overlay.begin(550);
    assert.deepEqual([el.style.opacity, el.style.transform], ['0.6', 'scale(1)'], 'begin changes nothing');
    t.mock.timers.tick(550);
    assert.equal(el.style.opacity, '0.6');
    rig.overlay.release();
    assert.equal(el.style.opacity, '0');
    t.mock.timers.tick(100);
    assert.equal(live(rig), null);
  });
});
