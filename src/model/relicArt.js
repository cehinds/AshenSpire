// Explicit availability: unpainted relics retain their glyph.
const PAINTED_RELICS = new Set([
  'forsakenMedallion', 'starstoneShard', 'cutpursesCoin', 'goldFigurine',
  'goldenSprout', 'crackedLantern', 'bloodstainedChalice', 'crownOfStitches',
]);

export function relicArtAsset(relic) {
  const id = typeof relic === 'string' ? relic : relic?.id;
  return PAINTED_RELICS.has(id) ? `assets/relics/${id}.webp` : null;
}
