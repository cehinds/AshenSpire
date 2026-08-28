// src/ui/fx.js — feedback effects (SPEC §7.4)
//
// Rules: every animation ≤300 ms; queued events play ≤80 ms apart; a click
// skips to end-state; shake ≤4 px only for hits ≥15; Bleed bursts and
// Staggers get the loud treatment (they're the theme).

import { sfx } from './sfx.js';
import { dlog } from './debuglog.js';

const STEP_MS = 80;

// ---------------------------------------------------------------------------
// Animation speed (settings-driven; 'instant' collapses paced playback to the
// classic fast-float behavior — also forced by reducedMotion).
// ---------------------------------------------------------------------------

export const ANIM_SPEEDS = {
  slow: { beatMs: 700, stepMs: 140, lungeMs: 340 },
  normal: { beatMs: 400, stepMs: 90, lungeMs: 260 },
  fast: { beatMs: 180, stepMs: 45, lungeMs: 160 },
  instant: null,
};

let animSpeed = 'normal';
export function setAnimSpeed(v) {
  animSpeed = ANIM_SPEEDS[v] === undefined ? 'normal' : v;
}
export function getAnimSpeed() {
  return animSpeed;
}

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

export function anchorLocalBox(layer, anchor) {
  const lr = rectOf(layer);
  const ar = rectOf(anchor);
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
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

/**
 * Spawn a floating number over an anchor element.
 *
 * EXPORTED so an instrument can drive the SHIPPED function with the exact
 * strings that were measured clipping, rather than a copy of it that would
 * agree with itself (#69).
 */
export function floatNum(layer, anchor, text, cls, tint) {
  if (!layer || !anchor) return;
  const b = anchorLocalBox(layer, anchor);
  const el = document.createElement('div');
  el.className = `float-num ${cls}`;
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
  const centre = b.left + b.width / 2 + (Math.random() * 26 - 13);
  const top = b.top + b.height * 0.25;
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

function shake(combatEl) {
  if (!combatEl) return;
  // Honor the Screen shake setting (and reduced motion, which also drops it).
  if (document.body.classList.contains('no-shake') || document.body.classList.contains('reduced-motion')) return;
  combatEl.classList.remove('shake');
  void combatEl.offsetWidth; // restart animation
  combatEl.classList.add('shake');
}

// Add a short-lived CSS class (restarting its animation if already present).
function flash(el, cls, ms = 300) {
  if (!el) return;
  // Photosensitivity: suppress bright impact/proc flashes when asked. Damage
  // numbers and HUD updates (which carry the actual info) are unaffected.
  if (document.body.classList.contains('reduce-flashes')) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
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
      removeEventListener('pointerdown', skip, { capture: true });
      if (done) done();
      return;
    }
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

function groupBeats(events) {
  const beats = [];
  let cur = { actorId: null, banner: null, kind: null, events: [] };
  const push = () => {
    if (cur.events.length || cur.banner || cur.actorId) beats.push(cur);
  };
  for (const e of events) {
    switch (e.type) {
      case 'cardPlayed':
        push();
        cur = { actorId: 'player', banner: null, kind: e.cardType === 'attack' ? 'attack' : 'act', events: [e] };
        break;
      case 'flaskUsed':
        push();
        cur = { actorId: 'player', banner: null, kind: 'act', events: [e] };
        break;
      case 'enemyMoveStarted':
        push();
        cur = { actorId: e.sourceId, banner: null, kind: e.kind === 'attack' ? 'attack' : 'act', events: [e] };
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
  const speed = ANIM_SPEEDS[animSpeed];
  const reduced = document.body.classList.contains('reduced-motion');
  if (!speed || reduced) {
    if (ctx.onFlush) ctx.onFlush();
    animateEvents(events, ctx, done);
    return;
  }
  dbg.open = (dbg.open || 0) + 1;

  const beats = groupBeats(events);
  let flushed = false;
  let finished = false;
  const skip = () => {
    flushed = true;
  };
  addEventListener('pointerdown', skip, { once: true, capture: true });
  const finish = () => {
    if (finished) return;
    finished = true;
    dbg.finished = (dbg.finished || 0) + 1;
    clearTimeout(watchdog);
    removeEventListener('pointerdown', skip, { capture: true });
    if (done) done();
  };
  // Safety net: however playback ends (or a re-render throws mid-beat), never
  // leave the caller's `busy` flag stuck — force completion after a bounded
  // wall-clock budget. This is what prevents the "cards stop responding" hang.
  const budget = 2000 + beats.length * (speed.beatMs + speed.lungeMs + 4 * speed.stepMs);
  const watchdog = setTimeout(() => {
    dbg.watchdog = (dbg.watchdog || 0) + 1;
    console.warn('[fx] watchdog forced timeline completion');
    dlog('fx', 'watchdog forced timeline completion', { open: dbg.open, finished: dbg.finished });
    try {
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
  const nextBeat = () => {
    if (finished) return;
    if (flushed) {
      safe(() => ctx.onFlush && ctx.onFlush());
      finish();
      return;
    }
    if (bi >= beats.length) {
      finish();
      return;
    }
    const beat = beats[bi++];

    if (beat.banner) {
      safe(() => banner(ctx.layer, beat.banner, 'turn'));
      safe(() => ctx.onBeatApplied && ctx.onBeatApplied(beat));
      setTimeout(nextBeat, Math.max(260, speed.beatMs));
      return;
    }

    // 1) actor animation (lunge for attacks, glow-step otherwise)
    const actorEl = beat.actorId ? ctx.anchorFor(beat.actorId) : null;
    if (actorEl) safe(() => flash(actorEl, beat.kind === 'attack' ? 'act-attack' : 'act-move', speed.lungeMs));

    // 2) after the wind-up, the beat's effect visuals + numbers, staggered
    const visuals = beat.events.map((e) => visualFor(e, beat.kind)).filter(Boolean);
    // Cast flourish: non-attack actors (skills, powers, buff moves) flare a
    // glyph as their wind-up — attacks get the slash arc on impact instead.
    if (actorEl && beat.kind !== 'attack' && beat.events.length) {
      safe(() => spawnFx(ctx.layer, actorEl, 'fx-glyph', 450, '✦'));
    }
    const windup = actorEl ? Math.round(speed.lungeMs * 0.55) : 0;
    setTimeout(() => {
      let vi = 0;
      const stepV = () => {
        if (finished) return;
        if (flushed) {
          nextBeat();
          return;
        }
        if (vi < visuals.length) {
          const v = visuals[vi++];
          safe(() => v(ctx));
          setTimeout(stepV, speed.stepMs);
          return;
        }
        // 3) HUD updates for this beat, 4) inter-beat breath
        safe(() => ctx.onBeatApplied && ctx.onBeatApplied(beat));
        setTimeout(nextBeat, speed.beatMs);
      };
      stepV();
    }, windup);
  };
  nextBeat();
}

function visualFor(e, beatKind) {
  switch (e.type) {
    case 'damageDealt':
      // Fully blocked: a frost spark and a BLOCKED float — the armor held, so
      // no flinch, no shake, no slash.
      if (e.amount === 0 && e.blocked > 0) {
        return (ctx) => {
          sfx.play('block');
          const anchor = ctx.anchorFor(e.targetId);
          spawnFx(ctx.layer, anchor, 'fx-spark', 320, '✦');
          floatNum(ctx.layer, anchor, 'BLOCKED', 'blk small');
        };
      }
      return (ctx) => {
        sfx.play('hit');
        const anchor = ctx.anchorFor(e.targetId);
        const heavy = e.amount >= 15;
        floatNum(ctx.layer, anchor, `-${e.amount}`, dmgClass(e.amount));
        // Attack impacts slash; the victim flashes + recoils (CSS); heavy hits
        // recoil further (hit-heavy) and kick the screen.
        if (beatKind === 'attack') spawnFx(ctx.layer, anchor, 'fx-slash', 300);
        flash(anchor, 'hitflash', heavy ? 380 : 220);
        if (heavy) {
          flash(anchor, 'hit-heavy', 380);
          shake(ctx.combatEl);
        }
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
          floatNum(ctx.layer, ctx.anchorFor(e.targetId), `${(info && info.icon) || ''} -${e.amount}`, 'burst', info && info.tint);
        };
      }
      return e.cause === 'effect'
        ? (ctx) => floatNum(ctx.layer, ctx.anchorFor(e.targetId), `-${e.amount}`, 'burst')
        : null; // attack damage already shown by damageDealt
    case 'healed':
      return e.amount > 0
        ? (ctx) => {
            sfx.play('heal');
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
        if (anchor) anchor.classList.add('crumble');
      };
    case 'stanceEntered':
      return (ctx) => {
        sfx.play('stance');
        const color = e.stance === 'bulwark' ? 'rgba(127,168,201,.55)' : 'rgba(201,80,46,.55)';
        flare(ctx.layer, ctx.anchorFor('player'), color);
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
