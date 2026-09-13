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
  // WCB1: one inspect circle for every card, combatant and tile — a 2.75
  // reference-rem (44 physical px) target, 16 px label, hung 10 px above.
  inspect: { sizeRem: 2.75, labelPx: 16, gapPx: 10 },
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
  // WCM0 lower meters. Screen-space minimums; they hold after perspective
  // scaling because the depth scale zooms only the sprite. Secondary and
  // buildup rows are half the HP height; stance matches HP.
  combatantMeters: {
    hpMinRem: 0.85, hpMinPx: 14, secondaryFraction: 0.5, secondaryMinRem: 0.45,
    stanceMinRem: 0.85, valueTextPx: 12, gapPx: 3,
    // Shown only while the combatant is selected; empty the list to show all.
    selectedOnly: ['name', 'resource', 'buildup', 'stance'],
  },
  footer: {
    circleMaxFraction: 0.2, pileMaxFraction: 0.1, endMaxFraction: 0.4,
    gapRem: 0.2, heightFraction: 0.95, minimumTargetPx: 44,
    // Readable floor for the two-line Discard / Exhaust face on narrow hosts,
    // in reference rems (at least 16 physical px each: 64 physical px).
    // Owner confirmed on 2026-09-13.
    pileMinimumRem: 4,
  },
  // WCB0 button sizes (docs/architecture-handoff/button-widths.json). A size ID
  // is width × height: {third, half, full} × {standard, tall, double}. Width
  // presets are percent of the OWNING action region's content box, never of
  // the viewport and never of the label. Heights, gaps and minimums are
  // reference rems (at least 16 physical px each, as in the hand and footer).
  // Header exits, steppers, inspect, map nodes, status icons and the packed
  // combat footer keep their own declared geometry (iconSize is the exit's).
  buttons: {
    standardHeightRem: 2.75,
    heightMultipliers: { standard: 1, tall: 1.5, double: 2 },
    sizeWidths: ['third', 'half', 'full'],
    presets: { quarter: 25, third: 30, half: 50, full: 100 },
    choice: 'half',
    minimumReadableRem: 8,
    iconSizeRem: 2.75,
    gapRem: 0.5,
    footer: 'equalSharesAfterGaps',
    singleFooter: 'full',
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
