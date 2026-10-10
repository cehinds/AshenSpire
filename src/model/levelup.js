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
import { enemyCombatPower } from './combatPower.js';
import { xpStepCost } from './xpCurve.js';
import { linkedAttributes, spendAttributePick } from './skills.js';
import { effectiveAshenBlightAttributes } from './ashenBlight.js';

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
 * costs: linear base + (level − 1) × base × scaler, or exponential
 * `round(base × growth^(level − 1), roundTo)` (the shipped default), the one curve shape
 * every track shares (proposal §10; skills.js has the same function for the
 * skill tracks). Level 1's step costs `base`.
 */
export function xpToNext(registries, level) {
  const { base, growth, roundTo, linear, multScaler } = curveTable(registries);
  const b = Number.isFinite(base) && base > 0 ? base : 100;
  const g = Number.isFinite(growth) && growth > 0 ? growth : 1.15;
  const step = Number.isInteger(level) && level > 1 ? level - 1 : 0;
  return xpStepCost({ base: b, growth: g, roundTo, linear, multScaler }, step);
}

/**
 * combatLevelXp(registries, { victory, pool, kills, enemies }) → the XP one fight
 * pays: floor(sum(defeated combat power) × combatPowerMultiplier × combatWin
 * + sum(kill base × killLevelMultiplier × defeated level)). The combat-power
 * portion needs victory; a loss still pays its defeated-enemy level portion.
 */
export function combatXpReceipt(registries, { victory = false, pool = 'normal', kills = 0, enemies = null, characterMultiplier = 1 } = {}) {
  const t = awardTable(registries);
  const kill = t.kill || {};
  const perKill = Number.isFinite(kill[pool]) ? kill[pool] : (Number.isFinite(kill.normal) ? kill.normal : 0);
  const levelMultiplier = Number.isFinite(t.killLevelMultiplier) && t.killLevelMultiplier >= 0 ? t.killLevelMultiplier : 1;
  const powerMultiplier = Number.isFinite(t.combatPowerMultiplier) && t.combatPowerMultiplier >= 0 ? t.combatPowerMultiplier : 0.2;
  const defeated = Array.isArray(enemies)
    ? enemies.filter((enemy) => enemy.alive === false || enemy.hp <= 0)
    : Array.from({ length: Number.isInteger(kills) && kills > 0 ? kills : 0 }, () => ({ level: 1, combatPower: 3 }));
  const powerSum = victory ? defeated.reduce((sum, enemy) => sum + enemyCombatPower(registries, enemy), 0) : 0;
  // Floor cumulative subtotals, not each enemy independently: every displayed
  // integer term then adds up to the exact award, even with fractional dials.
  let raw = powerSum * powerMultiplier * (t.combatWin || 0);
  let subtotal = 0;
  const rows = [];
  if (victory) {
    subtotal = Math.floor(raw + 1e-9);
    rows.push({ kind: 'power', amount: subtotal });
  }
  defeated.forEach((enemy, index) => {
    const level = Number.isSafeInteger(enemy.level) && enemy.level > 0 ? enemy.level : 1;
    raw += perKill * levelMultiplier * level;
    const next = Math.floor(raw + 1e-9);
    const definition = enemy.enemyId && registries?.enemies?.has?.(enemy.enemyId)
      ? registries.enemies.get(enemy.enemyId) : null;
    rows.push({ kind: 'enemy', enemyId: enemy.enemyId || null, name: definition?.name || `Enemy ${index + 1}`, level, amount: next - subtotal });
    subtotal = next;
  });
  const multiplier = Number.isFinite(characterMultiplier) && characterMultiplier >= 0 ? characterMultiplier : 1;
  const total = Math.floor(subtotal * multiplier);
  if (total !== subtotal) rows.push({ kind: 'bonus', amount: total - subtotal });
  return { total, rows };
}

export function combatLevelXp(registries, options = {}) {
  return combatXpReceipt(registries, options).total;
}

/** questLevelXp(registries) → the XP a completed quest pays (`xp.quest`); phase 10a's door pays it. */
export function questLevelXp(registries) {
  const t = awardTable(registries);
  return Number.isFinite(t.quest) ? t.quest : 0;
}

/** The cap on levels one award climbs (`balance.level.maxLevelsPerFight`), or null for none (0 ships). */
function perAwardCap(registries) {
  const cap = (((registries && registries.balance) || {}).level || {}).maxLevelsPerFight;
  return Number.isInteger(cap) && cap >= 1 ? cap : null;
}

/** Points one level grants: the Level-up value dial when given (it REPLACES the authored number), else balance.levelUp's. */
function pointsFor(registries, pointsPerLevel) {
  const t = grantTable(registries);
  const authored = Number.isInteger(t.pointsPerLevel) && t.pointsPerLevel > 0 ? t.pointsPerLevel : 1;
  return Number.isInteger(pointsPerLevel) && pointsPerLevel > 0 ? pointsPerLevel : authored;
}

/** How many levels the banked XP can pay for without changing the displayed level. */
export function pendingLevelCount(registries, run) {
  const row = levelOf(run);
  const ceiling = grantTable(registries).maxLevels;
  let level = characterLevel(run);
  let xp = Number.isSafeInteger(row.xp) ? Math.max(0, row.xp) : 0;
  let count = 0;
  while ((!Number.isInteger(ceiling) || level < ceiling) && xp >= xpToNext(registries, level)) {
    xp -= xpToNext(registries, level);
    level += 1;
    count += 1;
  }
  return count;
}

/** Pay XP now; leave level, stat points, and derived pools unchanged until claimed. */
export function bankLevelXp(registries, run, amount) {
  if (!run) throw new Error('bankLevelXp: no run');
  if (!run.level || typeof run.level !== 'object') run.level = emptyLevel();
  const before = characterLevel(run);
  const gain = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  // The per-fight cap counts only the levels this fight's XP earns: the levels
  // banked XP already pays for (pendingLevelCount) start the count after them.
  const fightFrom = before + pendingLevelCount(registries, run);
  const discarded = gain ? climbLevels(registries, { level: before, xp: run.level.xp, gain, fightFrom }).discarded : 0;
  if (gain) run.level.xp += gain - discarded;
  return { before, after: before, levelUps: 0, pendingLevelUps: pendingLevelCount(registries, run), points: 0, thresholds: 0, gained: gain, discarded };
}

/** Commit exactly one earned level, leaving any excess XP banked for the next claim. */
export function claimBankedLevel(registries, run, { pointsPerLevel = null, grantStats = true } = {}) {
  if (!run || pendingLevelCount(registries, run) < 1) return null;
  const before = characterLevel(run);
  const cost = xpToNext(registries, before);
  const points = grantStats ? pointsFor(registries, pointsPerLevel) : 0;
  run.level.xp -= cost;
  run.level.level = before + 1;
  run.level.unspentPoints += points;
  const thresholds = rederivePools(registries, run, `level ${before} → ${run.level.level}`);
  note(run, {
    kind: 'write', site: 'levelup.js:claimBankedLevel', field: 'level',
    was: { level: before, unspentPoints: run.level.unspentPoints - points },
    now: { level: run.level.level, unspentPoints: run.level.unspentPoints },
    why: `${cost} banked XP spent; ${points} point(s) granted`,
  });
  return { before, after: run.level.level, points, spent: cost, thresholds, remaining: pendingLevelCount(registries, run) };
}

/**
 * climbLevels(registries, { level, xp, gain }) → { level, xp, levelUps, capped, cappedBy, discarded }
 * — THE CLIMB, pure: `gain` XP added to a ledger at `level` with `xp` banked,
 * stepping up the curve while the XP pays for the next step. Two ceilings stop
 * it, both read off `registries.balance`:
 *   - `levelUp.maxLevels`, the run's level ceiling: the XP past it stays on the
 *     ledger (unchanged behaviour);
 *   - `level.maxLevelsPerFight` (SPEC §15.2; 0 is no cap), how many steps this
 *     one award may climb: the XP past it is DISCARDED, so the ledger ends at
 *     most one XP short of the next step and a progress bar never reads past
 *     full.
 * `capped` says a ceiling, not the XP, stopped the climb, and `cappedBy`
 * which: 'level' (maxLevels) or 'fight' (maxLevelsPerFight). `fightFrom`
 * (default `level`) is the level the allowance counts from, so levels the
 * ledger already paid for before this award do not use it up. `discarded` is
 * the XP the per-fight cap threw away (0 otherwise). `awardLevelXp`
 * writes this to the run; `levelPace` reads it for the Levelling preview, so
 * the preview cannot describe a climb play does not make.
 */
export function climbLevels(registries, { level = 1, xp = 0, gain = 0, fightFrom = null } = {}) {
  const start = Number.isInteger(level) && level >= 1 ? level : 1;
  // The level the per-award allowance counts from: `start` unless the caller
  // says XP already banked pays for levels first (bankLevelXp).
  const from = Number.isInteger(fightFrom) && fightFrom >= start ? fightFrom : start;
  const t = grantTable(registries);
  const ceiling = Number.isInteger(t.maxLevels) ? t.maxLevels : null;
  const perAward = perAwardCap(registries);
  let lv = start;
  let bank = (Number.isFinite(xp) ? xp : 0) + (Number.isFinite(gain) ? Math.max(0, Math.floor(gain)) : 0);
  let cost = xpToNext(registries, lv);
  let cappedBy = null;
  let discarded = 0;
  while (bank >= cost) {
    // The per-award cap first: once this award has climbed its allowance the
    // rest is discarded, whichever ceiling would also stop it here — so a
    // capped award always leaves xp ≤ xpToNext − 1 (review, #1349).
    if (perAward !== null && lv - from >= perAward) { cappedBy = 'fight'; discarded = bank - (cost - 1); bank = cost - 1; break; }
    if (ceiling !== null && lv >= ceiling) { cappedBy = 'level'; break; }
    bank -= cost;
    lv += 1;
    cost = xpToNext(registries, lv);
  }
  return { level: lv, xp: bank, levelUps: lv - start, capped: cappedBy !== null, cappedBy, discarded };
}

/** The fights the preview prices: a normal fight of three kills (SPEC §15.2),
 *  and an elite and a boss fight of one kill each — every elite and boss
 *  encounter the content authors fields a single enemy. */
export const PACE_FIGHTS = Object.freeze([
  Object.freeze({ pool: 'normal', kills: 3 }),
  Object.freeze({ pool: 'elite', kills: 1 }),
  Object.freeze({ pool: 'boss', kills: 1 }),
]);
/** The levels the preview climbs from, and the last level its curve lists. */
export const PACE_FROM_LEVELS = Object.freeze([1, 10]);
export const PACE_CURVE_TO = 20;

/**
 * levelPace(registries, { pointsPerLevel }) → what the numbers in force make
 * of a climb, for the Levelling preview (SPEC §15.2;
 * ui/models/LevelPacePreviewModel.js).
 *
 * `registries` is the CONFIGURED content (configuredContentBundle), where the
 * XP multiplier is already applied and rounded into the awards — it is not
 * applied again here. `pointsPerLevel` is the Level-up value dial, which
 * replaces balance.levelUp.pointsPerLevel (omitted, the authored number).
 *
 *   → { pointsPerLevel, maxLevelsPerFight, maxLevels,
 *       curve: [{ level, step, total }]            levels 2..20
 *       fights: [{ pool, kills, xp,
 *                  from: [{ level, levelsGained, reached, points, capped }] }] }
 *
 * Pure: no run, no DOM. The XP is `combatLevelXp` and the levels are
 * `climbLevels`, exactly what play runs through `awardLevelXp`.
 */
export function levelPace(registries, { pointsPerLevel = null } = {}) {
  const perLevel = pointsFor(registries, pointsPerLevel);
  const t = grantTable(registries);
  const curve = [];
  let total = 0;
  for (let level = 2; level <= PACE_CURVE_TO; level += 1) {
    const step = xpToNext(registries, level - 1);
    total += step;
    curve.push({ level, step, total });
  }
  const fights = PACE_FIGHTS.map(({ pool, kills }) => {
    const xp = combatLevelXp(registries, { victory: true, pool, kills });
    const from = PACE_FROM_LEVELS.map((level) => {
      const climb = climbLevels(registries, { level, xp: 0, gain: xp });
      return { level, levelsGained: climb.levelUps, reached: climb.level, points: climb.levelUps * perLevel, capped: climb.capped };
    });
    return { pool, kills, xp, from };
  });
  return {
    pointsPerLevel: perLevel,
    maxLevelsPerFight: perAwardCap(registries),
    maxLevels: Number.isInteger(t.maxLevels) ? t.maxLevels : null,
    curve,
    fights,
  };
}

/**
 * awardLevelXp(registries, run, amount, { pointsPerLevel }) → { before,
 * after, levelUps, points, thresholds, gained, discarded } — writes the ledger and climbs as
 * many steps as the XP buys (`climbLevels`, the climb the Levelling preview
 * reads), each step granting `pointsPerLevel` points to `unspentPoints` (the
 * caller resolves the player's dial; omitted, the content default). A step
 * that crosses a `perLevel` threshold re-derives the pools from the run's own
 * snapshot, the deficit carried. `maxLevels` (balance.levelUp) caps the run's
 * level, the XP past it staying on the ledger; `maxLevelsPerFight`
 * (balance.level) caps one award's climb, the XP past it discarded.
 * `gained` is what the award paid; `discarded` is how much of it the
 * per-fight cap threw away, so the spoils receipt can say both (Codex, #1349).
 * A non-positive or non-finite amount writes nothing.
 */
export function awardLevelXp(registries, run, amount, { pointsPerLevel = null, grantStats = true } = {}) {
  if (!run) throw new Error('awardLevelXp: no run');
  if (!run.level || typeof run.level !== 'object') run.level = emptyLevel();
  const row = run.level;
  const before = row.level;
  const gain = Number.isFinite(amount) ? Math.floor(amount) : 0;
  if (gain <= 0) return { before, after: before, levelUps: 0, points: 0, thresholds: 0, gained: 0, discarded: 0 };
  const perLevel = grantStats ? pointsFor(registries, pointsPerLevel) : 0;
  const climb = climbLevels(registries, { level: row.level, xp: row.xp, gain });
  const levelUps = climb.levelUps;
  const points = levelUps * perLevel;
  row.xp = climb.xp;
  row.level = climb.level;
  row.unspentPoints += points;
  let thresholds = 0;
  if (levelUps > 0) {
    thresholds = rederivePools(registries, run, `level ${before} → ${row.level}`);
    note(run, {
      kind: 'write',
      site: 'levelup.js:awardLevelXp',
      field: 'level',
      was: { level: before, unspentPoints: row.unspentPoints - points },
      now: { level: row.level, unspentPoints: row.unspentPoints },
      why: `${gain} XP paid; ${levelUps} level${levelUps === 1 ? '' : 's'} climbed at ${perLevel} point(s) each (${row.xp} XP toward level ${row.level + 1}, ${xpToNext(registries, row.level)} needed)${climb.cappedBy === 'fight' ? `; capped at ${levelUps} a fight, ${climb.discarded} XP past it discarded` : ''}`,
    });
  }
  return { before, after: row.level, levelUps, points, thresholds, gained: gain, discarded: climb.discarded };
}

/**
 * rederivePools(registries, run, why) → how many maxima moved. Mana, Stamina,
 * Actions and Hand from the run's own snapshot at its attributes AND level;
 * max HP through reconcileRunLoadoutHp (max-HP home 3 of 3). Current pools
 * ride their own maximum up and are never reduced. Shared by the point
 * assignment and the level climb: one writer for what a level does to a pool.
 */
export function rederivePools(registries, run, why) {
  if (!run.derivedStatRuleSnapshot || !run.derivedStatRuleSnapshot.rules) return 0;
  const rules = run.derivedStatRuleSnapshot.rules;
  const classDef = registries.classes.get(run.class);
  const level = characterLevel(run);
  const before = { maxHp: run.maxHp, maxMana: run.maxMana, maxStamina: run.maxStamina };
  const priorEnergy = run.energyMax;
  const attributes = effectiveAshenBlightAttributes(run);
  let moved = 0;
  for (const [key, statId] of [['energyMax', 'energy'], ['drawPerTurn', 'draw']]) {
    if (run[key] === undefined) continue;
    if (run.combatExpansionVersion === 2 && key === 'energyMax') continue;
    const next = deriveStat(rules, statId, { attributes, classDef, level }).value;
    if (next !== run[key]) moved += 1;
    run[key] = next;
  }
  // Reconcile from the original equipped maxima exactly once. Writing bare
  // derived maxima first would make the equipment bonus look like a refill.
  reconcileRunLoadoutHp(registries, run);
  if (run.combatExpansionVersion === 2 && priorEnergy !== run.energyMax) moved += 1;
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

/**
 * applySkillAttribute(registries, run, skillId, attributeId) → the attribute's
 * new value, or null (nothing written) when the track has no pick queued or
 * the attribute is not in its linked set (SPEC §13.4o, every 4th level). The
 * point is recorded in `run.skillAttributePoints`, which the load door adds to
 * the levelled points it judges the allocation against, and the pools are
 * re-derived exactly as a levelled point re-derives them. `offered` (the saved
 * offer's own list) is honoured when given, so an offer rolled before the
 * linked set changed still lands what it promised.
 */
export function applySkillAttribute(registries, run, skillId, attributeId, { offered = null } = {}) {
  const allowed = Array.isArray(offered) && offered.length ? offered : linkedAttributes(registries, skillId);
  if (!allowed.includes(attributeId) || !orderedAttributes(registries).some((attr) => attr.id === attributeId)) return null;
  if (!run.attributes || !Number.isFinite(run.attributes[attributeId])) return null;
  if (!run.derivedStatRuleSnapshot || !run.derivedStatRuleSnapshot.rules) return null;
  if (!spendAttributePick(run, skillId)) return null;
  run.attributes[attributeId] += 1;
  run.skillAttributePoints = (Number.isInteger(run.skillAttributePoints) ? run.skillAttributePoints : 0) + 1;
  // Which track granted which point, so a respec can take its own back.
  const grants = run.skillAttributeGrants && typeof run.skillAttributeGrants === 'object' ? run.skillAttributeGrants : {};
  run.skillAttributeGrants = { ...grants, [skillId]: [...(grants[skillId] || []), attributeId] };
  rederivePools(registries, run, `skill point on ${attributeId}`);
  note(run, {
    kind: 'write',
    site: 'levelup.js:applySkillAttribute',
    field: `attributes.${attributeId}`,
    was: run.attributes[attributeId] - 1,
    now: run.attributes[attributeId],
    why: `a ${skillId} level's attribute pick (${run.skillAttributePoints} skill points in total); pools re-derived from the run's own snapshot (maxHp ${run.maxHp})`,
  });
  return run.attributes[attributeId];
}

/**
 * withdrawSkillAttributes(registries, run, skillId) → the attribute ids taken
 * back: every point the track's picks granted (owner ruling, 2026-10-05: a
 * respec withdraws them, FINISH D13a). The points leave the attributes and
 * `skillAttributePoints` together, so the load door's allocation check still
 * balances, and the pools are re-derived once. A save from before the record
 * existed has nothing to name and keeps its points.
 */
export function withdrawSkillAttributes(registries, run, skillId) {
  const granted = run.skillAttributeGrants && Array.isArray(run.skillAttributeGrants[skillId]) ? run.skillAttributeGrants[skillId] : [];
  if (!granted.length) return [];
  // Only a point actually taken off an attribute leaves the count, so a record
  // naming an unknown id cannot unbalance the load door's allocation check.
  let taken = 0;
  for (const id of granted) if (Number.isFinite(run.attributes?.[id])) { run.attributes[id] -= 1; taken += 1; }
  run.skillAttributePoints = Math.max(0, (run.skillAttributePoints || 0) - taken);
  const rest = { ...run.skillAttributeGrants };
  delete rest[skillId];
  if (Object.keys(rest).length) run.skillAttributeGrants = rest; else delete run.skillAttributeGrants;
  rederivePools(registries, run, `respec withdrew ${granted.length} ${skillId} point(s)`);
  note(run, {
    kind: 'write',
    site: 'levelup.js:withdrawSkillAttributes',
    field: 'attributes',
    was: undefined,
    now: granted,
    why: `a respec of ${skillId} withdrew the attribute points its picks granted (${run.skillAttributePoints} skill points remain)`,
  });
  return granted;
}
