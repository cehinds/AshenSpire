import { ACTION_SIGILS } from '../../content/combatSigils.js';

// Original monochrome UI geometry, in the same vocabulary as card sigils.
const shapes = {
  attack: '<path d="m6 3 17 20-3 3L3 6Zm20 0L9 23l3 3L29 6ZM5 20l7 7m8-7 7 7M3 29l5-5m16 0 5 5"/>',
  defend: ACTION_SIGILS.defend.shape,
  smash: ACTION_SIGILS.smash.shape,
  prepare: '<path d="M7 3h18M7 29h18M9 3v6l14 14v6M23 3v6L9 23v6M9 8h14M9 25h14"/>',
  cast: '<path d="m6 29 15-19"/><circle cx="22" cy="8" r="6"/><path d="m22 3 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z"/>',
  buff: '<path d="M13 28V13H8L16 3l8 10h-5v15ZM4 16v6m-3-3h6m19 1v8m-4-4h8"/>',
};
export function intentIcon(id) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 32 32');
  node.setAttribute('class', 'intent-icon');
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  node.innerHTML = shapes[id] || '';
  return node;
}
