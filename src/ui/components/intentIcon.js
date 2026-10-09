import { ACTION_SIGILS } from '../../content/combatSigils.js';

// Original monochrome UI geometry, in the same vocabulary as card sigils.
export const INTENT_ICON_SHAPES = Object.freeze({
  attack: ACTION_SIGILS.attack.shape,
  defend: ACTION_SIGILS.defend.shape,
  counter: ACTION_SIGILS.counter.shape,
  smash: ACTION_SIGILS.smash.shape,
  prepare: '<path d="M7 3h18M7 29h18M9 3v6l14 14v6M23 3v6L9 23v6M9 8h14M9 25h14"/>',
  cast: ACTION_SIGILS.spell.shape,
  buff: ACTION_SIGILS.power.shape,
});
export function intentIcon(id) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 32 32');
  node.setAttribute('class', 'intent-icon');
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  const action = id === 'cast' ? 'spell' : id === 'buff' ? 'power' : id;
  if (ACTION_SIGILS[action]?.solid) node.setAttribute('data-solid', 'true');
  node.innerHTML = INTENT_ICON_SHAPES[id] || '';
  return node;
}
