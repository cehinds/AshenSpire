import { ACTION_SIGILS, SCHOOL_SIGILS } from '../../content/combatSigils.js';

// Original monochrome UI geometry, in the same vocabulary as card sigils.
export const INTENT_ICON_SHAPES = Object.freeze({
  attack: ACTION_SIGILS.attack.shape,
  defend: ACTION_SIGILS.defend.shape,
  counter: ACTION_SIGILS.counter.shape,
  smash: ACTION_SIGILS.smash.shape,
  sweep: ACTION_SIGILS.sweep.shape,
  evade: ACTION_SIGILS.evade.shape,
  prepare: '<path d="M7 3h18M7 29h18M9 3v6l14 14v6M23 3v6L9 23v6M9 8h14M9 25h14"/>',
  cast: ACTION_SIGILS.spell.shape,
  buff: ACTION_SIGILS.power.shape,
});
export function intentIcon(id) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 32 32');
  node.setAttribute('class', 'intent-icon');
  node.dataset.intent = id;
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  const action = id === 'cast' ? 'spell' : id === 'buff' ? 'power' : id;
  if (ACTION_SIGILS[action]?.solid) node.setAttribute('data-solid', 'true');
  node.innerHTML = INTENT_ICON_SHAPES[id] || '';
  return node;
}

// The elemental flux marks (W25-F): the school mark of each flux element (Necrotic wears Decay's), and the plain Spell mark for a spell with no element.
export const FLUX_ELEMENT_SCHOOL = Object.freeze({ fire: 'fire', lightning: 'lightning', frost: 'frost', divine: 'divine', necrotic: 'decay', force: 'force' });
export function FluxIcon(element) {
  const sigil = element ? SCHOOL_SIGILS[FLUX_ELEMENT_SCHOOL[element]] : ACTION_SIGILS.spell;
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 32 32');
  node.setAttribute('class', 'intent-icon flux-icon');
  node.dataset.flux = element || 'magic';
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  if (sigil.solid) node.setAttribute('data-solid', 'true');
  node.innerHTML = sigil.shape;
  return node;
}
