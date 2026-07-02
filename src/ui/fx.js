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
        floatNum(ctx.layer, ctx.anchorFor(e.targetId), `-${e.amount}`, e.amount >= 15 ? 'dmg heavy' : 'dmg');
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
      return e.amount > 0 ? (ctx) => floatNum(ctx.layer, ctx.anchorFor(e.targetId), `+${e.amount}`, 'heal') : null;
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
        floatNum(ctx.layer, ctx.anchorFor(e.targetId), '✝', 'dmg heavy');
      };
    case 'stanceEntered':
      return () => sfx.play('stance');
    default:
      return null;
  }
}
