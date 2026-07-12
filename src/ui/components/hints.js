// src/ui/components/hints.js — the contextual control-hint bar (SPEC §7.3).
//
// A thin, unobtrusive strip pinned to the bottom of the map and combat screens
// that lists the currently-bound keys for the dedicated overlay/zone actions, so
// the rebindable D/R/T/M/E keys are discoverable. Labels come from the live
// keyLabel() binding, so they reflect rebinds. The whole bar is hidden by CSS
// when the "Control hints" setting is off (body.hide-hints).

import { keyLabel, padLabel, hasGamepad } from '../input.js';

// Which action chips each context shows, in reading order. All of these carry a
// rebindable keyboard key (keyLabel returns a real key, never '—').
const CHIPS = {
  combat: [
    { id: 'endTurn', label: 'End Turn' },
    { id: 'deck', label: 'Deck' },
    { id: 'relics', label: 'Relics' },
    { id: 'stats', label: 'Stats' },
    { id: 'menu', label: 'Menu' },
  ],
  map: [
    { id: 'deck', label: 'Deck' },
    { id: 'relics', label: 'Relics' },
    { id: 'stats', label: 'Stats' },
    { id: 'menu', label: 'Menu' },
  ],
  // While aiming a card/flask, the combat bar swaps to the two live choices.
  targeting: [
    { id: 'confirm', label: 'Confirm' },
    { id: 'cancel', label: 'Cancel' },
  ],
};

// Combat sets 'targeting' while a card/flask is aimed; null restores the
// default chips. The bar rebuilds in place.
let hintMode = null;
export function setHintMode(mode) {
  if (mode === hintMode) return;
  hintMode = mode;
  refreshHintBars();
}

// Show controller glyphs when a gamepad is connected, keyboard keys otherwise.
function chipsHtml(context, pad) {
  const set = context === 'combat' && hintMode === 'targeting' ? CHIPS.targeting : CHIPS[context];
  return (set || [])
    .map((c) => {
      const label = pad ? padLabel(c.id) || keyLabel(c.id) : keyLabel(c.id);
      return `<span class="hint"><kbd>${label}</kbd>${c.label}</span>`;
    })
    .join('');
}

/** HTML for the hint bar in a given context ('combat' | 'map'). */
export function hintBarHtml(context) {
  const chips = CHIPS[context] || [];
  if (!chips.length) return '';
  const pad = hasGamepad();
  return `<div class="hint-bar hint-${context}${pad ? ' hint-pad' : ''}" role="presentation" aria-hidden="true">${chipsHtml(context, pad)}</div>`;
}

/** Rebuild any visible hint bars in place — called when a pad (dis)connects. */
export function refreshHintBars() {
  const pad = hasGamepad();
  document.querySelectorAll('.hint-bar').forEach((bar) => {
    const context = bar.classList.contains('hint-combat') ? 'combat' : bar.classList.contains('hint-map') ? 'map' : null;
    if (!context) return;
    bar.classList.toggle('hint-pad', pad);
    bar.innerHTML = chipsHtml(context, pad);
  });
  // The End Turn button carries its own key chip — keep it in sync too.
  const etKey = document.querySelector('.end-turn .et-key');
  if (etKey) etKey.textContent = pad ? padLabel('endTurn') || keyLabel('endTurn') : keyLabel('endTurn');
}

if (typeof window !== 'undefined') {
  window.addEventListener('gamepadconnected', refreshHintBars);
  window.addEventListener('gamepaddisconnected', refreshHintBars);
}
