import { uiIconText } from '../content/uiIcons.js';
import { viewScale, viewViewportBox } from './viewViewport.js';
import { playCombatEffect, clearCombatEffects } from './combatEffectSprites.js';
import { combatEffectForEvent } from '../model/combatEffectEvents.js';
import { effectsOff } from './performance.js';
// src/ui/fx.js — feedback effects (SPEC §7.4)
//
// Rules: every animation ≤300 ms; queued events play ≤80 ms apart; a click
// skips to end-state; every HP hit shakes ≤4 px by the HP it cost, and a
// big hit holds the two figures briefly (content/combatFeel.js); Bleed bursts and
// Staggers get the loud treatment (they're the theme).

import { sfx } from './sfx.js';
import { haptic } from './haptics.js';
import { hitTierFor } from '../content/sfx.js';
import { shakePxFor, hitStopMsFor, BIG_HIT_SHARE, HUGE_HIT_SHARE } from '../content/combatFeel.js';
export { BIG_HIT_SHARE, HUGE_HIT_SHARE };
import { dlog } from './debuglog.js';
import { UI_COMPONENTS as UI, markUiComponent } from './components/uiComponents.js';
import { playPoseOn, stageFor } from './services/PoseAnimator.js';
import { reducedMotionRequested } from './motion.js';
import { t } from './strings.js';
import { hitAsLayered } from '../model/combatLog.js';
import { buffGainFor, buffPopupFor } from './buffFeedback.js';


// ---------------------------------------------------------------------------
// Animation speed (settings-driven; 'instant' collapses paced playback to the
// classic fast-float behavior — also forced by reducedMotion).
// ---------------------------------------------------------------------------

// impactCapMs: the latest an actor's swing may land after its beat starts.
// An authored clip whose impact frame falls later is played faster as a whole
// (model/equipmentAnimation.js animationTiming), so the hit, its number and its
// sound arrive while the click is still fresh (FINISH §5: click to impact
// ≤ 400 ms at Normal; tools/click-impact-probe.mjs measures it).
import { runActionTimeline } from './actionTimeline.js';
import { actionPacing, floaterLifeMs, calloutLifeMs, floaterStaggerMs, floaterStaggerMinMs } from './animationPace.js';
import { createFloaterStack, FLOATER_STACK } from './floaterStack.js';
import { measure, measureThenMutate } from './frameMeasure.js';
import { ANIM_SPEEDS, COMBAT_TIMING, setAnimSpeed, getAnimSpeed, turnBannerHoldMs, getBeatOrder, setBeatOrder } from './animationPace.js';
export { ANIM_SPEEDS, setAnimSpeed, getAnimSpeed, getBeatOrder, setBeatOrder };

let pending = [];
let flushRequested = false;

// The whole UI is scaled by --ui-zoom (main.js applyUiScale). getBoundingClientRect
// returns POST-zoom (visual) pixels, but a child's `style.left` is interpreted in
// the layer's PRE-zoom local space — so a raw visual offset lands at offset×zoom,
// pulling anchored FX toward the origin (worse the further right the target). This
// converts an anchor's on-screen box into the layer's local coordinates so FX land
// exactly on their target regardless of zoom.
// `position: fixed` DOES NOT ESCAPE THIS (EldenSpire#15, Sunna). The zoom is on
// <body>, and a fixed descendant of a zoomed box still has its lengths read in the
// zoomed space — so the shared tooltip, the drag ghost and the card-fly ghost all
// landed at offset×zoom too: correct at exactly --ui-zoom 1.00 and wrong in BOTH
// directions away from it. At 1920×1080 the tooltip rendered at top 1406 in a
// 1080px viewport. Card tooltips did not exist for a player on the commonest
// desktop resolution. `transform: translate()` is the same space again (Marina
// measured it: 100px under zoom 1.5 moves 150 visual), and zoomunits.mjs reads
// neither `transform` nor `cssText` — so that half was, and stays, invisible to
// the instrument.
//
// Those sites come through here now, which is why EITHER argument may be a plain
// { left, top, width, height } of visual px instead of an element: a fixed
// element's "layer" is the viewport, and VIEWPORT_ORIGIN names it.
const rectOf = (o) => (o && typeof o.getBoundingClientRect === 'function' ? o.getBoundingClientRect() : o);

// The containing block of a `position: fixed` element is the viewport itself,
// whatever it is nested in — origin (0, 0), so only the zoom separates the spaces.
export const VIEWPORT_ORIGIN = {
  get left() { return viewViewportBox().left; },
  get top() { return viewViewportBox().top; },
  width: 0, height: 0,
};

/**
 * The page's `--ui-zoom`. Reading it is a computed-style read, which flushes
 * any pending style change: a loop that writes styles and converts a box per
 * item reads it once, before its writes, and passes it as `zoom`.
 */
export function uiZoom() {
  // main.js applyUiScale writes --ui-zoom inline on <html>; the inline read is
  // free, where a computed read flushes pending style and layout. It runs per
  // combatant per render (a third of an enemy turn on a throttled phone), so
  // the computed read is only the fallback for a page that set it in CSS.
  const root = document.documentElement;
  const inline = parseFloat(root?.style?.getPropertyValue?.('--ui-zoom'));
  const zoom = Number.isFinite(inline) ? inline : parseFloat(getComputedStyle(root).getPropertyValue('--ui-zoom'));
  return zoom * viewScale() || 1;
}

export function anchorLocalBox(layer, anchor, { zoom } = {}) {
  const lr = rectOf(layer);
  const ar = rectOf(anchor);
  // A native dialog may compensate for the body's zoom. Its measured effective
  // zoom uses the same conversion without a second placement implementation.
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : uiZoom();
  return {
    left: (ar.left - lr.left) / z,
    top: (ar.top - lr.top) / z,
    width: ar.width / z,
    height: ar.height / z,
  };
}

// anchorLocalBox for a READ PHASE: the boxes come from frameMeasure's per-task
// snapshot, so a layer and an anchor shared by several floats, words and flares
// in one beat are each read from layout once. Only for callers that have not
// written geometry since the snapshot (the effect elements they append are
// absolutely positioned in a layer and never move an anchor).
const cachedRectOf = (o) => (o && typeof o.getBoundingClientRect === 'function' ? measure(o) : o);
function anchorLocalBoxCached(layer, anchor, zoom) {
  const lr = cachedRectOf(layer);
  const ar = cachedRectOf(anchor);
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : uiZoom();
  return { left: (ar.left - lr.left) / z, top: (ar.top - lr.top) / z, width: ar.width / z, height: ar.height / z };
}

/**
 * The visible screen, in the local space a `position: fixed` child writes in.
 *
 * This is the JS half of the `vw`-vs-`%` finding in Marina's ruling: `vw/vh`
 * resolve against the UNZOOMED viewport and are then scaled, so a clamp written
 * in them does not clamp. `innerWidth` has the same trap and the same cure — read
 * it as visual px and convert, never write it into a local-space property raw.
 */
export function viewportLocalBox() {
  return anchorLocalBox(VIEWPORT_ORIGIN, viewViewportBox());
}

/**
 * clampBox(box, view, opts) → { left, top } — the bound, AFTER the conversion.
 *
 * Read the order, because it is the whole finding: tooltip.js already clamped all
 * four edges on both axes, arithmetically correctly, and still rendered 329px
 * below the bottom of the screen. It computed the clamp in visual space and wrote
 * the result into local space. A bound is a claim about a coordinate space, not
 * about arithmetic — so this function refuses to convert anything. Both arguments
 * must ALREADY be in one space, and the caller names which container `view` is.
 *
 * What it buys, beyond today's four sites: the next bad write here degrades to
 * "slightly misplaced" instead of "invisible" — a bug someone reports rather than
 * a feature that silently does not exist for half the players. Same move as
 * `.tut-veil { pointer-events: none }` in #7: delete the failure mode, not just
 * this instance of it.
 *
 * `keep` = how much of the box must stay inside on each axis:
 *   Infinity (default) — all of it. For anything a player has to READ.
 *   a number           — at least that many px. For anything that TRACKS THE
 *                        POINTER, which must be free to hang off the edge the
 *                        pointer is against but must never vanish entirely.
 * A box too big to fit pins to the low edge rather than sliding off the far one.
 *
 * Pure arithmetic, no DOM: unit-testable without a browser — which is the only
 * part of Rule 2 that can be. The rest needs layout, and that is zoomplace.mjs.
 */
export function clampBox(box, view, { pad = 4, keep = Infinity } = {}) {
  const fit = (v, size, span) => {
    const k = Math.min(keep, size);
    const lo = pad + k - size;
    const hi = span - pad - k;
    return Math.min(Math.max(v, lo), Math.max(lo, hi));
  };
  return {
    left: fit(box.left, box.width, view.width),
    top: fit(box.top, box.height, view.height),
  };
}

// ---------------------------------------------------------------------------
// ANCHORED PLACEMENT — one home for "put this element next to that one".
//
// WHY IT IS HERE AND NOT IN A NEW FILE. anchorLocalBox / viewportLocalBox /
// clampBox above are already the placement home: measure in one space, bound in
// that space. What they never held is the layer on top — WHICH SIDE, and how far
// off. That was written out twice: tooltip.js place() and quicknav.js position().
// Same shape both times (measure anchor, measure self, offset, clamp), different
// answers, and neither could be fixed without editing the other.
//
// THE INTENT IS NAMED BY THE CALLER, NEVER GUESSED HERE. "Beside it" and "under
// it" are DIFFERENT ANSWERS to different questions, and a function that picks
// between them from the geometry is a function that will pick wrong on the shape
// nobody photographed. A tooltip must not cover what it explains, so it takes any
// side that fits; a dropdown hangs off its button, so it takes one.
//
// THE GAP HAS ONE HOME AND IT IS THE STYLESHEET (Law 0 clause 4). A distance
// between two boxes is a length, lengths live in CSS, and the number a harness
// measures must be the number the code used. `--place-gap` on the PLACED element
// is that one home: `#tooltip { --place-gap: 14px }` replaces `const pad = 14`,
// and an instrument reads the same declaration through getComputedStyle that this
// function does. It is deliberately an unregistered custom property, so it
// computes to its own token and does NOT track --ui-zoom or the text-size dial —
// which is exactly what the two literals it replaces did (Law 2 rule 3: px where
// a value must not answer to text size, and a hairline gap is not read text).
//
// A MISSING DECLARATION RESOLVES TO 0, NOT TO A PLAUSIBLE DEFAULT. Law 0 clause
// 5: a generated thing that is wrong but reasonable is invisible. A panel welded
// to its anchor is a defect anyone sees in one screenshot; a panel 14 px off a
// stylesheet that says 6 is a defect nobody ever sees.
// ---------------------------------------------------------------------------

/** The one property name, so the stylesheet, the code and any instrument agree. */
export const PLACE_GAP_PROP = '--place-gap';

/** The gap `el` declares, in the local px this module writes in. 0 if undeclared. */
export function placeGap(el) {
  const n = parseFloat(getComputedStyle(el).getPropertyValue(PLACE_GAP_PROP));
  return Number.isFinite(n) ? n : 0;
}

const overlapArea = (a, b) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/**
 * placeAnchored(el, anchor, { intent, ... }) → { left, top, width, height }
 *
 * Writes `el`'s style.left/top in the local space of `layer` and returns the box
 * it resolved, so a caller that needs to do more with it (a max-height off the
 * remaining room) has the number rather than re-deriving it.
 *
 *   intent  'beside' — any of right / left / below / above, first that fits.
 *                      A ZERO-EXTENT anchor (a tap has no element) degenerates to
 *                      the offset-from-the-point rule, per-axis flip and all —
 *                      arithmetic, not a second branch at the call site.
 *           'left'   — toward the centre from a right-edge anchor, falling
 *                      through right / below / above only when it cannot fit.
 *           'right'  — toward the centre from a left-edge anchor, with the
 *                      mirrored fallback order.
 *           'above'  — above it when possible, otherwise under it. This is the
 *                      card/tray instruction intent: keep the explanation out
 *                      of the component being held or resized.
 *           'under'  — under it, and only under it. When it does not fit, the
 *                      bound answers; that is the caller's declared preference,
 *                      not a failure to consider the alternatives.
 *   align   'start' | 'center' | 'end' — where the anchor's free axis lines up
 *                      for 'above' and 'under'; 'beside' slides the free axis
 *                      to stay on screen, which is what made three of its
 *                      candidates usable at all.
 *   clear   an element or box to KEEP OFF IF IT CAN — the anchor's own group,
 *           named at the call site. Of the candidates that fit, the one that
 *           overlaps this least wins; ties fall to the declared order, so a
 *           caller that passes nothing gets exactly `first that fits`. It is a
 *           PREFERENCE and never a veto: when no candidate can clear the group,
 *           the answer is the one the caller would have got without it.
 *   layer   the containing block, VIEWPORT_ORIGIN by default (a `fixed` element).
 *   view    that container's box, in its own local space.
 *   pad     the screen margin, one home for both the fit test and the bound.
 *   keep    passed to clampBox. Infinity — a placed panel is read.
 */
export function placeAnchored(el, anchor, {
  intent,
  align = 'start',
  clear = null,
  layer = VIEWPORT_ORIGIN,
  view = null,
  pad = 4,
  keep = Infinity,
} = {}) {
  if (!['beside', 'left', 'right', 'above', 'under'].includes(intent)) {
    throw new Error(`placeAnchored: intent must be 'beside', 'left', 'right', 'above', or 'under', got ${JSON.stringify(intent)}`);
  }
  const room = view || viewportLocalBox();
  const gap = placeGap(el);
  // MEASURE ITS NATURAL BOX, NOT THE ONE ITS LAST POSITION SQUEEZED IT INTO.
  // A `fixed`/`absolute` element with a max-width and no width is laid out in the
  // space between style.left and the far edge: parked at 384 in a 433-wide room it
  // gets 49 px, wraps tall and narrow, and THAT is the box the next placement is
  // computed from — the same tooltip measured 280x220 or 171x384 depending only on
  // what you hovered before it. Zeroing first costs one layout and makes the
  // measurement a property of the CONTENT. Found in tooltip.js; it was never a
  // tooltip fact.
  el.style.left = '0px';
  el.style.top = '0px';
  const b = anchorLocalBox(layer, el);
  const a = anchorLocalBox(layer, anchor);
  const box = (p) => ({ left: p.left, top: p.top, width: b.width, height: b.height });
  // 4 low, 8 high — one home now (`pad` and `pad * 2`), the two literals tooltip.js
  // carried. The same `pad` goes to clampBox below, so the fit test and the bound
  // cannot disagree about where the screen ends.
  const fits = (p) => p.left >= pad && p.top >= pad
    && p.left + b.width <= room.width - pad * 2 && p.top + b.height <= room.height - pad * 2;

  let at0;
  if (intent === 'beside' && !(a.width || a.height)) {
    // A POINT has no sides to be outside of, so "outside the anchor" degenerates
    // to the offset-from-the-pointer rule — which is what a tap wants anyway.
    // These four lines are tooltip.js's ORIGINAL arithmetic, unchanged, including
    // the independent per-axis flip: this path is not being retuned, and keeping
    // it verbatim is how that is checkable rather than asserted.
    let left = a.left + gap;
    let top = a.top + gap;
    if (left + b.width > room.width - pad * 2) left = a.left - b.width - gap;
    if (top + b.height > room.height - pad * 2) top = a.top - b.height - gap;
    at0 = { left, top };
  } else {
    // ONLY THE SEPARATING AXIS IS PINNED. A tooltip below a control has to be
    // below it; it does not have to be left-aligned with it, and pinning the free
    // axis as well is what made three candidates fail — the below/above ones were
    // rejected for horizontal overflow while the vertical room they existed to use
    // sat empty.
    const anchoredX = align === 'end'
      ? a.left + a.width - b.width
      : align === 'center'
        ? a.left + (a.width - b.width) / 2
        : a.left;
    const slideX = Math.min(Math.max(pad, anchoredX), Math.max(pad, room.width - pad * 2 - b.width));
    const slideY = Math.min(Math.max(pad, a.top), Math.max(pad, room.height - pad * 2 - b.height));
    const under = { left: slideX, top: a.top + a.height + gap };
    const above = { left: slideX, top: a.top - b.height - gap };
    const aboveLeft = { left: a.left - b.width - gap, top: above.top };
    const aboveRight = { left: a.left + a.width + gap, top: above.top };
    const right = { left: a.left + a.width + gap, top: slideY };
    const left = { left: a.left - b.width - gap, top: slideY };
    const candidates = intent === 'under' ? [under]
      // 'above' flips BELOW before it goes sideways (CURRENT-SPECIFICATION,
      // Tooltips: "anchor above trigger, flip below / shift within viewport").
      : intent === 'above' ? [above, aboveLeft, aboveRight, under, right, left]
        : intent === 'left' ? [left, right, under, above]
          : intent === 'right' ? [right, left, under, above] : [
      right,
      left,
      { left: slideX, top: a.top + a.height + gap },  // below it
      above,
    ];
    const usable = candidates.filter(fits);
    if (clear && usable.length > 1) {
      const clearBoxes = (Array.isArray(clear) ? clear : [clear])
        .filter(Boolean)
        .map((candidate) => anchorLocalBox(layer, candidate));
      // LEAST OVERLAP, NOT "MUST CLEAR". A veto would have no answer on the shape
      // where the group fills the room, and "no answer" resolves to the bound,
      // which lands ON the group — worse than the candidate that grazes it.
      let best = usable[0];
      const blockedArea = (candidate) => clearBoxes.reduce((sum, clearBox) => sum + overlapArea(box(candidate), clearBox), 0);
      let bestArea = blockedArea(best);
      for (const p of usable.slice(1)) {
        const area = blockedArea(p);
        if (area < bestArea) { best = p; bestArea = area; }
      }
      at0 = best;
    } else {
      at0 = usable[0] || candidates[0];
    }
  }
  // …and then bound it regardless, so a wrong answer above is a misplaced panel
  // and never an absent one. When no side fits, this is what puts it back on
  // screen — ON the control, which is the right trade: unreadable beats
  // misplaced, absent beats neither.
  const at = clampBox(box(at0), room, { pad, keep });
  el.style.left = `${at.left}px`;
  el.style.top = `${at.top}px`;
  return { left: at.left, top: at.top, width: b.width, height: b.height };
}

const combatReadoutLayers = new WeakMap();

// Text feedback shares the combat root's ruler and escapes the sprite-FX
// stacking context. Callers retain their original FX layer for sprite effects.
export function combatReadoutLayer(layer, create = true) {
  const combat = layer?.closest?.('.combat');
  if (!combat) return layer;
  let host = combatReadoutLayers.get(combat);
  if (host?.parentNode === combat) return host;
  if (!create) return null;
  host = document.createElement('div');
  host.className = 'combat-floater-layer';
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'visible', zIndex: '800' });
  // One text size for every floater (owner, 2026-11-05; content/config floaterStack.json). The config is in design px
  // at the 10 px root, so rem keeps the player's display scale; the vw term shrinks it on a phone down to the minimum.
  host.style.setProperty('--floater-font', `clamp(${FLOATER_STACK.floaterFontMinPx / 10}rem, ${FLOATER_STACK.floaterFontVw}vw, ${FLOATER_STACK.floaterFontPx / 10}rem)`);
  host.style.setProperty('--floater-shift-ms', `${FLOATER_STACK.floaterShiftMs}ms`);
  combat.appendChild(host);
  combatReadoutLayers.set(combat, host);
  return host;
}

/**
 * Spawn a floating number over an anchor element (owner, 2026-11-05: one sequenced column per combatant).
 *
 * EXPORTED so an instrument can drive the SHIPPED function with the exact
 * strings that were measured clipping, rather than a copy of it that would
 * agree with itself (#69).
 *
 * Every floater over one combatant (damage, heal, Block, status words, callouts) shares one stack
 * (ui/floaterStack.js): it spawns `floaterStaggerMs` after the previous one, at the same x above the head, and the
 * earlier ones are lifted a line each. The element is made now and returned; it joins the layer when its turn
 * comes (a damage number's turn is at once). `onSpawn` runs when it joins the layer, so its sound plays with it.
 * There are no side lanes and no jitter, so a caller passes no placement.
 */
export function floatNum(layer, anchor, text, cls, tint, { onSpawn = null } = {}) {
  if (!layer || !anchor) return;
  layer = combatReadoutLayer(layer);
  const el = document.createElement('div');
  el.className = `float-num ${cls}`;
  const feedbackComponent = /\bblk\b/.test(cls)
    ? UI.guardedDamageIndicator
    : (/\bdmg\b/.test(cls) ? UI.healthDamageIndicator : UI.damageFeedback);
  markUiComponent(el, feedbackComponent);
  el.dataset.uiParentComponent = UI.damageFeedback;
  el.textContent = text;
  if (tint) el.style.color = tint; // #61: proc floats carry their row's tint
  const life = floaterLifeMs();
  el.style.setProperty('--float-ms', `${life}ms`);
  // The number outlives its animation by a beat, as it always has.
  // A damage number never waits behind the column (its bars follow in the same beat, so it must paint first); it
  // spawns at once at the bottom and the other floaters stagger after it. `onSpawn` is the floater's own sound.
  const immediate = /\b(dmg|burst)\b/.test(cls);
  enqueueFloater({ layer, anchor, el, kind: 'number', lifeMs: life + 60, immediate, onSpawn });
  return el;
}
// How many floaters of `line` px (plus `gap` px between them) fit in `room` px above the HUD (see FLOAT_EDGE_PX).
// A floater rises about 30 px before it fades (num-life, styles/combat.css), so the top one keeps that much
// clear of the battlefield top besides the 4 px gap above the HUD and the 6 px margin.
const FLOAT_EDGE_PX = 40;
export function floaterLanesFit(room, line, gap = line * 0.35, edge = FLOAT_EDGE_PX) {
  if (room - edge - line < 0) return 0;
  return Math.floor((room - edge - line) / (line + gap)) + 1;
}
// The top of the room the column may use: the battlefield top, or the bottom of the combat top bar
// (cinders, icon buttons, turn banner) when that sits lower. Layer px.
// Another combatant standing wholly above this one's HUD and overlapping its column (a back-rank enemy over
// the player on a phone) also caps the room, so the column never rises into that figure or its badges.
function floaterRoomTop(layer, view, zoom, anchor = null, b = null, ceiling = null) {
  const combat = layer.closest?.('.combat');
  let top = view.top;
  const bar = combat?.querySelector?.('.topbar');
  if (bar) {
    const box = anchorLocalBoxCached(layer, bar, zoom);
    if (box.height > 0) top = Math.max(top, box.top + box.height);
  }
  if (anchor && b && ceiling != null && combat?.querySelectorAll) {
    const own = anchor.closest?.('.combatant');
    for (const other of combat.querySelectorAll('.combatant')) {
      if (other === own || other.contains?.(anchor)) continue;
      const box = anchorLocalBoxCached(layer, other, zoom);
      if (!(box.width > 0 && box.height > 0)) continue;
      const bottom = box.top + box.height;
      const overlapsX = box.left < b.left + b.width && box.left + box.width > b.left;
      if (overlapsX && bottom <= ceiling) top = Math.max(top, bottom);
    }
  }
  return top;
}
// Floaters start above the combatant's overhead HUD (HP bar, badges, intent), not through it
// (owner, 2026-11-02). The ceiling is the highest top edge of the HUD pieces over the figure's head, in
// layer px, or null when none sits there. Same pieces and tests as overheadFloor, other edge.
export function overheadCeiling(layer, anchor, b, zoom) {
  const root = anchor.closest?.('.combatant');
  if (!root?.querySelectorAll) return null;
  let ceiling = null;
  for (const node of root.querySelectorAll(OVERHEAD_SELECTOR)) {
    if (anchor.contains?.(node)) continue;
    const box = anchorLocalBoxCached(layer, node, zoom);
    if (!(box.width > 0 && box.height > 0)) continue;
    const overlapsX = box.left < b.left + b.width && box.left + box.width > b.left;
    // Any piece of this combatant's HUD above the figure's middle counts, however far above the head (the
    // intent sits a full row up).
    if (overlapsX && box.top < b.top + b.height / 2) ceiling = Math.min(ceiling ?? Infinity, box.top);
  }
  return ceiling;
}

// Per combatant (its anchor element): the sequenced column, plus the tallest floater measured so far (every
// floater is one font size, so one line height sets the spacing).
const floaterStacks = new WeakMap();
// Every stack that has fed a layer, so a click-skip can drop the floaters still waiting there.
const floaterStacksByLayer = new WeakMap();
const FALLBACK_LINE_PX = Math.round(FLOATER_STACK.floaterFontPx * 1.2);
const FLOATER_EARLY_MS = 180;
function stackFor(layer, anchor) {
  let rec = floaterStacks.get(anchor);
  if (!rec) {
    // A combatant that was in the document when its first floater queued and has left it since is gone: its waiting
    // floaters are dropped. (An anchor that was never attached, as in a headless harness, is never gone.)
    rec = { line: 0 };
    rec.stack = createFloaterStack({
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) => clearTimeout(handle),
      staggerMs: () => floaterStaggerMs(),
      maxVisible: (item) => maxVisibleFor(rec, item),
      alive: (item) => floaterHostAlive(item),
      maxQueued: FLOATER_STACK.floaterMaxQueued,
      staggerMinMs: () => floaterStaggerMinMs(),
      show: (item, entry) => showFloater(rec, item, entry),
      fadeEarly: (entry) => fadeFloaterEarly(entry),
      layout: (entries) => liftFloaters(rec, entries),
    });
    floaterStacks.set(anchor, rec);
  }
  let set = floaterStacksByLayer.get(layer);
  if (!set) floaterStacksByLayer.set(layer, set = new Set());
  set.add(rec.stack);
  return rec;
}
function enqueueFloater(item) {
  // Whether the combatant was in the document when this floater queued: one that was and has left is gone. (An
  // anchor that was never attached, as in a headless harness, is never gone.)
  item.wasAttached = item.anchor.isConnected !== false && item.layer.isConnected !== false;
  item.eid = item.anchor.closest?.('[data-eid]')?.dataset?.eid ?? null;
  return stackFor(item.layer, item.anchor).stack.push(item);
}
// Is the combatant this waiting floater belongs to still on screen? A rebuilt figure (the player's art key
// re-arms, a re-render) is a new element with the same data-eid: the floater is retargeted to it, not dropped.
function floaterHostAlive(item) {
  if (!item.wasAttached) return true;
  if (item.layer.isConnected === false) return false;
  if (item.anchor.isConnected !== false) return true;
  if (item.eid == null) return false;
  const root = item.layer.closest?.('.combat') || item.layer.ownerDocument;
  const next = root?.querySelector?.(`[data-eid="${item.eid}"] .sprite`) || root?.querySelector?.(`[data-eid="${item.eid}"]`);
  if (!next) return false;
  item.anchor = next;
  return true;
}
// One floater's step up the column: its own line plus the gap (floaterLineGapPx).
function floaterStepPx(rec) {
  return (rec.line || FALLBACK_LINE_PX) + FLOATER_STACK.floaterLineGapPx;
}
// Where the column starts and how many floaters it can hold. The slot-0 floater sits just above the combatant's
// overhead HUD, as the owner asked on 2026-11-02 (never over the HUD), when at least two lines fit between the HUD
// and the top of the battlefield; otherwise it starts on the figure (a quarter of the way down, where damage
// numbers always showed) and the column rises over the HUD. With no HUD it starts just above the head. The cap is
// floaterMaxVisible, fewer when the room above the start cannot hold that many (never below one, or two on the figure).
const FLOAT_RISE_RESERVE_PX = 6; // the page margin; a floater's last 30 px of rise is a fade, so it may drift over the top bar
function columnStart(rec, layer, anchor, b, zoom, view) {
  const cap = Math.max(1, Math.floor(FLOATER_STACK.floaterMaxVisible));
  const line = rec.line || FALLBACK_LINE_PX, gap = FLOATER_STACK.floaterLineGapPx;
  const ceiling = overheadCeiling(layer, anchor, b, zoom);
  const roomTop = floaterRoomTop(layer, view, zoom, anchor, b, ceiling);
  const edge = ceiling ?? b.top + 8; // no HUD: the column starts just above the head
  const above = floaterLanesFit(edge - 4 - roomTop, line, gap, FLOAT_RISE_RESERVE_PX);
  if (ceiling == null || above >= 2) return { bottom: edge - 4, cap: Math.max(1, Math.min(cap, above)) };
  const top = b.top + b.height * 0.25;
  return { top, cap: Math.max(2, Math.min(cap, floaterLanesFit(top + line - roomTop, line, gap, FLOAT_RISE_RESERVE_PX))) };
}
function maxVisibleFor(rec, item) {
  try {
    const { layer, anchor } = item;
    const zoom = uiZoom();
    return columnStart(rec, layer, anchor, anchorLocalBoxCached(layer, anchor, zoom), zoom, anchorLocalBoxCached(layer, layer, zoom)).cap;
  } catch { return Math.max(1, Math.floor(FLOATER_STACK.floaterMaxVisible)); }
}
// Lift every visible floater by its slot (how many newer floaters are showing). Under Reduced motion the CSS drops
// the transition, so the column still stacks but nothing glides.
function liftFloaters(rec, entries) {
  // An empty column forgets its measured line, so a smaller font (a rotated phone) is not held to an old height.
  if (!entries.length && !rec.stack.visible.length) rec.line = 0;
  const step = floaterStepPx(rec);
  for (const entry of entries) {
    const el = entry.item.el;
    el.dataset.floatSlot = String(entry.slot);
    if (entry.slot > 0) el.style.setProperty('--float-lift', `${Math.round(entry.slot * step)}px`);
    else el.style.removeProperty('--float-lift');
  }
}
// The cap was exceeded: the oldest fades early (CSS .float-early adds a quick opacity fade), then goes.
function fadeFloaterEarly(entry) {
  const el = entry.item.el;
  el.classList.add('float-early');
  setTimeout(() => el.remove(), FLOATER_EARLY_MS + 20);
}

function showFloater(rec, item, entry) {
  const { layer, anchor, el } = item;
  if (typeof item.onSpawn === 'function') { try { item.onSpawn(); } catch { /* a sound must not stop its number */ } }
  const zoom = uiZoom();
  const b = anchorLocalBoxCached(layer, anchor, zoom);
  const view = anchorLocalBoxCached(layer, layer, zoom);
  // CENTRED BY CSS, NOT BY ARITHMETIC. `left` is the float's CENTRE and
  // `.float-num { translate: -50% ... }` takes off its own half-width — so the
  // width is the browser's to know and nobody's to maintain (#69). `translate` is the
  // standalone property on purpose: num-pop animates `transform`, and the two compose.
  const centre = b.left + b.width / 2;
  el.style.left = `${centre}px`;
  el.style.top = `${b.top + 4}px`;
  el.dataset.floatSlot = String(entry.slot);
  layer.appendChild(el);
  // In the DOM, so the size is REAL — emoji, ligatures and all, measured by layout rather than guessed from the
  // string. The measure waits for the end of this task (before paint), so every float and word of a beat shares
  // one layout flush instead of forcing one apiece.
  measureThenMutate(el, () => {
    const width = el.offsetWidth, height = el.offsetHeight;
    const half = width / 2;
    // The line is measured BEFORE the column's start is chosen, and the start is kept while the column has an older
    // floater, so one sequence is one strictly ordered stack even when the measured line differs from the fallback.
    if (height > rec.line) rec.line = height;
    const others = rec.stack.visible.some((e) => e.item !== item);
    if (!others || !rec.start) rec.start = columnStart(rec, layer, anchor, b, zoom, view);
    const start = rec.start;
    const placed = start.top ?? start.bottom - height;
    const at = clampBox({ left: centre - half, top: placed, width, height }, view, { pad: 6 });
    return () => {
      el.style.left = `${at.left + half}px`;
      el.style.top = `${at.top}px`;
      liftFloaters(rec, rec.stack.visible);
    };
  });
  // The element leaves at the end of its life; a skip removes it sooner.
  setTimeout(() => el.remove(), item.lifeMs);
  return el;
}

// ---------------------------------------------------------------------------
// On-character callouts (owner, 2026-10-11): one short word that rises from
// above a fighter's head — STAGGERED, COUNTERED, EVADED, CRITICAL, GUARD BREAK.
// Larger than a damage float and coloured per kind; the words are UI strings.
// Two on one fighter stack (never overlap) and at most two show at once; the
// same word already showing on that fighter is not repeated.
// ---------------------------------------------------------------------------
export const CALLOUT_KINDS = {
  hit: { string: 'combat.callout.hit', tone: 'white' },
  evadeFailed: { string: 'combat.callout.evadeFailed', tone: 'white' },
  missed: { string: 'combat.callout.missed', tone: 'white' },
  // Insight contests (SPEC §17 Contests): the word over the target a Read Intent style spell read or failed to read.
  contestPassed: { string: 'combat.callout.contestPassed', tone: 'white' },
  contestFailed: { string: 'combat.callout.contestFailed', tone: 'white' },
  outOfRange: { string: 'combat.callout.outOfRange', tone: 'white' },
  dodged: { string: 'combat.callout.dodged', tone: 'white' },
  staggered: { string: 'combat.callout.staggered', tone: 'gold' },
  disrupted: { string: 'combat.callout.disrupted', tone: 'gold' },
  countered: { string: 'combat.callout.countered', tone: 'red' },
  evaded: { string: 'combat.callout.evaded', tone: 'white' },
  critical: { string: 'combat.callout.critical', tone: 'red' },
  guardBreak: { string: 'combat.callout.guardBreak', tone: 'red' },
  wardBreak: { string: 'combat.callout.wardBreak', tone: 'ward' },
  barrierBreak: { string: 'combat.callout.barrierBreak', tone: 'barrier' },
  blockBreak: { string: 'combat.callout.blockBreak', tone: 'block' },
  interrupted: { string: 'combat.callout.interrupted', tone: 'interrupt' },
  poiseBreak: { string: 'combat.callout.poiseBreak', tone: 'gold' },
  // Outcome words (owner, 2026-10-12): a hit that does no HP damage shows one of these instead of its numbers.
  resisted: { string: 'combat.callout.resisted', tone: 'barrier' },
  wardResisted: { string: 'combat.callout.resisted', tone: 'ward' },
  blocked: { string: 'combat.callout.blocked', tone: 'block' },
  immune: { string: 'combat.callout.immune', tone: 'immune' },
  // An enemy weakness met (SPEC 5.3). There is no "resisted" counterpart for it.
  weak: { string: 'combat.callout.weak', tone: 'gold' },
};
export const CALLOUT_MS = 900; // legacy base; live words use calloutLifeMs() (animationPace.js)
export const CALLOUT_INSTANT_MS = COMBAT_TIMING.calloutInstantMs;
// The words over one fighter (owner, 2026-10-12) used to show three at a time in three lanes. They now share the
// fighter's one floater column (owner, 2026-11-05; ui/floaterStack.js): a word spawns floaterStaggerMs after the
// floater before it, at most floaterMaxVisible show at once, and nothing is dropped. STACK_STEP_MS stays the
// beat's lead for an accuracy word ahead of the result.
export const STACK_STEP_MS = 150;
// The fighter's overhead HUD pieces drawn over the top of its figure.
const OVERHEAD_SELECTOR = '.combatant-leading, .overhead-control, .as-meters';

/**
 * Priority of a word, highest first: STATUS > MISSED > IMMUNE > BREAKS (and the
 * stagger/crit words that land with them) > BLOCKED > RESISTED. Among the words waiting in one
 * fighter's column the higher priority spawns first (ties keep arrival order); numbers keep their own order.
 */
export function stackPriority(kind = '') {
  if (String(kind).startsWith('status:')) return 6;
  if (kind === 'evaded') return 5;
  if (kind === 'immune') return 4;
  if (kind === 'blocked') return 2;
  if (kind === 'resisted' || kind === 'wardResisted') return 1;
  return 3;
}

/** Show callout `kind` over `anchor` (fighter `forId`) in `layer`; returns the element, or null. */
export function callout(layer, anchor, forId, kind) {
  const isStatus = kind.startsWith('status:');
  const statusId = isStatus ? kind.slice('status:'.length) : null;
  const def = kind.startsWith('action:') ? { word: kind.slice(7), tone: 'white' } : isStatus
    ? (Object.prototype.hasOwnProperty.call(STATUS_WORDS, statusId) ? { string: `combat.status.applied.${statusId}`, tone: 'status', colour: STATUS_WORDS[statusId].colour } : null)
    : CALLOUT_KINDS[kind];
  return queuedCallout(layer, anchor, forId, kind, def);
}

// Buff gains use the same column and cleanup as outcome words. Each
// committed gain stays visible even when two receipts have the same amount.
function queuedCallout(layer, anchor, forId, kind, def, repeat = false) {
  if (!layer || !anchor || !def || forId == null) return null;
  layer = combatReadoutLayer(layer);
  const rec = stackFor(layer, anchor);
  const same = (item) => item.kind === kind && item.forId === String(forId);
  if (!repeat && (rec.stack.has(same) || liveCallouts(layer, forId).some((node) => node.dataset.calloutKind === kind))) return null;
  const el = document.createElement('div');
  el.className = `fx-callout ${def.tone}`;
  el.dataset.calloutFor = String(forId);
  el.dataset.calloutKind = kind;
  el.setAttribute('aria-hidden', 'true');
  el.textContent = def.word || t(def.string);
  if (def.colour) el.style.color = def.colour;
  const ms = calloutLifeMs();
  el.style.setProperty('--fx-callout-ms', `${ms}ms`);
  rec.stack.push({ layer, anchor, el, kind, forId: String(forId), rank: stackPriority(kind), lifeMs: ms, word: true });
  return el;
}
const liveCallouts = (layer, forId) => [...(layer.children || [])]
  .filter((node) => node.dataset?.calloutFor === String(forId));

/** A click-skip ends every callout in the layer. */
export function clearCallouts(layer) {
  layer = combatReadoutLayer(layer, false);
  for (const node of [...(layer?.children || [])]) if (node.dataset?.calloutFor !== undefined) node.remove();
  dropWaitingFloaters(layer);
}
// Every floater still waiting for its turn goes (damage numbers never wait); a word that was showing leaves its column.
function dropWaitingFloaters(layer) {
  // Numbers keep their lifetime through a skip (combat-readout-layer test).
  for (const stack of (layer && floaterStacksByLayer.get(layer)) || []) {
    stack.drop((item) => item.word === true, { visible: true });
    stack.dropWaiting();
  }
}

/**
 * One semantic split for every attack hit.
 * `amount` is the authoritative pre-block total; `blocked` is guard consumed.
 * Guard consumption is unsigned. Guard gain remains the separate +N channel.
 */
export function guardHitFloatParts(event, targetMaxHp = 0) {
  const amount = Math.max(0, Number(event && event.amount) || 0);
  const blocked = Math.min(amount, Math.max(0, Number(event && event.blocked) || 0));
  const residual = amount - blocked;
  // The whole hit as it reached the layers. `event.amount` is what is left AFTER Barrier, Ward and Poise,
  // so the floater reads the same sum the combat log does (owner, 2026-11-02: show the actual hit).
  const full = hitAsLayered(event);
  // What Barrier (blue) and Ward (purple) absorbed before the hit reached
  // Block (blue) and Health (red), each its own unsigned number.
  const barrier = Math.max(0, Number(event && event.barrierAbsorbed) || 0);
  const ward = Math.max(0, Number(event && event.wardAbsorbed) || 0);
  const magicPoise = Math.max(0, Number(event && event.magicPoise) || 0);
  const poise = Math.max(0, (Number(event && event.poiseAbsorbed) || 0) - magicPoise);
  // The Force part a Silenced target was immune to (the rest of the hit landed).
  const forceImmune = Math.max(0, Number(event && event.forceImmune) || 0);
  const pierced = Math.max(0, Number(event && event.pierced) || 0);
  return {
    amount,
    blocked,
    residual,
    // A hit Barrier stopped outright reads RESISTED.
    barrier: barrier > 0 ? { text: amount === 0 && ward === 0 ? `${barrier} RESISTED` : String(barrier), cls: 'barrier small' } : null,
    ward: ward > 0 ? { text: String(ward), cls: 'ward small' } : null,
    poise: poise > 0 ? { text: t('combat.receipt.poiseAbsorbed', { n: poise }), cls: 'poise small' } : null,
    // The part of a piercing hit that went past Block (owner, 2026-10-26); Poise met it first.
    // Magic hits Poise first, 1:1 (owner, 2026-10-31).
    magicPoise: magicPoise > 0 ? { text: t('combat.receipt.magicPoise', { n: magicPoise }), cls: 'poise small' } : null,
    pierced: pierced > 0 ? { text: t('combat.receipt.pierced', { n: pierced }), cls: 'pierce small' } : null,
    immune: forceImmune > 0 ? { text: `${forceImmune} IMMUNE`, cls: 'immune small' } : null,
    guard: blocked > 0 ? { text: String(blocked), cls: 'blk small' } : null,
    // The number floats the FULL hit before Block / Poise / Ward / Barrier; the Block badge drops by the guard
    // on its own. `damage` stays null for a hit that cost no HP so the flinch, shake and outcome words key off
    // HP loss as before; `fullHit` is the number a guarded hit that cost no HP floats (beside BLOCKED or Pierced).
    full,
    damage: residual > 0 ? { text: `-${full}`, cls: dmgClass(full, targetMaxHp) } : null,
    // Unsigned and not `dmg`: no HP was lost, so it must not read as HP loss (guard colour, damage size tier).
    fullHit: full > 0 ? { text: String(full), cls: `blk ${dmgClass(full, targetMaxHp).replace(/^dmg\s*/, '')}`.trim() } : null,
  };
}

// Damage size tier. A hit that takes a big share of the target's max HP pops
// biggest (pct35 at 35% or more, pct20 at 20% or more), whatever its absolute
// size; with no max HP known, or a smaller share, the absolute tiers apply:
// crit (big hits pop hardest), heavy, normal, chip.
export function dmgClass(amount, targetMaxHp = 0) {
  const pct = targetMaxHp > 0 ? amount / targetMaxHp : 0;
  if (pct >= HUGE_HIT_SHARE) return 'dmg pct35';
  if (amount >= 25) return 'dmg crit'; // crit (4.4rem) still outranks pct20 (3.6rem): the biggest tier that applies wins
  if (pct >= BIG_HIT_SHARE) return 'dmg pct20';
  if (amount >= 15) return 'dmg heavy';
  if (amount < 6) return 'dmg small';
  return 'dmg';
}

/** Spawn a transient effect element (slash arc, cast glyph, block spark…). */
function spawnFx(layer, anchor, cls, ms, text) {
  if (!layer || !anchor || effectsOff()) return; // Effects off: no sparks, slashes or glyphs (numbers and callouts stay)
  const b = anchorLocalBox(layer, anchor);
  const el = document.createElement('div');
  el.className = cls;
  if (text) el.textContent = text;
  el.style.left = `${b.left + b.width / 2}px`;
  el.style.top = `${b.top + b.height * 0.4}px`;
  el.style.setProperty('--rot', `${Math.round(Math.random() * 50 - 25)}deg`);
  layer.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// lifeMs, when given, is how long the banner shows and fades (the turn banner
// passes its pace's hold, so it is gone before the next beat starts).
export function banner(layer, text, cls = '', lifeMs = null) {
  if (!layer) return;
  const el = document.createElement('div');
  el.className = `fx-banner ${cls}`;
  el.textContent = text;
  if (lifeMs > 0) el.style.setProperty('--fx-banner-ms', `${lifeMs}ms`);
  layer.appendChild(el);
  setTimeout(() => el.remove(), lifeMs > 0 ? lifeMs : 320);
}

// Hit-stop (SPEC §7.4). `hitStop` is set by playTimeline only while the hit
// that earned the hold runs its visual, so that visual starts its target's
// recoil held and lengthens it by the same amount (never cut short).
let hitStop = 0;
const heldFigures = new Map();
function hold(el, ms) {
  if (!el || !(ms > 0) || effectsOff()) return;
  const swing = flashTimers.get(el)?.get('act-attack');
  if (swing) {
    clearTimeout(swing.id); swing.due += ms;
    swing.id = setTimeout(() => {
      el.classList.remove('act-attack'); flashTimers.get(el)?.delete('act-attack');
    }, Math.max(0, swing.due - Date.now()));
  }
  clearTimeout(heldFigures.get(el));
  el.classList.add('hit-stop');
  heldFigures.set(el, setTimeout(() => {
    el.classList.remove('hit-stop');
    heldFigures.delete(el);
  }, ms));
}

function clearHeldFigures() {
  for (const [el, timer] of heldFigures) {
    clearTimeout(timer);
    el.classList.remove('hit-stop');
    stageFor(el)?.settle?.({ reaction: true });
  }
  heldFigures.clear();
}

// A smaller hit does not cut a bigger shake short: while one plays, only a
// shake at least as big restarts it.
const SHAKE_MS = 200;
const shakeStates = new WeakMap();
const FIXED_SHAKE_PX = 4; // a stagger's shake: the old fixed amplitude, not scaled by a hit
function shake(combatEl, px = FIXED_SHAKE_PX) {
  if (!combatEl || !(px > 0) || effectsOff()) return;
  // Honor the Screen shake setting (and reduced motion, which also drops it).
  if (document.body.classList.contains('no-shake') || reducedMotionRequested()) return;
  const now = Date.now();
  const { shakeUntil = 0, shakeNow = 0 } = shakeStates.get(combatEl) || {};
  if (now < shakeUntil && px < shakeNow) return;
  shakeStates.set(combatEl, { shakeUntil: now + SHAKE_MS, shakeNow: px });
  combatEl.style.setProperty('--shake-px', `${px}px`);
  // The class stays on after the first shake, so a later one must restart the
  // running or finished CSS animations. Doing that through the Web Animations API
  // costs no style flush; the old remove / read offsetWidth / add restyled the
  // whole combat tree synchronously (77-109 ms per play on a phone profile).
  if (combatEl.classList.contains('shake') && typeof combatEl.getAnimations === 'function') {
    const running = combatEl.getAnimations({ subtree: true }).filter(a => a.animationName === 'shake');
    if (running.length) { for (const animation of running) animation.currentTime = 0; return; }
  }
  // Only a class that is already on needs a style flush between remove and add
  // to restart its finished animation; a first shake just starts.
  if (combatEl.classList.contains('shake')) {
    combatEl.classList.remove('shake');
    void combatEl.offsetWidth; // restart animation
  }
  combatEl.classList.add('shake');
}

// Add a short-lived CSS class (restarting its animation if already present).
const flashTimers = new WeakMap();
// Fighter motion (lunge, hit recoil, stagger wobble) rides this same helper but is
// governed by its own motion options in CSS, not by Effects.
const MOTION_FLASH = new Set(['act-attack', 'act-move', 'hitflash', 'hit-heavy', 'wobble']);
function flash(el, cls, ms = 300, pauseMs = 0) {
  if (!el) return;
  if (effectsOff() && !MOTION_FLASH.has(cls)) return; // relic proc / orb pulse flashes
  // Photosensitivity: suppress bright impact/proc flashes when asked. Damage
  // numbers and HUD updates (which carry the actual info) are unaffected.
  if (document.body.classList.contains('reduce-flashes')) return;
  const timers = flashTimers.get(el) || new Map();
  flashTimers.set(el, timers);
  clearTimeout(timers.get(cls)?.id);
  if (cls === 'hitflash') {
    clearTimeout(timers.get('hit-heavy')?.id); timers.delete('hit-heavy');
    el.classList.remove('hit-heavy');
    el.style.setProperty('--hurt-duration', `${ms}ms`);
  }
  // The flush that restarts a running animation is only needed when the class is already on.
  if (el.classList.contains(cls)) {
    el.classList.remove(cls);
    void el.offsetWidth;
  }
  el.classList.add(cls);
  const entry = { due: Date.now() + ms + pauseMs };
  entry.id = setTimeout(() => { el.classList.remove(cls); timers.delete(cls); }, ms + pauseMs);
  timers.set(cls, entry);
}

// Radial flare over an anchor (stance entries, big procs).
function flare(layer, anchor, color) {
  if (!layer || !anchor || effectsOff()) return;
  const b = anchorLocalBox(layer, anchor);
  const el = document.createElement('div');
  el.className = 'stance-flare';
  el.style.left = `${b.left + b.width / 2 - 90}px`;
  el.style.top = `${b.top + b.height / 2 - 90}px`;
  el.style.background = `radial-gradient(circle, ${color} 0%, transparent 65%)`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 320);
}

/**
 * animateEvents(events, ctx, done)
 *   ctx = { layer, combatEl, anchorFor(entityId) → element|null }
 * Events are staggered COMBAT_TIMING.instantStepMs apart; clicking anywhere flushes instantly.
 */
export function animateEvents(events, ctx, done) {
  const receiptVisuals = { reactionForReceipt: ctx.reactionForReceipt };
  flushRequested = false;
  // Beat by beat, as the paced timeline cues them, so instant or
  // reduced-motion playback makes the same sounds as Normal pacing, in the
  // same order: a beat's cues sound just before its first visual step (an
  // enemy's hits land before "your turn" stings), and beats with no visual
  // of their own sound when the walk passes them, or at the end.
  const beats = groupBeats(events);
  const beatOf = new Map();
  beats.forEach((beat, b) => { for (const e of beat.events) if (!beatOf.has(e)) beatOf.set(e, b); });
  let cued = 0;
  const cueThrough = (b) => { while (cued <= b && cued < beats.length) playBeatCues(beats[cued++].events, { maxHpFor: ctx.maxHpFor }); };
  pending = events.filter((e) => visualFor(e, undefined, receiptVisuals) !== null);
  const skip = (event) => {
    // A read-only control (the combat log, the Reaction switch) is not a skip, as in playTimeline.
    // It stays registered until the walk ends (removed below), so a read-only click leaves it armed.
    if (event?.target?.closest?.('[data-combat-read-only]')) return;
    dlog('input', 'tap skipped animation');
    flushRequested = true;
    if (ctx.reactionForReceipt) for (const sprite of globalThis.document?.querySelectorAll?.('.combatant .sprite') || []) {
      const stage = stageFor(sprite);
      if (stage?.reactionPoses?.length) stage.endReaction?.();
    }
    clearCallouts(ctx.layer);
  };
  addEventListener('pointerdown', skip, { capture: true });

  let i = 0;
  const step = () => {
    while (flushRequested && i < pending.length) {
      // Flushed: fire remaining sounds silently-fast, no visuals backlog.
      i++;
    }
    if (i >= pending.length) {
      cueThrough(beats.length - 1);
      removeEventListener('pointerdown', skip, { capture: true });
      if (done) done();
      return;
    }
    // A callout-only event (CRITICAL before its hit, say) plays in the same
    // tick as its neighbour, so callouts add no step to the fast path.
    // At most ONE ordinary event per tick: a callout between two hits must not
    // pull the next hit into this tick (a crit multi-hit still steps per hit).
    let hadRegular = false;
    let outcomeLead = 0;
    do {
      if (pending[i].type === 'attackHit') outcomeLead = STACK_STEP_MS * 2;
      if (!calloutOnly(pending[i], receiptVisuals)) hadRegular = true;
      cueThrough(beatOf.has(pending[i]) ? beatOf.get(pending[i]) : -1);
      const fn = visualFor(pending[i], undefined, receiptVisuals);
      if (fn) fn(ctx);
      i++;
    } while (i < pending.length && (calloutOnly(pending[i], receiptVisuals) || (!hadRegular && calloutOnly(pending[i - 1], receiptVisuals))));
    setTimeout(step, Math.max(COMBAT_TIMING.instantStepMs, outcomeLead));
  };
  step();
}

// ---------------------------------------------------------------------------
// Paced playback — one actor at a time (SPEC §7.4 extension).
//
// Groups a dispatch's event log into "beats": each card play, flask use, and
// enemy move is its own beat, played as actor animation → effect visuals →
// numbers → HUD update (ctx.onBeatApplied), before the next actor moves.
// Turn boundaries become banner beats. Click skips to the end state.
// ---------------------------------------------------------------------------

// A loose run of events with no actor, banner or draw — the cost a card pays
// (energySpent, staminaSpent, manaSpent) is emitted just before its
// cardPlayed — is not a beat of its own: as one it cost a whole inter-beat
// breath (~500 ms at Normal) before the swing began. It rides the next actor's
// beat as `lead` events, whose visuals play as that actor starts to move.
const isLoose = (beat) => !beat.actorId && !beat.banner && !beat.kind && beat.events.length > 0;
export function groupBeats(events) {
  const beats = [];
  let cur = { actorId: null, banner: null, kind: null, events: [] };
  const push = () => {
    if (cur.events.length || cur.banner || cur.actorId) beats.push(cur);
  };
  const startActor = (actorId, kind, e) => {
    const lead = isLoose(cur) ? cur.events : [];
    if (!lead.length) push();
    cur = { actorId, banner: null, kind, events: [...lead, e], ...(lead.length ? { lead } : {}) };
  };
  for (const e of events) {
    switch (e.type) {
      case 'cardPlayed':
        startActor(e.sourcePlayerId || e.playerId || 'player', e.cardType === 'attack' ? 'attack' : 'act', e);
        break;
      case 'flaskUsed':
        startActor('player', 'act', e);
        break;
      case 'enemyMoveStarted': case 'combatHitStarted':
        startActor(e.sourceId, e.kind === 'attack' ? 'attack' : 'act', e);
        cur.prepared = e.contactPrepared === true;
        break;
      case 'combatContactPrepared':
        startActor(e.sourceId, 'attack', e);
        cur.telegraph = true;
        break;
      case 'enemyActorTurnStarted':
        startActor(e.sourceId, 'reveal', e);
        break;
      case 'combatCounterTriggered':
        startActor(e.sourcePlayerId || e.sourceId, 'counter', e);
        cur.prepared = e.contactPrepared === true;
        break;
      case 'enemyTurnStart':
        push();
        cur = { actorId: null, banner: 'ENEMY TURN', kind: 'banner', events: [e] };
        break;
      case 'playerTurnStart':
        push();
        cur = { actorId: null, banner: 'YOUR TURN', kind: 'banner', events: [e] };
        break;
      case 'cardDrawn':
        // Draws fire just before 'playerTurnStart' — split them out of the
        // last enemy beat so the hand refills as its own step.
        if (cur.actorId && cur.actorId !== 'player' && cur.kind !== 'draw') {
          push();
          cur = { actorId: null, banner: null, kind: 'draw', events: [] };
        }
        cur.events.push(e);
        break;
      default:
        cur.events.push(e);
    }
  }
  push();
  return beats;
}

/**
 * playTimeline(events, ctx, done)
 *   ctx = animateEvents ctx + {
 *     onBeatApplied(beat)  — apply this beat's events to the display state
 *                            (HP/block bars, hand, statuses) AFTER its visuals,
 *     onFlush()            — skip: jump display to true final state,
 *     beatOrder?           — 'sequential' | 'impact'; defaults to the
 *                            animationPace.js setting (getBeatOrder),
 *   }
 * Uses the module anim speed; 'instant' (or reducedMotion) falls back to
 * animateEvents' classic behavior (final state + fast floats).
 */
// Debug lifecycle counters (window.__fx) — cheap, used to diagnose stuck-busy
// reports: every timeline must end in exactly one finish (done/watchdog/flush).
const dbg = typeof window !== 'undefined' ? (window.__fx = { open: 0, finished: 0, watchdog: 0 }) : {};
// Opt-in beat trace for browser QA: set window.__fx.trace = [] and each paced
// beat step pushes [performance.now(), step, detail].
const traceBeat = (step, detail) => {
  if (Array.isArray(dbg.trace)) dbg.trace.push([globalThis.performance?.now?.() ?? Date.now(), step, detail]);
};

// Is this figure in its stance? 'out' — mid-action or in a pose other than its
// rest; 'in'; or 'unknown' for a figure that cannot tell. The stage contracts
// differ, so each is read through the fields it actually exposes:
//   alternativeCardStage  presentation.action (an action is playing)
//   paintedOutfits        presentation.pose / .rest / .transition
//   enemyPoseStage        stage.pose / stage.rest getters
//   expansion stages      settle() / play() only → 'unknown'
export function stanceState(stage) {
  if (!stage) return 'in';
  const presentation = stage.presentation;
  if (presentation && typeof presentation === 'object') {
    if (Object.hasOwn(presentation, 'action')) return presentation.action ? 'out' : 'in';
    if (presentation.transition) return 'out';
    if (typeof presentation.pose === 'string' && typeof presentation.rest === 'string') {
      return presentation.pose === presentation.rest ? 'in' : 'out';
    }
  }
  if (typeof stage.pose === 'string') return stage.pose === (typeof stage.rest === 'string' ? stage.rest : 'idle') ? 'in' : 'out';
  return 'unknown';
}

// Ordered FixCore presentation. Optional impact playback remains available for
// historical callers explicitly requesting that older presentation policy.
export function playTimeline(events, ctx, done) {
  if ((ctx.beatOrder || getBeatOrder()) === 'impact') return playLegacyTimeline(events, ctx, done);
  const timing = actionPacing({ reduced: reducedMotionRequested() });
  const beats = groupBeats(events);
  const receiptOptions = { sequential: true, reactionForReceipt: ctx.reactionForReceipt };
  const visualSafe = fn => { try { return fn(); } catch (error) { console.warn('[fx] receipt visual failed:', error?.message); } };
  const parts = new Map(beats.flatMap(beat => beat.events.map(event => [event, visualSafe(() => visualPartsFor(event, beat.kind, receiptOptions))])));
  const terminal = event => ['enemyDied', 'playerDied', 'combatEnded'].includes(event.type);
  const runParts = (beat, key) => {
    for (const event of beat.events) if (!terminal(event)) visualSafe(() => parts.get(event)?.[key]?.(ctx));
  };
  // Cues belong to the committed beat, even when its multi-hit reactions are
  // split into groups. Skipping drains only beats whose numbers were unheard.
  const originalForEvent = new Map(beats.flatMap(beat => beat.events.map(event => [event, beat])));
  const cued = new Set(), stung = new Set(), buzzed = new Set();
  const cue = (beat, sounds = true) => {
    const original = originalForEvent.get(beat.events[0]) || beat;
    if (cued.has(original)) return;
    cued.add(original);
    const starts = original.events.filter(event => event.type === 'playerTurnStart');
    const stinger = starts.some(event => !stung.has(event.turn));
    const mine = starts.filter(event => localTurnStart(event));
    const turnBuzz = mine.some(event => !buzzed.has(event.turn));
    for (const event of starts) stung.add(event.turn);
    for (const event of mine) buzzed.add(event.turn);
    const options = { maxHpFor: ctx.maxHpFor, stinger, turnBuzz };
    if (sounds) playBeatCues(original.events, options);
    else playBeatHaptics(original.events, options);
  };
  let handle, skippedPointer = false;
  const skip = event => {
    if (event?.target?.closest?.('[data-combat-read-only], dialog, [role="dialog"]')) return;
    dlog('input', 'tap skipped animation');
    skippedPointer = true;
    handle?.pauseForSkip();
    // Keep the screen busy through pointer release, so the same click cannot
    // activate a newly rendered card after it skipped this action.
    clearHeldFigures(); clearCallouts(ctx.layer); clearCombatEffects(ctx.layer);
  };
  const release = () => { if (skippedPointer) handle?.skip(); };
  const blur = () => { clearCallouts(ctx.layer); handle?.skip(); };
  const visibility = () => { if (globalThis.document?.hidden || globalThis.document?.visibilityState === 'hidden') { clearCallouts(ctx.layer); handle?.skip(); } };
  addEventListener('pointerdown', skip, { capture: true });
  addEventListener('pointerup', release, { capture: true });
  addEventListener('pointercancel', release, { capture: true });
  addEventListener('blur', blur);
  globalThis.document?.addEventListener?.('visibilitychange', visibility);
  dbg.open = (dbg.open || 0) + 1;
  handle = runActionTimeline(beats, {
    onStage: (name, beat) => { traceBeat(name, beat.actorId); ctx.onStage?.(name, beat); },
    onIntent: beat => {
      const stage = beat.actorId && stageFor(ctx.anchorFor(beat.actorId));
      if (stage && stanceState(stage) !== 'in') stage.settle?.();
      ctx.onIntent?.(beat);
    },
    onAction: beat => {
      if (beat.prepared) return;
      const event = beat.events.find(e => ['cardPlayed', 'enemyMoveStarted', 'combatHitStarted', 'combatContactPrepared', 'combatCounterTriggered', 'flaskUsed'].includes(e.type));
      const maneuver = event?.combatProfile?.maneuver || event?.maneuver;
      const name = ctx.actionWordForBeat?.(beat) || event?.name || event?.cardName || event?.moveName
        || (maneuver ? maneuver[0].toUpperCase() + maneuver.slice(1) : null)
        || (event?.type === 'flaskUsed' ? 'Flask' : beat.kind === 'counter' ? t('deckEditor.stance.counter') : beat.kind === 'attack' ? t('deckEditor.stance.attack') : 'Action');
      callout(ctx.layer, ctx.anchorFor(beat.actorId), beat.actorId, `action:${name}`);
    },
    maxSpriteMs: speed => typeof ctx.maxActorAnimationMs === 'function' ? ctx.maxActorAnimationMs(speed) : Number(ctx.maxActorAnimationMs) || speed.lungeMs,
    onSprite: (beat, speed) => {
      if (timing.scale === 0 || beat.prepared) return null;
      const actorEl = ctx.anchorFor(beat.actorId);
      if (!actorEl) return null;
      const animation = ctx.animateActor?.(beat, actorEl, speed);
      if (animation && Number.isFinite(animation.totalMs) && typeof animation.cancel === 'function') return animation;
      if (ctx.figureAnimations !== false) {
        flash(actorEl, beat.kind === 'attack' || beat.kind === 'counter' ? 'act-attack' : 'act-move', speed.lungeMs);
        playPoseOn(actorEl, beat.kind === 'attack' || beat.kind === 'counter' ? 'attack' : 'guard', speed.lungeMs);
      }
      return { impactMs: speed.lungeMs * COMBAT_TIMING.windupFraction, totalMs: speed.lungeMs,
        cancel: () => { if (ctx.figureAnimations !== false) stageFor(actorEl)?.settle?.(); } };
    },
    onContact: (beat, actor) => {
      runParts(beat, 'contact');
      const hits = beat.events.filter(event => event.type === 'damageDealt');
      const holdMs = timing.scale === 0 ? 0 : hits.reduce((ms, event) => ms + hitStopMsFor(guardHitFloatParts(event).residual || 0, ctx.maxHpFor?.(event.targetId) || 0) * timing.scale, 0);
      if (holdMs && !effectsOff()) { actor?.hold?.(holdMs); hold(ctx.anchorFor(beat.actorId), holdMs); }
      if (beat.actorId && ctx.layer?.dataset) ctx.layer.dataset.contact = String((Number(ctx.layer.dataset.contact) || 0) + Math.max(1, hits.length));
      return holdMs;
    },
    reactionGroups: beat => {
      const groups = []; let group = [], hadHit = false;
      for (const event of beat.events) {
        if (hadHit && ['attackHit', 'attackMissed', 'combatAvoidanceResolved', 'damageDealt'].includes(event.type)) {
          groups.push({ ...beat, events: group }); group = []; hadHit = false;
        }
        group.push(event); if (event.type === 'damageDealt') hadHit = true;
      }
      if (group.length) groups.push({ ...beat, events: group });
      return groups;
    },
    // Accuracy is known before the target reacts; the defense/effect outcome
    // belongs after that animation, with the numeric result.
    onResult: beat => {
      const saidTargets = new Set();
      for (const event of beat.events) {
        const kind = event.type === 'attackHit' ? 'hit' : event.type === 'attackMissed' || event.type === 'attackEvaded'
          || event.type === 'combatAvoidanceResolved' && event.avoided ? 'missed'
          : event.type === 'contestPassed' || event.type === 'contestFailed' ? event.type : null;
        if (!kind || saidTargets.has(event.targetId)) continue;
        visualSafe(() => callout(ctx.layer, ctx.anchorFor(event.targetId), event.targetId, kind));
        saidTargets.add(event.targetId);
        if (kind === 'missed' && (event.missReason === 'range' || event.reason === 'range'))
          visualSafe(() => callout(ctx.layer, ctx.anchorFor(event.targetId), event.targetId, 'outOfRange'));
      }
      // Historical unavoidable contacts may have no accuracy receipt. Absorbed
      // contacts still hit; Block and Ward are their subsequent result.
      for (const event of beat.events) if (event.type === 'damageDealt' && !saidTargets.has(event.targetId)) {
        visualSafe(() => callout(ctx.layer, ctx.anchorFor(event.targetId), event.targetId, 'hit'));
        saidTargets.add(event.targetId);
      }
    },
    onReaction: beat => {
      runParts(beat, 'reaction');
      return Math.max(0, ...beat.events.map(event => Number(ctx.reactionTimingForReceipt?.(event, timing.spriteSpeed)) || 0));
    },
    onNumbers: beat => {
      if (beat.banner) visualSafe(() => banner(ctx.layer, beat.banner, 'turn', timing.bannerMs));
      if (!beat.actorId || beat.kind === 'reveal') { runParts(beat, 'contact'); runParts(beat, 'reaction'); runParts(beat, 'callout'); }
      else for (const event of beat.events) {
        if (event.type === 'attackEvaded' || event.type === 'combatAvoidanceResolved' && event.avoided && event.evade?.success
          || event.type === 'attackMissed' && event.missReason === 'accuracy' && event.evadeActive) {
          visualSafe(() => callout(ctx.layer, ctx.anchorFor(event.targetId), event.targetId, 'dodged'));
          continue;
        }
        if (terminal(event) || event.type === 'attackMissed' || event.type === 'attackHit' && !(event.evadeActive && !event.bypass)) continue;
        visualSafe(() => parts.get(event)?.callout?.(ctx));
      }
      runParts(beat, 'numbers');
      cue(beat);
    },
    onApply: beat => ctx.onBeatApplied?.(beat),
    onResolution: beat => {
      for (const event of beat.events) if (terminal(event)) visualSafe(() => visualFor(event, beat.kind, receiptOptions)?.(ctx));
      ctx.onResolution?.(beat);
    },
    onWatchdog: () => { dbg.watchdog = (dbg.watchdog || 0) + 1; },
    onFlush: () => {
      for (const beat of beats) cue(beat, false);
      clearHeldFigures(); clearCallouts(ctx.layer); clearCombatEffects(ctx.layer);
      for (const sprite of globalThis.document?.querySelectorAll?.('.combatant .sprite') || []) stageFor(sprite)?.endReaction?.();
      ctx.onFlush?.();
    },
    onDone: () => {
      removeEventListener('pointerdown', skip, { capture: true });
      removeEventListener('pointerup', release, { capture: true });
      removeEventListener('pointercancel', release, { capture: true });
      removeEventListener('blur', blur);
      globalThis.document?.removeEventListener?.('visibilitychange', visibility);
      dbg.finished = (dbg.finished || 0) + 1;
      done?.();
    },
    onError: error => console.warn('[fx] ordered presentation step failed:', error?.message),
  }, timing);
  return handle;
}

function playLegacyTimeline(events, ctx, done) {
  const receiptVisuals = { reactionForReceipt: ctx.reactionForReceipt };
  const speed = ANIM_SPEEDS[getAnimSpeed()];
  const reduced = reducedMotionRequested();
  // Reaction reservations use the paced sprite speed (frame hold included), as the sequential path does.
  const paced = actionPacing({ reduced }).spriteSpeed;
  const beatOrder = ctx.beatOrder || getBeatOrder();
  if (!speed || reduced) {
    // No added waits. 'sequential' still updates the bars after the
    // reactions and numbers have shown; 'impact' updates them first.
    if (beatOrder === 'sequential') {
      animateEvents(events, ctx, () => {
        try {
          if (ctx.onFlush) ctx.onFlush();
        } finally {
          if (done) done();
        }
      });
      return;
    }
    if (ctx.onFlush) ctx.onFlush();
    animateEvents(events, ctx, done);
    return;
  }
  dbg.open = (dbg.open || 0) + 1;

  const beats = groupBeats(events);
  // Beats whose cues have played. A skip (or the watchdog) jumps past the
  // rest, and their haptics still play then, in one tick, so a skipped enemy
  // hit or turn start still buzzes; their sounds are not replayed.
  let cued = 0;
  const cueBeat = (index) => { cued = Math.max(cued, index + 1); };
  const damageCued = new Set();
  const flushHaptics = () => {
    const rest = beats.slice(cued);
    cued = beats.length;
    for (const [i, beat] of rest.entries()) playBeatHaptics(beat.events, { maxHpFor: ctx.maxHpFor, damageBuzz: !damageCued.has(cued - rest.length + i) });
  };
  let flushed = false;
  let finished = false;
  let pendingTimer = null;
  let activeActorAnimation = null;
  let nextBeat = () => {};
  let skipRelease = null;
  const cancelActorAnimation = () => {
    if (!activeActorAnimation) return;
    try {
      activeActorAnimation.cancel();
    } catch (e) {
      /* cleanup must not break timeline completion */
    }
    activeActorAnimation = null;
  };
  const schedule = (fn, ms) => {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(fn, Math.max(0, ms));
  };
  const clearSkipRelease = () => {
    if (!skipRelease) return;
    removeEventListener('pointerup', skipRelease, { capture: true });
    removeEventListener('pointercancel', skipRelease, { capture: true });
    skipRelease = null;
  };
  const skip = event => {
    if (event?.target?.closest?.('[data-combat-read-only]')) return;
    if (finished) return;
    dlog('input', 'tap skipped animation');
    removeEventListener('pointerdown', skip, { capture: true });
    flushed = true;
    clearHeldFigures();
    clearCallouts(ctx.layer);
    // An unheld hit reaction (no hit-stop) is not in heldFigures; a skip ends it too.
    for (const sprite of globalThis.document?.querySelectorAll?.('.combatant .sprite') || []) stageFor(sprite)?.endReaction?.();
    clearCombatEffects(ctx.layer);
    cancelActorAnimation();
    clearTimeout(pendingTimer);
    // Finish after this pointer is released. Re-rendering under pointerdown
    // can put a new live control beneath the same physical click and activate
    // it on pointerup; keeping `busy` true through release prevents that ghost
    // action while still making a click skip immediately.
    skipRelease = () => {
      clearSkipRelease();
      schedule(nextBeat, 0);
    };
    addEventListener('pointerup', skipRelease, { once: true, capture: true });
    addEventListener('pointercancel', skipRelease, { once: true, capture: true });
  };
  addEventListener('pointerdown', skip, { capture: true });
  const finish = () => {
    if (finished) return;
    finished = true;
    clearHeldFigures();
    clearCombatEffects(ctx.layer);
    clearTimeout(pendingTimer);
    clearSkipRelease();
    cancelActorAnimation();
    dbg.finished = (dbg.finished || 0) + 1;
    clearTimeout(watchdog);
    removeEventListener('pointerdown', skip, { capture: true });
    if (done) done();
  };
  // Safety net: however playback ends (or a re-render throws mid-beat), never
  // leave the caller's `busy` flag stuck — force completion after a bounded
  // wall-clock budget. This is what prevents the "cards stop responding" hang.
  // The budget reads caller callbacks before the watchdog exists; a throw here must not escape.
  const budgetRead = (read, fallback) => { try { return Number(read()) || fallback; } catch (e) { console.warn('[fx] timeline budget read failed:', e && e.message); return fallback; } };
  const customActorMs = typeof ctx.maxActorAnimationMs === 'function'
    ? budgetRead(() => ctx.maxActorAnimationMs(speed), 0)
    : Number(ctx.maxActorAnimationMs) || 0;
  const actorBudgetMs = Math.max(speed.lungeMs, customActorMs);
  // A sequential attack beat adds its stance lead and, per event, a reaction
  // hold and a step after the swing.
  const sequentialMs = beatOrder === 'sequential'
    ? beats.filter((beat) => beat.kind === 'attack')
      .reduce((ms, beat) => ms + speed.stanceLeadMs + beat.events.reduce((total,event)=>total + budgetRead(() => ctx.reactionTimingForReceipt?.(event,paced), speed.reactionMs) + speed.stepMs,0), 0)
    : 0;
  // Impact order plays each sprite reaction with its contact and holds the beat for the paced total, so the
  // watchdog must outlast those reservations too.
  const impactReactionMs = beatOrder === 'sequential' ? 0
    : beats.reduce((ms, beat) => ms + beat.events.reduce((total, event) => total
      + (ctx.reactionForReceipt?.(event) ? budgetRead(() => ctx.reactionTimingForReceipt?.(event, paced), speed.reactionMs) : 0), 0), 0);
  const budget = COMBAT_TIMING.watchdogBaseMs + sequentialMs + impactReactionMs + beats.length * (speed.beatMs + actorBudgetMs + 4 * speed.stepMs);
  const watchdog = setTimeout(() => {
    dbg.watchdog = (dbg.watchdog || 0) + 1;
    console.warn('[fx] watchdog forced timeline completion');
    dlog('fx', 'watchdog forced timeline completion', { open: dbg.open, finished: dbg.finished });
    cancelActorAnimation();
    try {
      flushHaptics();
      if (ctx.onFlush) ctx.onFlush();
    } catch (e) {
      /* ignore */
    }
    finish();
  }, budget);

  const safe = (fn) => {
    try {
      if (fn) fn();
    } catch (e) {
      /* a render/visual error must not break the chain */
    }
  };

  let bi = 0;
  nextBeat = () => {
    if (finished) return;
    if (flushed) {
      safe(flushHaptics);
      safe(() => ctx.onFlush && ctx.onFlush());
      finish();
      return;
    }
    if (bi >= beats.length) {
      finish();
      return;
    }
    const beatIndex = bi;
    const beat = beats[bi++];

    if (beat.banner) {
      cueBeat(beatIndex);
      safe(() => playBeatCues(beat.events, { maxHpFor: ctx.maxHpFor }));
      const hold = turnBannerHoldMs(speed);
      safe(() => { if (!ctx.layer.closest('.combat')?.querySelector('.turn-ribbon')) banner(ctx.layer, beat.banner, 'turn', hold); });
      safe(() => ctx.onBeatApplied && ctx.onBeatApplied(beat));
      schedule(nextBeat, hold);
      return;
    }

    // An attack beat in the 'sequential' order (animationPace.js beatOrder):
    // stance → swing → back to stance → the defender's reaction → numbers →
    // bars. Counter beats and every other kind keep the 'impact' order.
    const sequential = beatOrder === 'sequential' && beat.kind === 'attack';
    const actorEl = beat.actorId ? ctx.anchorFor(beat.actorId) : null;
    // Start the first accuracy word before stance entry, so its readable hold
    // overlaps both stance entry and the swing instead of extending either.
    // Later accuracy events keep their own per-hit ordering in the queues.
    const accuracy = beat.events.find((e) => !(beat.lead || []).includes(e) && (e.type === 'attackHit' || e.type === 'damageDealt'));
    const earlyHit = accuracy?.type === 'attackHit' ? accuracy : null;
    const accuracyStartedAt = Date.now();
    if (earlyHit) safe(() => visualFor(earlyHit, beat.kind, receiptVisuals)?.(ctx));
    // Stance first: an attacker caught mid-pose (a hurt frame, an unfinished
    // action) returns to its stance, and holds it a moment, before it swings.
    let stanceLead = false;
    if (sequential && actorEl) {
      const stage = stageFor(actorEl);
      const state = stanceState(stage);
      if (state === 'out') {
        safe(() => stage.settle());
        traceBeat('stance');
        stanceLead = speed.stanceLeadMs > 0;
      } else if (state === 'unknown' && typeof stage.settle === 'function') {
        // A stage that cannot report its pose still settles, but nothing waits for it.
        safe(() => stage.settle());
      }
    }
    const playBeat = () => {
    if (finished) return;
    if (flushed) {
      nextBeat();
      return;
    }
    // 1) actor animation (lunge for attacks, glow-step otherwise)
    //
    // A figure drawn in the animated style also changes pose for the beat. Asking
    // for 'attack' lets the figure pick its own next swing, so a multi-hit turn
    // does not replay one frame and an actor with no frames cannot advance
    // anyone else's rotation. Anything else takes the guard frame, and
    // playPoseOn is a no-op for a figure with no frames at all.
    let actorAnimation = null;
    if (actorEl && ctx.animateActor) {
      try {
        actorAnimation = ctx.animateActor(beat, actorEl, speed);
        traceBeat('swing', actorAnimation && { impactMs: actorAnimation.impactMs, totalMs: actorAnimation.totalMs });
      } catch (e) {
        actorAnimation = null;
      }
    }
    if (actorAnimation
      && Number.isFinite(actorAnimation.impactMs)
      && Number.isFinite(actorAnimation.totalMs)
      && typeof actorAnimation.cancel === 'function') {
      activeActorAnimation = actorAnimation;
    } else {
      actorAnimation = null;
      if (ctx.figureAnimations !== false && actorEl && beat.kind !== 'reveal') {
        const attacking = beat.kind === 'attack' || beat.kind === 'counter';
        safe(() => flash(actorEl, attacking ? 'act-attack' : 'act-move', speed.lungeMs));
        safe(() => playPoseOn(actorEl, attacking ? 'attack' : 'guard', speed.lungeMs));
      }
    }
    const actorStartedAt = Date.now();
    // The cost the actor paid (lead events) shows as it starts to move.
    // A screen that can update its read-outs without touching the fighters
    // (ctx.onLeadApplied: the MP bar, say) applies them then too, not after the
    // swing; the rest of the beat applies after its visuals as before, so each
    // event's display update runs exactly once.
    const lead = new Set(beat.lead || []);
    for (const e of lead) {
      const v = visualFor(e, beat.kind, receiptVisuals);
      if (v) safe(() => v(ctx));
    }
    const leadApplied = lead.size > 0 && typeof ctx.onLeadApplied === 'function';
    if (leadApplied) safe(() => ctx.onLeadApplied({ ...beat, events: beat.lead }));

    // 2) after the wind-up, the beat's effect visuals + numbers, staggered
    // (sequential: only the contact parts here; reactions and numbers follow
    // the recovery).
    const rest = beat.events.filter((e) => !lead.has(e) && e !== earlyHit);
    const partsOf = new Map(rest.map((e) => [e, visualPartsFor(e, beat.kind, { sequential, ...receiptVisuals })]));
    const visualEvents = sequential
      ? rest.filter((e) => partsOf.get(e)?.contact)
      : rest.filter((e) => partsOf.get(e));
    const visuals = sequential
      ? visualEvents.map((e) => partsOf.get(e).contact)
      : visualEvents.map((e) => visualFor(e, beat.kind, receiptVisuals));
    // Cast flourish: non-attack actors (skills, powers, buff moves) flare a
    // glyph as their wind-up — attacks get the slash arc on impact instead.
    if (actorEl && beat.kind !== 'attack' && beat.events.length) {
      safe(() => spawnFx(ctx.layer, actorEl, 'fx-glyph', COMBAT_TIMING.castGlyphMs, 'Cast'));
    }
    const windup = actorAnimation
      ? actorAnimation.impactMs
      : (actorEl ? Math.round(speed.lungeMs * COMBAT_TIMING.windupFraction) : 0);
    // Every qualifying hit holds at its own visual, including multi-hit and
    // multi-target attacks. Recovery includes only the holds actually played.
    let heldMs = 0;
    const holdFor = (event) => ((beat.kind === 'attack' || beat.kind === 'counter') && event.type === 'damageDealt'
      ? hitStopMsFor(guardHitFloatParts(event).residual || 0, typeof ctx.maxHpFor === 'function' ? Number(ctx.maxHpFor(event.targetId)) || 0 : 0) : 0);
    const markContact = (what) => {
      // An observable contact marker (tools/click-impact-probe.mjs): the
      // effects layer's data-contact counts the impact-frame moments played.
      safe(() => { ctx.layer.dataset.contact = String((Number(ctx.layer.dataset.contact) || 0) + 1); });
      traceBeat('contact', what);
    };
    schedule(() => {
      if(!finished&&!flushed)safe(()=>activeActorAnimation?.contact?.());
      // A beat with nothing to draw at impact still reaches its impact frame.
      if (actorEl && visualEvents.every(event => calloutOnly(event, receiptVisuals))) markContact('impact');
      let vi = 0;
      let reactionEndAt = 0;
      const stepV = () => {
        if (finished) return;
        if (flushed) {
          nextBeat();
          return;
        }
        // A callout-only event (impact order: COUNTERED on a counter beat)
        // shows at once and takes no step, so the hit after it is not delayed.
        if (vi < visuals.length && calloutOnly(visualEvents[vi], receiptVisuals)) {
          traceBeat('callout', visualEvents[vi].type);
          safe(() => visuals[vi++](ctx));
          stepV();
          return;
        }
        if (vi < visuals.length) {
          const event = visualEvents[vi];
          const holdMs = holdFor(event);
          const held = holdMs > 0;
          const v = visuals[vi++];
          if (held) {
            safe(() => actorEl && hold(actorEl, holdMs));
            safe(() => {
              // Effects off: the timeline still spends the hit-stop time (the feel contract's spacing is
              // unchanged) but the figure is not frozen.
              if (effectsOff()) return;
              if (activeActorAnimation?.hold) activeActorAnimation.hold(holdMs);
              else if (ctx.figureAnimations !== false) stageFor(actorEl)?.hold?.(holdMs);
            });
            heldMs += holdMs;
            hitStop = holdMs;
          }
          safe(() => v(ctx));
          // Impact order plays the sprite reaction with the contact; the beat must outlast its paced total so
          // the next beat's action is not painted over it.
          if (!sequential && ctx.reactionForReceipt?.(event))
            reactionEndAt = Math.max(reactionEndAt, Date.now() + (Number(ctx.reactionTimingForReceipt?.(event, paced)) || 0));
          markContact(event.type);
          // Sequential: the damage buzz waits for the number (below).
          if (!sequential && !damageCued.has(beatIndex) && playerLostHp(event)) {
            damageCued.add(beatIndex);
            safe(() => haptic.play('damageTaken'));
          }
          hitStop = 0;
          // stepMs separates contacts. After the last sequential contact there
          // is no next contact to space: retain its hit-stop and the actor's
          // recovery below, then begin the defender's full reaction.
          const stepGap = sequential && vi === visuals.length ? 0 : speed.stepMs;
          schedule(stepV, Math.max(stepGap, event.type === 'attackHit' ? STACK_STEP_MS * 2 : 0) + (held ? holdMs : 0));
          return;
        }
        const applyBeat = () => {
          cueBeat(beatIndex);
          safe(() => playBeatCues(beat.events, { maxHpFor: ctx.maxHpFor, damageBuzz: !damageCued.has(beatIndex) }));
          // 3) HUD updates for this beat, 4) inter-beat breath. Painted actor
          // sequences retain their recovery frames before the render replaces
          // the sprite host; ordinary CSS lunges update immediately as before.
          cancelActorAnimation();
          safe(() => ctx.onBeatApplied && ctx.onBeatApplied(leadApplied ? { ...beat, events: beat.events.filter((e) => !lead.has(e)) } : beat));
          traceBeat('bars');
          schedule(nextBeat, Math.max(speed.beatMs,reactionEndAt-Date.now()));
        };
        // Sequential: once the attacker is back in its stance, each event's
        // reaction plays, then (reactionMs later) its numbers, in event order;
        // the bars follow the last number.
        const reactions = sequential
          ? rest.filter((e) => partsOf.get(e)?.reaction || partsOf.get(e)?.numbers || partsOf.get(e)?.callout)
          : [];
        const react = () => {
          if (finished) return;
          if (flushed) {
            nextBeat();
            return;
          }
          cancelActorAnimation();
          traceBeat('settle');
          let ri = 0;
          const stepR = () => {
            if (finished) return;
            if (flushed) {
              nextBeat();
              return;
            }
            if (ri >= reactions.length) {
              applyBeat();
              return;
            }
            const event = reactions[ri++];
            const parts = partsOf.get(event);
            const numbers = () => {
              if (finished) return;
              if (flushed) {
                nextBeat();
                return;
              }
              traceBeat('numbers', event.type);
              if (parts.numbers) safe(() => parts.numbers(ctx));
              if (!damageCued.has(beatIndex) && playerLostHp(event)) {
                damageCued.add(beatIndex);
                safe(() => haptic.play('damageTaken'));
              }
              // The bars follow in the next task, so the number is laid out
              // and painted before the beat's re-render, not after it.
              if (ri >= reactions.length) schedule(applyBeat, 0);
              else schedule(stepR, Math.max(speed.stepMs,reactionEndAt-Date.now()));
            };
            // The callout shows with the reaction and waits for nothing.
            const said = () => {
              if (!parts.callout) return;
              traceBeat('callout', event.type);
              safe(() => parts.callout(ctx));
            };
            if (!parts.reaction && !parts.numbers) {
              said();
              if (event.type === 'attackHit') schedule(stepR, STACK_STEP_MS * 2);
              else stepR();
              return;
            }
            if (!parts.reaction) {
              said();
              numbers();
              return;
            }
            // The hit-stop held the attacker's impact frame alone; the target's
            // reaction plays unheld (SPEC §7.4, sequential).
            traceBeat('reaction', event.type);
            safe(() => parts.reaction(ctx));
            said();
            reactionEndAt = Math.max(reactionEndAt,Date.now() + (Number(ctx.reactionTimingForReceipt?.(event,paced)) || speed.reactionMs));
            if (!parts.numbers) {
              if (ri >= reactions.length) schedule(applyBeat, speed.reactionMs);
              else schedule(stepR, Math.max(speed.reactionMs,reactionEndAt-Date.now()));
              return;
            }
            schedule(numbers, speed.reactionMs);
          };
          stepR();
        };
        const after = sequential ? react : applyBeat;
        // Sequential waits out a plain CSS lunge too, so the reaction never
        // starts mid-swing.
        const recovery = actorAnimation
          ? Math.max(0, actorAnimation.totalMs + heldMs - (Date.now() - actorStartedAt), Number(actorAnimation.remainingMs?.())||0)
          : sequential && actorEl ? Math.max(0, speed.lungeMs + heldMs - (Date.now() - actorStartedAt)) : 0;
        if (recovery > 0) schedule(after, recovery);
        else after();
      };
      stepV();
    }, Math.max(windup, earlyHit ? STACK_STEP_MS * 2 - (Date.now() - accuracyStartedAt) : 0));
    };
    if (stanceLead) schedule(playBeat, speed.stanceLeadMs);
    else playBeat();
  };
  nextBeat();
}

// ---------------------------------------------------------------------------
// Sound seams (FINISH §5 hit sound tiers). Exported so a headless test can
// drive the same calls the timeline makes; every id reaches audio through
// sfx.play, whose sink honours the mute and SFX-volume settings.
// ---------------------------------------------------------------------------

const hurtsPlayer = (e) => e.targetPlayerId != null || e.targetId === 'player';

/** The HP half of an attack: `playerHurt` on the player, else `hit_<tier>`. */
export function playHitSound(e) {
  const { residual } = guardHitFloatParts(e);
  if (residual <= 0) return;
  if (hurtsPlayer(e)) sfx.play('playerHurt');
  else sfx.play(`hit_${hitTierFor(residual)}`);
}

/**
 * playerLostHp(e) → did this receipt cost the player HP?
 */
export function playerLostHp(e) {
  if (!e) return false;
  if (e.type === 'damageDealt') return hurtsPlayer(e) && guardHitFloatParts(e).residual > 0;
  if (e.type === 'hpLost') return hurtsPlayer(e) && e.cause !== 'attack' && (e.amount || 0) > 0;
  return false;
}

/**
 * bigHitLanded(e, { maxHpFor? }) → did this receipt take an enemy down by
 * BIG_HIT_SHARE of its max HP or more? `maxHpFor(entityId)` says the target's
 * max HP (the screen's, as for the damage float's size); with none the hit
 * cannot be measured and is not big.
 */
export function bigHitLanded(e, { maxHpFor } = {}) {
  if (!e || e.type !== 'damageDealt' || hurtsPlayer(e) || typeof maxHpFor !== 'function') return false;
  const maxHp = Number(maxHpFor(e.targetId)) || 0;
  return maxHp > 0 && guardHitFloatParts(e).residual / maxHp >= BIG_HIT_SHARE;
}

/**
 * enemyPoiseBroken(e) → did an enemy's Poise break (the stagger starts)? A
 * player's Poise break (targetKind 'player') is not an enemy's and is false.
 * Legacy events without targetKind keep the old reading.
 */
export function enemyPoiseBroken(e) {
  return !!e && e.type === 'poiseBroken' && e.targetKind !== 'player' && !!(e.interrupted || e.poiseBreak);
}

/**
 * Once-per-beat cues: the turn stinger and the pile sounds. A five-card
 * refill or a whole-hand discard is ONE sound, not five, and adds no step to
 * the beat's pacing (these events have no visual of their own).
 */
export function playBeatCues(events, { maxHpFor, stinger = true, turnBuzz = true, damageBuzz = true } = {}) {
  const has = (type) => events.some((e) => e && e.type === type);
  playBeatHaptics(events, { maxHpFor, turnBuzz, damageBuzz });
  if (stinger && has('playerTurnStart')) sfx.play('turnStinger');
  if (has('deckShuffled')) sfx.play('deckShuffle');
  if (has('cardDrawn')) sfx.play('cardDraw');
  if (has('cardDiscarded')) sfx.play('cardDiscard');
}

/**
 * A beat's haptics alone (content/haptics.js): ONE damage buzz per beat that
 * cost the player HP by any route — an attack's residual, or a direct hpLost
 * (Guilt, Herald, Gorefire, Venom); an attack's own hpLost twin is skipped,
 * so the damageDealt/hpLost pair is one hit, not two — then the turn start.
 * playBeatCues plays it with the beat's sounds; a skipped timeline plays it
 * alone for the beats it jumped past.
 */
export function playBeatHaptics(events, { maxHpFor, turnBuzz = true, damageBuzz = true } = {}) {
  if (damageBuzz && events.some((e) => playerLostHp(e))) haptic.play('damageTaken');
  // The player's blows: a big hit on an enemy, and an enemy's Poise breaking (once each per beat).
  if (events.some((e) => bigHitLanded(e, { maxHpFor }))) haptic.play('bigHit');
  if (events.some((e) => enemyPoiseBroken(e))) haptic.play('poiseBreak');
  if (turnBuzz && events.some((e) => localTurnStart(e))) haptic.play('turnStart');
}

/**
 * localTurnStart(e) → is this the start of the player's turn?
 */
export function localTurnStart(e) {
  return !!e && e.type === 'playerTurnStart';
}

/**
 * The cues of a whole event list, one playBeatCues per beat exactly as the
 * paced timeline groups them (groupBeats). Used where the events are not
 * paced: instant/reduced-motion playback and a fresh fight's setup (the
 * opening draw and turn start).
 */
export function playEventCues(events, opts = {}) {
  // ONE STINGER PER TURN: a turn already stung in this list does not sting
  // again. The key is each receipt's `turn`; without it every start reads as
  // the same turn and a list with two turns stings once. The buzz keeps its
  // own once-per-turn set.
  const stung = new Set();
  const buzzed = new Set();
  for (const beat of groupBeats(events || [])) {
    const starts = beat.events.filter((e) => e && e.type === 'playerTurnStart');
    const repeat = starts.length > 0 && starts.every((e) => stung.has(e.turn));
    for (const e of starts) stung.add(e.turn);
    const mine = starts.filter((e) => localTurnStart(e));
    const turnBuzz = mine.some((e) => !buzzed.has(e.turn));
    for (const e of mine) buzzed.add(e.turn);
    playBeatCues(beat.events, { ...opts, stinger: !repeat, turnBuzz });
  }
}

// A visual in three parts, so the paced timeline can play an attack beat in
// the owner's order (animationPace.js beatOrder): `contact` is the attacker's
// side of the hit (its sound, spark, slash and effect sprite) at the swing's
// impact frame; `reaction` is the defender's (hurt flash and pose, recoil,
// shake, stagger wobble); `numbers` are the floats. Every part is optional.
// visualFor plays all three at once, in that order, for every other path.
// `callout` is the on-character word (callout above): it plays with the
// reaction, and adds no wait of its own.
function visualPartsFor(e, beatKind, opts) {
  let base = withCallout(baseVisualParts(e, beatKind, opts), e);
  const receiptReaction = opts?.reactionForReceipt?.(e);
  if (receiptReaction) {
    const original = base?.reaction;
    base = { ...base, reaction: ctx => { original?.(ctx); receiptReaction(ctx); } };
  }
  const effect = combatEffectForEvent(e);
  if (!effect) return base;
  const playEffect = (ctx) => {
    const anchor = ctx.anchorFor(effect.targetId);
    if (anchor) playCombatEffect(ctx.layer, anchorLocalBox(ctx.layer, anchor), effect.kind, { size: 190 });
  };
  // SPEC §7.4 (sequential): the Stagger wobble is the defender's reaction, not
  // the impact frame, so its break sprite plays with that reaction and takes no
  // contact step that would hold back the hit's first number.
  if (opts?.sequential && e.type === 'enemyStaggered' && base?.reaction && !base.contact) {
    const reaction = base.reaction;
    return { ...base, reaction: (ctx) => { reaction(ctx); playEffect(ctx); } };
  }
  const contact = base?.contact;
  return { ...base, contact: contact ? (ctx) => { contact(ctx); playEffect(ctx); } : playEffect };
}

/**
 * The one outcome word for a hit that does NO HP damage (owner, 2026-10-12):
 * RESISTED (Barrier took it whole and did not break; blue), BLOCKED (Block took
 * it whole; silver), IMMUNE (the target is immune; pale grey), MISSED (evaded;
 * the existing callout). Any HP damage keeps the per-layer floats, so null.
 * `e` is a damageDealt-like payload, or an attackEvaded / statusImmune event.
 */
export function outcomeKindForEvent(e = {}) {
  if (e.type === 'attackEvaded') return 'evaded';
  if (e.type === 'combatAvoidanceResolved') return e.avoided ? 'evaded' : null;
  if (e.type === 'statusImmune') return 'immune';
  if (e.type !== 'damageDealt') return null;
  if (e.immune && !(Number(e.amount) > 0)) return 'immune';
  const parts = guardHitFloatParts(e);
  if (parts.residual > 0) return null; // HP damage: the per-layer floats show it
  if (parts.pierced) return null; // a pierced hit keeps its floats (Pierced N beside Block and Poise), not a lone BLOCKED word
  if (parts.blocked > 0) return 'blocked';
  // Nothing reached Block or Health: Barrier or Ward took the whole hit. A Barrier that broke
  // keeps its BREAK callout and its number, as it did before.
  if (parts.amount === 0 && Math.max(0, Number(e.barrierAbsorbed) || 0) > 0) return e.barrierRemaining === 0 ? null : 'resisted';
  if (parts.amount === 0 && Math.max(0, Number(e.wardAbsorbed) || 0) > 0) return 'wardResisted';
  return null;
}

// Hostile statuses that earn a past-tense word over the fighter they land on
// (owner, 2026-10-12). Each colour is the status row's own tint in content/statuses.js
// where it has one; the rest are the owner's fallbacks, listed in the commit message.
export const STATUS_WORDS = {
  venom: { colour: '#6fd36f' },
  burn: { colour: 'var(--ember)' },
  bleed: { colour: 'var(--ember)' },
  bleeding: { colour: '#e0334a' },
  frost: { colour: '#7fa8c9' },
  frozen: { colour: '#9fe3ff' },
  chilled: { colour: '#9fe3ff' },
  paralysis: { colour: '#ffe14d' },
  sleep: { colour: '#c7b3ff' },
  weak: { colour: 'var(--muted)' },
  vulnerable: { colour: 'var(--grace)' },
  magicVulnerable: { colour: '#8b7cd6' },
  frail: { colour: 'var(--muted)' },
  dazed: { colour: '#ffe14d' },
  offBalance: { colour: '#d9c9a3' },
  prone: { colour: '#d9c9a3' },
  insanity: { colour: '#a06bd0' },
  madness: { colour: '#a06bd0' },
  crimsonBlight: { colour: 'var(--rot)' },
  frostExposed: { colour: '#7fa8c9' },
  insanityExposed: { colour: '#a06bd0' },
};

/**
 * A statusApplied payload → { kind, targetId, word, colour } for a hostile status
 * that was applied, or null (a buff, an unlisted status, or a zero-stack event).
 */
export function statusPopupFor(e = {}) {
  if (e.type !== 'statusApplied' || !(e.stacks > 0) || e.targetId == null) return null;
  if (!Object.prototype.hasOwnProperty.call(STATUS_WORDS, e.status)) return null;
  const string = `combat.status.applied.${e.status}`;
  return { kind: `status:${e.status}`, targetId: e.targetId, string, word: t(string), colour: STATUS_WORDS[e.status].colour };
}

/**
 * calloutForEvent(e) → { kind, targetId } | null — the word an event earns
 * and the fighter it shows over.
 */
export function calloutForEvent(e = {}) {
  let kind = null;
  const popup = statusPopupFor(e);
  if (popup) return { kind: popup.kind, targetId: popup.targetId };
  switch (e.type) {
    case 'attackHit': kind = e.evadeActive && !e.bypass ? 'evadeFailed' : 'hit'; break;
    case 'attackMissed': kind = 'missed'; break;
    case 'contestPassed': kind = 'contestPassed'; break;
    case 'contestFailed': kind = 'contestFailed'; break;
    case 'damageDealt': case 'statusImmune': kind = outcomeKindForEvent(e); break;
    // A stagger a break caused shows that break's word and INTERRUPTED, not a second STAGGERED.
    case 'enemyStaggered': if (!e.cause || e.cause === 'weakness') kind = 'staggered'; break;
    case 'weaknessTriggered': kind = 'weak'; break;
    case 'playerStaggered': kind = 'staggered'; break;
    case 'enemyInterrupted': kind = 'interrupted'; break;
    // A Smash's Block break is the GUARD BREAK callout (combatGuardBroken); it earns no BREAK word of its own.
    case 'blockBroken': if (!e.smash) kind = 'blockBreak'; break;
    case 'ratingImpact': if (e.breaks > 0) kind = e.label === 'Disruption' ? 'disrupted' : 'staggered'; break;
    case 'combatCounterTriggered': kind = 'countered'; break; // over the attacker who got countered
    case 'attackEvaded': kind = 'evaded'; break;
    // Any avoidance that stopped the hit is a miss: an evade, a distance roll, or a prevention charge.
    case 'combatAvoidanceResolved': if (e.avoided && !e.hitCheck) kind = 'evaded'; break;
    case 'critHit': kind = 'critical'; break;
    case 'combatGuardBroken': kind = 'guardBreak'; break;
    case 'wardBroken': kind = 'wardBreak'; break;
    case 'barrierBroken': kind = 'barrierBreak'; break;
    case 'poiseBroken': kind = 'poiseBreak'; break;
    default: break;
  }
  return kind && e.targetId != null ? { kind, targetId: e.targetId } : null;
}

function withCallout(parts, e) {
  const said = calloutForEvent(e);
  if (!said) return parts;
  // The BLOCKED word carries its hit sound, so the sound and the word land together.
  const sound = e.type === 'damageDealt' && said.kind === 'blocked';
  return { ...parts, callout: (ctx) => { callout(ctx.layer, ctx.anchorFor(said.targetId), said.targetId, said.kind); if (sound) sfx.play('block'); } };
}

// An event whose only visual is its callout: it never takes a step of its own.
function calloutOnly(e, opts) {
  // Accuracy has its own readable beat before damage or pressure begins.
  if (e.type === 'attackHit' || e.type === 'attackMissed') return false;
  const parts = visualPartsFor(e, undefined, opts);
  return !!parts && Object.keys(parts).every((key) => key === 'callout' || !parts[key]);
}

function visualFor(e, beatKind, opts) {
  const parts = visualPartsFor(e, beatKind, opts);
  if (!parts) return null;
  return (ctx) => {
    parts.contact?.(ctx);
    parts.reaction?.(ctx);
    parts.callout?.(ctx);
    parts.numbers?.(ctx);
  };
}

// opts.sequential (SPEC §7.4, beatOrder 'sequential'): a hit's sound plays
// with its number; only the spark and slash stay at the contact.
// A break's visual: a shatter ring in the layer's tone, over the fighter it broke, with its sound.
function breakBurst(e, tone, sound) {
  return {
    reaction: (ctx) => {
      sfx.play(sound);
      spawnFx(ctx.layer, ctx.anchorFor(e.targetId), `fx-shatter ${tone}`, 420);
    },
  };
}

function baseVisualParts(e, beatKind, { sequential = false } = {}) {
  switch (e.type) {
    case 'statusApplied': {
      if (buffGainFor(e) <= 0) return null;
      const showGain = ctx => {
        const popup = buffPopupFor(e, ctx.statusInfo?.(e.status));
        if (popup) queuedCallout(ctx.layer, ctx.anchorFor(popup.targetId), popup.targetId, popup.kind, popup, true);
      };
      // The sequential core timeline runs numbers after the target reaction.
      // Older impact and instant paths render callout-only events at once, so
      // using a numbers part there would add one stepMs delay per status.
      return sequential ? { numbers: showGain } : { callout: showGain };
    }
    case 'damageDealt': {
      // One event owns both visible channels: unsigned guard consumed, then
      // the full hit as damage (HP residual drives flinch and shake). Paired results sit side-by-side without
      // relying on random jitter, so phone and desktop read the same grammar.
      const parts = guardHitFloatParts(e);
      const outcome = outcomeKindForEvent(e);
      const heavy = parts.residual >= 15;
      const hitSounds = () => {
        if (parts.guard) sfx.play('block');
        if (parts.damage) playHitSound(e);
      };
      return {
        contact: (ctx) => {
          const anchor = ctx.anchorFor(e.targetId);
          // A BLOCKED hit's sound comes with its word (withCallout); other outcome words have no hit sound.
          if (!sequential && !outcome) hitSounds();
          if (parts.guard) spawnFx(ctx.layer, anchor, 'fx-spark', 320, 'Guard');
          if (!parts.damage) return; // fully guarded: no flinch, slash, or shake
          // Attack impacts slash at the contact.
          if (beatKind === 'attack') spawnFx(ctx.layer, anchor, 'fx-slash', 300);
        },
        reaction: (ctx) => {
          const anchor = ctx.anchorFor(e.targetId);
          if (ctx.figureAnimations !== false && parts.guard && !parts.damage && anchor?.closest('.enemy')) playPoseOn(anchor, 'guardHit', 220);
          if (!parts.damage) return;
          // The victim flashes + recoils (CSS); heavy hits recoil further
          // (hit-heavy) and kick the screen. A held hit (hit-stop) starts the
          // recoil held and runs it that much longer, so the whole recoil still plays.
          const held = hitStop;
          flash(anchor, 'hitflash', heavy ? 380 : 220, held);
          // An animated figure recoils in its own art as well as in CSS, and holds
          // it as long as the flash it belongs to.
          if (ctx.figureAnimations !== false) {
            playPoseOn(anchor, 'hit', heavy ? 380 : 220);
            if (held) stageFor(anchor)?.hold?.(held);
          }
          if (heavy) flash(anchor, 'hit-heavy', 380 + held);
          hold(anchor, held);
          // Every HP hit shakes, by the share of the target's max HP it cost (SPEC §7.4).
          shake(ctx.combatEl, shakePxFor(parts.residual, typeof ctx.maxHpFor === 'function' ? Number(ctx.maxHpFor(e.targetId)) || 0 : 0));
        },
        numbers: (ctx) => {
          if (sequential && !outcome) hitSounds();
          // An outcome word (RESISTED, BLOCKED, IMMUNE, MISSED) replaces the numbers of a hit that did no HP damage.
          // A spell that spent Poise keeps its "Poise N" float beside the callout (owner, 2026-10-31).
          if (outcome) {
            if (outcome === 'blocked' && parts.fullHit) floatNum(ctx.layer, ctx.anchorFor(e.targetId), parts.fullHit.text, parts.fullHit.cls);
            if (parts.magicPoise) floatNum(ctx.layer, ctx.anchorFor(e.targetId), parts.magicPoise.text, parts.magicPoise.cls);
            return;
          }
          const anchor = ctx.anchorFor(e.targetId);
          // One column per combatant (owner, 2026-11-05): the parts spawn in the order below, one stagger apart,
          // all at the same x. The layers the hit met come first, then the hit's HP loss.
          if (parts.barrier) floatNum(ctx.layer, anchor, parts.barrier.text, parts.barrier.cls);
          if (parts.ward) floatNum(ctx.layer, anchor, parts.ward.text, parts.ward.cls);
          if (parts.poise) floatNum(ctx.layer, anchor, parts.poise.text, parts.poise.cls);
          if (parts.magicPoise) floatNum(ctx.layer, anchor, parts.magicPoise.text, parts.magicPoise.cls);
          if (parts.pierced) floatNum(ctx.layer, anchor, parts.pierced.text, parts.pierced.cls);
          if (parts.immune) floatNum(ctx.layer, anchor, parts.immune.text, parts.immune.cls);
          // A pierced hit that cost no HP has no outcome word, so its full number floats here.
          if (!parts.damage && parts.fullHit && parts.pierced) floatNum(ctx.layer, anchor, parts.fullHit.text, parts.fullHit.cls);
          if (parts.damage) {
            // The tier is the hit's share of the target's max HP when the screen can say it.
            const maxHp = typeof ctx.maxHpFor === 'function' ? Number(ctx.maxHpFor(e.targetId)) || 0 : 0;
            floatNum(ctx.layer, anchor, parts.damage.text, dmgClass(parts.full, maxHp));
          }
        },
      };
    }
    case 'blockGained':
      return e.amount > 0
        ? {
            // Sequential order: the sound arrives with its number (SPEC §7.4).
            reaction: () => { if (!sequential) sfx.play('block'); },
            numbers: (ctx) => {
              // The sound plays when this number spawns in its column, not when it queued.
              floatNum(ctx.layer, ctx.anchorFor(e.targetId), `+${e.amount}`, 'blk', undefined, sequential ? { onSpawn: () => sfx.play('block') } : undefined);
            },
          }
        : null;
    case 'hpLost': {
      // #61 M2a: a proc burst's number is ITS OWN float, in the row's tint,
      // with the row's glyph — separate from and after the hit that tipped it.
      const proc = typeof e.cause === 'string' && e.cause.startsWith('proc:');
      if (!proc && e.cause !== 'effect') return null; // attack damage already shown by damageDealt
      return {
        reaction: (ctx) => {
          const anchor = ctx.anchorFor(e.targetId);
          if (e.amount > 0) {
            if (ctx.figureAnimations !== false) playPoseOn(anchor, 'hit', 300);
            flash(anchor, 'hitflash', 300);
          }
        },
        numbers: proc
          ? (ctx) => {
              const info = ctx.statusInfo && ctx.statusInfo(e.cause.slice(5));
              floatNum(ctx.layer, ctx.anchorFor(e.targetId), `${uiIconText(info?.icon)} -${e.amount}`, 'burst', info && info.tint);
            }
          : (ctx) => floatNum(ctx.layer, ctx.anchorFor(e.targetId), `-${e.amount}`, 'burst'),
      };
    }
    case 'healed':
      return e.amount > 0
        ? {
            reaction: (ctx) => {
              if (!sequential) sfx.play('heal');
              const anchor = ctx.anchorFor(e.targetId);
              if (anchor) playCombatEffect(ctx.layer, anchorLocalBox(ctx.layer, anchor), 'heal');
            },
            numbers: (ctx) => {
              floatNum(ctx.layer, ctx.anchorFor(e.targetId), `+${e.amount}`, 'heal', undefined, sequential ? { onSpawn: () => sfx.play('heal') } : undefined);
            },
          }
        : null;
    // #61 M2: the proc moment, three beats — banner + per-status SFX row here,
    // the visible drain on the meter bar, then the tinted number (the proc:
    // hpLost above, next on the queue's own cadence). The old bleed-only
    // meterFilled banner generalized: any threshold row procs through this one
    // grammar, tint and name from its own data (M4).
    case 'procBurst':
      return {
        numbers: (ctx) => {
          const info = ctx.statusInfo && ctx.statusInfo(e.status);
          // Per-status SFX row by name — an unauthored id degrades to the sfx
          // table's own default (audible, never silent), until the audio seat
          // authors procBurst_<status> rows.
          sfx.play(`procBurst_${e.status}`);
          banner(ctx.layer, `${((info && info.name) || e.status).toUpperCase()} BURST`, 'blood');
          // M2b: the drain is SEEN — the live bar transitions to empty before
          // the re-render replaces it.
          const anchor = ctx.anchorFor(e.targetId);
          const card = anchor && anchor.closest ? anchor.closest('[data-eid]') : null;
          const bar = card && card.querySelector(`.procbar[data-status="${e.status}"] .fill`);
          if (bar) {
            bar.style.transition = 'width 250ms ease-out';
            bar.style.width = '0%';
          }
        },
      };
    // #61 M3: refusal has feedback — points blocked by an active resistance
    // answer with a gray tick, so a bleed card into resistance never reads as
    // the game eating the card.
    case 'procResisted':
      return {
        numbers: (ctx) => {
          const info = ctx.statusInfo && ctx.statusInfo(e.status);
          floatNum(ctx.layer, ctx.anchorFor(e.targetId), `${uiIconText(info?.icon)} ${e.blocked} RESISTED`, 'blk small');
        },
      };
    case 'meterFilled':
      return null; // poise fills speak through enemyStaggered below
    case 'ratingImpact':
      if (e.breaks) return {
        // Its word (STAGGERED / DISRUPTED) is the on-character callout.
        reaction: (ctx) => {
          flash(ctx.anchorFor(e.targetId), 'wobble', 600);
        },
      };
      // A Poise / Ward guard (the Dodge Roll) took some of the impact.
      return e.guarded > 0
        ? { numbers: (ctx) => floatNum(ctx.layer, ctx.anchorFor(e.targetId), `${e.guarded} ${e.meter === 'ward' ? 'WARD' : 'POISE'} GUARDED`, `${e.meter === 'ward' ? 'ward' : 'poise'} small`) }
        : null;
    case 'meterGuardGained':
      return e.amount > 0
        ? { numbers: (ctx) => floatNum(ctx.layer, ctx.anchorFor(e.targetId), `+${e.amount} ${e.meter === 'ward' ? 'WARD' : 'POISE'}`, `${e.meter === 'ward' ? 'ward' : 'poise'} small`) }
        : null;
    // A miss (any avoidance that stopped the hit): a white streak over the fighter it missed, and a swish.
    case 'combatAvoidanceResolved':
    case 'attackEvaded':
      if (e.type === 'combatAvoidanceResolved' && !e.avoided) return null;
      return {
        reaction: (ctx) => {
          sfx.play('cardDraw');
          spawnFx(ctx.layer, ctx.anchorFor(e.targetId), 'fx-miss-streak', 380);
        },
      };
    // A Smash's Block break shows as GUARD BREAK alone: no burst and no sound for it here.
    case 'blockBroken': return e.smash ? null : breakBurst(e, 'block', 'hit_heavy');
    case 'barrierBroken': return breakBurst(e, 'barrier', 'block');
    case 'wardBroken': return breakBurst(e, 'ward', 'procBurst');
    case 'poiseBroken': return breakBurst(e, 'gold', 'hit_heavy');
    case 'enemyInterrupted': return breakBurst(e, 'interrupt', 'stagger');
    case 'playerStaggered': return breakBurst(e, 'gold', 'stagger');
    case 'enemyStaggered':
      return {
        reaction: (ctx) => {
          // A break's stagger plays the break's own sound (poiseBroken, enemyInterrupted), not a second one.
          if (!e.cause) sfx.play('stagger');
          // The STAGGERED word is the on-character callout now, not a banner.
          const anchor = ctx.anchorFor(e.targetId);
          flash(anchor, 'wobble', 600); // poise broken: the whole figure teeters
          spawnFx(ctx.layer, anchor, 'fx-glyph', 450, 'Stun');
          shake(ctx.combatEl);
        },
      };
    case 'enemyDied':
      // After the killing blow's reaction and numbers: the cross and the fall.
      return {
        numbers: (ctx) => {
          sfx.play('enemyDeath');
          const anchor = ctx.anchorFor(e.targetId);
          floatNum(ctx.layer, anchor, 'Defeated', 'dmg heavy');
          if (anchor) { anchor.classList.remove('hitflash', 'hit-heavy'); playPoseOn(anchor, 'defeated'); }
        },
      };
    case 'stanceEntered':
      return { contact: () => sfx.play('stance') };
    case 'relicTriggered':
      return {
        contact: (ctx) => {
          sfx.play('relic');
          if (ctx.relicAnchor) flash(ctx.relicAnchor(e.relicId), 'proc', 320);
        },
      };
    case 'energySpent':
    case 'energyGained':
      return {
        contact: (ctx) => {
          if (ctx.orb) flash(ctx.orb(), 'pulse', 260);
        },
      };
    default:
      return null;
  }
}
