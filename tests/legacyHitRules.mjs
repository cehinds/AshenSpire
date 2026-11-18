import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
// A fight created before the 2026-11-14 ruling (attacks always hit, intents always read) keeps rolling: its snapshotted rules lack
// `accuracy.hitRoll` and `perception.roll`. Tests that assert the d20 or the perception check hand their fight through here.

// Owner, 2026-11-15 (Wave 2 batch 5): the Counter-stack keys (`counter.stackSource`, `returnPerStack`, ...) are newer than every earlier fight.
// Every wrapper below removes them from the shipped defaults while it builds, and puts them back after.
const COUNTER_STACK_KEYS = ['stackSource', 'returnPerStack', 'consumePerHit', 'decayPerTurn', 'decayClock', 'advantageShare', 'stacksPerCard', 'stacksUpgradeBonus', 'stacksMax', 'stacksByCard'];
function stripCounterStacks() {
  const held = Object.fromEntries(COUNTER_STACK_KEYS.map(key => [key, fixCoreMechanics.counter[key]]));
  for (const key of COUNTER_STACK_KEYS) delete fixCoreMechanics.counter[key];
  // ...and the Counter stance still returns 25% of the HP a hit cost it (stanceBenefits.counter.hpReturnFraction), which the same ruling dropped.
  const stance = fixCoreMechanics.stanceBenefits?.counter;
  if (stance) stance.hpReturnFraction = 0.25;
  return () => { Object.assign(fixCoreMechanics.counter, held); if (stance) delete stance.hpReturnFraction; };
}
// Owner, 2026-11-17 (theme B, status and stance rules): these keys are newer than every fight the wrappers below rebuild. Each owning object is
// snapshotted whole before the keys go, and rebuilt from that snapshot after, so the key order of the shared defaults (part of a fight's state hash) never moves.
const THEME_B_KEYS = [['counter', 'armedWhileStacks'], ['counter', 'enemyBadgeStacks'], ['stanceBenefits', 'defend', 'poiseFloorWhileBlock'],
  ['stanceBenefits', 'defend', 'poiseFloorWardMagic'], ['stanceBenefits', 'prepared', 'meleeDamageTakenMultiplier'], ['stanceBenefits', 'neutral', 'damageTakenMultiplier']];
function stripThemeB() {
  const saved = new Map();
  for (const path of THEME_B_KEYS) {
    const owner = path.slice(0, -1).reduce((row, key) => row?.[key], fixCoreMechanics), key = path.at(-1);
    if (!owner || !Object.hasOwn(owner, key)) continue;
    if (!saved.has(owner)) saved.set(owner, Object.entries(owner));
    delete owner[key];
  }
  return () => {
    for (const [owner, rows] of saved) {
      for (const key of Object.keys(owner)) delete owner[key];
      for (const [key, value] of rows) owner[key] = value;
    }
  };
}
// Owner, 2026-11-18 (section 20 and 21): Ward's decay and break keys, the Pierce Block-per-stack rule and Force's Poise share are newer than every fight these wrappers
// rebuild. A fight made before them keeps Pierce's 20% Block bypass, Force's x1.5 Poise key, and no Ward decay or break keys. Owners are rebuilt whole on the way back so key order never moves.
function stripSection20() {
  const ward = fixCoreMechanics.ward, wardRows = Object.entries(ward), pierce = fixCoreMechanics.pierce, force = fixCoreMechanics.elements?.force;
  const poise = fixCoreMechanics.poise, poiseRows = Object.entries(poise);
  delete ward.decayPerTurn; delete ward.breaksAtZeroPoise; delete poise.breakStatusStacks;
  fixCoreMechanics.pierce = { blockBypassFraction: 0.2 };
  if (force) fixCoreMechanics.elements.force = { poiseMultiplier: 1.5 };
  return () => {
    for (const key of Object.keys(ward)) delete ward[key];
    for (const [key, value] of wardRows) ward[key] = value;
    for (const key of Object.keys(poise)) delete poise[key];
    for (const [key, value] of poiseRows) poise[key] = value;
    fixCoreMechanics.pierce = pierce;
    if (force) fixCoreMechanics.elements.force = force;
  };
}
/** Theme B goes first and comes back last, so its whole-object snapshot also puts back the Counter-stack keys in their original places. */
function guarded(build) {
  const restoreSection20 = stripSection20(), restoreThemeB = stripThemeB(), restore = stripCounterStacks();
  try { return build(); } finally { restore(); restoreThemeB(); restoreSection20(); }
}
/** Runs `build` while the shipped default rules lack only the theme B keys (2026-11-17): a fight created before the status and stance rules. */
export function withoutThemeBRules(build) { const restoreSection20 = stripSection20(), restore = stripThemeB(); try { return build(); } finally { restore(); restoreSection20(); } }
/** The rules of a fight saved before the 2026-11-14 ruling: the perception key is absent, so intents roll. */
export function legacyPerceptionRules(rules = fixCoreMechanics) {
  const out = structuredClone(rules);
  delete out.perception.roll;
  return out;
}
export function legacyHitRoll(combat) {
  const rules = structuredClone(combat.fixCoreRules || combat.gameProfile?.fixCoreRules);
  delete rules.accuracy.hitRoll; delete rules.accuracy.evadeStacksPerCard;
  combat.fixCoreRules = rules;
  return combat;
}
export function legacyPerceptionRoll(combat) {
  const rules = structuredClone(combat.fixCoreRules || combat.gameProfile?.fixCoreRules);
  delete rules.perception.roll;
  combat.fixCoreRules = rules;
  return combat;
}
export const legacyRolls = combat => legacyPerceptionRoll(legacyHitRoll(combat));
/** The same, for a bare rules object: no hitRoll, no evadeStacksPerCard, no perception.roll. Returns a copy. */
export function legacyRules(rules) {
  const out = structuredClone(rules);
  delete out.accuracy.hitRoll; delete out.accuracy.evadeStacksPerCard; delete out.perception.roll;
  return out;
}

/**
 * Removes `statusCaps` (owner 2026-11-15, no max stack counts: newer than every earlier fight) and returns the function that puts it back at its
 * original position. The key order of the shared defaults is part of a fight's state hash, so it must not move.
 */
function dropStatusCaps() {
  const held = fixCoreMechanics.statusCaps, at = Object.keys(fixCoreMechanics).indexOf('statusCaps');
  delete fixCoreMechanics.statusCaps;
  return () => {
    const rows = Object.entries(fixCoreMechanics);
    rows.splice(at, 0, ['statusCaps', held]);
    for (const [key] of rows) delete fixCoreMechanics[key];
    for (const [key, value] of rows) fixCoreMechanics[key] = value;
  };
}

/**
 * Runs `build` while the shipped default rules read as a fight saved before the 2026-11-14 ruling (no hitRoll, evadeStacksPerCard or
 * perception.roll). A fight snapshots its rules when it is created, so build the fight inside and play it outside. Restores the keys after.
 */
export function withLegacyDefaults(build) { return guarded(() => withLegacyDefaultsInner(build)); }
function withLegacyDefaultsInner(build) {
  const held = { wardRouting: fixCoreMechanics.ward.routing, spellCosts: fixCoreMechanics.spellCosts, elementFlux: fixCoreMechanics.elementFlux, stanceBenefits: fixCoreMechanics.stanceBenefits, elements: fixCoreMechanics.elements, ratings: fixCoreMechanics.ratings, hitRoll: fixCoreMechanics.accuracy.hitRoll, evadeStacksPerCard: fixCoreMechanics.accuracy.evadeStacksPerCard, roll: fixCoreMechanics.perception.roll };
  const restoreStatusCaps = dropStatusCaps(); // W25-NC: the no-max-stack rule (2026-11-15) is newer than every earlier fight
  delete fixCoreMechanics.ward.routing; // W25-W: Ward's block-first routing is newer than every earlier fight
  delete fixCoreMechanics.accuracy.hitRoll; delete fixCoreMechanics.accuracy.evadeStacksPerCard; delete fixCoreMechanics.perception.roll; delete fixCoreMechanics.stanceBenefits; delete fixCoreMechanics.elements; delete fixCoreMechanics.ratings; delete fixCoreMechanics.spellCosts; delete fixCoreMechanics.elementFlux;
  try { return build(); } finally {
    fixCoreMechanics.ward.routing = held.wardRouting;
    fixCoreMechanics.spellCosts = held.spellCosts; fixCoreMechanics.elementFlux = held.elementFlux; // W25-F: spell costs and elemental flux are absent from an earlier fight too
    fixCoreMechanics.elements = held.elements; fixCoreMechanics.ratings = held.ratings; // the element identities and PR from max(INT, WIS) (batch 2) are absent from an earlier fight too
    fixCoreMechanics.stanceBenefits = held.stanceBenefits; // the 2026-11-14 stance benefits (Wave 2.5) are also absent from a fight saved earlier
    fixCoreMechanics.accuracy.hitRoll = held.hitRoll; fixCoreMechanics.accuracy.evadeStacksPerCard = held.evadeStacksPerCard; fixCoreMechanics.perception.roll = held.roll;
    restoreStatusCaps();
  }
}

/** Runs `build` while the shipped default rules lack only `stanceBenefits`: a fight created between the 2026-11-14 exact-hits ruling and the stance benefits (Wave 2.5). */
export function withoutStanceBenefitDefaults(build) { return guarded(() => withoutStanceBenefitDefaultsInner(build)); }
function withoutStanceBenefitDefaultsInner(build) {
  const held = fixCoreMechanics.stanceBenefits;
  delete fixCoreMechanics.stanceBenefits;
  try { return build(); } finally { fixCoreMechanics.stanceBenefits = held; }
}

/**
 * Runs `build` while the shipped default rules lack every Wave 2.5 key (`stanceBenefits`, `elements`, `ratings`): a fight created before batch 2. Only these
 * keys are removed, so a shipped-rules fight played this way must reproduce the digests taken before batch 2.
 */
export function withoutBatch2Rules(build) { return guarded(() => withoutBatch2RulesInner(build)); }
function withoutBatch2RulesInner(build) {
  const held = { spellCosts: fixCoreMechanics.spellCosts, elementFlux: fixCoreMechanics.elementFlux, stanceBenefits: fixCoreMechanics.stanceBenefits, elements: fixCoreMechanics.elements, ratings: fixCoreMechanics.ratings };
  const restoreStatusCaps = dropStatusCaps(); // W25-NC: newer than batch 2
  const wardRouting = fixCoreMechanics.ward.routing; delete fixCoreMechanics.ward.routing; // W25-W: newer than batch 2
  delete fixCoreMechanics.stanceBenefits; delete fixCoreMechanics.elements; delete fixCoreMechanics.ratings; delete fixCoreMechanics.spellCosts; delete fixCoreMechanics.elementFlux; // W25-F keys are newer than batch 2
  try { return build(); } finally { Object.assign(fixCoreMechanics, held); fixCoreMechanics.ward.routing = wardRouting; restoreStatusCaps(); }
}

/** Runs `build` while the shipped default rules lack only the W25-F keys (`spellCosts`, `elementFlux`): a fight created before the spell cost and flux ruling. */
export function withoutSpellCostRules(build) { return guarded(() => withoutSpellCostRulesInner(build)); }
function withoutSpellCostRulesInner(build) {
  const held = { spellCosts: fixCoreMechanics.spellCosts, elementFlux: fixCoreMechanics.elementFlux }, wardRouting = fixCoreMechanics.ward.routing;
  const restoreStatusCaps = dropStatusCaps(); // W25-NC: newer than the spell cost ruling
  delete fixCoreMechanics.spellCosts; delete fixCoreMechanics.elementFlux; delete fixCoreMechanics.ward.routing; // W25-W: Ward routing is newer than the spell cost ruling's base
  try { return build(); } finally { Object.assign(fixCoreMechanics, held); fixCoreMechanics.ward.routing = wardRouting; restoreStatusCaps(); }
}

/** Runs `build` while the shipped default rules lack only `statusCaps` (owner 2026-11-15, no max stack counts): a fight created before it keeps every old hold cap. */
export function withoutStatusCapsRule(build) {
  const restore = dropStatusCaps();
  try { return build(); } finally { restore(); }
}

/** Runs `build` while the shipped default rules lack the Counter-stack keys (batch 5, 2026-11-15): a fight or card face from before the ruling. */
export function withoutCounterStackDefaults(build) { return guarded(build); }

/** Runs `build` while the shipped Counter stack table lacks Quickstep (W25-EvadeCards, 2026-11-15): a fight whose rules were snapshotted before Quickstep joined `counter.stacksByCard`. */
export function withoutQuickstepCounterStacks(build) {
  const table = fixCoreMechanics.counter.stacksByCard, held = table.quickstep;
  delete table.quickstep;
  try { return withoutThemeBRules(build); } finally { table.quickstep = held; } // theme B (2026-11-17) is newer than the Evade cards too
}
