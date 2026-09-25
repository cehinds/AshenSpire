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
    energy: { base: 3, strength: 0.1, dexterity: 0.2, wisdom: 0.01, intelligence: 0.01, perLevel: 0.1 },
    // The hand. Each was a single-attribute rule on INT; the weight below
    // lands on the old count at INT 3, 5, 8 and 12.
    // The shared row is the fallback for a character with no class row (a
    // headless fixture); every shipped class opens on its own row (byClass).
    openingHand: { base: 4, intelligence: 0.45, min: 4, max: 6 },
    draw: { base: 2, intelligence: 0.1, min: 2, max: 10 },
    handSize: { base: 7, intelligence: 0.19, min: 1, max: 30 },
    hp: { base: 30, strength: 0.35, constitution: 4, wisdom: 0.1, perLevel: 2 },
    // Budget 1 each, the owner's own sums.
    stamina: { base: 1, strength: 0.25, dexterity: 0.25, constitution: 0.5, perLevel: 0.2 },
    mana: { base: 1, strength: 0.125, constitution: 0.25, wisdom: 0.5, intelligence: 0.125, perLevel: 0.2 },
    // The combat ratings, budget 2. Equipment, relics and statuses add on top.
    ar: { base: 0, strength: 0.75, dexterity: 0.5, constitution: 0.25, wisdom: 0.25, intelligence: 0.25 },
    dr: { base: 0, strength: 0.5, dexterity: 0.75, constitution: 0.25, wisdom: 0.35, intelligence: 0.15 },
    pr: { base: 0, dexterity: 0.25, constitution: 0.5, wisdom: 0.5, intelligence: 0.75 },
    ward: { base: 1, dexterity: 0.2, constitution: 0.3, wisdom: 1, intelligence: 0.5 },
    // ONE Poise: the rating and the pool were two rows for one number. Armour
    // and relics remain its external addends, exactly as HP's equipment bonus.
    poise: { base: 1, strength: 0.5, constitution: 1, wisdom: 0.3, intelligence: 0.2 },
  },
  // ---- A CLASS'S OWN ROWS --------------------------------------------------
  //
  // THE OPENING HAND IS PER CLASS (owner, 2026-09-24: "start with 4-6 cards
  // depending on the base (3-5)", "Class base 3–5, +1 from stats", #1294):
  // each class opens on its own base and its own lead attribute, 4 to 6 cards.
  // A class's row is a FULL row in the one shape, not a patch, and a run of
  // that class is born with it in its snapshot in place of the shared row.
  // The 0.45 weight lands on #1294's clamp(base + floor(max(0, primary − 1) ÷
  // 2), 4, 6) at every attribute value: the Standard presets (primary 3) open
  // 4/5/5/6, all 1s open 4/4/4/5.
  byClass: {
    reaver: { openingHand: { base: 3, strength: 0.45, min: 4, max: 6 } },
    rogue: { openingHand: { base: 4, dexterity: 0.45, min: 4, max: 6 } },
    herald: { openingHand: { base: 4, wisdom: 0.45, min: 4, max: 6 } },
    starseer: { openingHand: { base: 5, intelligence: 0.45, min: 4, max: 6 } },
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
    stamina: { label: 'Stamina', order: 3, disclosure: 'reveal', sense: 'Spent by cards that ask for it — the dodge roll among them. An idle turn recovers some.' },
    // ACTIONS, NOT ENERGY — his rename, D17 message 3: "energy (which we
    // should call actions going forward)", confirmed by D21 as needing no
    // re-ask. The ENGINE ids are untouched here (`energyMax`, `balance.energy`,
    // the orb) — that rename is a sequenced act across five branches and is not
    // this one. What changes is the WORD A PLAYER READS, and since D26 that
    // word has exactly one home: this row — the frame adopts this row's label
    // rather than inventing a second one.
    // NO SURFACE CENSUS ON THIS LINE. One lived here, listing which screens
    // said which word. It was wrong the day it was written, nothing went red
    // when it drifted, and it reached him. A spread worth watching gets a
    // check that can go red, never a comment kept in sync by hand.
    energy: { label: 'Actions / turn', faceLabel: 'Actions', order: 4, disclosure: 'face', sense: 'How much you can do in one turn.' },
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
