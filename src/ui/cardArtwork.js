import { EXTENDED_CARD_ART } from './extendedCardArtwork.js';
import { defaultCardArtwork, defaultCardArtFallbacks } from './defaultCardArtwork.js';
import { simpleCardArt } from './cardArtComposition.js';
import { cardArtStyle, CARD_ART_LEGACY } from './cardArtStyle.js';
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
  starstonePebble: 'starstone-pebble',
  urgentHeal: 'urgent-heal',
  ambush: 'ambush',
});

export function playingCardArtwork(ref, { large = false, extended = EXTENDED_CARD_ART } = {}) {
  const profileScene = extended?.profiles?.[ref?.profileId];
  if (profileScene) return `${profileScene}-${large ? '1024' : '512'}.webp`;
  const profile = PROFILE_ART[ref?.profileId];
  if (profile) return `assets/cards/${profile}-${large ? '1024' : '512'}.webp`;
  const scene = extended?.cards?.[ref?.cardId];
  if (scene) return `${scene}-${large ? '1024' : '512'}.webp`;
  const name = CARD_ART[ref?.cardId];
  return name ? `assets/cards/${name}-${large ? '1024' : '512'}.webp` : null;
}

/** Resolve the visual style without changing the legacy artwork catalog. */
export function playingCardArt(ref, { large = false, catalog, extended = EXTENDED_CARD_ART, definition, registries, style = cardArtStyle() } = {}) {
  if (style !== CARD_ART_LEGACY && definition) {
    const simple = simpleCardArt(definition, { ref, registries, large });
    if (simple) return simple;
  }
  const official = playingCardArtwork(ref, { large, extended });
  if (official) return { path: official, kind: 'official', ...(official.startsWith('assets/cards/extended/') ? { position: '50% 65%', extended: true } : {}) };
  const fallback = defaultCardArtwork(ref, catalog);
  return fallback ? { path: fallback, kind: 'outline' } : null;
}

/** Failed new artwork falls back through the retained illustrations, then outlines. */
export function cardArtFallbacks(ref, artwork, options = {}) {
  const legacy = artwork?.kind === 'simple' ? options.legacy || playingCardArt(ref, { ...options, style: CARD_ART_LEGACY }) : null;
  const candidates = [legacy, ...defaultCardArtFallbacks(ref).map(path => ({path, kind:'outline', fit:'contain'}))].filter(Boolean);
  const seen = new Set([artwork?.path]);
  return candidates.filter(candidate => !seen.has(candidate.path) && seen.add(candidate.path));
}
