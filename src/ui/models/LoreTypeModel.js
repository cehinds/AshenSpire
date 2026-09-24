// src/ui/models/LoreTypeModel.js — how card lore is set: the identity line in
// card inspection and the lore modal behind it.
//
// ONE HOME. The Advanced → Text & lore rows (screens/settings.js) take their
// choices and defaults from here, and applyDisplaySettings (main.js) asks
// `applyLoreType` to stamp the answer on the root. Nothing else knows the list.
//
// DATA ATTRIBUTES, NOT PIXELS. The answer is written as words on <html>
// (`data-lore-face="garamond"`); styles/kit.css maps each word to a family,
// size or spacing. Script never writes a length, so the UI-size zoom keeps
// owning every length on the page.
//
// THE FACES ARE BUNDLED AND SCOPED. Each is an @font-face under its own
// "AS Lore …" family (assets/fonts/, styles/kit.css), so choosing Cinzel here
// sets the lore in the bundled Cinzel without changing the headings, which
// keep the game's own --font-display stack.

export const LORE_FACES = Object.freeze([
  { id: 'fell', label: 'IM Fell English' },
  { id: 'garamond', label: 'EB Garamond' },
  { id: 'cormorant', label: 'Cormorant Garamond' },
  { id: 'crimson', label: 'Crimson Pro' },
  { id: 'spectral', label: 'Spectral' },
  { id: 'baskerville', label: 'Libre Baskerville' },
  { id: 'cinzel', label: 'Cinzel' },
  { id: 'inter', label: 'Inter' },
  { id: 'georgia', label: 'Georgia' },
]);

export const LORE_SIZES = Object.freeze(['S', 'M', 'L', 'XL']);
export const LORE_LEADING = Object.freeze(['tight', 'normal', 'loose']);
export const LORE_TRACKING = Object.freeze(['tight', 'normal', 'wide']);
export const LORE_SLANTS = Object.freeze(['italic', 'upright']);

export const LORE_TYPE_DEFAULTS = Object.freeze({
  loreFace: 'IM Fell English',
  loreSize: 'M',
  loreLeading: 'normal',
  loreTracking: 'normal',
  loreSlant: 'italic',
  loreIdentitySlant: 'italic',
});

const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);

/** The stored settings, resolved to the words the stylesheet reads. */
export function resolveLoreType(settings = {}) {
  const face = LORE_FACES.find((entry) => entry.label === settings.loreFace)
    || LORE_FACES.find((entry) => entry.label === LORE_TYPE_DEFAULTS.loreFace);
  return {
    face: face.id,
    size: pick(LORE_SIZES, settings.loreSize, LORE_TYPE_DEFAULTS.loreSize),
    leading: pick(LORE_LEADING, settings.loreLeading, LORE_TYPE_DEFAULTS.loreLeading),
    tracking: pick(LORE_TRACKING, settings.loreTracking, LORE_TYPE_DEFAULTS.loreTracking),
    slant: pick(LORE_SLANTS, settings.loreSlant, LORE_TYPE_DEFAULTS.loreSlant),
    identitySlant: pick(LORE_SLANTS, settings.loreIdentitySlant, LORE_TYPE_DEFAULTS.loreIdentitySlant),
  };
}

/** Stamp the resolved type on the root element. */
export function applyLoreType(settings, root = globalThis.document?.documentElement) {
  if (!root) return;
  const type = resolveLoreType(settings);
  root.dataset.loreFace = type.face;
  root.dataset.loreSize = type.size;
  root.dataset.loreLeading = type.leading;
  root.dataset.loreTracking = type.tracking;
  root.dataset.loreSlant = type.slant;
  root.dataset.loreIdentitySlant = type.identitySlant;
}

/**
 * loreParts(text) → { identity, body, closing }.
 *
 * Card lore is written in three parts separated by blank lines (LORE.md §7):
 * the identity line, the history, and a closing line set apart. The identity
 * line is all card inspection shows; the rest opens in the lore modal. Text
 * with no blank line is an identity line alone (equipment blurbs, afflictions).
 */
export function loreParts(text) {
  const parts = String(text || '').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const [identity = '', ...rest] = parts;
  const closing = rest.length > 1 ? rest.at(-1) : '';
  const body = closing ? rest.slice(0, -1) : rest;
  return { identity, body, closing };
}
