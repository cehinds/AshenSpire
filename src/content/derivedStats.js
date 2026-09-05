// src/content/derivedStats.js — shipping authority for derived-stat rules.
//
// The content registry validates this table, and run creation snapshots its
// resolved rules so saves, sessions, and co-op keep the same derived values.

export const derivedStatRules = {
  rulesetVersion: 4,
  defaults: {
    pointsPerTier: 5,
    rounding: 'floor',
    cap: null,
  },
  rules: {
    energy: {
      base: 2,
      sourceStat: 'dexterity',
      pointsPerTier: 10,
      gainPerTier: 1,
      cap: null,
    },
    draw: {
      base: 4,
      sourceStat: 'intelligence',
      pointsPerTier: 10,
      gainPerTier: 1,
      cap: null,
    },
    hp: {
      // Tuned rule: 30 + 2 × CON + flat bonuses. A one-point tier makes the
      // generic derived-stat engine express the per-point coefficient exactly.
      // Relic resource.flat rows fold into base; equipment max-HP mods and the
      // persisted adjustment remain the two external addends at the run door.
      base: 30,
      sourceStat: 'constitution',
<<<<<<< ours
      pointsPerTier: 1,
      gainPerTier: 2,
=======
      // `pointsPerTier: 5` WAS HERE AND IS DELETED — it restated
      // `defaults.pointsPerTier`, which is also 5, so it moved no number today
      // and was a second copy with a live consequence tomorrow (Law 1 clause 2).
      //
      // WHAT IT COSTS, MEASURED RATHER THAN ASSUMED — and my first draft of this
      // comment was WRONG, which is why it says what it says now. A row's own
      // value beats the defaults it is merged over
      // (`resolveDerivedStatRules`), so turning `defaults.pointsPerTier` IN
      // THIS FILE moves Mana, Actions, Draw and Stamina and LEAVES HP ALONE —
      // silently, and HP is the stat a tier dial is for.
      //
      // WHAT IT DOES **NOT** AFFECT, and I claimed it did until a plant said
      // otherwise: Constantine's Settings → Advanced tier dial. That arrives as
      // an override LAYER, and a layer's `defaults` is assigned over every row
      // (same function), so it reached HP with the restatement present.
      // Restoring the line leaves all 91 tests green.
      //
      // So this deletion is a SECOND-COPY fix and not a bug fix: it closes the
      // OTHER door — the one a designer uses when they edit this file directly
      // — where the two doors gave two different answers. `tests/engine.test.js`
      // 60c pins that door, so the copy can now go red instead of being
      // remembered.
      gainPerTier: 1,
      // WHAT "OTHER BONUSES" COVERS, and it is not a list anyone maintains.
      // Every HP bonus in this tree already arrives through a declared tag or
      // a declared mod field, and both are summed by machinery, not by name:
      //   · relic `resource.flat` / `resource.attributeTier` rows targeting
      //     resource 'hp' (model/relicModifiers.js — relic ids never appear in
      //     code) fold into THIS row's base and gainPerTier at snapshot time;
      //   · equipment `self.maxHp=+N` mods, selected by the equipMods field
      //     spec `apply: 'maxHp'`, scope 'run' (model/loadout.js runMods), are
      //     added outside the derived value.
      // A new HP bonus of either kind needs a row, never a code edit, so this
      // lane builds NO private tag scheme (Law 0 clause 1, Law 1 clause 7).
      //
      // WHAT HIS SENTENCE IS SILENT ON, kept as it was rather than invented:
      // `run.maxHpAdjustment` (the permanent event-curse residual — a
      // subtraction, not a bonus), the `Math.max(1, …)` floor on the pool, and
      // the mode/run/explicit override layers.
      //
      // THE COST, STATED: a CON tier is now worth 1 for every class instead of
      // 4/5/6, so the spread BETWEEN classes is now their authored bases and
      // their starting relics' tagged rows, and CON is worth the same to
      // everyone. Enemy numbers did not move.
>>>>>>> theirs
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
