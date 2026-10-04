// Explicit illustration choices. Unknown cards retain their authored glyph;
// no gameplay type or tag silently assigns a painted identity.
const CARD_PAINTINGS = Object.freeze({
  gorefireSlash: 'card-attack-illustration',
  defend: 'card-guard-illustration',
  emberVigil: 'card-ember-illustration',
});
export function playerCardArtwork(cardId) {
  const name = CARD_PAINTINGS[cardId];
  return name ? `assets/player-polish/illustrations/${name}.webp` : null;
}
