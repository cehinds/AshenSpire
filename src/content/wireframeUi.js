// Compatibility shim: the legacy wireframeUi shape, composed from uiConfig.
// Every number is authored in content/config/ui/ (see content/config/README.md)
// and compiled by tools/config-build.mjs into src/config/generated/ui.js. Edit
// the JSON, never this file: it only maps config paths onto the old keys, and
// tests/ui-config.test.mjs holds it deep-equal (key order included) to the
// pre-migration snapshot and refuses any numeric literal here except PERCENT.
import { uiConfig } from '../config/generated/ui.js';

const PERCENT = 100;
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const { w4, w4a, w4b, w4c } = uiConfig.scenes;
const {
  card, selection, inspect, inspector, choiceBody, buttons, identity, possession,
  categoryNav, workspace, tooltip, hud, dialogueFrame,
} = uiConfig.components;
const { armoury, shop, smith } = uiConfig.screens;
const layerEnabled = (scene, id) => scene.layering.layers.find((l) => l.id === id).enabled;

const size = w4a.sizing;
const place = w4a.positioning;

export const wireframeUi = freeze({
  card: { ratio: card.sizing.ratio, bands: card.sizing.bands },
  selection: { glowRem: selection.sizing.glowRem, revealDelayMs: selection.motion.revealDelayMs },
  inspect: { sizeRem: inspect.sizing.sizeRem, labelPx: inspect.sizing.labelPx, gapPx: inspect.positioning.gapPx },
  map: {
    repeatPickDelayMs: w4b.behavior.repeatPickDelayMs,
    // THE MAP TRAY (owner, 2026-09-14; screens/map.js). A pick lights the node
    // at once; the tray waits openDelayMs, slides up in slideMs (styles/map.css
    // holds the same duration) while the camera glides cameraMs to recentre the
    // node; then the context and Back / Enter fade in. Closing fades them out
    // for fadeMs, then the tray drops and the camera recentres on the map.
    // Reduced motion takes every one of these to zero. The numbers live in
    // content/config/ui/scenes/w4b-map.json, like every other scene number.
    tray: {
      openDelayMs: w4b.behavior.tray.openDelayMs,
      slideMs: w4b.behavior.tray.slideMs,
      fadeMs: w4b.behavior.tray.fadeMs,
      cameraMs: w4b.behavior.tray.cameraMs,
    },
    header: {
      heightFraction: w4b.sizing.header.heightFraction,
      minimumTargetPx: w4b.sizing.header.minimumTargetPx,
      insetPx: w4b.positioning.header.insetPx,
      lineHeightPx: w4b.sizing.header.lineHeightPx,
      lineGapPx: w4b.sizing.header.lineGapPx,
      wideMinWidthPx: w4b.sizing.header.wideMinWidthPx,
      narrowRouteLines: w4b.sizing.header.narrowRouteLines,
    },
  },
  hand: {
    minimumHeightPx: size.hand.minimumHeightPx,
    minWidthRem: size.hand.minWidthRem,
    maxWidthRem: size.hand.maxWidthRem,
    minCapacity: size.hand.minCapacity,
    maxCapacity: size.hand.maxCapacity,
    narrowWidthRem: size.hand.narrowWidthRem,
    wideWidthRem: size.hand.wideWidthRem,
    exposedTargetPx: size.hand.exposedTargetPx,
    selectedLiftRem: place.hand.selectedLiftRem,
    verticalInsetRem: place.hand.verticalInsetRem,
    fanAngleDegrees: place.hand.fanAngleDegrees,
    arcRem: place.hand.arcRem,
    dragThresholdPx: w4a.behavior.hand.dragThresholdPx,
  },
  combat: {
    bands: [size.bands.hud, size.bands.scene, size.bands.context, size.bands.footer],
    footerMinimumPx: w4.sizing.minimums.footerPx,
    shortHostRails: w4a.behavior.shortHostRails,
  },
  inspector: { previewFraction: inspector.sizing.previewFraction },
  choiceBody: {
    frameWidthVw: choiceBody.sizing.frameWidthVw,
    frameHeightVh: choiceBody.sizing.frameHeightVh,
    headerMinVh: choiceBody.sizing.headerMinVh,
    footerMinVh: choiceBody.sizing.footerMinVh,
    sideInsetVw: choiceBody.positioning.sideInsetVw,
    topInsetVh: choiceBody.positioning.topInsetVh,
    columnGapVw: choiceBody.positioning.columnGapVw,
    rowGapVh: choiceBody.positioning.rowGapVh,
  },
  armoury: {
    collectionShare: armoury.sizing.collectionShare,
    compactCollectionShare: armoury.sizing.compactCollectionShare,
  },
  combatantStack: {
    maxRows: w4a.components.combatantStack.maxRows,
  },
  iconTray: {
    iconRem: uiConfig.components.iconTray.sizing.iconRem,
    iconGapRem: uiConfig.components.iconTray.positioning.iconGapRem,
    footerPotionIcons: uiConfig.components.iconTray.sizing.footerPotionIcons,
  },
  combatantMeters: {
    hpMinRem: size.combatantMeters.hpMinRem,
    hpMinPx: size.combatantMeters.hpMinPx,
    secondaryFraction: size.combatantMeters.secondaryFraction,
    secondaryMinRem: size.combatantMeters.secondaryMinRem,
    stanceMinRem: size.combatantMeters.stanceMinRem,
    valueTextPx: size.combatantMeters.valueTextPx,
    gapPx: place.combatantMeters.gapPx,
    selectedOnly: w4a.components.combatantMeters.selectedOnly,
  },
  shop: {
    railFraction: shop.sizing.railFraction,
    railMinRem: shop.sizing.railMinRem,
    railMaxRem: shop.sizing.railMaxRem,
    offersFraction: shop.sizing.offersFraction,
    gapRem: shop.positioning.gapRem,
    wideMinRem: shop.sizing.wideMinRem,
    detailMaxFraction: shop.sizing.detailMaxFraction,
  },
  footer: {
    circleMaxFraction: size.footer.circleMaxFraction,
    pileMaxFraction: size.footer.pileMaxFraction,
    endMaxFraction: size.footer.endMaxFraction,
    gapRem: place.footer.gapRem,
    heightFraction: size.footer.heightFraction,
    minimumTargetPx: size.footer.minimumTargetPx,
    pileMinimumRem: size.footer.pileMinimumRem,
  },
  buttons: {
    standardHeightRem: buttons.sizing.standardHeightRem,
    heightMultipliers: buttons.sizing.heightMultipliers,
    sizeWidths: buttons.sizing.sizeWidths,
    presets: buttons.sizing.presets,
    choice: buttons.components.choice,
    minimumReadableRem: buttons.sizing.minimumReadableRem,
    iconSizeRem: buttons.sizing.iconSizeRem,
    gapRem: buttons.positioning.gapRem,
    footer: buttons.components.footer,
    singleFooter: buttons.components.singleFooter,
  },
  formation: {
    depth: size.formation.depth,
    selectedGrowth: size.formation.selectedGrowth,
    displayScale: size.formation.displayScale,
    insetRem: place.formation.insetRem,
    detailReserveRem: size.formation.detailReserveRem,
    minimumSpritePx: size.formation.minimumSpritePx,
    horizontalStepFraction: place.formation.horizontalStepFraction,
    minimumStepPx: place.formation.minimumStepPx,
    innerRetreatFraction: place.formation.innerRetreatFraction,
    maxRetreatSpacingFraction: place.formation.maxRetreatSpacingFraction,
    gapNarrowFraction: place.formation.gapNarrowFraction,
    gapWideFraction: place.formation.gapWideFraction,
    backLayer: w4a.layering.formation.backLayer,
    frontLayer: w4a.layering.formation.frontLayer,
    focusPriority: w4a.layering.formation.focusPriority,
  },
  scene: {
    skyline: layerEnabled(w4a, 'skyline'),
    floor: layerEnabled(w4a, 'floor'),
    floorFraction: size.floorPercent / PERCENT,
    bleedFraction: w4.layering.plate.bleedFraction,
  },
  targetLayer: {
    outlinePx: size.targetLayer.outlinePx,
    outlineMinPx: size.targetLayer.outlineMinPx,
    offsetPx: place.targetLayer.offsetPx,
    offsetMinPx: place.targetLayer.offsetMinPx,
  },
  overlay: {
    intentVisibleByRole: w4a.components.overlay.intentVisibleByRole,
    defenseAnchorByRole: place.overlay.defenseAnchorByRole,
    defenseGapRem: place.overlay.defenseGapRem,
    defenseMinRem: size.overlay.defenseMinRem,
    intentMinRem: size.overlay.intentMinRem,
    valueFontMinPx: size.overlay.valueFontMinPx,
  },
  identity: {
    metadataSlots: identity.components.metadataSlots,
    artworkAnchorByHost: identity.positioning.artworkAnchorByHost,
  },
  possession: { faceLines: possession.components.faceLines, faceEffects: possession.components.faceEffects },
  categoryNav: {
    railMinHostWidthRem: categoryNav.sizing.railMinHostWidthRem,
    bodyHeightFraction: categoryNav.sizing.bodyHeightFraction,
    railGapRem: categoryNav.positioning.railGapRem,
    railInsetRem: categoryNav.positioning.railInsetRem,
    hysteresisRem: categoryNav.behavior.hysteresisRem,
  },
  workspace: {
    frameWidth: workspace.sizing.frameWidth,
    frameHeight: workspace.sizing.frameHeight,
    railWidth: workspace.sizing.railWidth,
    railMinRem: workspace.sizing.railMinRem,
    railMaxRem: workspace.sizing.railMaxRem,
    columnGap: workspace.positioning.columnGap,
    rowGap: workspace.positioning.rowGap,
  },
  tooltip: {
    wireframeByRung: tooltip.components.wireframeByRung,
    arrowWidthRem: tooltip.sizing.arrowWidthRem,
    arrowHeightRem: tooltip.sizing.arrowHeightRem,
    arrowInsetRem: tooltip.positioning.arrowInsetRem,
  },
  hud: { layers: hud.layering.layers, potions: hud.components.potions },
  smith: {
    candidatesWidth: smith.sizing.candidatesWidth,
    candidatesMinRem: smith.sizing.candidatesMinRem,
    candidatesMaxRem: smith.sizing.candidatesMaxRem,
  },
  dialogue: {
    portraitShare: dialogueFrame.sizing.portraitShare,
    sceneMinRem: dialogueFrame.sizing.sceneMinRem,
    captionLines: w4c.sizing.context.captionLines,
    captionLineHeight: w4c.sizing.context.captionLineHeight,
  },
});
