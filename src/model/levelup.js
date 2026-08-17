// src/model/levelup.js — LEVELLING AT A SHRINE. Constantine, D10 wave 1:
//
//   "also at graces, players should have the option to level up their character
//    (per run) by trading cinders to level up. at level up they may increase a
//    stat by 1 point."
//
// and again in E13, with the acceptance test attached:
//
//   "rest sites become where you level, cinders spent past a threshold — 1 stat
//    point per level, 10–20 level-ups a run, scalable."
//
// WHAT LEVELLING TURNED OUT TO BE, because there was no level system in this
// tree to add to and the shape had to be derived rather than invented. There is
// no XP, no character level, no class progression, and nothing anywhere named
// `level`. What there IS, already, is the exact machinery a level-up needs:
//
//   `run.attributes`      five integers, the only growth surface the run has.
//   `content/derivedStats.js`  what a point is WORTH — CON → HP and Stamina,
//                         WIS → Mana, DEX → Actions, INT → Draw. E6 shipped
//                         this tonight.
//   `run.cinders`         the currency, already spent this way at the shop.
//
// So a level is not a new system. **A level is one attribute point, bought with
// cinders, at a shrine** — and every consequence of it is already derived by
// tables somebody else owns. This file adds a PRICE and a PURCHASE and nothing
// else: it authors no stat, no curve of HP, and no idea of what a point does.
//
// THE ONE THING THAT IS NOT OBVIOUS, and it is the whole reason this is a model
// file rather than four lines in the shrine screen. Three separate mechanisms
// have to move together or the run breaks, and two of them break LATER:
//
//   1. the attribute goes up — the visible half;
//   2. the derived pools have to be re-derived from the run's OWN snapshot, or
//      the next load throws `Persisted maxMana N contradicts derived-stat
//      snapshot value N+1` (state.js:initializeRunDerivedStats);
//   3. `run.levelUps` has to record the purchase, or the creation-rule check at
//      the load door sees a 56-point allocation where the mode says 55 and the
//      save is ARCHIVED (attributes.js:grantedAttributePoints, save.js).
//
// A level-up that does only (1) looks perfect on screen and destroys the run on
// the next load. That is why this is one function and not a screen's business.

import { deriveStat } from './derivedStats.js';
import { orderedAttributes } from './attributes.js';
import { reconcileRunLoadoutHp } from './loadout.js';
import { note } from './healLedger.js';

/** The authored table, or the shape of one, so a bundle without it fails soft
 *  in tools rather than throwing on a missing key. Bad data is caught at the
 *  content door, not here. */
function table(registries) {
  return (registries && registries.balance && registries.balance.levelUp) || {};
}

/**
 * levelCost(registries, levelsTaken) → the price of the NEXT level.
 *
 * "cinders spent past a threshold … scalable" — a linear ramp, `firstCost +
 * costStep × levelsTaken`, so n levels cost `n × firstCost + costStep × n(n−1)/2`
 * in total. Both numbers are data (content/balance.js `levelUp`), which is what
 * makes his "scalable" a knob rather than an edit.
 */
export function levelCost(registries, levelsTaken) {
  const t = table(registries);
  const first = Number.isFinite(t.firstCost) ? t.firstCost : 0;
  const step = Number.isFinite(t.costStep) ? t.costStep : 0;
  return Math.max(0, Math.round(first + step * Math.max(0, levelsTaken)));
}

/**
 * levelsAffordable(registries, cinders) → how many levels a given purse buys,
 * from a standing start, if it is spent on nothing else.
 *
 * THIS IS THE ACCEPTANCE TEST'S FUNCTION, and it is exported so the test is a
 * property of the shipped curve rather than arithmetic retyped beside it. His
 * band is 10–20 levels a run.
 *
 * WHAT IT IS NOT: a claim about a real climb. Nobody has simulated what an act
 * actually pays out, or what the shop takes first. The curve is checked; the
 * purse it is checked against is an assumption and is named as one wherever it
 * is used.
 */
export function levelsAffordable(registries, cinders) {
  let n = 0;
  let left = Number.isFinite(cinders) ? cinders : 0;
  // The ramp only rises, so this terminates on any non-negative purse; the
  // guard is against a zero-or-negative step making every level free.
  while (left >= levelCost(registries, n) && levelCost(registries, n) > 0) {
    left -= levelCost(registries, n);
    n++;
    if (n > 10000) break;
  }
  return n;
}

/**
 * levelUpPlan(registries, run, { pointsPerLevel }) → what the shrine may offer.
 *
 *   { levelsTaken, cost, cinders, affordable, capped, offerable,
 *     pointsPerLevel, attributes }
 *
 * `attributes` is READ OFF THE CONTENT TABLE, in its authored order, and is
 * this feature's Law 0 falsifier: a sixth attribute is one row in
 * `content/attributes.js` and it appears at the shrine with zero UI edits. The
 * shrine screen never names a stat.
 *
 * `pointsPerLevel` IS AN ARGUMENT, NOT A LOOKUP — Constantine, 2026-08-17:
 * "leave the level up value configurable". The caller resolves the player's
 * setting (`resolveLevelUpValue`, settings.js) and hands it in; omitted, the
 * content default applies. This model stays pure and knows nothing about a
 * profile, and — the reason that matters — NOTHING AT THE LOAD DOOR EVER READS
 * THE LIVE VALUE. See `run.levelPoints` in `applyLevelUp`.
 */
export function levelUpPlan(registries, run, { pointsPerLevel = null } = {}) {
  const t = table(registries);
  const levelsTaken = Number.isInteger(run && run.levelUps) ? run.levelUps : 0;
  const cost = levelCost(registries, levelsTaken);
  const cinders = Number.isFinite(run && run.cinders) ? run.cinders : 0;
  const capped = Number.isInteger(t.maxLevels) && levelsTaken >= t.maxLevels;
  const affordable = cinders >= cost;
  const authored = Number.isInteger(t.pointsPerLevel) && t.pointsPerLevel > 0 ? t.pointsPerLevel : 1;
  return {
    levelsTaken,
    cost,
    cinders,
    affordable,
    capped,
    // A cap of `null` is "no ceiling but the cinders themselves" — his range is
    // an economy, not a limit, so the shipped table refuses on price alone.
    offerable: affordable && !capped,
    pointsPerLevel: Number.isInteger(pointsPerLevel) && pointsPerLevel > 0 ? pointsPerLevel : authored,
    attributes: orderedAttributes(registries),
  };
}

/**
 * applyLevelUp(registries, run, attributeId) → the plan that was paid for, or
 * throws by name.
 *
 * THE THREE MECHANISMS, IN ONE ACT, in the order that keeps the run loadable at
 * every point in between. Nothing here is a screen's to reorder.
 *
 * RE-DERIVED FROM THE RUN'S OWN SNAPSHOT, never from today's content tables.
 * `run.derivedStatRuleSnapshot` is what the run was born under and what its
 * persisted pools are validated against; re-deriving from `registries` would
 * hand a climb in progress whatever the tables say tonight — the exact drift
 * the snapshot exists to prevent.
 *
 * MAX-HP IS NOT COMPUTED HERE. `reconcileRunLoadoutHp` is max-HP home 3 of 3
 * and already does derived + equipment + adjustment with the deficit carried;
 * a fourth home doing the same sum is the second copy this tree keeps catching.
 *
 * WHAT A LEVEL DOES TO A CURRENT POOL, ruled rather than assumed: the pool
 * grows and **the deficit is carried** — levelling CON at 12/40 HP gives 12/41,
 * not a heal. A level-up is not a rest, the shrine already sells the heal
 * beside it, and a level that healed would make the Rest panel pointless at the
 * same counter. Mana, Stamina and the per-turn stats have no deficit to carry
 * inside a shrine (combat is over), so they take the new maximum.
 *
 * ⚠ `run.levelPoints` IS NOT A SECOND COPY OF `run.levelUps`, AND IT BECAME A
 * SECOND FACT THE MOMENT THE LEVEL VALUE BECAME A DIAL. Six levels at 1 point
 * and three levels at 2 points are the same nine points and a different number
 * of purchases; the COST RAMP indexes on purchases, the LOAD DOOR's allocation
 * check needs points, and there is no arithmetic between them once the dial has
 * moved mid-run. Deriving one from the other would need the value each purchase
 * was made at, which is a history nobody is keeping.
 *
 * AND IT IS WHAT DELETES THE HAZARD I SHIPPED THIS EVENING. `e05be89` had the
 * door multiply `levelUps × balance.levelUp.pointsPerLevel` — a LIVE content
 * read — so turning this dial would have re-priced every in-flight save's
 * expected total and archived runs at the next load. He has just told us he
 * intends to turn it repeatedly between test runs, which would have made that
 * the FIRST thing he hit. The run now records the points it was actually
 * granted, the door reads what the run recorded, and no setting can refuse a
 * save. A friendlier error message would have been the wrong fix.
 */
export function applyLevelUp(registries, run, attributeId, { pointsPerLevel = null } = {}) {
  const plan = levelUpPlan(registries, run, { pointsPerLevel });
  const ids = plan.attributes.map((a) => a.id);
  if (!ids.includes(attributeId)) {
    throw new Error(`levelUp: '${attributeId}' is not an attribute id (${ids.join(', ')})`);
  }
  if (plan.capped) throw new Error(`levelUp: this run is at its ${plan.levelsTaken}-level ceiling`);
  if (!plan.affordable) throw new Error(`levelUp: ${plan.cost} cinders needed, ${plan.cinders} held`);
  if (!run.derivedStatRuleSnapshot || !run.derivedStatRuleSnapshot.rules) {
    throw new Error('levelUp: the run carries no derived-stat snapshot to re-derive against');
  }

  run.cinders -= plan.cost;
  run.attributes[attributeId] += plan.pointsPerLevel;
  run.levelUps = plan.levelsTaken + 1;
  // The POINTS this run was actually granted — what the load door checks the
  // allocation against, recorded at the moment they were granted so no later
  // change to the dial can re-price them. See the paragraph above.
  run.levelPoints = (Number.isInteger(run.levelPoints) ? run.levelPoints : 0) + plan.pointsPerLevel;

  const rules = run.derivedStatRuleSnapshot.rules;
  const classDef = registries.classes.get(run.class);
  const before = { maxMana: run.maxMana, maxStamina: run.maxStamina, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn };
  for (const [key, statId] of [['maxMana', 'mana'], ['maxStamina', 'stamina'], ['energyMax', 'energy'], ['drawPerTurn', 'draw']]) {
    if (run[key] === undefined) continue;
    run[key] = deriveStat(rules, statId, { attributes: run.attributes, classDef }).value;
  }
  // Current pools ride their own maximum up; they are never reduced by a level.
  if (run.mana !== undefined && before.maxMana !== undefined) {
    run.mana = Math.min(run.maxMana, run.mana + Math.max(0, run.maxMana - before.maxMana));
  }
  if (run.stamina !== undefined && before.maxStamina !== undefined) {
    run.stamina = Math.min(run.maxStamina, run.stamina + Math.max(0, run.maxStamina - before.maxStamina));
  }
  const hp = reconcileRunLoadoutHp(registries, run);

  note(run, {
    kind: 'write',
    site: 'levelup.js:applyLevelUp',
    field: `attributes.${attributeId}`,
    was: run.attributes[attributeId] - plan.pointsPerLevel,
    now: run.attributes[attributeId],
    why: `level ${run.levelUps} bought for ${plan.cost} cinders at ${plan.pointsPerLevel} point(s) each (${run.levelPoints} granted in total); pools re-derived from the run's own snapshot (maxHp ${hp ? hp.maxHp : 'unchanged'})`,
  });
  return { ...plan, spent: plan.cost, attributeId, level: run.levelUps };
}
