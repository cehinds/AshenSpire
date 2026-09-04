// src/ui/components/piles.js — pile viewer modal (SPEC §7.2)
//
// Draw-pile views are display-shuffled (Math.random is fine here — pure
// presentation, never game state) so pile inspection leaks no order info,
// like StS.
//
// THIS DOOR HAD NO WAY OUT THAT A KEYBOARD COULD REACH. Before adopting the
// shell it built its own veil and panel, listened for a click on the veil, and
// stopped there: no close control, no Escape, no `aria-modal`, no focus
// return. A player on a pad or a keyboard who opened the draw pile was stuck
// in it. That is not a styling divergence — it is the reason modalShell.js
// owns dismissal rather than advising about it.
//
// What is left here is the BODY, which is all this file ever should have been:
// a grid of card faces, display-shuffled where the pile is hidden.

import { renderCard } from './card.js';
import { openModal } from './modalShell.js';
import { button, cardGrid, flavour, statusText } from '../kit/index.js';

export function openPileModal(registries, title, cards, { shuffleForDisplay = false } = {}) {
  let list = [...cards];
  if (shuffleForDisplay) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  const done = button({ label: 'Close', weight: 'primary', className: 'pile-done', attrs: { 'data-focusable': 'true' } });

  // The COUNT is the head's status, not part of the title: "Draw pile" names
  // the door and stays put while `(5)` changes underneath it. The old markup
  // baked the number into the <h2>, so the thing a player reads as the name
  // of the surface changed every time a card moved.
  const status = statusText(`${list.length} ${list.length === 1 ? 'card' : 'cards'}`, { class: 'modal-head-status' });

  const shell = openModal({
    size: 'xl',
    className: 'pile-modal',
    eyebrow: 'Pile',
    title,
    headExtras: status,
    bodyClassName: 'pile-body',
    body: (host) => {
      // The body is the kit's CardGrid: the same faces the fan draws, wrapped,
      // at one gap. An empty pile says so in Flavour rather than drawing air.
      const grid = cardGrid(list.map((inst) => renderCard(registries, inst, { small: true })), { class: 'grid' });
      if (!list.length) grid.appendChild(flavour('Empty.', { class: 'pile-empty' }));
      host.appendChild(grid);
    },
    primary: done,
    footSize: 'short',
  });
  done.addEventListener('click', shell.close);
  return shell.veil;
}
