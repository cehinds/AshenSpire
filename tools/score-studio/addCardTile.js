// The add cell is an action, never a selectable or exportable card definition.
export function createAddCardTile({ onAdd, document: doc = document } = {}) {
  const tile = doc.createElement('div'); tile.className = 'studio-add-card-tile';
  const button = doc.createElement('button'); button.type = 'button'; button.className = 'studio-add-card-button';
  button.setAttribute('aria-label', 'Add card');
  const plus = doc.createElement('span'); plus.className = 'studio-add-card-plus'; plus.textContent = '+'; plus.setAttribute('aria-hidden', 'true');
  const text = doc.createElement('span'); text.textContent = 'Add card';
  button.append(plus, text);
  button.addEventListener('click', event => { event.stopPropagation(); onAdd?.(); });
  tile.append(button); return tile;
}

/** Capture real card positions before a gallery render; the Add cell is excluded. */
export function CaptureCardTilePositions(grid) {
  return new Map([...grid.querySelectorAll('.studio-card-tile[data-card-id]')].map(tile => {
    const box = tile.getBoundingClientRect();
    return [tile.dataset.cardId, { left: box.left, top: box.top }];
  }));
}

/** FLIP the repainted cards into place and introduce the new draft in 180 ms. */
export function animateCardInsertion(grid, newId, { before = new Map(), reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false } = {}) {
  if (reducedMotion) return [];
  const animations = [];
  for (const tile of grid.querySelectorAll('.studio-card-tile[data-card-id]')) {
    if (typeof tile.animate !== 'function') continue;
    const box = tile.getBoundingClientRect(), old = before.get(tile.dataset.cardId);
    let frames;
    if (tile.dataset.cardId === newId) frames = [{ opacity: 0, transform: 'translateY(8px) scale(.98)' }, { opacity: 1, transform: 'none' }];
    else if (old && (old.left !== box.left || old.top !== box.top)) frames = [{ transform: `translate(${old.left - box.left}px, ${old.top - box.top}px)` }, { transform: 'none' }];
    if (frames) animations.push(tile.animate(frames, { duration: 180, easing: 'cubic-bezier(.2, 0, 0, 1)' }));
  }
  return animations;
}
