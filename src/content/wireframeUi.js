// Approved presentation defaults. No gameplay facts or illustrative fixtures.
// CURRENT-SPECIFICATION.md's final revisions supersede earlier atlas defaults.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const wireframeUi = freeze({
  card: { ratio: 5 / 8, bands: [1, 4, 4, 1] },
  // WCF3: one shared glow on a selected owner (card or combatant); its inspect
  // control appears once the selection has stood this long.
  selection: { glowRem: 0.35, revealDelayMs: 1000 },
  // W4b: a repeat pick enters only after the selection has stood this long.
  // Owner kept 400 ms on 2026-09-13.
  map: { repeatPickDelayMs: 400 },
  hand: {
    minimumHeightPx: 208, minWidthRem: 5, maxWidthRem: 9,
    minCapacity: 5, maxCapacity: 15, narrowWidthRem: 22, wideWidthRem: 75,
    exposedTargetPx: 44, selectedLiftRem: 1, verticalInsetRem: 0.25,
    fanAngleDegrees: 2.5, arcRem: 0.6, dragThresholdPx: 12,
  },
  combat: { bands: [10, 55, 30, 5], footerMinimumPx: 56 },
  // W1w: preview column share; the details pane takes the rest and scrolls.
  inspector: { previewFraction: 0.38 },
  // WCF2 lower stack: rows after activity filtering; icon tiles never wrap.
  combatantStack: { maxRows: 5, iconRem: 1.575, iconGapRem: 0.1875 },
  footer: {
    circleMaxFraction: 0.2, pileMaxFraction: 0.1, endMaxFraction: 0.4,
    gapRem: 0.2, heightFraction: 0.95, minimumTargetPx: 44,
    // Readable floor for the two-line Discard / Exhaust face on narrow hosts,
    // in reference rems (at least 16 physical px each: 64 physical px).
    // Owner confirmed on 2026-09-13.
    pileMinimumRem: 4,
  },
  formation: {
    depth: [0.9, 0.95, 1], selectedGrowth: [1.1, 1.05, 1.1],
    displayScale: 1.1, floorFraction: 0.8, insetRem: 1,
    detailReserveRem: 3.5, minimumSpritePx: 92,
    horizontalStepFraction: 0.05, minimumStepPx: 8,
    innerRetreatFraction: 0.02, maxRetreatSpacingFraction: 0.15,
    gapNarrowFraction: 0.03, gapWideFraction: 0.05,
    backLayer: 200, frontLayer: 0, focusPriority: 100,
    guardAnchor: { player: 0.12, enemy: 0.88 }, guardGapRem: 0.5,
  },
  // WCI0 identity and artwork. The metadata band names what each end holds;
  // contained artwork sits centred on cards and inspector previews and stands
  // on its baseline in combat. Only artwork mirrors for facing.
  identity: {
    metadataSlots: { start: 'rarity', end: 'owned' },
    artworkAnchorByHost: { card: 'center', inspector: 'center', combatant: 'bottom' },
  },
});
