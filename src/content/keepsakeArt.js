// Keepsakes intentionally reuse visible item identities to avoid another set
// of bitmaps in the single-file builds. Nothing remains an empty choice.
const KEEPSAKE_ART = Object.freeze({
  oldCinder: 'assets/relics/cutpursesCoin.webp',
  travelersFlask: 'assets/ui/flasks/flask-crimson.webp',
  whetstoneMemory: 'assets/relics/travelersWhetstone.webp',
});

export function keepsakeArtAsset(keepsake) {
  const id = typeof keepsake === 'string' ? keepsake : keepsake?.id;
  return KEEPSAKE_ART[id] || null;
}
