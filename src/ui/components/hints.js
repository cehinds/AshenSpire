// src/ui/components/hints.js — the contextual control-hint bar (SPEC §7.3).
//
// A thin, unobtrusive strip pinned to the bottom of the map and combat screens
// that lists the currently-bound keys for the dedicated overlay/zone actions, so
// the rebindable D/R/T/M/E keys are discoverable. Labels come from the live
// keyLabel() binding, so they reflect rebinds. The whole bar is hidden by CSS
// when the "Control hints" setting is off (body.hide-hints).

import { keyLabel } from '../input.js';

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
};

/** HTML for the hint bar in a given context ('combat' | 'map'). */
export function hintBarHtml(context) {
  const chips = CHIPS[context] || [];
  if (!chips.length) return '';
  const inner = chips
    .map((c) => `<span class="hint"><kbd>${keyLabel(c.id)}</kbd>${c.label}</span>`)
    .join('');
  return `<div class="hint-bar hint-${context}" role="presentation" aria-hidden="true">${inner}</div>`;
}
