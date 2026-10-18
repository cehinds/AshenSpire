// Visual style is a saved game preference, independent of the art resolution tier.
export const CARD_ART_STYLE_KEY = 'cardArtStyle';
export const CARD_ART_SIMPLE = 'Simple';
export const CARD_ART_LEGACY = 'Legacy';
export const CARD_ART_STYLE_CHOICES = Object.freeze([CARD_ART_SIMPLE, CARD_ART_LEGACY]);
let current = CARD_ART_SIMPLE;
const refreshers = new WeakMap();

export function resolveCardArtStyle(settings = {}) {
  return settings[CARD_ART_STYLE_KEY] === CARD_ART_LEGACY ? CARD_ART_LEGACY : CARD_ART_SIMPLE;
}
export function cardArtStyle() { return current; }

// Weak ownership avoids retaining cards after their screen is discarded.
export function registerCardArtRefresh(node, refresh) {
  if (!node?.dataset) return;
  node.dataset.cardArtRefresh = 'true';
  refreshers.set(node, refresh);
}

export function applyCardArtStyle(settings = {}, root = globalThis.document) {
  const next = resolveCardArtStyle(settings);
  if (next === current) return false;
  current = next;
  for (const node of root?.querySelectorAll?.('[data-card-art-refresh]') || []) refreshers.get(node)?.();
  return true;
}
