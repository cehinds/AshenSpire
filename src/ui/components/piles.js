// src/ui/components/piles.js — pile viewer modal (SPEC §7.2)
//
// Draw-pile views are display-shuffled (Math.random is fine here — pure
// presentation, never game state) so pile inspection leaks no order info,
// like StS.

import { renderCard } from './card.js';

export function openPileModal(registries, title, cards, { shuffleForDisplay = false } = {}) {
  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<h2>${title} (${cards.length})</h2>`;
  const grid = document.createElement('div');
  grid.className = 'grid';

  let list = [...cards];
  if (shuffleForDisplay) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  for (const inst of list) {
    grid.appendChild(renderCard(registries, inst, { small: true }));
  }
  if (!list.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--muted);padding:20px;';
    empty.textContent = 'Empty.';
    grid.appendChild(empty);
  }
  modal.appendChild(grid);
  veil.appendChild(modal);
  veil.addEventListener('click', (ev) => {
    if (ev.target === veil) veil.remove();
  });
  document.body.appendChild(veil);
  return veil;
}
