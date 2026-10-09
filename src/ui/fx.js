import { playCombatEffect, clearCombatEffects } from './combatEffectSprites.js';
import { combatEffectForEvent } from '../model/combatEffectEvents.js';
// src/ui/fx.js — feedback effects (SPEC §7.4)
//
// Rules: every animation ≤300 ms; queued events play ≤80 ms apart; a click
// skips to end-state; every HP hit shakes ≤4 px by the HP it cost, and a
// big hit holds the two figures briefly (content/combatFeel.js); Bleed bursts and
// Staggers get the loud treatment (they're the theme).

import { sfx } from './sfx.js';
import { haptic } from './haptics.js';
import { hitTierFor } from '../content/sfx.js';
import { shakePxFor, hitStopMsFor, SHAKE_MAX_PX } from '../content/combatFeel.js';
import { dlog } from './debuglog.js';
import { UI_COMPONENTS as UI, markUiComponent } from './components/uiComponents.js';
import { playPoseOn, stageFor } from './services/PoseAnimator.js';
import { reducedMotionRequested } from './motion.js';

const STEP_MS = 80;

// ---------------------------------------------------------------------------
// Animation speed (settings-driven; 'instant' collapses paced playback to the
// classic fast-float behavior — also forced by reducedMotion).
// ---------------------------------------------------------------------------

// impactCapMs: the latest an actor's swing may land after its beat starts.
// An authored clip whose impact frame falls later is played faster as a whole
// (model/equipmentAnimation.js animationTiming), so the hit, its number and its
// sound arrive while the click is still fresh (FINISH §5: click to impact
// ≤ 400 ms at Normal; tools/click-impact-probe.mjs measures it).
import { ANIM_SPEEDS, setAnimSpeed, getAnimSpeed } from './animationPace.js';
export { ANIM_SPEEDS, setAnimSpeed, getAnimSpeed };

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
export const VIEWPORT_ORIGIN = { left: 0, top: 0, width: 0, height: 0 };

/**
 * The page's `--ui-zoom`. Reading it is a computed-style read, which flushes
 * any pending style change: a loop that writes styles and converts a box per
 * item reads it once, before its writes, and passes it as `zoom`.
 */
export function uiZoom() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
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

/**
 * The visible screen, in the local space a `position: fixed` child writes in.
 *
 * This is the JS half of the `vw`-vs-`%` finding in Marina's ruling: `vw/vh`
 * resolve against the UNZOOMED viewport and are then scaled, so a clamp written
 * in them does not clamp. `innerWidth` has the same trap and the same cure — read
 * it as visual px and convert, never write it into a local-space property raw.
 */
export function viewportLocalBox() {
  return anchorLocalBox(VIEWPORT_ORIGIN, { left: 0, top: 0, width: innerWidth, height: innerHeight });
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

/**
 * Spawn a floating number over an anchor element.
 *
 * EXPORTED so an instrument can drive the SHIPPED function with the exact
 * strings that were measured clipping, rather than a copy of it that would
 * agree with itself (#69).
 */
export function floatNum(layer, anchor, text, cls, tint, placement = {}) {
  if (!layer || !anchor) return;
  const x = Number.isFinite(placement.x) ? placement.x : 0;
  const y = Number.isFinite(placement.y) ? placement.y : 0;
  const jitter = placement.jitter !== false;
  const b = anchorLocalBox(layer, anchor);
  const el = document.createElement('div');
  el.className = `float-num ${cls}`;
  const feedbackComponent = /\bblk\b/.test(cls)
    ? UI.guardedDamageIndicator
    : (/\bdmg\b/.test(cls) ? UI.healthDamageIndicator : UI.damageFeedback);
  markUiComponent(el, feedbackComponent);
  el.dataset.uiParentComponent = UI.damageFeedback;
  el.textContent = text;
  if (tint) el.style.color = tint; // #61: proc floats carry their row's tint
  // CENTRED BY CSS, NOT BY ARITHMETIC. `left` is the float's CENTRE and
  // `.float-num { translate: -50% 0 }` takes off its own half-width — so the
  // width is the browser's to know and nobody's to maintain. It used to be
  // `- 14`, a hardcoded half-width that the CSS owned and nothing checked, so
  // every float sat off-centre by (realHalfWidth - 14): measured -6px for "-7",
  // +31px for "BLOCKED", and worst for multi-codepoint text, which is exactly
  // where a guess lies hardest. At 390 that pushed "BLOCKED" to right=412 —
  // 22px off-screen, in a layer with no scrollport, so unreachable.
  //
  // `translate` is the standalone property on purpose: num-pop animates
  // `transform`, and a `transform: translateX(-50%)` here would be overwritten
  // by the first keyframe. The two compose.
  const centre = b.left + b.width / 2 + x + (jitter ? Math.random() * 26 - 13 : 0);
  const top = b.top + b.height * 0.25 + y;
  el.style.left = `${centre}px`;
  el.style.top = `${top}px`;
  layer.appendChild(el);
  // In the DOM, so the size is REAL — emoji, ligatures and all, measured by
  // layout rather than guessed from the string. offsetWidth is the untransformed
  // box, so the running pop animation cannot skew it. Keep it inside the layer
  // through the one home for that arithmetic (clampBox), then hand `left` back
  // as a centre, which is what the CSS expects.
  const half = el.offsetWidth / 2;
  const view = anchorLocalBox(layer, layer);
  const at = clampBox(
    { left: centre - half, top, width: el.offsetWidth, height: el.offsetHeight },
    view,
    { pad: 6 }
  );
  el.style.left = `${at.left + half}px`;
  setTimeout(() => el.remove(), 600);
  return el;
}

/**
 * One semantic split for every attack hit, shared by solo and co-op.
 * `amount` is the authoritative pre-block total; `blocked` is guard consumed.
 * Guard consumption is unsigned. Guard gain remains the separate +N channel.
 */
export function guardHitFloatParts(event) {
  const amount = Math.max(0, Number(event && event.amount) || 0);
  const blocked = Math.min(amount, Math.max(0, Number(event && event.blocked) || 0));
  const residual = amount - blocked;
  return {
    amount,
    blocked,
    residual,
    guard: blocked > 0 ? { text: String(blocked), cls: 'blk small' } : null,
    damage: residual > 0 ? { text: `-${residual}`, cls: dmgClass(residual) } : null,
  };
}

// Damage magnitude → size tier: crit (big hits pop hardest), heavy, normal, chip.
function dmgClass(amount) {
  if (amount >= 25) return 'dmg crit';
  if (amount >= 15) return 'dmg heavy';
  if (amount < 6) return 'dmg small';
  return 'dmg';
}

/** Spawn a transient effect element (slash arc, cast glyph, block spark…). */
function spawnFx(layer, anchor, cls, ms, text) {
  if (!layer || !anchor) return;
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

function banner(layer, text, cls = '') {
  if (!layer) return;
  const el = document.createElement('div');
  el.className = `fx-banner ${cls}`;
  el.textContent = text;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 320);
}

// Hit-stop (SPEC §7.4). `hitStop` is set by playTimeline only while the hit
// that earned the hold runs its visual, so that visual starts its target's
// recoil held and lengthens it by the same amount (never cut short).
let hitStop = 0;
const heldFigures = new Map();
function hold(el, ms) {
  if (!el || !(ms > 0)) return;
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
    stageFor(el)?.settle?.();
  }
  heldFigures.clear();
}

// A smaller hit does not cut a bigger shake short: while one plays, only a
// shake at least as big restarts it.
const SHAKE_MS = 200;
const shakeStates = new WeakMap();
function shake(combatEl, px = SHAKE_MAX_PX) {
  if (!combatEl || !(px > 0)) return;
  // Honor the Screen shake setting (and reduced motion, which also drops it).
  if (document.body.classList.contains('no-shake') || reducedMotionRequested()) return;
  const now = Date.now();
  const { shakeUntil = 0, shakeNow = 0 } = shakeStates.get(combatEl) || {};
  if (now < shakeUntil && px < shakeNow) return;
  shakeStates.set(combatEl, { shakeUntil: now + SHAKE_MS, shakeNow: px });
  combatEl.style.setProperty('--shake-px', `${px}px`);
  combatEl.classList.remove('shake');
  void combatEl.offsetWidth; // restart animation
  combatEl.classList.add('shake');
}

// Add a short-lived CSS class (restarting its animation if already present).
const flashTimers = new WeakMap();
function flash(el, cls, ms = 300, pauseMs = 0) {
  if (!el) return;
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
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const entry = { due: Date.now() + ms + pauseMs };
  entry.id = setTimeout(() => { el.classList.remove(cls); timers.delete(cls); }, ms + pauseMs);
  timers.set(cls, entry);
}

// Radial flare over an anchor (stance entries, big procs).
function flare(layer, anchor, color) {
  if (!layer || !anchor) return;
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
 * Events are staggered STEP_MS apart; clicking anywhere flushes instantly.
 */
export function animateEvents(events, ctx, done) {
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
  const cueThrough = (b) => { while (cued <= b && cued < beats.length) playBeatCues(beats[cued++].events); };
  pending = events.filter((e) => visualFor(e) !== null);
  const skip = () => {
    flushRequested = true;
  };
  addEventListener('pointerdown', skip, { once: true, capture: true });

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
    cueThrough(beatOf.has(pending[i]) ? beatOf.get(pending[i]) : -1);
    const fn = visualFor(pending[i]);
    if (fn) fn(ctx);
    i++;
    setTimeout(step, STEP_MS);
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
      case 'enemyMoveStarted':
        startActor(e.sourceId, e.kind === 'attack' ? 'attack' : 'act', e);
        break;
      case 'enemyActorTurnStarted':
        startActor(e.sourceId, 'reveal', e);
        break;
      case 'combatCounterTriggered':
        startActor(e.sourcePlayerId || e.sourceId, 'counter', e);
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
 *   }
 * Uses the module anim speed; 'instant' (or reducedMotion) falls back to
 * animateEvents' classic behavior (final state + fast floats).
 */
// Debug lifecycle counters (window.__fx) — cheap, used to diagnose stuck-busy
// reports: every timeline must end in exactly one finish (done/watchdog/flush).
const dbg = typeof window !== 'undefined' ? (window.__fx = { open: 0, finished: 0, watchdog: 0 }) : {};

export function playTimeline(events, ctx, done) {
  const speed = ANIM_SPEEDS[getAnimSpeed()];
  const reduced = reducedMotionRequested();
  if (!speed || reduced) {
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
    for (const [i, beat] of rest.entries()) playBeatHaptics(beat.events, { damageBuzz: !damageCued.has(cued - rest.length + i) });
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
    removeEventListener('pointerdown', skip, { capture: true });
    flushed = true;
    clearHeldFigures();
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
  const customActorMs = typeof ctx.maxActorAnimationMs === 'function'
    ? Number(ctx.maxActorAnimationMs(speed)) || 0
    : Number(ctx.maxActorAnimationMs) || 0;
  const actorBudgetMs = Math.max(speed.lungeMs, customActorMs);
  const budget = 2000 + beats.length * (speed.beatMs + actorBudgetMs + 4 * speed.stepMs);
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
      safe(() => playBeatCues(beat.events));
      safe(() => { if (!ctx.layer.closest('.combat')?.querySelector('.turn-ribbon')) banner(ctx.layer, beat.banner, 'turn'); });
      safe(() => ctx.onBeatApplied && ctx.onBeatApplied(beat));
      schedule(nextBeat, Math.max(260, speed.beatMs));
      return;
    }

    // 1) actor animation (lunge for attacks, glow-step otherwise)
    //
    // A figure drawn in the animated style also changes pose for the beat. Asking
    // for 'attack' lets the figure pick its own next swing, so a multi-hit turn
    // does not replay one frame and an actor with no frames cannot advance
    // anyone else's rotation. Anything else takes the guard frame, and
    // playPoseOn is a no-op for a figure with no frames at all.
    const actorEl = beat.actorId ? ctx.anchorFor(beat.actorId) : null;
    let actorAnimation = null;
    if (actorEl && ctx.animateActor) {
      try {
        actorAnimation = ctx.animateActor(beat, actorEl, speed);
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
      if (actorEl && beat.kind !== 'reveal') {
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
      const v = visualFor(e, beat.kind);
      if (v) safe(() => v(ctx));
    }
    const leadApplied = lead.size > 0 && typeof ctx.onLeadApplied === 'function';
    if (leadApplied) safe(() => ctx.onLeadApplied({ ...beat, events: beat.lead }));

    // 2) after the wind-up, the beat's effect visuals + numbers, staggered
    const visuals = beat.events.filter((e) => !lead.has(e)).map((e) => visualFor(e, beat.kind)).filter(Boolean);
    // Cast flourish: non-attack actors (skills, powers, buff moves) flare a
    // glyph as their wind-up — attacks get the slash arc on impact instead.
    if (actorEl && beat.kind !== 'attack' && beat.events.length) {
      safe(() => spawnFx(ctx.layer, actorEl, 'fx-glyph', 450, '✦'));
    }
    const windup = actorAnimation
      ? actorAnimation.impactMs
      : (actorEl ? Math.round(speed.lungeMs * 0.55) : 0);
    // Every qualifying hit holds at its own visual, including multi-hit and
    // multi-target attacks. Recovery includes only the holds actually played.
    let heldMs = 0;
    const visualEvents = beat.events.filter((e) => !lead.has(e) && visualFor(e, beat.kind));
    schedule(() => {
      let vi = 0;
      const stepV = () => {
        if (finished) return;
        if (flushed) {
          nextBeat();
          return;
        }
        if (vi < visuals.length) {
          const event = visualEvents[vi];
          const holdMs = beat.kind === 'attack' && event.type === 'damageDealt'
            ? hitStopMsFor(guardHitFloatParts(event).residual || 0) : 0;
          const held = holdMs > 0;
          const v = visuals[vi++];
          if (held) {
            safe(() => actorEl && hold(actorEl, holdMs));
            safe(() => {
              if (activeActorAnimation?.hold) activeActorAnimation.hold(holdMs);
              else stageFor(actorEl)?.hold?.(holdMs);
            });
            heldMs += holdMs;
            hitStop = holdMs;
          }
          safe(() => v(ctx));
          if (!damageCued.has(beatIndex) && playerLostHp(event)) {
            damageCued.add(beatIndex);
            safe(() => haptic.play('damageTaken'));
          }
          hitStop = 0;
          schedule(stepV, speed.stepMs + (held ? holdMs : 0));
          return;
        }
        const applyBeat = () => {
          cueBeat(beatIndex);
          safe(() => playBeatCues(beat.events, { damageBuzz: !damageCued.has(beatIndex) }));
          // 3) HUD updates for this beat, 4) inter-beat breath. Painted actor
          // sequences retain their recovery frames before the render replaces
          // the sprite host; ordinary CSS lunges update immediately as before.
          cancelActorAnimation();
          safe(() => ctx.onBeatApplied && ctx.onBeatApplied(leadApplied ? { ...beat, events: beat.events.filter((e) => !lead.has(e)) } : beat));
          schedule(nextBeat, speed.beatMs);
        };
        const recovery = actorAnimation
          ? Math.max(0, actorAnimation.totalMs + heldMs - (Date.now() - actorStartedAt))
          : 0;
        if (recovery > 0) schedule(applyBeat, recovery);
        else applyBeat();
      };
      stepV();
    }, windup);
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
 * playerLostHp(e, isLocalPlayer?) → did this receipt cost a player HP? In
 * co-op, `isLocalPlayer(seatId)` narrows it to the seats this screen plays.
 */
export function playerLostHp(e, isLocalPlayer) {
  if (!e) return false;
  let lost = false;
  if (e.type === 'damageDealt') lost = hurtsPlayer(e) && guardHitFloatParts(e).residual > 0;
  else if (e.type === 'hpLost') lost = hurtsPlayer(e) && e.cause !== 'attack' && (e.amount || 0) > 0;
  if (!lost || typeof isLocalPlayer !== 'function') return lost;
  // A co-op receipt that names no seat is nobody's here: every player entity
  // is id 'player', so treating it as local would buzz every device.
  const seat = e.targetPlayerId ?? e.playerId;
  return seat != null && isLocalPlayer(seat);
}

/**
 * Once-per-beat cues: the turn stinger and the pile sounds. A five-card
 * refill or a whole-hand discard is ONE sound, not five, and adds no step to
 * the beat's pacing (these events have no visual of their own).
 */
export function playBeatCues(events, { isLocalPlayer, stinger = true, turnBuzz = true, damageBuzz = true } = {}) {
  const has = (type) => events.some((e) => e && e.type === type);
  playBeatHaptics(events, { isLocalPlayer, turnBuzz, damageBuzz });
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
export function playBeatHaptics(events, { isLocalPlayer, turnBuzz = true, damageBuzz = true } = {}) {
  if (damageBuzz && events.some((e) => playerLostHp(e, isLocalPlayer))) haptic.play('damageTaken');
  if (turnBuzz && events.some((e) => localTurnStart(e, isLocalPlayer))) haptic.play('turnStart');
}

/**
 * localTurnStart(e, isLocalPlayer?) → is this the start of a turn this screen
 * plays? Solo (no predicate) always is. In co-op the turn stinger is shared,
 * but the buzz is personal: only a local seat's own playerTurnStart, so a
 * downed seat spectating its teammates' turns stays still. A receipt naming
 * no seat is nobody's, as in playerLostHp.
 */
export function localTurnStart(e, isLocalPlayer) {
  if (!e || e.type !== 'playerTurnStart') return false;
  if (typeof isLocalPlayer !== 'function') return true;
  return e.playerId != null && isLocalPlayer(e.playerId);
}

/**
 * The cues of a whole event list, one playBeatCues per beat exactly as the
 * paced timeline groups them (groupBeats). Used where the events are not
 * paced: instant/reduced-motion playback, a fresh fight's setup (the opening
 * draw and turn start), and co-op receipts.
 */
export function playEventCues(events, opts = {}) {
  // ONE STINGER PER SHARED TURN. Co-op's startPlayerPhase emits a
  // playerTurnStart per living seat while the shared turn moves once, and
  // groupBeats gives each its own beat; a turn already stung in this list
  // does not sting again. The key is each receipt's `turn`, so the co-op
  // digest (tools/session.mjs) must keep that field: without it every start
  // reads as the same turn and a list with two turns stings once.
  // The buzz keeps its own once-per-turn set, over this screen's seats only:
  // the turn's first start may be a teammate's, which stings for everyone
  // but buzzes nobody here, and a later local start must still buzz.
  const stung = new Set();
  const buzzed = new Set();
  for (const beat of groupBeats(events || [])) {
    const starts = beat.events.filter((e) => e && e.type === 'playerTurnStart');
    const repeat = starts.length > 0 && starts.every((e) => stung.has(e.turn));
    for (const e of starts) stung.add(e.turn);
    const mine = starts.filter((e) => localTurnStart(e, opts.isLocalPlayer));
    const turnBuzz = mine.some((e) => !buzzed.has(e.turn));
    for (const e of mine) buzzed.add(e.turn);
    playBeatCues(beat.events, { ...opts, stinger: !repeat, turnBuzz });
  }
}

/**
 * Every sound a batch of authoritative receipts carries: the HP half of each
 * attack (playHitSound) and the per-beat cues. Co-op plays its receipts
 * through this, since its floats are drawn by coop.js, not by visualFor.
 */
export function playReceiptSounds(events, opts = {}) {
  const local = (seat) => typeof opts.isLocalPlayer !== 'function' || seat == null || opts.isLocalPlayer(seat);
  for (const e of events || []) {
    if (e && e.type === 'damageDealt') playHitSound(e);
    // Co-op plays no 'cardPlay' sound or haptic at the tap (it only sends an
    // intent); the card-play buzz follows the authoritative receipt, for a
    // card this screen's own seat played.
    if (e && e.type === 'cardPlayed' && local(e.playerId)) haptic.play('cardPlay');
  }
  playEventCues(events, opts);
}

/**
 * The haptics alone of a batch of receipts, with no sound: card plays for
 * this screen's seats, and one damage buzz per beat that cost a local seat
 * HP, and a local seat's turn start once per turn. Co-op uses it for a
 * fight's final receipts, which ride the reward or completion scene that
 * replaces the combat scene (tools/session.mjs settleCombat), so the card
 * that ends a fight still buzzes, and for combat frames a paced enemy turn
 * held back behind that scene (coop.js paceEnemyTurn).
 */
export function playReceiptHaptics(events, { isLocalPlayer } = {}) {
  const local = (seat) => typeof isLocalPlayer !== 'function' || seat == null || isLocalPlayer(seat);
  for (const e of events || []) if (e && e.type === 'cardPlayed' && local(e.playerId)) haptic.play('cardPlay');
  const buzzed = new Set();
  for (const beat of groupBeats(events || [])) {
    const mine = beat.events.filter((e) => localTurnStart(e, isLocalPlayer));
    const turnBuzz = mine.some((e) => !buzzed.has(e.turn));
    for (const e of mine) buzzed.add(e.turn);
    playBeatHaptics(beat.events, { isLocalPlayer, turnBuzz });
  }
}

function visualFor(e, beatKind) {
  const base=baseVisualFor(e,beatKind),effect=combatEffectForEvent(e);
  if(!effect)return base;
  return ctx=>{
    base?.(ctx);
    const anchor=ctx.anchorFor(effect.targetId);
    if(anchor)playCombatEffect(ctx.layer,anchorLocalBox(ctx.layer,anchor),effect.kind,{size:190});
  };
}

function baseVisualFor(e, beatKind) {
  switch (e.type) {
    case 'damageDealt':
      // One event owns both visible channels: unsigned guard consumed, then
      // only the HP residual as damage. Paired results sit side-by-side without
      // relying on random jitter, so phone and desktop read the same grammar.
      return (ctx) => {
        const parts = guardHitFloatParts(e);
        const anchor = ctx.anchorFor(e.targetId);
        const paired = !!(parts.guard && parts.damage);
        if (parts.guard) {
          if (!parts.damage && anchor?.closest('.enemy')) playPoseOn(anchor, 'guardHit', 220);
          sfx.play('block');
          spawnFx(ctx.layer, anchor, 'fx-spark', 320, '✦');
          floatNum(ctx.layer, anchor, parts.guard.text, parts.guard.cls, null,
            { x: paired ? -26 : 0, jitter: false });
        }
        if (!parts.damage) return; // fully guarded: no flinch, slash, or shake
        playHitSound(e);
        const heavy = parts.residual >= 15;
        floatNum(ctx.layer, anchor, parts.damage.text, parts.damage.cls, null,
          { x: paired ? 26 : 0, jitter: !paired });
        // Attack impacts slash; the victim flashes + recoils (CSS); heavy hits
        // recoil further (hit-heavy) and kick the screen.
        if (beatKind === 'attack') spawnFx(ctx.layer, anchor, 'fx-slash', 300);
        // A held hit (hit-stop) starts the recoil held and runs it that much
        // longer, so the whole recoil still plays.
        const held = hitStop;
        flash(anchor, 'hitflash', heavy ? 380 : 220, held);
        // An animated figure recoils in its own art as well as in CSS, and holds
        // it as long as the flash it belongs to.
        playPoseOn(anchor, 'hit', heavy ? 380 : 220);
        if (held) stageFor(anchor)?.hold?.(held);
        if (heavy) flash(anchor, 'hit-heavy', 380 + held);
        hold(anchor, held);
        // Every HP hit shakes, by the HP it cost (SPEC §7.4).
        shake(ctx.combatEl, shakePxFor(parts.residual));
      };
    case 'blockGained':
      return e.amount > 0
        ? (ctx) => {
            sfx.play('block');
            floatNum(ctx.layer, ctx.anchorFor(e.targetId), `+${e.amount}`, 'blk');
          }
        : null;
    case 'hpLost':
      // #61 M2a: a proc burst's number is ITS OWN float, in the row's tint,
      // with the row's glyph — separate from and after the hit that tipped it.
      if (typeof e.cause === 'string' && e.cause.startsWith('proc:')) {
        return (ctx) => {
          const info = ctx.statusInfo && ctx.statusInfo(e.cause.slice(5));
          const anchor = ctx.anchorFor(e.targetId);
          if (e.amount > 0) { playPoseOn(anchor, 'hit', 300); flash(anchor, 'hitflash', 300); }
          floatNum(ctx.layer, ctx.anchorFor(e.targetId), `${(info && info.icon) || ''} -${e.amount}`, 'burst', info && info.tint);
        };
      }
      return e.cause === 'effect'
        ? (ctx) => {
            const anchor = ctx.anchorFor(e.targetId);
            if (e.amount > 0) { playPoseOn(anchor, 'hit', 300); flash(anchor, 'hitflash', 300); }
            floatNum(ctx.layer, anchor, `-${e.amount}`, 'burst');
          }
        : null; // attack damage already shown by damageDealt
    case 'healed':
      return e.amount > 0
        ? (ctx) => {
            sfx.play('heal');
            const anchor=ctx.anchorFor(e.targetId);if(anchor)playCombatEffect(ctx.layer,anchorLocalBox(ctx.layer,anchor),'heal');
            floatNum(ctx.layer, ctx.anchorFor(e.targetId), `+${e.amount}`, 'heal');
          }
        : null;
    // #61 M2: the proc moment, three beats — banner + per-status SFX row here,
    // the visible drain on the meter bar, then the tinted number (the proc:
    // hpLost above, next on the queue's own cadence). The old bleed-only
    // meterFilled banner generalized: any threshold row procs through this one
    // grammar, tint and name from its own data (M4).
    case 'procBurst':
      return (ctx) => {
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
      };
    // #61 M3: refusal has feedback — points blocked by an active resistance
    // answer with a gray tick, so a bleed card into resistance never reads as
    // the game eating the card.
    case 'procResisted':
      return (ctx) => {
        const info = ctx.statusInfo && ctx.statusInfo(e.status);
        floatNum(ctx.layer, ctx.anchorFor(e.targetId), `${(info && info.icon) || ''} ${e.blocked} RESISTED`, 'blk small');
      };
    case 'meterFilled':
      return null; // poise fills speak through enemyStaggered below
    case 'ratingImpact':
      if (e.breaks) return (ctx) => {
        banner(ctx.layer, e.label.toUpperCase());
        flash(ctx.anchorFor(e.targetId), 'wobble', 600);
      };
      // A Poise / Ward guard (the Dodge Roll) took some of the impact.
      return e.guarded > 0
        ? (ctx) => floatNum(ctx.layer, ctx.anchorFor(e.targetId), `${e.guarded} ${e.meter === 'ward' ? 'WARD' : 'POISE'} GUARDED`, 'blk small')
        : null;
    case 'meterGuardGained':
      return e.amount > 0
        ? (ctx) => floatNum(ctx.layer, ctx.anchorFor(e.targetId), `+${e.amount} ${e.meter === 'ward' ? 'WARD' : 'POISE'}`, 'blk small')
        : null;
    case 'enemyStaggered':
      return (ctx) => {
        sfx.play('stagger');
        banner(ctx.layer, 'STAGGERED');
        const anchor = ctx.anchorFor(e.targetId);
        flash(anchor, 'wobble', 600); // poise broken: the whole figure teeters
        spawnFx(ctx.layer, anchor, 'fx-glyph', 450, '✦');
        shake(ctx.combatEl);
      };
    case 'enemyDied':
      return (ctx) => {
        sfx.play('enemyDeath');
        const anchor = ctx.anchorFor(e.targetId);
        floatNum(ctx.layer, anchor, '✝', 'dmg heavy');
        if (anchor) { anchor.classList.remove('hitflash', 'hit-heavy'); playPoseOn(anchor, 'defeated'); }
      };
    case 'stanceEntered':
      return (ctx) => {
        sfx.play('stance');
      };
    case 'relicTriggered':
      return (ctx) => {
        sfx.play('relic');
        if (ctx.relicAnchor) flash(ctx.relicAnchor(e.relicId), 'proc', 320);
      };
    case 'energySpent':
    case 'energyGained':
      return (ctx) => {
        if (ctx.orb) flash(ctx.orb(), 'pulse', 260);
      };
    default:
      return null;
  }
}
