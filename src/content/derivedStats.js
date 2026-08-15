// src/content/derivedStats.js — shipping authority for derived-stat rules.
//
// The content registry validates this table, and run creation snapshots its
// resolved rules so saves, sessions, and co-op keep the same derived values.

export const derivedStatRules = {
  rulesetVersion: 3,
  defaults: {
    pointsPerTier: 5,
    rounding: 'floor',
    cap: null,
  },
  rules: {
    energy: {
      base: 1,
      sourceStat: 'dexterity',
      gainPerTier: 1,
      cap: null,
    },
    draw: {
      base: 3,
      sourceStat: 'intelligence',
      gainPerTier: 1,
      cap: null,
    },
    hp: {
      base: { strategy: 'classField', field: 'maxHp' },
      sourceStat: 'constitution',
      // D22 restores Constitution and pays HP in complete five-point tiers.
      pointsPerTier: 5,
      gainPerTier: { strategy: 'classField', field: 'hpPerConTier' },
    },
    stamina: {
      base: 0,
      sourceStat: 'constitution',
      gainPerTier: 1,
    },
    mana: {
      // Small-unit pool: WIS is the only authored Mana authority. Classes do
      // not carry a second base pool that can drift from this row.
      base: 0,
      sourceStat: 'wisdom',
      gainPerTier: 1,
      cap: null,
    },
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
  // nothing in the engine spends it yet. The old panel said so in engine words
  // ("No current consumer") on the first screen of the game. It now says so in
  // player words, one tap down, where a stat that does nothing belongs.
  presentation: {
    hp: { label: 'HP', order: 1, disclosure: 'face', sense: 'What you have left before the climb ends.' },
    mana: { label: 'Mana', order: 2, disclosure: 'face', sense: 'Spent by the cards that ask for more than effort.' },
    stamina: { label: 'Stamina', order: 3, disclosure: 'reveal', sense: 'Carried, and nothing spends it yet.' },
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
  },
};
