// src/ui/fx.js — feedback effects (SPEC §7.4)
//
// Rules: every animation ≤300 ms; queued events play ≤80 ms apart; a click
// skips to end-state; shake ≤4 px only for hits ≥15; Bleed bursts and
// Staggers get the loud treatment (they're the theme).

import { sfx } from './sfx.js';

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

/** Spawn a floating number over an anchor element. */
function floatNum(layer, anchor, text, cls) {
  if (!layer || !anchor) return;
  const lr = layer.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `float-num ${cls}`;
  el.textContent = text;
  el.style.left = `${ar.left - lr.left + ar.width / 2 - 14 + (Math.random() * 26 - 13)}px`;
  el.style.top = `${ar.top - lr.top + ar.height * 0.25}px`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 300);
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
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// Radial flare over an anchor (stance entries, big procs).
function flare(layer, anchor, color) {
  if (!layer || !anchor) return;
  const lr = layer.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'stance-flare';
  el.style.left = `${ar.left - lr.left + ar.width / 2 - 90}px`;
  el.style.top = `${ar.top - lr.top + ar.height / 2 - 90}px`;
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
export function playTimeline(events, ctx, done) {
  const speed = ANIM_SPEEDS[animSpeed];
  const reduced = document.body.classList.contains('reduced-motion');
  if (!speed || reduced) {
    if (ctx.onFlush) ctx.onFlush();
    animateEvents(events, ctx, done);
    return;
  }

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
    clearTimeout(watchdog);
    removeEventListener('pointerdown', skip, { capture: true });
    if (done) done();
  };
  // Safety net: however playback ends (or a re-render throws mid-beat), never
  // leave the caller's `busy` flag stuck — force completion after a bounded
  // wall-clock budget. This is what prevents the "cards stop responding" hang.
  const budget = 2000 + beats.length * (speed.beatMs + speed.lungeMs + 4 * speed.stepMs);
  const watchdog = setTimeout(() => {
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
    const visuals = beat.events.map(visualFor).filter(Boolean);
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

function visualFor(e) {
  switch (e.type) {
    case 'damageDealt':
      return (ctx) => {
        sfx.play('hit');
        const anchor = ctx.anchorFor(e.targetId);
        floatNum(ctx.layer, anchor, `-${e.amount}`, e.amount >= 15 ? 'dmg heavy' : 'dmg');
        flash(anchor, 'hitflash', 220);
        if (e.amount >= 15) shake(ctx.combatEl);
      };
    case 'blockGained':
      return e.amount > 0
        ? (ctx) => {
            sfx.play('block');
            floatNum(ctx.layer, ctx.anchorFor(e.targetId), `+${e.amount}`, 'blk');
          }
        : null;
    case 'hpLost':
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
    case 'meterFilled':
      return e.status === 'bleed'
        ? (ctx) => {
            sfx.play('bleedBurst');
            banner(ctx.layer, 'BLEED BURST', 'blood');
          }
        : null;
    case 'enemyStaggered':
      return (ctx) => {
        sfx.play('stagger');
        banner(ctx.layer, 'STAGGERED');
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
