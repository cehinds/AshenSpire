// src/content/attributes.js — authoritative Phase 1 creation-stat data.
//
// These values are inert run identity. Combat, checks, resource pools and
// derived formulas do not read them in Phase 1. `strength` and `dexterity`
// deliberately share display words with existing transient combat statuses;
// they remain separate namespaces until a later feature defines a bridge.

// Constitution is the authored HP and Stamina source. Vigour is the retired
// three-day save spelling; the load door migrates it through retiredNames.js.
//
// `sense` and `disclosure` are the D26 short form (model/disclosure.js).
//
//   sense       ONE player sentence, and it carries NO NUMBER. Every number in
//               a reveal is derived from the table that owns it — a figure
//               typed into prose is a copy nothing syncs (Law 1 clause 2,
//               which calls that a defect "even in tooltip prose"). So this
//               says what the attribute IS; what it FEEDS and what it UNLOCKS
//               are read off derivedStatRules and equipmentRequirements at
//               render time and can never go stale.
//   disclosure  'face' (in the short form) or 'reveal' (behind the tap). All
//               five are face-tier because he named them: "just the starting
//               stats". This is data, not a decision the screen makes.
export const attributes = [
  { id: 'strength', label: 'Strength', shortLabel: 'STR', order: 1, disclosure: 'face', sense: 'Raw force. Heavy armaments ask for it before they will let you hold them.' },
  { id: 'dexterity', label: 'Dexterity', shortLabel: 'DEX', order: 2, disclosure: 'face', sense: 'Speed of hand — the quick armaments answer to it.' },
  { id: 'constitution', label: 'Constitution', shortLabel: 'CON', order: 3, disclosure: 'face', sense: 'What your body takes before the climb ends.' },
  { id: 'wisdom', label: 'Wisdom', shortLabel: 'WIS', order: 4, disclosure: 'face', sense: 'What you hold in mind, and can pour back out.' },
  { id: 'intelligence', label: 'Intelligence', shortLabel: 'INT', order: 5, disclosure: 'face', sense: 'How much of the Spire you read at once.' },
];

export const creationModes = [
  // ---- THE LEAN SCALE (owner, 2026-09-20) ---------------------------------
  //
  // His words: "I'd like the default stats to be low, with everyone having a
  // total pool of points starting off. the default stat for each stat is 1 and
  // assign allows a user to assign 3 points."
  //
  // So the mode IS those two sentences and nothing more:
  //   baseline 1      "the default stat for each stat is 1"
  //   bonusPool 3     "assign allows a user to assign 3 points"
  //   minimum 1       a stat cannot be worth less than existing
  //   maximum 4       1 + 3 — pouring the whole pool into one attribute is the
  //                   ceiling, so no cell can be typed that the pool cannot pay
  //   total 8         5 x 1 + 3, which is what every class carries at creation
  //
  // A NEW MODE, NOT AN EDIT TO tuned2 — the same reason tuned2 was a new mode
  // and not an edit to tuned. Every in-flight save is validated at the load
  // door against the total of the mode it was created under, and save.js
  // ARCHIVES what fails there. tuned2 stays in this table, and leaves creation
  // through characterCreation.visibleModeIds.
  {
    id: 'lean',
    label: 'Lean',
    baseline: 1,
    bonusPool: 3,
    minimum: 1,
    maximum: 4,
    // 'allow' is the reclaim clause: a point placed can be taken back off a
    // stat down to `minimum`. At baseline 1 there is nothing below to reclaim
    // to — it matters the moment the baseline is raised in Settings, which is
    // now a dial (gameConfig.startingStats.lean.baseline).
    belowBaseline: 'allow',
    redistribution: 'fixedTotal',
    // NO CONVERSION SCALE, AND THE POOLS ARE SMALLER FOR IT (owner,
    // 2026-09-21: "all calculations should be sum(floor(statmult*stat)) +
    // equipment bonus"). This mode shipped `statConversionScale: 1/5` so the
    // ruleset-5 coefficients — Mana IS Wisdom, HP is 20 + 4 × CON, every one
    // read off the tuned2 span 3-12 — would land on tuned2's own pools when
    // the span became 1-4. The cost was that no formula read the attribute on
    // the character sheet: every one of them divided by the fifth first, and
    // the settings rows the player tunes described arithmetic the game did not
    // do. The divisor is gone from the codebase; what a coefficient says is
    // what it does. THE POOLS THIS MODE OPENS ON ARE THEREFORE A FIFTH OF WHAT
    // #1238 SHIPPED — a stock Reaver climbs on 28 HP, not 70 — and moving them
    // is a retune of `derivedStatRules` and the rating weights, in the open,
    // not a scale hidden behind them.
    // THE SAME AUTHORITY tuned2 CARRIES, RESTATED FOR THIS SPAN. Strike and
    // Defend scale off an attribute rather than off the weapon alone, and a
    // profile is read as `baseValue + floor(stat / pointsPerTier) × gainPerTier`.
    //
    // Carried over unchanged (gain 1 per point), the whole of Strike would live
    // between 4 and 7, because four points is the whole span — the basic attack
    // would stop answering to the attribute it scales off. So the GAIN carries
    // the rebase here, in the open and on the row that states it:
    // two per lean point, opening at 3.
    //
    //   STR 1 → 5    STR 2 → 7    STR 3 → 9    STR 4 → 11
    //
    // which lands on tuned2's own numbers where it matters: the Reaver's Strike
    // is the 9 it was, its Defend the 5 the tuned2 comment below fought for
    // (at -3 a Reaver's guard fell to 3 and the simulator read it — the tier-1
    // boss band collapsed), the Herald's sceptre the 9 it was, and the ceiling
    // 11 is tuned2's ceiling. Dropping this block would silently take attribute
    // scaling off every basic attack.
    equipmentProfiles: {
      unarmedAttack: { baseValue: 3, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      bladeAttack: { baseValue: 3, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      daggerPierceAttack: { baseValue: 3, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      bowPierceAttack: { baseValue: 3, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      staffMagicAttack: { baseValue: 3, scalingStat: 'wisdom', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      sceptreArcaneAttack: { baseValue: 3, scalingStat: 'wisdom', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      unarmedGuard: { baseValue: 3, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      weaponGuard: { baseValue: 3, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      shieldGuard: { baseValue: 3, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      staffGuard: { baseValue: 3, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      sceptreGuard: { baseValue: 3, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 2 },
      // THE ONE PROFILE tuned2 LEFT ALONE, AND WHY LEAN CANNOT. An unrestated
      // profile keeps its authored five-point tier, which on a 1-4 span means
      // floor(stat / 5) is ZERO for every character alive: the shield's own
      // attack would stop answering to Strength entirely and sit flat at its
      // base. On tuned2's span the same row still moved (2 at STR 3, 4 at STR
      // 12), so leaving it out would be a silent loss rather than a choice.
      // A two-point tier is the closest whole-number restatement of that
      // slower curve: 3 at the baseline, 5 with the whole pool in Strength.
      shieldAttack: { baseValue: 3, scalingStat: 'strength', pointsPerTier: 2, rounding: 'floor', gainPerTier: 1 },
    },
  },
  // THE REBASED SCALE (plan phase 9). Ten was never a floor a player chose —
  // it was the middle of a d20 habit this game does not otherwise keep. Five
  // is the baseline, ten points are yours to place, and the span 3–12 is wide
  // enough that a point is worth spending: under ruleset 5 a point of Wisdom
  // IS a point of Mana and a point of Constitution IS a point of Stamina, so
  // the scale and the pools finally speak the same units.
  //
  // THE OLDER MODES BELOW ARE KEPT AND HIDDEN. Every in-flight save was
  // validated against its own mode's fixed total at the load door, and
  // save.js ARCHIVES what fails there, so deleting a mode would refuse every
  // run created under it. They stay in the table and out of creation, which
  // characterCreation.visibleModeIds decides.
  {
    id: 'tuned2',
    label: 'Tuned',
    baseline: 5,
    bonusPool: 10,
    minimum: 3,
    maximum: 12,
    belowBaseline: 'allow',
    redistribution: 'fixedTotal',
    // THE SAME AUTHORITY THE OLD TUNED MODE CARRIED, REBASED. Strike and
    // Defend scale off an attribute rather than off the weapon alone, and the
    // baseline hand must still land where it always did. DEFEND IS WHY THE
    // NUMBER IS -1: it scales off Dexterity, the stat the rebase compressed
    // hardest, and at -3 a Reaver's guard fell from 5 to 3 and the simulator
    // read it — the tier-1 boss band collapsed. At -1 the baseline guard is
    // the 5 it always was.
    // Dropping this block would have quietly taken
    // attribute scaling off every basic attack the moment the baseline moved.
    equipmentProfiles: {
      unarmedAttack: { baseValue: -1, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      bladeAttack: { baseValue: -1, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      daggerPierceAttack: { baseValue: -1, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      bowPierceAttack: { baseValue: -1, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      staffMagicAttack: { baseValue: -1, scalingStat: 'wisdom', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      sceptreArcaneAttack: { baseValue: -1, scalingStat: 'wisdom', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      unarmedGuard: { baseValue: -1, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      weaponGuard: { baseValue: -1, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      shieldGuard: { baseValue: -1, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      staffGuard: { baseValue: -1, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      sceptreGuard: { baseValue: -1, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
    },
  },
  {
    id: 'tuned',
    label: 'Tuned',
    baseline: 10,
    bonusPool: 3,
    minimum: 8,
    maximum: 15,
    belowBaseline: 'allow',
    redistribution: 'fixedTotal',
    equipmentProfiles: {
      unarmedAttack: { baseValue: -6, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      bladeAttack: { baseValue: -6, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      daggerPierceAttack: { baseValue: -6, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      bowPierceAttack: { baseValue: -6, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      staffMagicAttack: { baseValue: -6, scalingStat: 'wisdom', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      sceptreArcaneAttack: { baseValue: -6, scalingStat: 'wisdom', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      unarmedGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      weaponGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      shieldGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      staffGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      sceptreGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    baseline: 10,
    bonusPool: 5,
    minimum: 10,
    maximum: 15,
    belowBaseline: 'forbid',
    redistribution: 'fixedTotal',
  },
  // E5 (#250) — Constantine's own numbers, verbatim from the card: "10 points,
  // configurable; points come back out when a stat is dropped; floor 8, ceiling
  // 15 at creation, both customizable; the floor is the reclaim limit; 15 caps
  // CREATION, not the character."
  //   bonusPool 10        the ten points ("configurable" = it is content, here)
  //   minimum 8 + allow   the floor IS the reclaim limit: a stat may be dropped
  //                       below its baseline down to 8, and fixedTotal hands
  //                       the difference back to the pool by construction
  //   maximum 15          caps creation only — allocationProblems already
  //                       raises the ceiling by levelled points, which is his
  //                       "not the character" clause, shipped before this mode
  // A SECOND MODE, NOT AN EDIT TO `standard`: standard's fixedTotal of 55 is
  // what every existing save is validated against at the load door, and
  // save.js ARCHIVES what fails there. Changing standard's pool would refuse
  // every in-flight run the first boot after update.
  {
    id: 'pointbuy',
    label: 'Assign points',
    baseline: 10,
    bonusPool: 10,
    minimum: 8,
    maximum: 15,
    belowBaseline: 'allow',
    redistribution: 'fixedTotal',
  },
];

// Complete mode × class × attribute product. No Origins are enabled in Phase 1.
// The pointbuy presets are the EDITOR'S OPENING POSITION and the load-door
// refill value — a legal allocation (sum 60, cells 8..15), thematically the
// standard preset with the five extra points laid along each class's grain.
// The player reshapes them; nothing here is a recommendation.
export const attributeRules = {
  defaultMode: 'lean',
  presets: {
    // ---- LEAN ------------------------------------------------------------
    // Baseline 1 in every cell, plus the three assignable points laid along
    // each class's grain. Every row therefore sums to 8 and sits inside 1–4,
    // and every row can hold the kit its class starts in after the equipment
    // table was restated for this span (content/source/equipmentRequirements.csv):
    // the Reaver's Iron Vanguard sword asks 2 Strength, the Starseer's Ash
    // Focus staff 3 Intelligence, the Rogue's knife 2 Dexterity.
    // attributeContentProblems and validate.js refuse any row that fails either.
    lean: {
      reaver: { strength: 3, dexterity: 1, constitution: 2, wisdom: 1, intelligence: 1 },
      starseer: { strength: 1, dexterity: 1, constitution: 1, wisdom: 2, intelligence: 3 },
      herald: { strength: 1, dexterity: 1, constitution: 2, wisdom: 3, intelligence: 1 },
      rogue: { strength: 1, dexterity: 3, constitution: 2, wisdom: 1, intelligence: 1 },
    },
    // Each row sums to the mode's total (5 × 5 + 10 = 35) and sits inside
    // 3–12; attributeContentProblems refuses any that does not, by name.
    tuned2: {
      reaver: { strength: 10, dexterity: 6, constitution: 9, wisdom: 3, intelligence: 7 },
      starseer: { strength: 3, dexterity: 6, constitution: 7, wisdom: 11, intelligence: 8 },
      herald: { strength: 6, dexterity: 5, constitution: 7, wisdom: 10, intelligence: 7 },
      rogue: { strength: 7, dexterity: 11, constitution: 7, wisdom: 3, intelligence: 7 },
    },
    tuned: {
      reaver: { strength: 13, dexterity: 11, constitution: 11, wisdom: 8, intelligence: 10 },
      starseer: { strength: 11, dexterity: 11, constitution: 8, wisdom: 13, intelligence: 10 },
      herald: { strength: 12, dexterity: 11, constitution: 8, wisdom: 12, intelligence: 10 },
      rogue: { strength: 11, dexterity: 13, constitution: 10, wisdom: 9, intelligence: 10 },
    },
    standard: {
      reaver: { strength: 13, dexterity: 10, constitution: 12, wisdom: 10, intelligence: 10 },
      starseer: { strength: 10, dexterity: 11, constitution: 10, wisdom: 10, intelligence: 14 },
      herald: { strength: 10, dexterity: 10, constitution: 12, wisdom: 13, intelligence: 10 },
      rogue: { strength: 10, dexterity: 15, constitution: 10, wisdom: 10, intelligence: 10 },
    },
    pointbuy: {
      reaver: { strength: 14, dexterity: 10, constitution: 14, wisdom: 11, intelligence: 11 },
      starseer: { strength: 10, dexterity: 12, constitution: 11, wisdom: 12, intelligence: 15 },
      herald: { strength: 10, dexterity: 10, constitution: 13, wisdom: 15, intelligence: 12 },
      rogue: { strength: 10, dexterity: 15, constitution: 12, wisdom: 10, intelligence: 13 },
    },
  },
};
