import { defaultCardArtwork, defaultCardArtFallbacks } from './deckReadingOutlines.js';
export { defaultCardArtFallbacks };

// A small reviewed illustration set. Equipment profiles take priority over
// base card IDs: one base Strike can carry several different weapon profiles.
const PROFILE_ART = Object.freeze({
  bladeAttack: 'slashing-strike',
  shieldGuard: 'shield-defend',
  weaponTechnique: 'weapon-technique',
});

const CARD_ART = Object.freeze({
  gorefireSlash: 'gorefire-slash',
  bloodletting: 'bloodletting',
  ironResolve: 'iron-resolve',
  lastStand: 'last-stand',
});

export function playingCardArtwork(ref, { large = false } = {}) {
  const name = PROFILE_ART[ref?.profileId] || CARD_ART[ref?.cardId];
  return name ? `docs/design/deck-editor/assets/cards/${name}-${large ? '1024' : '512'}.webp` : null;
}

/** Reviewed illustrations always win; defaults only fill unillustrated cards. */
export function playingCardArt(ref, { large = false, catalog } = {}) {
  const official = playingCardArtwork(ref, { large });
  if (official) return { path: official, kind: 'official' };
  const fallback = defaultCardArtwork(ref, catalog);
  return fallback ? { path: fallback, kind: 'outline' } : null;
}
