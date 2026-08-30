// src/model/levels.js — canonical hidden player/enemy level semantics (#237)
//
// Pure and inert: no UI, save, encounter, combat, or co-op activation. #238
// authors enemy constraints and act/floor target bands; #241 decides when the
// resulting receipts become persisted runtime state.
//
// Headless: no document/window/localStorage/timers.

export const ENCOUNTER_LEVEL_SEAM = 'encounter-level-planning/v1';
export const LEVEL_SCALING_ROUNDING = Object.freeze(['floor', 'round', 'ceil']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isPositiveInt = (value) => Number.isSafeInteger(value) && value > 0;

function bandProblems(band, path) {
  const problems = [];
  if (!isObject(band)) return [{ path, msg: 'must be an object { min, max }' }];
  for (const key of Object.keys(band)) {
    if (!['min', 'max'].includes(key)) problems.push({ path: `${path}.${key}`, msg: 'unknown field' });
  }
  if (!isPositiveInt(band.min)) problems.push({ path: `${path}.min`, msg: 'must be a positive integer' });
  if (!isPositiveInt(band.max)) problems.push({ path: `${path}.max`, msg: 'must be a positive integer' });
  if (isPositiveInt(band.min) && isPositiveInt(band.max) && band.min > band.max) {
    problems.push({ path, msg: `min ${band.min} must not exceed max ${band.max}` });
  }
  return problems;
}

export function levelConfigProblems(balance) {
  const levels = balance && balance.levels;
  if (!isObject(levels)) return [{ path: 'balance.levels', msg: 'must be an object with playerStartingLevel' }];
  const problems = [];
  for (const key of Object.keys(levels)) {
    if (key !== 'playerStartingLevel') problems.push({ path: `balance.levels.${key}`, msg: 'unknown field' });
  }
  if (!isPositiveInt(levels.playerStartingLevel)) {
    problems.push({ path: 'balance.levels.playerStartingLevel', msg: 'must be a positive integer' });
  }
  return problems;
}

export function enemyLevelProfileProblems(profile, path = 'levelProfile') {
  return bandProblems(profile, path);
}

function requireClean(problems) {
  if (!problems.length) return;
  const first = problems[0];
  throw new Error(`${first.path}: ${first.msg}`);
}

/**
 * playerLevel(registries, run) -> hidden whole-number player level.
 *
 * Missing `levelUps` is the legacy-save shape and means zero purchases. A
 * present malformed count fails loudly. `levelPoints` never participates.
 */
export function playerLevel(registries, run) {
  requireClean(levelConfigProblems(registries && registries.balance));
  const starting = registries.balance.levels.playerStartingLevel;
  const purchases = run && run.levelUps;
  if (purchases == null) return starting;
  if (!Number.isSafeInteger(purchases) || purchases < 0) {
    throw new Error(`run.levelUps: must be a non-negative integer, got ${JSON.stringify(purchases)}`);
  }
  const result = starting + purchases;
  if (!Number.isSafeInteger(result)) throw new Error('player level: exceeds the safe integer range');
  return result;
}

function hashString(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function assertContext(context) {
  if (!isObject(context)) throw new Error('enemy level context: must be an object');
  for (const key of Object.keys(context)) {
    if (!['seed', 'contextKey', 'act', 'floor', 'targetBand', 'modifiers'].includes(key)) {
      throw new Error(`enemy level context.${key}: unknown field`);
    }
  }
  if (!Number.isSafeInteger(context.seed) || context.seed < 0 || context.seed > 0xffffffff) {
    throw new Error(`enemy level context.seed: must be a uint32, got ${JSON.stringify(context.seed)}`);
  }
  if (typeof context.contextKey !== 'string' || !context.contextKey.trim()) {
    throw new Error('enemy level context.contextKey: must be a non-empty stable encounter/slot key');
  }
  if (!isPositiveInt(context.act)) throw new Error('enemy level context.act: must be a positive integer');
  if (!Number.isSafeInteger(context.floor) || context.floor < 0) {
    throw new Error('enemy level context.floor: must be a non-negative integer');
  }
  requireClean(bandProblems(context.targetBand, 'enemy level context.targetBand'));
  const modifiers = context.modifiers == null ? [] : context.modifiers;
  if (!Array.isArray(modifiers)) throw new Error('enemy level context.modifiers: must be an array');
  modifiers.forEach((modifier, index) => {
    if (!isObject(modifier)) throw new Error(`enemy level context.modifiers[${index}]: must be an object { id, delta }`);
    if (typeof modifier.id !== 'string' || !modifier.id) {
      throw new Error(`enemy level context.modifiers[${index}].id: must be a non-empty string`);
    }
    if (!Number.isSafeInteger(modifier.delta)) {
      throw new Error(`enemy level context.modifiers[${index}].delta: must be an integer`);
    }
    for (const key of Object.keys(modifier)) {
      if (!['id', 'delta'].includes(key)) throw new Error(`enemy level context.modifiers[${index}].${key}: unknown field`);
    }
  });
  return modifiers;
}

/**
 * resolveEnemyLevel(profile, context) -> deterministic planning receipt.
 *
 * `profile` is the enemy's authored { min, max } constraint. `targetBand` is
 * the act/floor planning band supplied by later content. A stable hash of the
 * run seed plus the explicit encounter/slot key chooses inside their overlap.
 * This dedicated, stateless seam consumes no `enemyAI` or other run RNG draw.
 * Integer modifiers apply afterward and the authored profile is the final
 * clamp, so no caller can push an instance outside its declared bounds.
 */
export function resolveEnemyLevel(profile, context) {
  requireClean(enemyLevelProfileProblems(profile, 'enemy level profile'));
  const modifiers = assertContext(context);

  const sourceBand = { min: profile.min, max: profile.max };
  const targetBand = { min: context.targetBand.min, max: context.targetBand.max };
  const overlapMin = Math.max(sourceBand.min, targetBand.min);
  const overlapMax = Math.min(sourceBand.max, targetBand.max);
  const planningKey = JSON.stringify([
    ENCOUNTER_LEVEL_SEAM,
    context.seed >>> 0,
    context.contextKey,
    context.act,
    context.floor,
    sourceBand.min,
    sourceBand.max,
    targetBand.min,
    targetBand.max,
  ]);
  const keyHash = hashString(planningKey);

  let rolledLevel;
  if (overlapMin <= overlapMax) {
    rolledLevel = overlapMin + (keyHash % (overlapMax - overlapMin + 1));
  } else {
    const targetMidpoint = Math.round((targetBand.min + targetBand.max) / 2);
    rolledLevel = clamp(targetMidpoint, sourceBand.min, sourceBand.max);
  }

  const modifierTotal = modifiers.reduce((sum, modifier) => sum + modifier.delta, 0);
  if (!Number.isSafeInteger(modifierTotal)) throw new Error('enemy level modifier total: exceeds the safe integer range');
  const unclamped = rolledLevel + modifierTotal;
  if (!Number.isSafeInteger(unclamped)) throw new Error('enemy level result: exceeds the safe integer range');
  const result = clamp(unclamped, sourceBand.min, sourceBand.max);

  return {
    seam: ENCOUNTER_LEVEL_SEAM,
    sourceBand,
    actFloorTarget: {
      act: context.act,
      floor: context.floor,
      band: targetBand,
    },
    planning: {
      seed: context.seed >>> 0,
      contextKey: context.contextKey,
      keyHash,
      overlap: overlapMin <= overlapMax ? { min: overlapMin, max: overlapMax } : null,
    },
    modifiers: modifiers.map(({ id, delta }) => ({ id, delta })),
    rolledLevel,
    modifierTotal,
    unclamped,
    clamped: result !== unclamped,
    result,
  };
}

/**
 * levelScalingReceipt(spec) -> one exact, pure stat-scaling receipt.
 *
 * #237 owns the arithmetic vocabulary, not any live enemy values. #238 authors
 * the per-stat base level, coefficient, rounding, and optional caps. Keeping
 * rounding explicit prevents HP, damage, block, and poise from silently using
 * whichever Math function a later caller happened to choose.
 */
export function levelScalingReceipt({
  stat,
  base,
  baselineLevel,
  resolvedLevel,
  perLevel,
  rounding,
  min = null,
  max = null,
}) {
  if (typeof stat !== 'string' || !stat) throw new Error('level scaling stat: must be a non-empty string');
  if (!Number.isFinite(base)) throw new Error('level scaling base: must be finite');
  if (!isPositiveInt(baselineLevel)) throw new Error('level scaling baselineLevel: must be a positive integer');
  if (!isPositiveInt(resolvedLevel)) throw new Error('level scaling resolvedLevel: must be a positive integer');
  if (!Number.isFinite(perLevel)) throw new Error('level scaling perLevel: must be finite');
  if (!LEVEL_SCALING_ROUNDING.includes(rounding)) {
    throw new Error(`level scaling rounding: must be one of ${LEVEL_SCALING_ROUNDING.join(' | ')}`);
  }
  if (min != null && !Number.isFinite(min)) throw new Error('level scaling min: must be finite when present');
  if (max != null && !Number.isFinite(max)) throw new Error('level scaling max: must be finite when present');
  if (min != null && max != null && min > max) throw new Error(`level scaling cap: min ${min} must not exceed max ${max}`);

  const levelDelta = resolvedLevel - baselineLevel;
  const unrounded = base + levelDelta * perLevel;
  if (!Number.isFinite(unrounded)) throw new Error('level scaling result: must remain finite');
  const rounded = Math[rounding](unrounded);
  if (!Number.isSafeInteger(rounded)) throw new Error('level scaling rounded result: exceeds the safe integer range');
  const result = clamp(rounded, min == null ? -Infinity : min, max == null ? Infinity : max);
  return {
    stat,
    base,
    baselineLevel,
    resolvedLevel,
    levelDelta,
    perLevel,
    rounding,
    unrounded,
    rounded,
    cap: { min, max },
    clamped: result !== rounded,
    result,
  };
}
