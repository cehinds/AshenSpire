// src/ui/fx.js — feedback effects (SPEC §7.4)
//
// Rules: every animation ≤300 ms; queued events play ≤80 ms apart; a click
// skips to end-state; shake ≤4 px only for hits ≥15; Bleed bursts and
// Staggers get the loud treatment (they're the theme).

import { sfx } from './sfx.js';

const STEP_MS = 80;

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
