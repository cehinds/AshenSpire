// src/content/derivedStats.js — shipping authority for derived-stat rules.
//
// The content registry validates this table, and run creation snapshots its
// resolved rules so saves, sessions, and co-op keep the same derived values.

export const derivedStatRules = {
  // RULESET 6 — ONE FORMAT FOR EVERY STAT AND RESOURCE (owner, 2026-09-21).
  //
  // "make mp hp and every resource now a similar calculation to AR, PR, DR,
  // etc. I'll just use decimal values to set the growth per level, in fact I'd
  // like all the resources and stats to be in the same format so that there was
  // no confusion to include the base values and everything because they are way
  // too separated."
  //
  // So a row here is now the SAME ROW a combat rating is (model/ratingFormula.js
  // — AR, DR, PR, Poise, Ward), with the level term on it:
  //
  //   base         before a single point is spent
  //   <attribute>  that attribute's decimal contribution per point, floored on
  //                its own: 0.2 gives nothing until the attribute reaches 5
  //   perLevel     DECIMAL growth per character level: 0.2 is a point every
  //                five levels, 1 is one every level
  //
  // WHAT MOVED FROM RULESET 5: nothing in the attribute terms — every weight
  // below is ruleset 5's `gainPerTier / pointsPerTier` restated, and lands on
  // the same number at every attribute value. The LEVEL terms are decimals now
  // and so are SMOOTH: HP climbs 1 per level instead of 5 every fifth level
  // (the same rate, arriving each level rather than in lumps); Mana, Stamina
  // and draw land on exactly the levels they always did. Ruleset 5 and earlier
  // are restored exactly as they were saved; only new runs read this.
  // RULESET 7 — EVERY STAT IN THIS TABLE (owner, 2026-09-24).
  //
  // "mana should be derived but mostly comes from about 4 points in wisdom
  // with some from constitution strength and intelligence … I'd like all
  // features, handsize, draw amount, actions, ar, dr, pr, ward, poise, stamina,
  // mana, hp settings to have a similiar interface and be driven by only that
  // interface. default should equal about 2 when adding all partials values as
  // the budget per with mana and stamina budget is about 1."
  //
  // So the combat ratings (AR, DR, PR, Ward, Poise — formerly model/
  // ratingFormula.js) and the hand (opening hand, per-turn draw, hand size —
  // formerly content/handRules.js and the balance fallback hand size) are rows here, in the
  // row every pool already used:
  //
  //   base         before a single point is spent (whole points)
  //   <attribute>  that attribute's decimal contribution per point, floored
  //                on its own: 0.125 gives nothing until the attribute is 8
  //   perLevel     decimal growth per character level after the first
  //   min / max    optional bounds the value never leaves
  //
  // THE BUDGET: a row's weights sum to about 2, Mana's and Stamina's to 1.
  // HP, Actions and the three hand rows are PRESERVED rather than re-budgeted
  // — a literal sum of 2 would hand out some ten extra Actions at creation —
  // and read what ruleset 6 read at every attribute 5 and at 12 in the lead
  // stat. Rulesets 1–6 are restored exactly as they were saved; only new runs
  // read this.
  rulesetVersion: 7,
  defaults: {
    perLevel: 0,
  },
  rules: {
    // Owner defaults, 2026-09-24 (ashen-spire-game-config_4.json): every
    // pool reads a spread of attributes, not one.
    //
    // A3 LEAN RETUNE (2026-09-27, FINISH D28). Two numbers moved, each sized
    // from `node tools/runsim.mjs 100 --seeded-seats --incoming`:
    //   energy.dexterity 0.2 → 0.25   the first extra Action at DEX 4, not 5:
    //       reachable at creation (Assign points can put all three points
    //       there), one level-up away for the Standard Rogue (DEX 3) and three
    //       for every DEX-1 preset. The level term (0.1) is unchanged.
    //   hp.base 30 → 51               the lowest stock pool (Rogue and Herald,
    //       38 before) now covers the fleet's 90th-percentile HP lost over a
    //       run's first three fights (59, every class pooled). Every stock
    //       pool rises by the same 21: Reaver 70, Starseer 69, Rogue and
    //       Herald 59. Only the base moved; CON still pays 4 a point.
    energy: { base: 3, strength: 0.1, dexterity: 0.25, wisdom: 0.01, intelligence: 0.01, perLevel: 0.1 }, // Retired save row; combat reads Stamina.
    // Owner, 2026-10-03: open and draw four, with the existing Draw scaling
    // (+1 per five INT above 4). Retain adds to the next draw; the absolute
    // capacity is a separate flat 15. Each row remains configurable, and
    // existing runs continue to read their snapshotted rows.
    openingHand: {
      base: 4, intelligence: 0.2, attributeBaseline: 4, min: 2, max: 10,
      byClass: {
        reaver: { base: 4, intelligence: 0.2 },
        rogue: { base: 4, intelligence: 0.2 },
        herald: { base: 4, intelligence: 0.2 },
        starseer: { base: 4, intelligence: 0.2 },
      },
    },
    draw: { base: 4, intelligence: 0.2, attributeBaseline: 4, min: 2, max: 10 },
    handSize: { base: 15, min: 1, max: 15 },
    // Owner, 2026-10-06: each primary attribute has a clear +1 main bonus.
    // Bases, level growth and secondary resource rules stay independently
    // configurable. Existing runs retain their snapshotted coefficients.
    hp: { base: 51, constitution: 1, perLevel: 2 },
    // Budget 1 each, the owner's own sums.
    stamina: { base: 3, dexterity: 0.25, constitution: 0.25, wisdom: 0.2, intelligence: 0.2, perLevel: 0.1 },
    mana: { base: 1, strength: 0.125, constitution: 0.25, wisdom: 0.5, intelligence: 0.125, perLevel: 0.2 },
    // Equipment, relics and statuses add on top of each attribute's bonus.
    ar: { base: 0, strength: 1 },
    dr: { base: 0, dexterity: 1 },
    pr: { base: 0, intelligence: 1 },
    ward: { base: 1, wisdom: 1 },
    // ONE Poise: the rating and the pool were two rows for one number. Armour
    // and relics remain its external addends, exactly as HP's equipment bonus.
    poise: { base: 1, constitution: 1 },
  },
  // ---- D26: how each row READS, authored beside the row it describes -------
  //
  // WHY IT IS A SIBLING OF `rules` AND NOT A FIELD ON EACH RULE. A rule row is
  // SNAPSHOTTED into every save and every co-op handshake (createDerivedStat-
  // RuleSnapshot): putting a label and a sentence in there would write prose
  // into save bytes and make a copy-edit a save-compatibility question. So
  // presentation sits outside the snapshot and inside the same FILE — one
  // author edit adds a derived stat and how it reads, and a row here with no
  // rule (or a rule with no row) is refused BY NAME at the content door
  // (derivedStatPresentationProblems, model/derivedStats.js).
  //
  //   label       the row title. These five strings were the hard-coded LABELS
  //               map in model/statProjection.js until now — a second home for
  //               a fact the table should own. Moved, not copied.
  //   faceLabel   OPTIONAL. What the chip says when the label is a phrase. Left
  //               out, the face uses `label` (Law 0 clause 3: derivation is
  //               overridable and the override is data).
  //   order       the order every stat surface reads them in.
  //   disclosure  'face' = in the short form · 'reveal' = behind the tap.
  //   sense       ONE player sentence, no numbers in it (Law 1 clause 2).
  //
  // STAMINA IS 'reveal' ON PURPOSE and it is the honest half of this table:
  // a Stamina-cost card spends it — the sense line below names which — and an
  // idle turn recovers some (framework Mana & Stamina rule). The old panel once said
  // "No current consumer" in engine words on the first screen of the game; the
  // sense line below is the player's words, one tap down.
  presentation: {
    hp: { label: 'HP', order: 1, disclosure: 'face', sense: 'What you have left before the climb ends.' },
    mana: { label: 'Mana', order: 2, disclosure: 'face', sense: 'Spent by the cards that ask for more than effort.' },
    stamina: { label: 'Stamina / turn', faceLabel: 'Stamina', order: 3, disclosure: 'face', sense: 'Pays card and combat costs. Refills at the start of every turn.' },
    // Retained for old saves and exports; omitted from character stat surfaces.
    energy: { label: 'Stamina / turn (legacy)', faceLabel: 'Stamina', order: 4, disclosure: 'reveal', sense: 'How much you can do in one turn.' },
    draw: { label: 'Draw / turn', faceLabel: 'Draw', order: 5, disclosure: 'face', sense: 'How many cards you draw at the start of each turn.' },
    poise: { label: 'Poise', order: 6, disclosure: 'reveal', sense: 'How much blows you can take before your footing breaks.' },
    openingHand: { label: 'Opening hand', order: 7, disclosure: 'reveal', sense: 'How many cards you hold when a fight begins.' },
    handSize: { label: 'Hand size', order: 8, disclosure: 'reveal', sense: 'The most cards you can hold at once.' },
    ar: { label: 'AR', order: 9, disclosure: 'reveal', sense: 'How hard your physical attacks land.' },
    dr: { label: 'DR', order: 10, disclosure: 'reveal', sense: 'How much your guard holds.' },
    pr: { label: 'PR', order: 11, disclosure: 'reveal', sense: 'How hard your spells land.' },
    ward: { label: 'Ward', order: 12, disclosure: 'reveal', sense: 'How well you shrug off magic and disruption.' },
  },
};
