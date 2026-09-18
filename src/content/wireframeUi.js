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
  map: {
    // W4b: a repeat pick enters only after the selection has stood this long.
    // Owner kept 400 ms on 2026-09-13.
    repeatPickDelayMs: 400,
    // THE MAP TRAY (owner, 2026-09-14; screens/map.js). A pick lights the node
    // at once; the tray waits openDelayMs, slides up in slideMs (styles/map.css
    // holds the same 240 ms) while the camera glides cameraMs to recentre the
    // node; then the context and Back / Enter fade in. Closing fades them out
    // for fadeMs, then the tray drops and the camera recentres on the map.
    // Reduced motion takes every one of these to zero.
    tray: { openDelayMs: 150, slideMs: 240, fadeMs: 140, cameraMs: 300 },
    // W4b header (owner: "10 vh for w4b"). The run HUD and the route strip
    // share one band of heightFraction × the visible height, never shorter
    // than one touch row (minimumTargetPx, physical) plus its two insets.
    // Lines are the compact text/meter rows the band can stack beside the
    // controls; a narrow band needs three (facts, meters, route) to keep the
    // route line, a wide one carries the route in its own column.
    header: {
      heightFraction: 0.1, minimumTargetPx: 44, insetPx: 4,
      lineHeightPx: 16, lineGapPx: 2, wideMinWidthPx: 640, narrowRouteLines: 3,
    },
  },
  hand: {
    minimumHeightPx: 208, minWidthRem: 5, maxWidthRem: 9,
    minCapacity: 5, maxCapacity: 15, narrowWidthRem: 22, wideWidthRem: 75,
    exposedTargetPx: 44, selectedLiftRem: 1, verticalInsetRem: 0.25,
    fanAngleDegrees: 2.5, arcRem: 0.6, dragThresholdPx: 12,
  },
  // shortHostRails: when the stacked bands leave no readable combatant (short
  // landscape, e.g. 844x390), the footer row folds into rails beside the hand.
  combat: { bands: [10, 55, 30, 5], footerMinimumPx: 56, shortHostRails: true },
  // W1w: preview column share; the details pane takes the rest and scrolls.
  inspector: { previewFraction: 0.38 },
  // W1s Rest / W1u Event (choice body): nominal shares of the visible game
  // viewport. The frame takes what the run HUD leaves, capped at these.
  choiceBody: {
    frameWidthVw: 95, frameHeightVh: 90, headerMinVh: 10, footerMinVh: 10,
    sideInsetVw: 2.5, topInsetVh: 2, columnGapVw: 2, rowGapVh: 2,
  },
  // W1e/W1n: the Armoury pane's item collection and the selected item's
  // detail share the active pane (31.95/31.95 and 44/44 in the drawings, so
  // one half each). Wide hosts put them side by side; phone hosts stack them.
  armoury: { collectionShare: 0.5, compactCollectionShare: 0.5 },
  // WCF2 lower stack: rows after activity filtering.
  combatantStack: { maxRows: 5 },
  // THE ICON TRAY (components/iconTray.js, models/IconTrayModel.js): the
  // combatant card's status effects, the relic rail and the Potions minis are
  // one non-wrapping row. The status row is the reference (owner, 2026-09-14),
  // so these are its numbers: icon size and gap in reference rem.
  // `footerPotionIcons` is how many minis the tray over the combat footer's
  // Potions control is wide enough for before its `+N` tile.
  iconTray: { iconRem: 1.575, iconGapRem: 0.1875, footerPotionIcons: 4 },
  // WCM0 lower meters. Screen-space minimums; they hold after perspective
  // scaling because the depth scale zooms only the sprite. Secondary and
  // buildup rows are half the HP height; stance matches HP.
  combatantMeters: {
    hpMinRem: 0.85, hpMinPx: 14, secondaryFraction: 0.5, secondaryMinRem: 0.45,
    stanceMinRem: 0.85, valueTextPx: 12, gapPx: 3,
    // Shown only while the combatant is selected; empty the list to show all.
    selectedOnly: ['name', 'resource', 'buildup', 'stance'],
  },
  // W1d / W1v merchant workspace. The rail takes W1's 21.6 of the 95 frame
  // width (clamped to readable rems); offers and detail split the pane evenly
  // with a gap. Below `wideMinRem` of frame width the rail moves above the
  // pane and the detail stacks under the offers, taking at most
  // `detailMaxFraction` of the body so the offers keep the larger share.
  shop: {
    railFraction: 21.6 / 95, railMinRem: 11, railMaxRem: 28,
    offersFraction: 0.5, gapRem: 1, wideMinRem: 60, detailMaxFraction: 0.5,
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
    displayScale: 1.1, insetRem: 1,
    detailReserveRem: 3.5, minimumSpritePx: 92,
    horizontalStepFraction: 0.05, minimumStepPx: 8,
    innerRetreatFraction: 0.02, maxRetreatSpacingFraction: 0.15,
    gapNarrowFraction: 0.03, gapWideFraction: 0.05,
    backLayer: 200, frontLayer: 0, focusPriority: 100,
  },
  // WGS1 background composition: WGS6 skyline and WGS7 floor. Each scene is
  // one painted plate; it fills the battlefield and its authored ground line
  // sits at the floor band's top, so the field is floorFraction ground and the
  // rest sky (CURRENT-SPECIFICATION: 80% ground, 20% sky). bleedFraction
  // over-scales the plate so its atlas edges never show. With floor off the
  // plate is a centred cover crop; with skyline off no plate is painted.
  // Neither toggle moves the formation's feet.
  scene: { skyline: true, floor: true, floorFraction: 0.8, bleedFraction: 0.02 },
  // WGC4 target layer: the dashed outline on each eligible target and the
  // solid one on the active target, authored in sprite px (2 / 6, as before)
  // and held at physical minimums after the formation's depth zoom.
  targetLayer: { outlinePx: 2, outlineMinPx: 2, offsetPx: 6, offsetMinPx: 4 },
  // WCO0 combat overlays (CURRENT-SPECIFICATION: WC4, the 13.2px value font,
  // and the accepted guard geometry). Badges and text are never mirrored.
  overlay: {
    intentVisibleByRole: { player: false, enemy: true },
    defenseAnchorByRole: {
      player: { side: 'right', heightFraction: 0.12 },
      enemy: { side: 'left', heightFraction: 0.88 },
    },
    defenseGapRem: 0.5, defenseMinRem: 3.5, intentMinRem: 2.8, valueFontMinPx: 13.2,
  },
  // WCI0 identity and artwork. The metadata band names what each end holds;
  // contained artwork sits centred on cards and inspector previews and stands
  // on its baseline in combat. Only artwork mirrors for facing.
  identity: {
    metadataSlots: { start: 'rarity', end: 'owned' },
    artworkAnchorByHost: { card: 'center', inspector: 'center', combatant: 'bottom' },
  },
  // WC2a1–WC2c3 possession sub-variants. The face shows this many detail
  // lines in its fact region and this many entries in its effect region;
  // the rest stay on the card (hidden) so the inspection lists every one.
  // One effect entry: at a 280 px card the heading and a second entry do not
  // fit the 54 px effect row above the physical type floor.
  possession: { faceLines: 2, faceEffects: 1 },
  // W1 category navigation, shared by every categorized W1 surface (Settings,
  // Shop, Armoury, Compendium, Profile, the pile viewer). A category rail needs
  // this host width, and every category at the tap floor must fit in the W1
  // body band (70% of the viewport); otherwise one [Category ▾] selector sits
  // above the pane (rule 11: never a horizontal strip). Gap and inset are the
  // rail's budget, not its drawn values. Hysteresis stops a host at the edge
  // flapping. (These numbers were W1a's `settings` block.)
  categoryNav: {
    railMinHostWidthRem: 60, bodyHeightFraction: 0.7,
    railGapRem: 0.6, railInsetRem: 1.4, hysteresisRem: 1,
  },
  // W1 workspace (W1f Compendium, W1g Profile): frame share of the viewport,
  // the wide rail (21.6vw, floored and capped for readability) and the gaps
  // between the pane's two slots (2vw beside each other, 2vh stacked).
  workspace: {
    frameWidth: 0.95, frameHeight: 0.9, railWidth: 0.216,
    railMinRem: 11, railMaxRem: 24, columnGap: 0.02, rowGap: 0.02,
  },
  // WT0 shared tooltip. The presenter's measured rungs (tooltip.js) remain
  // its only size system; this names the wireframe each rung draws: small is
  // WT1 compact, medium WT2 standard, and large and expanded are both WT3
  // (same width, expanded only reaches further down). The arrow is WT0.arrow,
  // 0.75 × 0.375 reference rems on the edge facing the trigger, kept
  // arrowInsetRem clear of the frame's corners.
  tooltip: {
    wireframeByRung: { small: 'WT1', medium: 'WT2', large: 'WT3', expanded: 'WT3' },
    arrowWidthRem: 0.75, arrowHeightRem: 0.375, arrowInsetRem: 0.5,
  },
  // WGH0 / WGS2 shared run HUD (CURRENT-SPECIFICATION: the HUD contract and
  // "Potions ownership"). Layers are filtered before layout: a layer that is
  // off draws nothing and leaves no row or gap; `header` and `rail` switch
  // their whole row. Which resource rows exist is content/resources.js's
  // business, not a layer here.
  // Potions: WGC11 in the combat footer is the one Potions control and WGH8
  // is its contents, charge flasks and carried consumables in one projection
  // (models/PotionContentsModel.js); either category can be hidden. Its minis
  // hang over that footer control as the shared icon tray. NO TOP HUD DRAWS
  // POTIONS (owner, 2026-09-14: "why do I still see potions in the top band"),
  // so `roomRail` is false: shop, rest and event show none, and outside combat
  // nothing drinks a charge flask or drops a carried one until the Potions
  // control has a room home. true puts the flask icons back in those rooms'
  // rail; combat never takes them.
  hud: {
    layers: {
      header: true, class: true, cinders: true, position: true,
      vitality: true, armoury: true, menu: true, rail: true, relics: true,
    },
    potions: { chargeFlasks: true, carried: true, roomRail: false },
  },
  // W1i Smith upgrade, W1j Extract card, W1k Install card. The item list is
  // the workspace's left column at W1i's 44 of the 90 usable width (floored
  // and capped so a name stays readable); the selected item's pane takes the
  // rest. Compact hosts fold the list into one selector above the pane.
  smith: { candidatesWidth: 0.44, candidatesMinRem: 14, candidatesMaxRem: 60 },
  // W4c dialogue (WGQ0–WGQ8). The player's portrait stands left and the
  // speaker's right, each portraitShare of the scene's width; the scene is at
  // least sceneMinRem tall. The caption region keeps room for captionLines
  // lines of prose at captionLineHeight, so moving between beats never jumps
  // the controls. Reference rems (at least 16 physical px each). Provisional
  // numbers: an owner decision.
  dialogue: { portraitShare: 0.3, sceneMinRem: 10, captionLines: 3, captionLineHeight: 1.45 },
});
