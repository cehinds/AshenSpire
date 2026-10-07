import { FORMATION_ROWS } from '../../model/formationLayout.js';

export function formationTileOutline() {
  return '<svg class="formation-grid-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,0 100,50 50,100 0,50" vector-effect="non-scaling-stroke"/><rect width="100" height="100" vector-effect="non-scaling-stroke"/><ellipse cx="50" cy="50" rx="50" ry="50" vector-effect="non-scaling-stroke"/></svg>';
}

// Stable nodes retain their hold handlers when the selected dimensions change.
export function formationGridHtml() {
  return `<div class="formation-grid" aria-hidden="true">${[...FORMATION_ROWS].flatMap(row =>
    [1, 2, 3, 4, 5, 6].map(column => `<button type="button" hidden disabled tabindex="-1" aria-label="Position ${row}${column}" class="formation-grid-cell" data-cell="${row}${column}">${formationTileOutline()}<span>${row}${column}</span></button>`)).join('')}</div>`;
}
