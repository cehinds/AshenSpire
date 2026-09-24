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
  //
  // RULESET 7 — THE LEAN ATTRIBUTE RETUNE (plan A3, owner's pre-approved
  // ruling, 2026-09-24). Same format as 6; two rows move, measured with
  // tools/runsim.mjs (the live combat door, plan A1) and its --deep
  // per-encounter damage table and --levelup=<attribute> fleets:
  //
  //   energy  dexterity 0.2 -> 0.25. The first extra Action sat at DEX 5, one
  //           past the creation ceiling of 4, so no new character could hold
  //           it and every level-up raced to it. At 0.25 it is DEX 4 (a
  //           creation-reachable choice) and the next is DEX 8, inside a
  //           climb's ~9-11 levels: two steps, neither out of reach.
  //   hp      base 30 / CON 4 / perLevel 1 -> base 36 / CON 2 / perLevel 2.5.
  //           Constitution paid HP, Stamina and Poise at once and was the
  //           dominant level-up pick (120 runs a class, every earned point to
  //           one attribute; wins for CON / DEX / STR / WIS — Reaver
  //           61/20/8/8, Rogue 66/58/9/6, Herald 69/38/41/39). Half of CON's
  //           HP moves onto the level, so a point anywhere still grows the
  //           pool (after: Reaver 68/54/19/16, Rogue 68/88/35/26, Herald
  //           67/56/49/52; the Rogue's own Dexterity is now its best pick,
  //           and the Reaver's Strength is weak because of its rating weight,
  //           not this row). Starting pools: Reaver 48 -> 50 (with the
  //           Medallion's ten), Rogue and Herald 38 -> 40, Starseer 34 -> 38.
  //           The per-encounter damage table says the opening pool is not
  //           where runs end: act-1 normals cost 3-9 HP a fight and act 1
  //           ends 0-2 runs in 60 for the three stable classes, while the
  //           act-2 boss (70-90 HP a fight against 60-70 HP entering) ends
  //           most — so the growth the level pays, not #1238's
  //           70-HP opening, is what was retuned. Shipped presets, 120
  //           runs a class, CON picks: Reaver 61 -> 68, Rogue 66 -> 68,
  //           Herald 69 -> 67 (with plan A3's evasion-roll retune in
  //           content/framework/mechanics.json).
  //
  // Draw is left to plan A4 (hand rules, ruleset 8 below); Stamina, Mana and
  // Poise read right on the lean scale and are unchanged. Ruleset 6 and earlier are restored
  // exactly as they were saved.
  //
  // RULESET 8 — A NEW CHARACTER DRAWS FIVE (plan A4, owner ruling 2026-09-24).
  // Solo combat now draws this row every turn and discards what is unplayed
  // (content/handRules.js), so the row is the hand. At creation INT is 1–4 and
  // the old base of 3 dealt a three-card hand; the base is 5, the weight and the
  // level term are unchanged. The format is ruleset 6's and every other row is
  // ruleset 7's; the version moved so a run born under 7 or earlier keeps its
  // snapshot, and its retain-and-fill hand with it (content/handRules.js).
  rulesetVersion: 8,
  defaults: {
    perLevel: 0,
    cap: null,
  },
  rules: {
    // One more action every four points of Dexterity (ruleset 7: was five).
    energy: { base: 3, dexterity: 0.25 },
    // Five cards (ruleset 8: was three), one more every five points of
    // Intelligence, and one at level 11 and every ten after.
    draw: { base: 5, intelligence: 0.2, perLevel: 0.1 },
    // 36 + 2 x CON, and two and a half per level (ruleset 7: was 30 + 4 x
    // CON and one per level).
    hp: { base: 36, constitution: 2, perLevel: 2.5 },
    // The body's own reserve: the pool IS Constitution.
    stamina: { base: 1, constitution: 1, perLevel: 0.2 },
    // WIS is the only authored Mana authority — classes carry no second base
    // pool that can drift from this row.
    mana: { base: 1, wisdom: 1, perLevel: 0.2 },
    // The Poise vessel. Armour and relics remain the two external addends,
    // exactly as HP's equipment bonus is.
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
    draw: { label: 'Draw / turn and opening hand', faceLabel: 'Draw', order: 5, disclosure: 'face', sense: 'How many cards you hold to choose from.' },
    poise: { label: 'Poise', order: 6, disclosure: 'reveal', sense: 'How much blows you can take before your footing breaks.' },
  },
};
