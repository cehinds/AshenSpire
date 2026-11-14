// The stance-change flash: a brief sigil over the actor, data-driven, skipped under Reduced motion, never blocks input.
import test from 'node:test';
import { readFileSync } from 'node:fs';
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
test('linger: it persists into the play and fades out when the swing ends, whatever the selection does meanwhile', t => {
  const rig = styledRig(t, 'linger');
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

// ---- the exit style: outline (default) or linger, as data ----
import { overlayPlan, overlayStanceFor } from '../src/ui/stanceFlash.js';
test('the overlay style is data: outline by default, linger on request, nothing under Reduced motion', () => {
  assert.deepEqual({ ...ACTION_PACING.stanceOverlay }, { style: 'outline', opacity: 0.6, fadeInMs: 80, playExitMs: 75, outlineScale: 2.5, fadeOutMs: 80 });
  assert.equal(overlayPlan().style, 'outline');
  assert.equal(overlayPlan({ ...ACTION_PACING.stanceOverlay, style: 'linger' }).style, 'linger');
  assert.equal(overlayPlan({ style: 'enlarge' }).style, 'outline', 'the old enlarge style is gone');
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
test('outline: on play the sigil keeps its size, the glow grows to 2.5x and the overlay fades out over 75 ms, then it is removed', t => {
  const rig = styledRig(t, 'outline');
  withKitDom(dom => {
    dom.document.documentElement = { dataset: { performance: 'full' } };
    rig.overlay.select('smash');
    const el = live(rig);
    t.mock.timers.tick(100);
    rig.overlay.hold('#ee7237');
    const svg = el.querySelector('svg');
    assert.match(svg.style.filter, /0 0 3px/, 'the play glow at its own radius');
    assert.match(svg.style.filter, /0 0 12px/);
    t.mock.timers.tick(1);
    assert.match(svg.style.filter, /0 0 7\.5px/, 'the outline grows 2.5x (3 -> 7.5)');
    assert.match(svg.style.filter, /0 0 30px/, 'and 12 -> 30');
    assert.equal(el.style.opacity, '0', 'while the whole overlay fades');
    assert.match(el.style.transition, /opacity 75ms/);
    assert.equal(el.style.transform, 'scale(1)', 'the sigil itself is never scaled');
    assert.equal(el.style.pointerEvents, 'none');
    t.mock.timers.tick(100);
    assert.equal(live(rig), null, 'removed about 75 ms after the play');
    assert.equal(rig.overlay.consumePlayed(), true, 'the stance event knows the sigil was shown');
    assert.equal(rig.overlay.consumePlayed(), false);
  });
});
test('linger: the held sigil stays at its opacity and size through the swing, then fades out when it ends', t => {
  const rig = styledRig(t, 'linger');
  withKitDom(() => {
    rig.overlay.select('smash'); rig.overlay.hold();
    const el = live(rig);
    t.mock.timers.tick(600);
    assert.deepEqual([el.style.opacity, el.style.transform], ['0.6', 'scale(1)']);
    rig.overlay.release();
    assert.equal(el.style.opacity, '0');
    t.mock.timers.tick(100);
    assert.equal(live(rig), null);
  });
});

// ---- which stance the selected card is compared with ----
test('regression: after playing Attack, selecting another Attack shows nothing and selecting Sweep shows the sweep sigil', () => {
  // The display's held stance is stale right after a play (it catches up when the played card's beat is drawn); the engine's
  // stance is committed the moment the play is dispatched.
  const afterPlayingAttack = { engine: 'attack', held: 'defend' };
  assert.equal(overlayStanceFor({ armed: 'attack', ...afterPlayingAttack }), null);
  assert.equal(overlayStanceFor({ armed: 'sweep', ...afterPlayingAttack }), 'sweep');
  // A card still waiting in the play queue is what the next card follows.
  assert.equal(overlayStanceFor({ armed: 'attack', pending: 'sweep', engine: 'attack', held: 'attack' }), 'attack');
  assert.equal(overlayStanceFor({ armed: 'sweep', pending: 'sweep', engine: 'attack', held: 'attack' }), null);
  // Without an engine stance the held one decides; a card with no stance shows nothing.
  assert.equal(overlayStanceFor({ armed: 'smash', held: 'smash' }), null);
  assert.equal(overlayStanceFor({ armed: 'smash', held: 'attack' }), 'smash');
  assert.equal(overlayStanceFor({ armed: null, engine: 'attack' }), null);
  assert.equal(overlayStanceFor({ armed: 'defend', engine: 'block' }), null, 'block is the defend stance');
});

// ---- the played card's motif glow ----
import { cardMotifGlow, CARD_ART_ELEMENTS } from '../src/ui/cardArtComposition.js';
test('a card resolves its motif glow from the element table, and none without an element', () => {
  assert.equal(cardMotifGlow({ id: 'f', cardTags: ['camp:spell', 'element:fire'] }), CARD_ART_ELEMENTS.fire.glow);
  assert.equal(cardMotifGlow({ id: 'a', cardTags: ['camp:physical'], attack: { damageType: 'frost' } }), CARD_ART_ELEMENTS.frost.glow);
  assert.equal(cardMotifGlow({ id: 's', cardTags: ['camp:spell'] }), CARD_ART_ELEMENTS.force.glow, 'a spell without an element is force, as the card art');
  assert.equal(cardMotifGlow({ id: 'p', cardTags: ['camp:physical', 'maneuver:smash'] }), null);
  assert.equal(cardMotifGlow(null), null);
});
test('a played fire card glows in its motif colour (two shadows on full performance); selection alone does not', t => {
  const rig = overlayRig(t);
  withKitDom(dom => {
    dom.document.documentElement = { dataset: { performance: 'full' } };
    rig.overlay.select('smash');
    const el = live(rig);
    assert.equal(el.dataset.glowColor, undefined, 'no glow while it is only selected');
    assert.equal(el.dataset.tone, 'idle');
    assert.equal(el.style.color, 'var(--stance-sigil-idle)', 'the grey token while selected');
    assert.equal(el.querySelector('svg').style.filter || '', '');
    rig.overlay.hold(cardMotifGlow({ id: 'f', cardTags: ['camp:spell', 'element:fire'] }));
    assert.equal(el.dataset.glowColor, CARD_ART_ELEMENTS.fire.glow);
    assert.equal(el.dataset.tone, 'played');
    assert.equal(el.style.color, 'var(--stance-glow)', 'the motif colour once played');
    const filter = el.querySelector('svg').style.filter;
    assert.equal((filter.match(/drop-shadow/g) || []).length, 2, 'tight plus wide');
    assert.match(el.querySelector('svg').style.transition, /filter 120ms/);
    t.mock.timers.tick(1);
    assert.equal(el.dataset.glowColor, CARD_ART_ELEMENTS.fire.glow, 'the glow colour stays through the exit');
  });
});
test('a card with no motif glows in the neutral gold token, and a lite device gets one shadow', t => {
  const rig = overlayRig(t);
  withKitDom(dom => {
    dom.document.documentElement = { dataset: { performance: 'lite' } };
    rig.overlay.select('smash');
    rig.overlay.hold(null);
    const el = live(rig);
    assert.equal(el.dataset.glowColor, 'var(--gold)');
    assert.equal((el.querySelector('svg').style.filter.match(/drop-shadow/g) || []).length, 1);
  });
});

test('the idle sigil colour is a CSS custom property backed by a neutral token', () => {
  const css = readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
  assert.match(css, /\.stance-flash \{ --stance-sigil-idle: var\(--muted\); \}/);
});

// ---- the figure previews the selected card's stance (owner, 2026-11-13) ----
import { previewPose } from '../src/ui/stanceFlash.js';
function figure() {
  const poses = [];
  return { poses, stage: { setStance: pose => { if (poses.at(-1) !== pose) poses.push(pose); } } };   // setStance on the same stance repaints nothing
}
test('selecting a stance-changing card poses the figure in it; deselecting or a same-stance card returns it; another stance switches', () => {
  const { poses, stage } = figure();
  const sync = state => { const pose = previewPose({ armedPose: () => state.armed, currentPose: () => 'attack', ...state }); if (pose !== undefined) stage.setStance(pose); };
  sync({ changing: false });                              // at rest in Attack
  sync({ changing: true, armed: 'sweep' });               // a Sweep card selected
  sync({ changing: true, armed: 'defend' });              // a Defend card instead
  sync({ changing: false });                              // deselected
  sync({ changing: true, armed: 'sweep' });
  sync({ changing: false });                              // a same-stance card is selected: no change
  assert.deepEqual(poses, ['attack', 'sweep', 'defend', 'attack', 'sweep', 'attack']);
});
test('play commits the pose the figure is already in: no second stance pose, and no flicker back while the play is in flight', () => {
  const { poses, stage } = figure();
  const apply = state => { const pose = previewPose({ armedPose: () => 'sweep', currentPose: () => state.current, ...state }); if (pose !== undefined) stage.setStance(pose); };
  apply({ changing: true, current: 'attack' });
  assert.deepEqual(poses, ['sweep']);
  apply({ changing: false, inFlight: true, current: 'attack' });   // the selection clears at commit; the display's stance is still stale
  assert.deepEqual(poses, ['sweep'], 'left alone');
  stage.setStance('sweep');                                         // the played card's stance event
  assert.deepEqual(poses, ['sweep'], 'no entry pose is replayed');
  apply({ changing: false, current: 'sweep' });                     // after the play
  assert.deepEqual(poses, ['sweep']);
});
test('a refused or cancelled play reverts the figure', () => {
  const { poses, stage } = figure();
  stage.setStance(previewPose({ changing: true, armedPose: () => 'sweep', currentPose: () => 'attack' }));
  stage.setStance(previewPose({ changing: false, currentPose: () => 'attack' }));   // revertPlayerPose after a refusal
  assert.deepEqual(poses, ['sweep', 'attack']);
});
test('the overlay reports a play in flight until its stance event consumes it', t => {
  const rig = overlayRig(t);
  withKitDom(() => {
    rig.overlay.select('smash');
    rig.overlay.hold();
    assert.equal(rig.overlay.pending, true);
    assert.equal(rig.overlay.held, true);
    rig.overlay.consumePlayed();
    assert.equal(rig.overlay.pending, false);
  });
});

// ---- visibility: the shared combat symbol palette must not paint the sigil near-black ----
import { sigilSizePx } from '../src/ui/stanceFlash.js';
test('the sigil is not an .intent-icon, so the dark symbol-palette outline never applies; its paths take currentColor', t => {
  const rig = overlayRig(t);
  withKitDom(() => {
    rig.overlay.select('smash');
    const svg = live(rig).querySelector('svg');
    assert.equal(svg.getAttribute('class'), 'stance-sigil');
    assert.equal(svg.hasAttribute('data-intent') || svg.dataset.intent !== undefined, false, 'combat-symbol-colors.css keys on [data-intent]');
    assert.equal(svg.style.width, '72px', 'at least 72 px');
    const css = readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
    assert.match(css, /\.stance-flash \.stance-sigil, \.stance-flash \.stance-sigil \* \{ stroke: currentColor; fill: none; stroke-width: 2\.2;/);
    assert.match(css, /\.stance-sigil\[data-solid='true'\] \* \{ fill: currentColor; \}/);
    const palette = readFileSync(new URL('../styles/combat-symbol-colors.css', import.meta.url), 'utf8');
    assert.ok(!/stance-sigil/.test(palette));
  });
});
test('the sigil is sized from the figure: about 70% of its height, never under 72 px', () => {
  const figure = height => ({ offsetHeight: 90, querySelectorAll: () => [{ offsetHeight: height }] });
  assert.equal(sigilSizePx(figure(60)), 72);
  assert.equal(sigilSizePx(figure(200)), 140);
  assert.equal(sigilSizePx(null), 72);
});
