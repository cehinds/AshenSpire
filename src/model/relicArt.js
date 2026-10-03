// Explicit availability: unpainted relics retain their glyph.
const PAINTED_RELICS = new Set([
  'forsakenMedallion', 'starstoneShard', 'cutpursesCoin', 'goldFigurine',
  'goldenSprout', 'crackedLantern', 'bloodstainedChalice', 'crownOfStitches',
  'ivoryComb', 'blessedDew', 'gravetendersBell', 'wyrmHeart',
  'ashenGrip', 'lodestarShard', 'waxenSeal', 'whetstonePouch',
  'whetstoneFragment', 'kindlingCharm', 'cinderPouch', 'feralEye',
  'goldleafCharm', 'sacrificialKnife', 'curedHide', 'travelersWhetstone',
  'moonlitVial', 'wardensLantern', 'emberwickCharm', 'carrionMorsel',
  'wayfarersKnot',
  'crackedTear', 'sealstoneKey', 'fellWardenBrand', 'bloodiedTalisman',
  'emberFragment', 'twinnedArmor', 'blightTouchedIdol', 'warhorn',
  'vowOfVengeance', 'pearlOfSagacity', 'azureSigil', 'saltedRelic',
  'hollowedHorn', 'gildedTear', 'sentinelsOath', 'prismaticThorn',
  'goldboughSapling', 'ancestralHorn', 'titansCinder', 'radiantAegis',
  'flayersCenser', 'vigilantHalo', 'carrionTalon', 'emberIdol',
  'watchmansBadge',
  'wardenHorn', 'ashOfRemembrance', 'cinderOfTheFallen',
  'crimsonCovenant', 'howlingStandard', 'forsakenWarflag',
  'wrathCoil', 'restlessClasp', 'paupersDiadem',
]);

export function relicArtAsset(relic) {
  const id = typeof relic === 'string' ? relic : relic?.id;
  return PAINTED_RELICS.has(id) ? `assets/relics/${id}.webp` : null;
}
