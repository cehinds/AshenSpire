// src/ui/components/victoryBeat.js — THE BREATH BETWEEN THE LAST BLOW AND THE
// SPOILS. Constantine's review (2026-09-11): the reward door used to open the
// instant the last enemy fell, so the fight's end was never seen — the screen
// simply became a shop of cards. This stands the fight's title (VICTORY, ELITE
// VANQUISHED, <boss> FALLS — the same string the spoils door is headed with,
// from main.js's one home) over the battlefield for `balance.ui.victoryBeat.ms`,
// then lets the door open. It never owns navigation: the caller awaits it and
// goes where it was going.
//
// REDUCED MOTION IS IMMEDIATE, not a shorter beat: a player who asked for no
// motion asked for the door, and the promise resolves before a frame is drawn.
import { el, titleL } from '../kit/index.js';
import { reducedMotionRequested } from '../motion.js';

/**
 * victoryBeat(host, { title, ms }) → Promise<void>
 * `host` is the combat screen root (the ribbon's own positioning context).
 */
export function victoryBeat(host, { title, ms }) {
  return new Promise((resolve) => {
    if (!host || !title || !(ms > 0) || reducedMotionRequested()) { resolve(); return; }
    const beat = el('div', { class: 'victory-beat', role: 'status', 'aria-live': 'polite' },
      titleL(title, { tag: 'p', class: 'victory-beat-title' }));
    host.appendChild(beat);
    requestAnimationFrame(() => beat.classList.add('is-in'));
    setTimeout(() => { beat.remove(); resolve(); }, ms);
  });
}
