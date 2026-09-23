// src/ui/components/loreLine.js — the identity line and the lore modal.
//
// Card inspection shows one line of lore: the identity line ("Art of the
// sellswords of the Bastion."). When the card has more to say, the line is a
// button, and pressing it opens the lore modal over the inspection with the
// whole description — identity line, history, and the closing line set apart
// (LORE.md §7). Card and equipment inspection both use this, so the two card
// kinds read the same way at the same level.
//
// The modal wears the shared chrome (modalShell.js): Escape, the ✕ and a scrim
// press close only this modal, because the shell answers only for the top
// dialog, and focus returns to the line that opened it.
//
// Typeface, size, spacing and slant are the player's (Advanced → Text & lore);
// the stylesheet reads them from <html> (models/LoreTypeModel.js).

import { openModal } from './modalShell.js';
import { loreParts } from '../models/LoreTypeModel.js';

function paragraph(text, className) {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

/** Open the lore modal for `text`, titled `title`. */
export function openLoreModal({ text, title = '', eyebrow = 'Lore', opener = document.activeElement } = {}) {
  const { identity, body, closing } = loreParts(text);
  const content = document.createElement('div');
  content.className = 'lore-modal-text';
  content.append(paragraph(identity, 'lore-identity'));
  for (const part of body) content.append(paragraph(part, 'lore-history'));
  if (closing) content.append(paragraph(closing, 'lore-closing'));
  return openModal({ size: 'sm', className: 'lore-modal', eyebrow, title, opener, body: content });
}

/**
 * loreLine({ text, title, eyebrow }) → the inspection's lore element, or null
 * when there is no lore. A line with nothing behind it is plain text.
 */
export function loreLine({ text, title = '', eyebrow = 'Lore' } = {}) {
  const { identity, body, closing } = loreParts(text);
  if (!identity) return null;
  const more = body.length > 0 || Boolean(closing);
  const line = document.createElement(more ? 'button' : 'p');
  line.className = 'inspection-lore-line';
  const words = document.createElement('span');
  words.className = 'lore-identity';
  words.textContent = identity;
  line.append(words);
  if (!more) return line;
  line.type = 'button';
  line.setAttribute('aria-haspopup', 'dialog');
  // The accessible name is the identity line itself plus a hidden verb, so
  // the words a sighted player reads are the words a screen reader says.
  const hint = document.createElement('span');
  hint.className = 'sr-only';
  hint.textContent = ' — read the lore';
  line.append(hint);
  const cue = document.createElement('span');
  cue.className = 'lore-read';
  cue.setAttribute('aria-hidden', 'true');
  cue.textContent = 'Read';
  line.append(cue);
  line.addEventListener('click', (event) => {
    event.stopPropagation();
    openLoreModal({ text, title, eyebrow, opener: line });
  });
  return line;
}
