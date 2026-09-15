// src/ui/components/choiceBody.js — the W1 frame a choice body stands in
// (W1s Rest, W1u Event; W1t Rewards keeps its door over the battlefield).
//
// One header (title + {Status}), one body that alone scrolls, holding two slots
// side by side on wide hosts and stacked on narrow ones, and a reserved foot
// when the surface has a continuation. The shares come from
// wireframeUi.choiceBody through the DOM-free ChoiceBodyModel.
//
// NO CLOSE CONTROL. A choice body is left through its own choices or its
// continuation; the head's close is removed, not built and then hidden.
import { el, modalHead } from '../kit/index.js';
import { choiceBodyFrameVars } from '../models/ChoiceBodyModel.js';

/**
 * mountChoiceBody(screen, spec) → the door element, appended to `screen`.
 * spec: { className, label, eyebrow, title, status, choices, consequences, foot }
 * `choices` and `consequences` are the two body slots, in reading order.
 */
export function mountChoiceBody(screen, { className = '', label = '', eyebrow = '', title, status = '', choices = null, consequences = null, foot = null }) {
  for (const [name, value] of Object.entries(choiceBodyFrameVars())) screen.style.setProperty(name, value);
  screen.classList.add('choice-screen');
  const head = modalHead({
    eyebrow, title,
    extras: el('span', { class: 'as-status modal-head-status choice-head-status', dataset: { choiceStatus: '' }, text: status }),
  });
  head.querySelector('.modal-close')?.remove();
  const door = el('section', { class: `modal choice-door${className ? ` ${className}` : ''}`, role: 'region', 'aria-label': label || title }, [
    head,
    el('div', { class: 'modal-body choice-body' }, el('div', { class: 'choice-body-columns' }, [choices, consequences])),
    foot,
  ]);
  screen.appendChild(door);
  return door;
}

/** setChoiceStatus(door, text) — rewrite the head's {Status} in place. */
export function setChoiceStatus(door, text) {
  const node = door.querySelector('[data-choice-status]');
  if (node) node.textContent = text;
}
