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
  // RULESET 7 — A NEW CHARACTER DRAWS FIVE (plan A4, owner ruling 2026-09-24).
  // Solo combat now draws this row every turn and discards what is unplayed
  // (content/handRules.js), so the row is the hand. At creation INT is 1–4 and
  // the old base of 3 dealt a three-card hand; the base is 5, the weight and the
  // level term are unchanged. The format is ruleset 6's; the version moved so a
  // run born under 6 keeps its snapshot, and its retain-and-fill hand with it.
  rulesetVersion: 7,
  defaults: {
    perLevel: 0,
    cap: null,
  },
  rules: {
    // One more action every five points of Dexterity.
    energy: { base: 3, dexterity: 0.2 },
    // Five cards, one more every five points of Intelligence, and one at
    // level 11 and every ten after.
    draw: { base: 5, intelligence: 0.2, perLevel: 0.1 },
    // 30 + 4 x CON, and a point per level.
    hp: { base: 30, constitution: 4, perLevel: 1 },
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
