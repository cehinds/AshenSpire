// src/model/levelup.js — THE CHARACTER LEVEL (plan phase 6, proposal §10).
//
// A level is EARNED, not bought. The run keeps one ledger, `run.level =
// { xp, level, unspentPoints }`: XP is paid by the run's owner at the end of
// a fight (a win, and each kill by the door's pool) and, once phase 10a's
// door exists, per quest; every step of the one curve every track shares
// (`xpToNext`, the shape skills.js uses) grants `pointsPerLevel` attribute
// points, which wait on the ledger until the player assigns them at a shrine
// (the town's level-up service once phase 7 places it). Cinders buy nothing
// here any more: the shrine's Level-up card spends POINTS, never a purse.
//
// WHAT A POINT STILL IS, unchanged from the shrine ladder this replaces: one
// attribute point, worth exactly what the derived-stat table says a point is
// worth, with the pools re-derived from the run's OWN snapshot and the deficit
// carried (levelling is not a rest). `run.levelUps` and `run.levelPoints`
// keep counting every point assigned — they are what the load door's
// allocation check reads (attributes.js:grantedAttributePoints), and nothing
// about that door moved.
//
// WHAT A LEVEL ADDS BESIDE THE POINT: every `perLevel.every` levels the
// derived-stat rows that carry a `perLevel` term (content/derivedStats.js)
// bump their maximum — the same rule the snapshot carries, so a run born
// under it keeps it and a run born before it never gains it.

import { deriveStat } from './derivedStats.js';
import { orderedAttributes } from './attributes.js';
import { reconcileRunLoadoutHp } from './loadout.js';
import { note } from './healLedger.js';

/** The authored tables, or the shape of them, so a bundle without them fails
 *  soft in tools rather than throwing on a missing key. Bad data is caught at
 *  the content door, not here. */
function grantTable(registries) {
  return (registries && registries.balance && registries.balance.levelUp) || {};
}
function curveTable(registries) {
  return ((registries && registries.balance && registries.balance.level) || {}).xp || {};
}
function awardTable(registries) {
  return (registries && registries.balance && registries.balance.xp) || {};
}

/** A fresh ledger: level 1, nothing earned, nothing waiting. */
export const emptyLevel = () => ({ xp: 0, level: 1, unspentPoints: 0 });

/** The ledger a run holds, or a fresh one for a run that has none. */
export function levelOf(run) {
  const row = run && run.level;
  return row && typeof row === 'object' ? row : emptyLevel();
}

/** The displayed character level: 1 for a run that has none. */
export function characterLevel(run) {
  const row = run && run.level;
  return row && Number.isInteger(row.level) && row.level >= 1 ? row.level : 1;
}

/**
 * xpToNext(registries, level) → the XP the step from `level` to `level + 1`
 * costs: `round(base × growth^(level − 1), roundTo)`, the one curve shape
 * every track shares (proposal §10; skills.js has the same function for the
 * skill tracks). Level 1's step costs `base`.
 */
export function xpToNext(registries, level) {
  const { base, growth, roundTo } = curveTable(registries);
  const b = Number.isFinite(base) && base > 0 ? base : 100;
  const g = Number.isFinite(growth) && growth > 0 ? growth : 1.15;
  const step = Number.isInteger(level) && level > 1 ? level - 1 : 0;
  const unit = Number.isInteger(roundTo) && roundTo > 0 ? roundTo : 1;
  // The epsilon: 100 × 1.15 is 114.999… in floating point, and the receipt
  // in balance.js says 120, not 110.
  return Math.max(unit, Math.round((b * Math.pow(g, step)) / unit + 1e-9) * unit);
}

/**
 * combatLevelXp(registries, { victory, pool, kills }) → the XP one fight
 * pays: `xp.combatWin` for a won fight, and `xp.kill.<pool>` per enemy felled
 * (a kill is a kill, won or lost; an unknown pool pays the normal rate).
 */
export function combatLevelXp(registries, { victory = false, pool = 'normal', kills = 0 } = {}) {
  const t = awardTable(registries);
  const kill = t.kill || {};
  const perKill = Number.isFinite(kill[pool]) ? kill[pool] : (Number.isFinite(kill.normal) ? kill.normal : 0);
  const won = victory && Number.isFinite(t.combatWin) ? t.combatWin : 0;
  const n = Number.isInteger(kills) && kills > 0 ? kills : 0;
  return won + n * perKill;
}

/** questLevelXp(registries) → the XP a completed quest pays (`xp.quest`); phase 10a's door pays it. */
export function questLevelXp(registries) {
  const t = awardTable(registries);
  return Number.isFinite(t.quest) ? t.quest : 0;
}

/**
 * awardLevelXp(registries, run, amount, { pointsPerLevel }) → { before,
 * after, levelUps, points, thresholds, gained } — writes the ledger and climbs as
 * many steps as the XP buys, each step granting `pointsPerLevel` points to
 * `unspentPoints` (the caller resolves the player's dial; omitted, the
 * content default). A step that crosses a `perLevel` threshold re-derives
 * the pools from the run's own snapshot, the deficit carried. `maxLevels`
 * (balance.levelUp) caps the climb; XP past the cap stays on the ledger. A
 * non-positive or non-finite amount writes nothing.
 */
export function awardLevelXp(registries, run, amount, { pointsPerLevel = null } = {}) {
  if (!run) throw new Error('awardLevelXp: no run');
  if (!run.level || typeof run.level !== 'object') run.level = emptyLevel();
  const row = run.level;
  const before = row.level;
  const gain = Number.isFinite(amount) ? Math.floor(amount) : 0;
  if (gain <= 0) return { before, after: before, levelUps: 0, points: 0, thresholds: 0, gained: 0 };
  const t = grantTable(registries);
  const authored = Number.isInteger(t.pointsPerLevel) && t.pointsPerLevel > 0 ? t.pointsPerLevel : 1;
  const perLevel = Number.isInteger(pointsPerLevel) && pointsPerLevel > 0 ? pointsPerLevel : authored;
  const cap = Number.isInteger(t.maxLevels) ? t.maxLevels : null;
  row.xp += gain;
  let points = 0;
  let cost = xpToNext(registries, row.level);
  while (row.xp >= cost && (cap === null || row.level < cap)) {
    row.xp -= cost;
    row.level += 1;
    row.unspentPoints += perLevel;
    points += perLevel;
    cost = xpToNext(registries, row.level);
  }
  const levelUps = row.level - before;
  let thresholds = 0;
  if (levelUps > 0) {
    thresholds = rederivePools(registries, run, `level ${before} → ${row.level}`);
    note(run, {
      kind: 'write',
      site: 'levelup.js:awardLevelXp',
      field: 'level',
      was: { level: before, unspentPoints: row.unspentPoints - points },
      now: { level: row.level, unspentPoints: row.unspentPoints },
      why: `${gain} XP paid; ${levelUps} level${levelUps === 1 ? '' : 's'} climbed at ${perLevel} point(s) each (${row.xp} XP toward level ${row.level + 1}, ${xpToNext(registries, row.level)} needed)`,
    });
  }
  return { before, after: row.level, levelUps, points, thresholds, gained: gain };
}

/**
 * rederivePools(registries, run, why) → how many maxima moved. Mana, Stamina,
 * Actions and Hand from the run's own snapshot at its attributes AND level;
 * max HP through reconcileRunLoadoutHp (max-HP home 3 of 3). Current pools
 * ride their own maximum up and are never reduced. Shared by the point
 * assignment and the level climb: one writer for what a level does to a pool.
 */
function rederivePools(registries, run, why) {
  if (!run.derivedStatRuleSnapshot || !run.derivedStatRuleSnapshot.rules) return 0;
  const rules = run.derivedStatRuleSnapshot.rules;
  const classDef = registries.classes.get(run.class);
  const level = characterLevel(run);
  const before = { maxHp: run.maxHp, maxMana: run.maxMana, maxStamina: run.maxStamina };
  let moved = 0;
  for (const [key, statId] of [['energyMax', 'energy'], ['drawPerTurn', 'draw']]) {
    if (run[key] === undefined) continue;
    const next = deriveStat(rules, statId, { attributes: run.attributes, classDef, level }).value;
    if (next !== run[key]) moved += 1;
    run[key] = next;
  }
  // Reconcile from the original equipped maxima exactly once. Writing bare
  // derived maxima first would make the equipment bonus look like a refill.
  reconcileRunLoadoutHp(registries, run);
  for (const key of Object.keys(before)) if (run[key] !== before[key]) moved += 1;
  return moved;
}

/**
 * levelUpPlan(registries, run) → what the shrine may offer.
 *
 *   { level, xp, xpToNext, points, capped, offerable, blockedBy,
 *     pointsPerLevel, attributes }
 *
 * `points` is the ledger's `unspentPoints`; the offer is those points and
 * nothing else — no price, no purse. `blockedBy` is a TOKEN so a label
 * switches on a word: 'points' (none waiting) or 'cap' (the level ceiling,
 * with none waiting); null means it IS offerable. `attributes` is READ OFF THE
 * CONTENT TABLE, in its authored order: the shrine names no stat itself.
 */
export function levelUpPlan(registries, run) {
  const t = grantTable(registries);
  const row = levelOf(run);
  const points = Number.isInteger(row.unspentPoints) && row.unspentPoints > 0 ? row.unspentPoints : 0;
  const capped = Number.isInteger(t.maxLevels) && row.level >= t.maxLevels;
  const authored = Number.isInteger(t.pointsPerLevel) && t.pointsPerLevel > 0 ? t.pointsPerLevel : 1;
  return {
    level: row.level,
    xp: row.xp,
    xpToNext: xpToNext(registries, row.level),
    points,
    capped,
    blockedBy: points > 0 ? null : (capped ? 'cap' : 'points'),
    offerable: points > 0,
    pointsPerLevel: authored,
    attributes: orderedAttributes(registries),
  };
}

/** levelUpBudget(registries, run) → { points }: how many points the shrine card may assign at once. */
export function levelUpBudget(registries, run) {
  return { points: levelUpPlan(registries, run).points };
}

/**
 * applyLevelUp(registries, run, attributeId) → the plan that was spent from,
 * or throws by name. Spends ONE unspent point on one attribute, in the order
 * that keeps the run loadable at every point in between: the attribute goes
 * up, the assignment is recorded (`levelUps`, `levelPoints` — what the load
 * door checks the allocation against), and the pools are re-derived from the
 * run's own snapshot with the deficit carried.
 */
export function applyLevelUp(registries, run, attributeId) {
  const plan = levelUpPlan(registries, run);
  const ids = plan.attributes.map((a) => a.id);
  if (!ids.includes(attributeId)) {
    throw new Error(`levelUp: '${attributeId}' is not an attribute id (${ids.join(', ')})`);
  }
  if (!plan.offerable) throw new Error(`levelUp: no attribute point waiting to be assigned (level ${plan.level}, ${plan.xp}/${plan.xpToNext} XP)`);
  if (!run.derivedStatRuleSnapshot || !run.derivedStatRuleSnapshot.rules) {
    throw new Error('levelUp: the run carries no derived-stat snapshot to re-derive against');
  }
  run.attributes[attributeId] += 1;
  run.level.unspentPoints -= 1;
  run.levelUps = (Number.isInteger(run.levelUps) ? run.levelUps : 0) + 1;
  run.levelPoints = (Number.isInteger(run.levelPoints) ? run.levelPoints : 0) + 1;
  rederivePools(registries, run, `point on ${attributeId}`);
  note(run, {
    kind: 'write',
    site: 'levelup.js:applyLevelUp',
    field: `attributes.${attributeId}`,
    was: run.attributes[attributeId] - 1,
    now: run.attributes[attributeId],
    why: `one earned point assigned at level ${run.level.level} (${run.levelPoints} assigned in total, ${run.level.unspentPoints} waiting); pools re-derived from the run's own snapshot (maxHp ${run.maxHp})`,
  });
  return { ...plan, attributeId, points: run.level.unspentPoints, level: run.level.level };
}
