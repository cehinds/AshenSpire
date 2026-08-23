// src/content/balance.js — every global tuning constant (SPEC §3.1(4))
//
// Code never embeds a balance number; a balance change is a one-file diff here.

export const balance = {
  // Arcane Exposure host resolution: visible name plus the explicit school
  // mapping actions.js consumes. No buildup is inferred from card tags.
  arcaneExposure: {
    label: 'Arcane Exposure',
    // Explicit carrier schools. Physical/holy/fire are currently unmapped and
    // therefore add zero even if a malformed card tries to author buildup.
    schoolBuildupMultipliers: { magic: 1, arcane: 1 }, // PROVISIONAL
  },
  energy: 3,
  draw: 5,
  handMax: 10,
  // Crimson/Azure are charge pools sharing this fixed capacity. Utility
  // consumables remain inventory items and use flaskSlots independently.
  flaskCapacity: 4,
  // The approved base is four; future unlocks may still grow the total. The
  // first live growth rung is data: Golden Sprout
  // is the Golden Seed homage, and carrying it grows the pool by one Crimson
  // charge. One row, amount 1, deliberately modest — the M3 balance pass owns
  // the number, and a retune is this row, nothing else: the tooltip clause
  // derives (flaskGrowthClause), the capacity derives (syncFlaskGrowth), the
  // corpus derives its expectations (tools/flaskgrowth.mjs). Schema and
  // refusals: model/flaskgrowth.js.
  flaskGrowth: [
    { source: 'relic', id: 'goldenSprout', kind: 'hp', amount: 1 },
  ],
  flaskSlots: 3,
  startingCinders: 0,
  startingDeckSize: 10,

  // Engine-consulted poise config (see ENGINE-API §1). onFill is where content
  // defines what "Staggered" means — the engine never names the status.
  poise: {
    growthMult: 1.25,
    onFill: [{ op: 'applyStatus', target: 'self', status: 'staggered', stacks: 2 }],
  },

  // ---- M2 run economy (SPEC §6) ---------------------------------------------
  rewards: {
    cardChoices: 3,
    cinders: { normal: [15, 25], elite: [35, 50], boss: [75, 90] },
    rarityWeights: {
      normal: { common: 60, uncommon: 35, rare: 5 },
      elite: { common: 45, uncommon: 40, rare: 15 },
      boss: { common: 45, uncommon: 40, rare: 15 },
    },
    // Decaying flask drop (StS potion rule): −step on drop, +step on miss.
    flaskDropBasePct: 35,
    flaskDropStepPct: 10,
  },

  shop: {
    cardStock: 5,
    relicStock: 2,
    flaskStock: 2,
    cardCost: { common: [45, 55], uncommon: [68, 82], rare: [135, 160] },
    relicCost: { common: [140, 160], uncommon: [200, 230], rare: [270, 300] },
    flaskCost: [50, 80],
    removeBase: 75,
    removeStep: 25,
    // E2 (#247): the merchant's buy-back, as a FRACTION of the low end of the
    // same cost table his own stock rolls from (relicCost[rarity][0] /
    // flaskCost[0]) — so a possession is always worth less than the cheapest
    // he would sell one for, and the same item fetches the same cinders every
    // visit, no rng. OUR number, labelled as ours: half, rounded down at the
    // price, one word flips it. 0 turns the buy-back off at the table without
    // touching the Settings toggle that owns the feature's visibility.
    sellFraction: 0.5,
  },

  shrine: { healPct: 35 },

  // ---- levelling at a shrine (Constantine, D10 wave 1 + E13) ----------------
  //
  // His words, and the whole feature is in them:
  //
  //   "also at graces, players should have the option to level up their
  //    character (per run) by trading cinders to level up. at level up they may
  //    increase a stat by 1 point."
  //   "rest sites become where you level, cinders spent past a threshold — 1
  //    stat point per level, 10–20 level-ups a run, scalable."   (E13)
  //
  // FOUR NUMBERS AND NOTHING ELSE, because the rest is derived (Law 0 clause 1):
  // which attributes may be raised is `content/attributes.js` — adding a sixth
  // attribute puts a sixth button on the shrine with no UI edit, and that is
  // this feature's Law 0 falsifier. What a point is WORTH is
  // `content/derivedStats.js`, already: a CON point is +1 HP per five, a WIS
  // point is Mana. Nothing about the value of a level is authored here.
  //
  //   firstCost   what the FIRST level of a run costs.
  //   costStep    what each level adds to the next one's price. "cinders spent
  //               past a threshold, scalable" — a linear ramp, and the ramp is
  //               the scalable part: raise this and the run gets fewer levels
  //               with no code touched.
  //   pointsPerLevel  "they may increase a stat by 1 point". His number.
  //   maxLevels   null = no ceiling but the cinders themselves. His range is an
  //               ECONOMY, not a cap, and a cap would answer it by refusing
  //               rather than by pricing.
  //
  // WHY 20 AND 4, AND WHAT IS UNKNOWN ABOUT THEM. Cost(n) = 20 + 4(n−1), so a
  // run's nth level costs 20, 24, 28 … and n levels cost 2n² + 18n cinders in
  // total. Against a run's whole cinder budget that is 10 levels at 400, 13 at
  // 600, 20 at 1200 — inside his 10–20 band across the entire plausible range,
  // which is the property `tests/engine.test.js` asserts on this table.
  // **WHAT IS NOT MEASURED IS THE BUDGET ITSELF.** Nobody here has simulated
  // what a real climb actually earns, or what the shop takes out of it first.
  // The curve is checked; the range it is checked over is an assumption, and it
  // is stated as one rather than reported as balance.
  //
  // ---- TWO DIALS HE ASKED FOR BY NAME, 2026-08-17 ---------------------------
  //
  //   "leave the level up value configurable. also, let's make the increment of
  //    5 points for reasonable change be confurable as well. that way I can
  //    test each."
  //
  // Only the LADDERS live here. `pointsPerLevel` is the level value's shipping
  // default and this is its home. The TIER SIZE's default is deliberately NOT
  // restated in this file — it is `derivedStatRules.defaults.pointsPerTier`,
  // read at the settings row from its one home, because this file is exactly
  // where a copy of it would drift. Adding a value he may pick is a row in
  // these arrays and ZERO UI code (the `tapFloor` row's shape, and the Law 0
  // falsifier for the dials themselves).
  //
  // WHAT THE TIER DIAL DOES NOT REACH, said out loud rather than discovered:
  // THREE separate vocabularies in this tree carry a 5-point tier —
  // derived stats (this dial), `equipment.basicCardProfiles[*].pointsPerTier`,
  // and relic `resource.attributeTier` rows. His sentence is about what a stat
  // point is WORTH, which is the derived-stat one and the one my HP finding was
  // about. The other two are their own systems with their own tiers, and a
  // single global reaching into all three would be collapsing three
  // distinctions into one number because it is tidier.
  levelUp: {
    firstCost: 800,
    costStep: 200,
    pointsPerLevel: 1,
    maxLevels: null,
    // What a level GRANTS — the DOMAIN, not a ladder. Constantine rejected the
    // ladder in his own words: "i don't want a dial for hte level up, I want to
    // be able to enter the value myself and maybe a slider with it that is
    // synced with the value." Four chips let him test four things; he said he
    // wants to test.
    //
    // ONE DOMAIN, TWO CONTROLS. The typed field and the slider read these two
    // numbers, so they cannot disagree about what is enterable — a field that
    // accepted 50 while the slider stopped at 20 would be the second copy of a
    // domain, and the player would find it by dragging.
    //
    // THE CEILING IS ONE NUMBER HERE AND NOTHING ELSE. 20 is an experimental
    // bound, not a design claim: at 20 a single level is four tiers of a stat.
    // If he wants 50, this line is the whole change — no code, no UI, and the
    // field will say it clamped rather than swallowing the value (Law 0 clause
    // 5: the silent plausible answer is the dangerous one).
    pointsPerLevelMin: 1,
    pointsPerLevelMax: 20,
    // How many points buy one tier of a derived stat — the DOMAIN, not a ladder,
    // for the same reason the level value stopped being one. His purpose clause
    // was "that way I can test each", and a 1-2-3-5 ladder cannot express 4 or
    // 7. (The four-chip shape a previous seat measured — 92.1 px at 390x844
    // against 301.2 for a seven-chip row — is why a LADDER could never have been
    // widened to cover the domain instead: a typed field has no chip count.)
    //
    // MIN IS 1 AND IT IS ARITHMETIC, NOT TASTE. The tier is `floor(points /
    // pointsPerTier)`, so 0 divides by zero, and the content door already
    // refuses a non-positive value by name (model/validate.js). 20 is the
    // ceiling for the same reason as the level value's: an experimental bound,
    // one number here, no code.
    tierSizeMin: 1,
    tierSizeMax: 20,
  },

  // ---- what a grace hands back ----------------------------------------------
  // Grace refills the current Crimson/Azure counts to the allocation stored on
  // the run. The allocation may be redistributed but always sums to capacity.
  // This legacy table remains empty so old debug readers fail harmlessly.
  graceRefill: [],
  graceRefillAtRunStart: false,

  // Unknown (?) node resolution odds (SPEC §5.6 M2 tuning).
  // `unknownNode` MOVED to mapConfigs[act].unknownWeights (EldenSpire#43-adjacent,
  // Freja's finding, Marina binding): what a `?` node resolves to is map geometry
  // and belongs beside `typeWeights`, per act. A flat global here could not vary
  // per act while the map it describes does, and nothing said so.

  // M1 gauntlet glue (kept for the headless bot test; the map flow is M2+).
  gauntlet: {
    healPct: 15,
    rewardChoices: 3,
    rarityWeights: { common: 60, uncommon: 35, rare: 5 },
  },

  // ---- Forsaken Together (co-op) ------------------------------------------
  coop: {
    headcountHpFactor: 0.6, // enemy HP ×(1 + factor×(headcount−1)): 2p ×1.6, 3p ×2.2, 4p ×2.8
    mendHealPct: 30, // Mend at a shrine heals an ally this % of their max HP
    reviveHp: 1, // downed-but-not-dead members revive next floor at this HP (StS2)
  },

  // ---- Endless Spire + Custom Climb rule magnitudes ------------------------
  endless: {
    hpPerLoop: 0.35, // +% enemy HP per completed cycle
    strPerLoop: 1, // +Strength per completed cycle
    actsPerCycle: 3, // acts before the spire loops (also the act count)
  },
  customMods: {
    toughElitesHpMult: 1.3, // Tough Elites: elites & bosses ×HP
    bigBossesHpMult: 1.5, // Dread Bosses: act bosses ×HP
    hoarderCinders: 250, // Hoarder: bonus starting cinders
    expensiveShopsMult: 1.5, // Greedy Merchants: ×shop price
    hoarderShopMult: 2, // Hoarder: ×shop price
    lessHealingMult: 0.5, // Scarce Embers: ×healing (shrine rest + between-act)
  },

  // ---- presentation config (read by the UI layer, never by the engine) ----
  // Same rule as the tuning above: code never embeds these numbers. Keeping the
  // audio defaults here in particular means the engine fallback and the settings
  // slider can't drift apart — they previously lived in two files and silently
  // disagreed.
  ui: {
    // HUD resource bars, per surface (content/resources.js holds the rows).
    //
    // `scaleByMax` is HIS RULE — "the size of that bar should scale depending on
    // the max total ... with the max size filling up the full top row". It is on
    // for the main HUD, which is the surface he said it about.
    //
    // It is OFF under the character models, and that is a call worth stating
    // rather than burying: he assigned that surface its CONTENTS ("really just
    // health and poise"), not a scaling rule. Turning it on there is defensible
    // and informative — the act-3 boss carries 250 HP against a 12 HP wisp —
    // but the under-model track is 84.6 px at 390x844, so most of the roster
    // lands on the 16 px floor and stops encoding anything.
    //
    // MEASURED, all 19 enemies, `node tools/hudbars.mjs --model-scale`:
    // 15 of 38 bars (39 %) sit ON the floor, and 13 of the 19 HP bars (68 %) do
    // — every enemy at or under 60 HP renders the same length as every other.
    // A scale two thirds of whose values are pinned to its minimum is not a
    // scale. That is the reason for the false, and it is a number rather than
    // a preference.
    //
    // Flipping either boolean is a one-number data edit and needs no code.
    hudBars: {
      // The shared map/combat resource reference track may occupy at most this
      // share of the visual viewport. main.js projects it to one CSS variable;
      // the stylesheet carries no second numeric copy.
      // The shared solo HUD uses this share of the room left after its action
      // cells. The old 40vw cap typed a viewport answer before those controls
      // had taken their space; 82% keeps a deliberate gutter without making a
      // second breakpoint. Co-op still consumes maxViewportPct below.
      main: { scaleByMax: true, maxViewportPct: 40, availableWidthPct: 82 },
      model: { scaleByMax: false },
    },
    // Shared HUD presentation tokens. These are screen-pixel intentions;
    // main.js projects them through --ui-zoom so Map and Combat consume the
    // same answer. Component backgrounds are transparent by current design,
    // while borders and the contents inside each panel remain visible.
    hudPresentation: {
      componentBackgroundOpacityPct: 0,
      metadataFontPx: 11,
      beltItemGapPx: 2,
      // Shared HUD spacing/scale tokens. Portraits shrink to 70% of the
      // legacy badge; the primary row, control grid, and vital rows each own
      // their own gap so responsive layouts do not hide a second copy.
      portraitScale: 0.7,
      primaryRowGapPx: 8,
      controlGapPx: 2,
      resourceRowGapPx: 2,
    },
    // Accent themes → --gold plus its rgb form (focus glow / halos).
    accents: {
      gold: { hex: '#c9a227', rgb: '201, 162, 39' },
      crimson: { hex: '#c1453a', rgb: '193, 69, 58' },
      frost: { hex: '#7fa8c9', rgb: '127, 168, 201' },
      verdant: { hex: '#8bae54', rgb: '139, 174, 84' },
      violet: { hex: '#a06cc8', rgb: '160, 108, 200' },
    },
    // UI size → whole-app zoom (--ui-zoom). 'Auto' flexes against the design
    // baseline below and is clamped so it never gets unusably tiny/huge.
    uiScale: {
      named: { s: 0.85, m: 1, l: 1.2, xl: 1.45 },
      designW: 1200,
      designH: 730,
      min: 0.62,
      max: 1.7,
      // PROTOTYPE (EldenSpire#23, track B). A SECOND design baseline, for the
      // narrow layout in styles/combat.css. #23 reads as a clamp bug — the
      // floor of 0.62 winning on every phone — and it is not: lowering the
      // floor to 0.325 fits a 1200px layout onto a 390px screen and gives you
      // glyphs you can read on a board you still cannot use. The wrong number
      // is the BASELINE, which says every screen is 1200x730. Auto picks
      // whichever of the two baselines wants the LARGER zoom, so nothing here
      // decides "is this a phone" — the fit does, and the floor stops binding
      // on its own without being touched.
      //
      // 430x780 is a portrait-phone board: at 390x844 it wants 0.907 (local
      // 430x930), at 412x915 0.958, at 360x640 0.821 (local 438x780).
      //
      // narrowMax is the width, in LOCAL px, at or below which the narrow
      // layout is used. It lives HERE and nowhere else.
      //
      // It used to live in styles/combat.css instead, as `@container app
      // (max-width: 520px)`, because a container query condition cannot read a
      // custom property. That was a correct single-home argument and Vira
      // verified it — and it was not the point. The stylesheet asking the
      // question at all made TWO deciders out of one decision: the zoom judged
      // innerWidth/innerHeight against 430x780, the layout judged the
      // container's local width against 520, and nothing made them agree. On a
      // tablet they disagreed and the fight became unadvanceable (#24).
      // main.js now decides once and writes `data-layout` on <html>; the
      // stylesheets follow it and measure nothing. One decider, one home, and
      // CSS needs no copy of this number.
      narrowW: 430,
      narrowH: 780,
      narrowMax: 520,
      // The compact wide composition's rendered lower edge. Text XL is the
      // tallest cell: at 844x340 its complete HUD, combatants, cards, hint row
      // and action controls are on glass; at 844x339 at least one required
      // region crosses its owning row. Derived at one-pixel resolution by
      // tools/short-landscape-support.mjs before this value is consulted, so
      // moving the number without moving the rendered premise goes red.
      shortWideMinH: 340,
      // THE SHORT-WIDE BAND'S UPPER EDGE (src/main.js, #27). At or above this
      // viewport height, the established wide composition remains. Below it,
      // main.js selects the compact composition down through shortWideMinH;
      // only heights below that rendered floor are refused. Thus the complete
      // current answer is:
      //
      //   h >= 465                 standard wide composition
      //   340 <= h < 465           compact wide composition (when width fits)
      //   h < 340                  truthful upright/resize refusal
      //
      // IT IS A MEASUREMENT, NOT A TASTE, and it is in data because it is a
      // layout fact that will move when the board does.
      //
      // HISTORICAL PRE-#27 RECORD BELOW. It explains why 465 was originally
      // derived as the refusal threshold. #27 keeps that exact measured upper
      // edge but inserts a supported composition below it; statements below
      // about 368..464 being refused describe the former runtime, not today.
      //
      // THE MEASUREMENT IS A DERIVATION OVER AN ENUMERATED SET, AND SAYING THAT
      // OUT LOUD IS WHY THIS NUMBER SURVIVED HAVING ITS QUESTION CHANGED. It was
      // 432 on 2026-08-15 under a different predicate; the predicate was ruled
      // wrong on 2026-08-16 and the number was RE-RUN rather than re-investigated
      // — a threshold with a domain can be re-derived when the question changes,
      // a remembered one cannot.
      //
      // ===================================================================
      // WHAT IT ANSWERS TO: THE WALL (Marina, MR-142, 2026-08-16)
      // ===================================================================
      //
      // Two predicates were on the table and they name different sets of screens:
      //   `whole`   — all five required controls whole. A QUALITY question:
      //               is this screen good?
      //   the WALL  — `.end-turn` UNREACHABLE: not one pixel on glass and no
      //               gesture to it. A SAFETY question: can this player continue?
      // They part by 64-109 px at every text size (Vira, 2026-08-15). MARINA
      // RULED THE WALL, for three reasons and the third decides it alone:
      //   1. the gate's cost is TOTAL — it removes the shape and says rotate —
      //      and a total hammer should fire on a total condition;
      //   2. a refusal removes the player's choice, a degraded screen leaves it.
      //      At 67.3% of the hand a player can rotate, page or accept. Behind the
      //      gate they cannot opt out;
      //   3. `whole` CAN BE SATISFIED BY THE VERY INTERACTION THAT STRANDS THE
      //      PLAYER — one flask gesture at 844x390 scrolls `.combat` 162.9 px and
      //      takes the screen from 2/5 + UNREACHABLE to 5/5 + onscreen, carrying
      //      the topbar off the top with no gesture back. A refusal predicate the
      //      trap itself satisfies is the wrong question.
      //
      // ===================================================================
      // THE DERIVATION: max(wall h) + 1, NEVER min(good h) (MR-143)
      // ===================================================================
      //
      // Sunna, 2026-08-16, `?shot=combat`, wide layout, auto UI size, headless
      // Chromium at width 800, EXHAUSTIVE 1 px sweep of h 360..600 per text size
      // (964 cells), tree at HEAD `sunna/the-ladder-and-the-number`:
      //   `CHROME=/usr/bin/chromium node tools/uprightgate.mjs --ladder --ladder-from 360`
      //
      //   text size                 S     M     L     XL
      //   last WALLED h           367   394   423   464      <- the derivation
      //   max(wall)+1             368   395   424   465
      //   all five whole from     432   495   533   571      <- the COST column
      //
      //   THE XL WALL IS NOT AN INTERVAL: h 360..450 AND 464 (92 cells), with
      //   451..463 not walled at all. The auto-zoom steps 0.63 -> 0.64 at 464 and
      //   the board grows faster than the window, so END TURN goes 13.37% on
      //   screen at 460, 0% AT 464, 19.76% at 470. Found by Vira, 2026-08-15;
      //   re-derived here.
      //
      //   THE LOWER BOUND READ `390` UNTIL 2026-08-16 AND 390 WAS NEVER MEASURED
      //   — it is `--ladder-from`'s DEFAULT (uprightgate.mjs, `argOf(...) ?? 390`).
      //   A run that takes the default cannot see below its own floor, so the
      //   floor comes back in the output looking exactly like an edge. It printed
      //   as one, was copied here as one, and understated this wall by 30 cells.
      //   Re-measured from 360 (Bjorn, 2026-08-16): XL is walled at every swept
      //   cell from the floor to 450.
      //
      //   AND 360 IS THE NEW FLOOR, NOT A NEW EDGE. The wall's LOWER edge is
      //   still unestablished — at 360 all four text sizes are walled, so each
      //   run's bottom is the sweep's, not the board's. Writing `360` as though
      //   it were measured is the same mistake one floor down. IT DOES NOT
      //   MATTER TO THE NUMBER: the derivation is max(wall)+1 and needs only the
      //   wall's TOP edge, which is inside the sweep at every text size. That is
      //   why a wrong lower bound sat here harmlessly and why it still had to go
      //   — a bound that costs nothing today is read as measured tomorrow.
      //
      // 465 IS ONE PAST THE LAST WALL — max(368, 395, 424, 465). NOT the first
      // height that stops being a wall, WHICH WOULD BE 451 AND WOULD BE WRONG BY
      // FOURTEEN. `min(good)` is a monotonic idea and this ground is not
      // monotonic; I measured the non-monotonicity myself (97.13% at h 485, 94.4%
      // at 486), used it to justify sweeping exhaustively, and still derived with
      // `min(good)`. One past the last bad cell is the only form that survives a
      // hole, and the hole is real.
      //
      // AND I CHECKED THE SAME QUESTION AGAINST THE COST COLUMN, because a
      // corrected derivation that leaves its neighbour uncorrected is the same
      // defect at a new address: at all four text sizes `min(whole)` and
      // `max(not-whole)+1` COINCIDE (432/495/533/571 either way). The whole set
      // is contiguous above its first cell; the wall set is not. That is a
      // measurement, not an assumption, and it is why only one column moved.
      //
      // ===================================================================
      // THE COST OF ONE NUMBER, AND IT IS MINE (MR-142's division)
      // ===================================================================
      //
      // MAXIMUM, NOT MINIMUM, AND THE DIRECTION FLIPPED WITH THE PREDICATE.
      // Under `whole` the binding constraint was "refuse no working screen", so
      // the constant was the SMALLEST of the four. Under the wall it is COVERAGE
      // — a wall the gate does not stand on is a player who cannot end their turn
      // and is not told why — so it is the LARGEST. One number cannot serve both
      // ends of the dial, and it now serves the one where the player has no way
      // out.
      //
      // WHAT 465 BUYS: every wall at every text size is covered, including the
      // Text XL band 432..450 and the one-pixel wall at 464 that no shipped
      // instrument could see. THE XL CARD DOES NOT GET RE-CARDED, IT CLOSES.
      //
      // WHAT 465 COSTS, COUNTED — `--ladder` prints this table on every run:
      //   Text S : h 368..464 refused, NOT ONE OF THEM A WALL, and h 432..464
      //            (33 heights) are FULLY WHOLE — a perfect screen, refused.
      //            (This read `390..464` and carried THE SAME sweep-floor default
      //            as the XL wall above — one defect, two addresses, one comment
      //            block. 368 is max(wall)+1 at Text S and is floor-independent,
      //            which is why the M and L rows below were right all along.)
      //   Text M : h 395..464 refused and not walled.
      //   Text L : h 424..464 refused and not walled.
      //   h 451..463 refuses NOBODY at any text size — the gap the Text XL wall
      //   jumps, which a downward-closed threshold cannot jump with it.
      // A Text S player on a 800x440 window is refused a board that works. That
      // is the price of one number and it is stated here rather than discovered.
      //
      // THE OPTION I MEASURED AND DID NOT INSTALL, because the shape of the
      // threshold is a design ruling and not mine: a per-text-size TABLE on the
      // premise — {S 368, M 395, L 424, XL 465} — is better on BOTH edges at
      // once. It covers every wall AND refuses no reachable screen at any text
      // size except the 451..463 gap at XL. My Law 4 objection to a table
      // ("an accessibility setting that takes screens away as you turn it up")
      // was true of a table on `whole` and is FALSE of a table on the premise:
      // it refuses a large-text player only the heights where that player is
      // actually walled. Vira found the step I generalised over; the objection
      // was a property of the predicate, not of the shape. What it costs is the
      // thing the single number hides: at Text S a landscape phone is handed a
      // board with 67.3% of the hand and 86.4% of the orb, both CLIPPED WITH NO
      // SCROLL PATH, and nothing refuses it. Whether that board is playable is a
      // player-experience finding and it is filed with this act.
      //
      // Re-derive with `node tools/uprightgate.mjs --ladder --ladder-from 360` —
      // it sweeps every cell at 1 px and goes red BOTH ways: a constant at or
      // below the last wall (LEAVES A WALL UNGATED — what 432 was) and one above
      // it (REFUSES ABOVE ITS OWN PREMISE). `node tools/uprightgate.mjs
      // --predicates` is the standing check that every wall has a gate on it, and
      // `--text S` is the standing check on what this number costs.
      gateBelowH: 465,
    },
    // Text size → root font-size %. It scales readable type and line metrics;
    // component and sprite geometry is owned separately (styles/base.css).
    textSize: { S: '56.25%', M: '62.5%', L: '68.75%', XL: '75%' },
    // MINIMUM TAP SIZE (Settings → Accessibility). THE ONE HOME OF THE 44.
    //
    // It used to be the literal `44px` inside `--tap-floor` in styles/base.css.
    // Constantine: "just make the tabs about 20% smaller or the size
    // configurable or scalable with UI or both" — and then, on the 44 floor,
    // "actually, I think it should be able to go smaller than 44px." Sunna
    // measured why the second half of the first sentence could never answer
    // him: `calc(44px / var(--ui-zoom))` under `body { zoom }` renders
    // 44 x zoom / zoom, so the floored controls are the one part of the
    // interface UI size cannot reach — 44.00 device px in all 20 UI-size x
    // shape cells, zero variance. So it is configurable, and this is the data.
    //
    // `sizes` IS THE CLOSED SET, largest first — that order is the order the
    // chips draw in and the order the row reads. The settings row derives its
    // `choices` and its `def` from here; nothing restates them.
    //
    // `missRate` is what the RESEARCH says, and ONLY where it says anything.
    // Two points exist: WCAG 2.1 AAA (SC 2.5.5) is 44x44 CSS px, WCAG 2.2 AA
    // (SC 2.5.8) is 24x24. 36 and 30 sit between them and carry no entry ON
    // PURPOSE — an interpolated statistic is a fabricated one, and the cost
    // line below 44 says less about them rather than inventing a number
    // (Sunna's ruling; Law 0 clause 5 is the same sentence about derivation).
    //
    // ADDING A FIFTH SIZE IS A ROW HERE AND NOTHING ELSE: it appears as a chip,
    // it applies, and it gets a cost line with no percentage unless someone
    // adds one. Removing `missRate` for a size removes the percentage and keeps
    // the sentence. That is the falsifier for Law 0 on this control.
    tapSize: {
      def: 44,
      sizes: [44, 36, 30, 24],
      missRate: { 44: '1 in 30', 24: '1 tap in 7' },
    },
    // HOLD TO CONFIRM (Settings → Advanced). THE ONE HOME OF THE DURATIONS.
    //
    // WHAT IT IS FOR, and the number that made it necessary. The event screen's
    // three choice bars are 44/44/44 across sixteen cells — the size is fixed
    // and it did not help, because THE GAPS ARE 9-9.7 px at every dial setting
    // and nothing in this game reads a gap. Targets grow, the space between
    // them does not, so a thumb that lands 9 px low lands on the NEIGHBOUR —
    // and on this screen the neighbour is "permanent curse", with no confirm
    // and no undo. Constantine, asked: "yes press and hold".
    //
    // WHY A HOLD AND NOT A MODAL, because that choice is the whole design and
    // it is not a preference: the held control FILLS, so the player watches the
    // wrong words filling under their finger and lets go IN TIME. A modal asks
    // "are you sure?" AFTER the commit, when the eye has already moved on. The
    // hold puts the question in the same moment as the mistake.
    //
    // `steps` IS THE CLOSED SET, in dial order, and `off` is first because it
    // is the A/B — the same "let me try each and decide" he asked for on the
    // map. The Advanced row derives its `choices` and its `def` from these keys
    // and nothing restates them; ADDING A FIFTH SPEED IS A ROW HERE AND NOTHING
    // ELSE. That is the falsifier for Law 0 on this control, and it is the same
    // sentence tapSize above already ships.
    //
    // The durations: 600 ms is the default because a long-press people already
    // know is ~400-500 ms (Android's own threshold) and a CONFIRM wants to sit
    // just past reflex without becoming a chore. `short` is for players who
    // find the wait irritating, `long` for hands that need the room. `off` is
    // 0 and means the pre-hold behaviour, byte for byte: one tap commits.
    holdConfirm: {
      def: 'normal',
      steps: { off: 0, short: 350, normal: 600, long: 1000 },
    },
    // THE HOLD'S BEAT — WHERE IN THE FILL A SOUND LANDS. One home for the
    // fractions; the sounds themselves are recipes in content/sfx.js and the
    // durations are holdConfirm above. Three facts, three homes, none restated.
    //
    // WHY THE HOLD NEEDS ONE AT ALL, and it is a measurement rather than a
    // taste. The fill is the only feedback the hold has, and on the event
    // screen it works: the bar is 378x44 at 390x844 and a thumb covers a
    // fraction of it. END TURN IS 190.2x50.4 AT y=784.6 OF AN 844 px VIEWPORT
    // — a control roughly the size of the contact patch, in the bottom 60 px,
    // approached from below. The hand that presses it is on top of the only
    // thing telling the player the press was received. A hold with no beat is
    // then indistinguishable from a tap that did not register, and the player
    // presses again — so the guard fires the thing twice.
    //
    // `at` IS THE CLOSED SET, as fractions of the fill, ascending, and 1.0 is
    // NOT in it: the arrival is `holdCommit`, a different sound with a
    // different job, and putting it here would give the landing two homes.
    //
    // THE SPACING IS THE MESSAGE, not decoration. The gaps shorten (0.42,
    // 0.36, 0.22) so the train ACCELERATES toward the commit: a player hears
    // "approaching" without counting anything, and an abort at 0.5 has heard a
    // train that was speeding up and then stopped, which is the true sentence
    // about what happened. An evenly spaced train is a metronome, and a
    // metronome says only "time is passing".
    //
    // ACCELERATION AND NOT PITCH, which is a composition decision with a
    // maintenance reason. A rising train would need one recipe per tick
    // (`holdTick_1..3`), and the day someone adds a fourth fraction here the
    // fourth tick has no row and the rise breaks — the row edit this comment
    // promises would stop being enough. Identical ticks getting closer
    // together is the same signal, and a fourth fraction just works.
    //
    // WHY THREE. One tick cannot rise. Two can, barely. Four plus a commit is
    // five sounds on every confirmation and this fires many times a run — the
    // cost of a charming sound is paid at hold #200, not hold #1. Three is the
    // fewest that reads as a gesture. TUNING IS THIS ROW: an empty array is
    // legal and means the ticks are off with the commit intact.
    //
    // The first tick is at 0.00 on purpose — it is the "pressed" report, and a
    // report that arrives at 180 ms has already let the player wonder.
    holdBeat: {
      at: [0, 0.42, 0.78],
    },
    // HOLD TO INSPECT (the hand). THE ONE HOME OF THE DURATION.
    //
    // Constantine, 2026-08-08: press-and-hold a card and it "expands" and comes
    // "in front". This is the gesture half of that ask; the layout half (how
    // the hand itself is arranged) is HELD on C2 and no number for it lives
    // here or anywhere.
    //
    // WHY THIS IS NOT holdConfirm's DIAL, though both are a stationary press
    // with a timer. Two different jobs (Law 4's shape, applied to time): the
    // confirm hold is a SAFETY step before an irreversible act — its length is
    // a protection preference, and `off` means "one tap commits". The inspect
    // hold is how a player READS a card — turning the safety dial off must not
    // take reading away, and a hand that needs a longer confirm does not
    // thereby need slower reading. One dial answering both would break the
    // weaker job the day anyone tunes the stronger one.
    //
    // 400 ms: the bottom of the long-press convention players already know
    // (Android's own threshold is ~400-500), BELOW the confirm's 600 default
    // because reading is cheaper than committing and fires far more often —
    // and above any tap: the slow edge of a deliberate tap is ~250 ms, and a
    // stationary press that outlives 400 was not going to become one. The
    // known cost, stated rather than hidden: a tap slower than this becomes an
    // inspect, whose release then does nothing — the card visibly expanding IS
    // the feedback that says why. `ms: 0` is the off position: no inspect,
    // pre-gesture behaviour byte for byte.
    inspectHold: {
      ms: 400,
    },
    // REWARD COLLECTION (E11, #256). THE ONE HOME OF THE WORD.
    //
    // Constantine, 2026-08-15 (the E11 card): Continue on the reward menu is
    // ALWAYS pressable and a setting decides what it means — "auto-collect ON
    // takes everything, picking at random where there is a choice; OFF gives
    // only what was chosen, no nagging".
    //
    // `auto` is the default, and the reason is which mistake costs more: under
    // auto a distracted Continue still banks the cinders and the relic (an
    // explicit SKIP on a row is respected — deck discipline survives the
    // setting); under manual a distracted Continue walks away from everything.
    // Losing rewards you never saw is the worse silence. The cost of the
    // default, stated: auto's card pick adds a card a deliberate player may
    // not have wanted — one tap (Skip on the card row) prevents it.
    //
    // NO SETTINGS ROW DERIVES FROM THIS YET, ON PURPOSE — settings.js is under
    // E3's live claim (#248); adding the row later is a data edit there, not a
    // redesign (the handLayout precedent, three rows down). Until then the
    // dial is this row and meta.settings.rewardCollect overrides it when a
    // row exists to write it.
    rewardCollect: {
      def: 'auto',
      modes: ['auto', 'manual'],
    },
    // HAND LAYOUT (C2). THE ONE HOME OF THE WORD.
    //
    // Constantine, 2026-08-13: "overlap and paging (maybe a toggleable
    // feature)" — BOTH modes, one knob. His "maybe" hedges the TOGGLE, not the
    // modes (directions.md D19), so both modes exist now behind this word and
    // the player-facing control waits for his eye on a picture. No Settings row
    // derives from this yet, on purpose — adding one later is a data edit in
    // settings.js, not a redesign.
    //
    // 'paging' names the SHIPPED narrow hand: the horizontal card strip
    // (styles/combat.css, the narrow reflow) — F1 of the approved hybrid.
    // Selecting it changes nothing, byte for byte; it is the default because
    // the shipped behaviour keeps its seat until his picture says otherwise.
    //
    // 'overlap' lays the whole hand inside the strip's width: each card
    // overlapped by the next, the overlap DERIVED per render from hand size
    // and measured width (renderHand, combat.js) — no number for it lives
    // here or anywhere, which is why this row is a word and not a px value.
    //
    // The renderer derives from this word alone (via data-hand-layout on
    // <html>, written by applyDisplaySettings beside cardMotif's attribute).
    // A stored settings.handLayout outside `handLayoutModes` lands on this
    // default and says so in the debug log; a garbage value HERE fails loud
    // in model/validate.js — the two halves of "validated loud, garbage lands
    // on default".
    handLayout: 'paging',
    handLayoutModes: ['paging', 'overlap'],
    // Sprite display tiers an enemy def's `size` selects. px-magnitude; the
    // renderer emits them as rem (÷10).
    spriteTiers: {
      small: { w: 92, h: 128, font: 44 },
      medium: { w: 132, h: 168, font: 58 },
      large: { w: 194, h: 206, font: 78 },
    },
    // How many act backdrop plates exist (assets/bg/bg_act*.webp). Endless acts
    // past this cycle back through them.
    backdropActs: 3,
    // How many map-parchment plates exist (assets/map/parchment_act*.webp) — the
    // undiscovered ground the fog map draws on. Same rule as backdropActs, its
    // own row because the two sets are authored separately and one may grow
    // first. A row, so a fourth plate is a file plus this number and no code.
    parchmentActs: 3,
    // Card colour motif (Settings → Display). Cards carry two independent
    // colour axes: the owning class (each class def's cardTint) and the
    // player's accent. `cardMotif` picks how the class one is expressed;
    // `cardMotifStrength` is the wash depth for each choice.
    // Card TYPE presentation. Geometry carries the type (attack squarest,
    // power roundest, skill between) and each type owns its banner colour.
    // label is display-only — the engine keys on the id (CARD_TYPES is frozen
    // and the Bulwark stance matches 'skill'), so renaming here is safe.
    cardTypes: {
      attack: { label: 'ATTACK', color: '#c9502e', radius: 3, art: 0 },
      skill: { label: 'SKILL', color: '#7fa8c9', radius: 10, art: 6 },
      power: { label: 'POWER', color: '#c9a227', radius: 20, art: 16 },
      curse: { label: 'CURSE', color: '#6a3a7a', radius: 10, art: 6 },
      status: { label: 'STATUS', color: '#7a6f5a', radius: 10, art: 6 },
    },
    cardMotif: 'wash',
    cardMotifModes: ['off', 'wash', 'accent', 'band'],
    cardMotifStrength: { subtle: 0.06, normal: 0.10, strong: 0.17 },
    // Default audio levels for a profile that has never touched the sliders.
    // Music ships at 50, deliberately under SFX's 75: the score is ambience,
    // the SFX are information, and the hit-confirm must read over any swell.
    // The beds carry their own gain staging on top of this bus (music.js,
    // gains 0.34–0.6), so 50 is clearly audible from first boot without
    // crowding the feedback layer.
    audio: { musicVolume: 50, sfxVolume: 75 },
  },

  // ---- Armaments & armour (equipment) ---------------------------------------
  // What you carry rewrites the cards you start with, rather than adding new
  // ones: a dagger turns Strike into 3×2, a greatsword into one heavy swing.
  // The pieces themselves live in content/source/weapons.csv and outfits.csv;
  // what a mod is ALLOWED to say lives in equipMods.csv. Everything here is
  // the rules of the system, kept in one place so it can be tuned or switched
  // off without touching the model.
  equipment: {
    startingKitDiscovery: {
      // Undiscovered alternates render no row at all: no name, numbers, cards,
      // or item silhouette leaks through character creation.
      undiscoveredPresentation: 'hidden',
      receiptLimit: 64,
    },
    roleCopies: { attack: 4, guard: 4, technique: 1, signature: 1 },
    rarityBonuses: {
      common: { attack: 0, guard: 0 },
      uncommon: { attack: 1, guard: 1 },
      rare: { attack: 2, guard: 2 },
    },
    roleSources: {
      attack: [{ slot: 'rightHand' }],
      guard: [{ slot: 'leftHand' }, { slot: 'rightHand' }],
      technique: [{ slot: 'rightHand' }],
    },
    unarmedProfiles: {
      attack: 'unarmedAttack',
      guard: 'unarmedGuard',
      technique: 'unarmedTechnique',
    },
    enabled: true,

    // WHAT THE SHELF IS SCOPED TO, and it is this word — there is no second one.
    // 'perRun'   what you find is yours for this run only
    // 'unlocked' pieces are permanent once unlocked, chosen before a run
    // 'both'     unlocked pieces are choosable AND drops apply for the run
    //
    // Constantine, 2026-08-08: *"maybe the armament menu on the main menu might
    // update, but everything else is profile specific but maybe a few basic
    // weapons become available for all. so all together for armory shelf with
    // settings to configure this."* The DEFAULT half of that is decided —
    // profile-wide, which is `both` and is what already shipped (directions.md
    // D15). The SETTING half is this line, and it did not need inventing: a
    // `shelfScope` word beside `persistence` would be two settings answering one
    // question, which is the defect this house is named for (Law 1 clause 2).
    // What `persistence` genuinely cannot say is the other half of his sentence
    // — the few pieces that are nobody's to FIND because they are everybody's —
    // and that is `basicTag` below.
    // HIS WORD, 2026-08-21: *"it should only show armory you actually picked
    // up mid run"*. That is this line and nothing else — the three values were
    // already the closed set and 'perRun' is already documented above as "what
    // you find is yours for this run only". Law 0's falsifier, answered by the
    // machinery that was already here: an entry describes, the machinery
    // derives, and the whole of item 1 is one word in a content table.
    //
    // WHAT THIS DOES NOT TOUCH, said out loud because it is the half of his
    // sentence this word cannot reach: `basicTag` below still exempts the few
    // pieces that are everybody's from the found gate, so three `basic`
    // armaments remain on the shelf in a run that has picked up nothing. That
    // is HIS OWN earlier ask (A7, 2026-08-08) and the two instructions meet
    // here. It is flagged on the PR rather than averaged: if he wants a truly
    // empty shelf, `basicTag: ''` is the second word and it is his to say.
    persistence: 'perRun',

    // ---- A FEW BASIC WEAPONS, AVAILABLE FOR ALL --------------------------
    // The tag that means "this is everybody's". It answers the FOUND gate only
    // (drops.requireFound): a basic piece never has to turn up in treasure. It
    // has no opinion about the EARNED gate, so the two compose instead of
    // racing, and a row that carries both is refused by name at validation
    // rather than quietly preferring one.
    //
    // NOTHING NEW IS AUTHORED (Law 0 clause 1). `tags` is a column weapons.csv
    // has always had; three plain rows now carry `basic` and the shelf follows.
    // Moving the line between "for all" and "profile specific" is editing that
    // column — no code, which is the whole promise. Set it to '' to switch the
    // universal shelf off entirely; a value naming a tag no armament carries is
    // a hard validation failure, because a setting that silently does nothing
    // is the one failure mode worse than a missing one.
    //
    // KILLED BY HIM, 2026-08-21: *"kill 3 basic weapons on self unless it's a
    // starting kit armory weapon shown on character creation. the armory should
    // not show weapons not collected in run. it should not show items not
    // available at character creation."*
    //
    // THE UNLESS-CLAUSE NEEDED NO CODE, AND THAT IS A MEASUREMENT, NOT A HOPE.
    // The worry was that clearing this tag would also hide the pieces the player
    // STARTED with — his exemption is the starting kit, not a category. It does
    // not, because the kit is WORN: `carriedIds(loadout)` is storage plus every
    // set, and `createRunState` puts the kit in the sets. Measured across all
    // three shipped classes at this ref:
    //
    //   reaver    carries straightSword, roundShield, default
    //   starseer  carries ashStaff, default
    //   herald    carries boneSceptre, default
    //
    // So with `persistence: 'perRun'` the shelf is already exactly KIT ∪ WHAT
    // THIS RUN PICKED UP, per class, following the player rather than a tag —
    // which is his sentence. What the tag was adding on top is the part he
    // killed: it handed the starseer a straightSword and a roundShield it was
    // never shown, and the herald all three.
    //
    // '' is the documented off value, not an invention (see the paragraph
    // above); a value naming a tag no armament carries is still a hard
    // validation failure, so this cannot rot into a silent no-op.
    basicTag: '',

    // Swapping a hand mid-fight. 'energy' spends from the turn's pool;
    // 'allowance' gives a separate per-turn budget that energy never touches.
    swapCostKind: 'energy',
    swapCost: 2,
    swapAllowancePerTurn: 1, // only consulted when swapCostKind === 'allowance'
    swapEndsTurn: false,

    // ---- WHAT A SWAP COSTS: three prices he can try, one chain ------------
    // Constantine, 2026-08-08: *"switching sets should cost actions. perhaps
    // this action costs more or less depending on Talisman or starting relic,
    // or some other reason. let's default to costing 2 actions. alternatively,
    // or by a setting, different weapon categories have weapon swap costs.
    // THAT WAY I CAN TRY EACH."*
    //
    // He named three prices and asked to FEEL them, so the three are ROWS and
    // the live one is a WORD — never three branches in the engine. One chain,
    // always the same, and the row says which of its rungs are live:
    //
    //   base 'category' → the drawn piece's category cost, falling through to
    //                     `swapCost` when its tags match no row below
    //   base 'default'  → `swapCost` for everything
    //   gear true       → talisman and relic deltas adjust that base
    //
    // THE PRODUCT IS TOTAL, AND THAT IS THE PART I GOT WRONG LAST TIME (#78).
    // Two closed fields make FOUR cells; I once shipped three ids for a product
    // whose fourth cell nobody had built, and one row of legal data drew an
    // empty screen. Here every one of the four computes a real price. The
    // fourth — category AND gear — is deliberately not shipped, because he named
    // three; it is one row away and needs no code, which is what test 28q
    // measures (Law 0's falsifier, applied to a rule instead of a card).
    //
    // WHY 28q, AND NOT 28p OR 28r — re-derivable in one read, because this line
    // cited `28c` from b5c81d0 through 284997a and NO TEST OF THAT NAME HAS EVER
    // EXISTED IN THIS REPO (`git log --all -S '28c.' -- tests/` returns nothing).
    // A wrong citation that four hands corrected in copies while the original
    // stood is not fixed by a better name alone; it is fixed by a name a reader
    // can check without trusting me:
    //   · 28q is the ONLY test in tests/engine.test.js that DECLARES the fourth
    //     cell — `{ id: 'both', base: 'category', gear: true }` — and then prices
    //     all four cells of the base × gear product, asserting '2,3,3,4'.
    //   · 28p asserts the shipped rows are exactly `flat,gear,category`. It
    //     measures the three and never builds a fourth.
    //   · 28r holds the two fields APART: its one gear clause refuses a
    //     non-boolean `gear` by name, and its base sweep runs `gear: false`
    //     throughout, so the fourth cell never occurs in it either.
    // Scored over all 66 tests in that file at 284997a, on the four claims this
    // sentence makes, 28q is the only one that carries all four.
    //
    // The default is 'flat', which is the game exactly as it shipped: nobody who
    // does not opt in pays a different price. Settings → Advanced switches it.
    swapCostRule: 'flat',
    swapCostRules: [
      { id: 'flat', label: 'Flat', base: 'default', gear: false },
      { id: 'gear', label: 'Talisman & relic', base: 'default', gear: true },
      { id: 'category', label: 'Weapon category', base: 'category', gear: false },
    ],
    // A WEAPON'S CATEGORY IS ITS TAGS. `heavy` and `flourish` are already on the
    // rows because a greatsword IS heavy — a `swapCost` column on weapons.csv
    // would compel an author to restate what the tags already imply, which is a
    // breach of Law 0 clause 1 even though every value would sit in a table.
    //
    // ORDERED, FIRST MATCH WINS. A twinblade is `blade|flourish` and a halberd
    // is `blade|heavy`; which tag rules is the order of these rows, not a max()
    // nobody can see. A tag no armament carries fails validation by name.
    swapCostByCategory: [
      { tag: 'heavy', cost: 3 },
      { tag: 'flourish', cost: 1 },
    ],

    // true  → swapping rewrites the Strikes/Defends already in your hand
    // false → only cards drawn after the swap carry the new numbers
    restampHand: true,

    storageSlots: 8, // pieces carried but not slotted; hand slots lock in combat

    defaultView: 'hybrid', // 'grid' | 'rack' | 'hybrid'
    // What a NARROW layout opens on. Data, not a branch in the screen: the view
    // list is content, and picking one in JS would put a second copy of the
    // closed set below the content layer (Law 1 clause 3). EldenSpire#38 —
    // 'hybrid' asks for a figure and three cells side by side and a phone has
    // room for one of those, which is how two of six weapon slots went missing.
    // A player's own saved equipView still wins over this; it is what a phone
    // OPENS on, never what it is allowed to show.
    narrowDefaultView: 'rack',
    // A VIEW DESCRIBES ITSELF; the screen derives the layout (#78, Law 0 cl.1).
    // These were three bare ids and `equipment.js` was `if (view === 'grid') …
    // else …`, so a fourth id rendered AS HYBRID and said nothing — the author
    // did the data-driven thing correctly and got a silently wrong screen.
    //
    // Two characteristics are the whole difference, and every rule in ui.css
    // that used to key off `.view-<id>` keys off one of them now:
    //   figure — is the dressed class figure on screen at all
    //   slots  — 'flank': slot blocks split either side of the figure
    //            'list':  slot blocks in one column beside it
    //
    // WHAT IS CLOSED IS THE COMBINATION, NOT EACH FIELD. Read that before
    // inventing a row. The first pass said "both are closed sets", which is two
    // closed sets and a product of FOUR cells — and only three are drawn. A row
    // saying `figure: false, slots: 'flank'` used every legal word and rendered
    // an EMPTY armoury in silence (Vira, #78). The three combinations below are
    // the whole vocabulary; each one is a layout in LAYOUTS in equipment.js and
    // that table is the only place the list lives. Anything else fails loud and
    // names this row (Law 1 clause 5) — including a combination of two words
    // that are each fine on their own.
    views: [
      { id: 'grid', figure: true, slots: 'flank' },
      { id: 'rack', figure: false, slots: 'list' },
      { id: 'hybrid', figure: true, slots: 'list' },
    ],
    // WHICH PANE IS THE SUBJECT. One field, and it is the whole of "collapsible"
    // (#90). Constantine: *"I still want the armoury card list to be collapsable
    // SO THAT I CAN SEE THE ARMORY SLOTS BETTER."* The clause after "so that" is
    // the datum — on this screen the slots are what you came for and everything
    // else is what helps you decide. `collapsible: true` written on a pane is
    // that fact spelled as a mechanism, and it is a special case in a
    // characteristic's clothes.
    //
    // NOT A FLAG PER PANE, and this is the #78 lesson one screen over. A
    // two-valued `role` on each pane is a closed set per pane whose PRODUCT has
    // cells nobody built: NO subject (every pane collapsible — you can fold the
    // whole screen away) and TWO subjects (nothing to order by, nothing that
    // must stay open). A POINTER has no product. One field, one value, and
    // context is the COMPLEMENT — derived, never authored.
    //
    // The regions themselves are the vocabulary and live where they are drawn
    // (REGIONS in src/ui/screens/equipment.js), exactly as LAYOUTS holds the
    // view cells. A name here that is not a region fails BY NAME at boot with
    // the list printed; naming none fails the same way.
    subject: 'slots',

    spriteReacts: 'full', // 'none' | 'hands' | 'full'

    // Floors of the mod system, so a piece can't be authored past the point
    // where the card stops making sense.
    limits: { minCost: 0, minDamage: 0, minBlock: 0, maxHits: 6 },

    // ---- Where armaments come from ------------------------------------------
    // You start bare-handed and the run arms you. A found piece is yours for
    // the run immediately AND remembered forever, so a climb that ends badly
    // still widens the wardrobe — the roguelike bargain: this run's loss is
    // next run's option.
    drops: {
      enabled: true,
      // false makes every authored armament available from the start (a sandbox
      // for testing the mod system without playing for it).
      requireFound: true,
      permanentOnFind: true,
      // HOW MUCH OF THE UNKNOWN THE PLAYER SEES — the Compendium's whole dial,
      // and one word. Constantine: *"the potential weapons to unlock should be
      // in its own menu on the main menu that keeps most things hidden."* The
      // vocabulary is not new: it is `REVEAL_MODES` from unlocks.csv, applied to
      // the OTHER gate. An armament is withheld by not being found rather than
      // by an unearned condition, so it has no unlock row to read a reveal from,
      // and this is where that answer lives — one home, tunable, no code.
      //   'teased'  silhouette, rarity, hand. No name, no tags, no numbers.
      //   'listed'  the above plus its name and why it is not yours.
      //   'hidden'  the Compendium is empty until you find something.
      // 'teased' is the shipped line: shape is a promise, a name is the item
      // delivered without the climb. A piece that wants a different answer names
      // an unlock row, whose own `reveal` wins (Law 0 clause 3 — the override is
      // data). The Armoury picker is unaffected by this word: an offer you
      // cannot take shows its reason either way.
      reveal: 'teased',
      // Chance a node of each kind yields an armament, and the rarity odds when
      // it does. Bosses always drop; their table is weighted to the good stuff.
      chance: { treasure: 60, elite: 30, boss: 100, shop: 0 },
      rarityWeights: {
        treasure: { common: 55, uncommon: 35, rare: 10 },
        elite: { common: 40, uncommon: 45, rare: 15 },
        boss: { common: 15, uncommon: 45, rare: 40 },
      },
      // A duplicate is a non-event, so drops prefer something you have never
      // held. With nothing new left the node gives cinders instead.
      preferUnfound: true,
      consolationCinders: 40,
    },
  },
};
