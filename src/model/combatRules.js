// Pure rules validation and arithmetic shared by execution and previews.
import { attackDescriptor } from './attackTags.js';
export function assertNumber(value, path, min = 0, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${path}: expected finite number in [${min}, ${max}]`);
}


export function validateAttack(attack, rules = null) {
  if (!attack || typeof attack !== 'object' || Array.isArray(attack)) throw new Error('attack must be an object');
  const fields = ['source', 'hand', 'damageType', 'components', 'impactBonus', 'impactFactor', 'penetration', 'hitWeights', 'dodgeable', 'buildup', 'weaponDamage'];
  for (const key of Object.keys(attack)) if (!fields.includes(key)) throw new Error(`unknown attack field '${key}'`);
  if (attack.source && !['weapon', 'spell', 'unarmed'].includes(attack.source)) throw new Error('invalid attack source');
  if (attack.hand && !['mainHand', 'offHand'].includes(attack.hand)) throw new Error('invalid attack hand');
  if (attack.damageType && (typeof attack.damageType !== 'string' || (rules && !(attack.damageType in rules.damageTypes)))) throw new Error('unknown attack damageType');
  for (const key of ['impactBonus', 'impactFactor', 'penetration']) if (attack[key] !== undefined) assertNumber(attack[key], `attack.${key}`);
  if (attack.dodgeable !== undefined && typeof attack.dodgeable !== 'boolean') throw new Error('dodgeable must be boolean');
  for (const row of attack.buildup || []) {
    if (typeof row.status !== 'string' || !row.status) throw new Error('attack buildup requires a status');
    assertNumber(row.amount, 'attack.buildup.amount');
  }
  if (attack.components !== undefined) {
    if (!Array.isArray(attack.components) || !attack.components.length) throw new Error('attack.components must be nonempty');
    for (const c of attack.components) {
      if (typeof c.type !== 'string' || (rules && !rules.damageTypes[c.type])) throw new Error(`unknown component type '${c.type}'`);
      assertNumber(c.weight, 'component.weight');
    }
    if (!attack.components.some((c) => c.weight > 0)) throw new Error('component weights must have a positive total');
  }
  // The weapon families/types a weapon-typed card keeps; any other deals types[0] (owner #19).
  if (attack.weaponDamage !== undefined) {
    const { families, types, ...rest } = attack.weaponDamage || {};
    if (Object.keys(rest).length) throw new Error(`unknown attack.weaponDamage field '${Object.keys(rest)[0]}'`);
    if (!Array.isArray(families) || !families.length || families.some((f) => typeof f !== 'string' || (rules && !(f in rules.impact.family)))) throw new Error('attack.weaponDamage.families must name known source families');
    if (!Array.isArray(types) || !types.length || types.some((t) => typeof t !== 'string' || (rules && !rules.damageTypes[t]))) throw new Error('attack.weaponDamage.types must name known damage types');
    if (attack.damageType) throw new Error('attack.weaponDamage cannot sit beside a fixed damageType');
    // Beside components, exactly one component is the weapon's part (owner #24).
    if (attack.components && attack.components.filter((c) => types.includes(c.type)).length !== 1) {
      throw new Error('attack.weaponDamage beside components needs exactly one component of its types');
    }
  }
  if (attack.hitWeights !== undefined) {
    if (!Array.isArray(attack.hitWeights) || !attack.hitWeights.length) throw new Error('hitWeights must be nonempty');
    attack.hitWeights.forEach((w) => assertNumber(w, 'hitWeights'));
    if (!attack.hitWeights.some((w) => w > 0)) throw new Error('hitWeights require positive total');
  }
}

export function validateSource(source, rules) {
  if (!source || typeof source.id !== 'string') throw new Error('attack source requires id');
  if (source.sourceType !== undefined && !['weapon', 'spell', 'unarmed'].includes(source.sourceType)) throw new Error(`${source.id}: invalid sourceType`);
  assertNumber(source.weight, `${source.id}.weight`);
  if (!(source.family in rules.impact.family)) throw new Error(`${source.id}: unknown family '${source.family}'`);
  if (!(source.grip in rules.impact.grip)) throw new Error(`${source.id}: unknown grip '${source.grip}'`);
  if (!(source.damageType in rules.damageTypes)) throw new Error(`${source.id}: unknown damage type '${source.damageType}'`);
  if (source.tags !== undefined && (!Array.isArray(source.tags) || source.tags.some((tag) => typeof tag !== 'string'))) throw new Error(`${source.id}: tags must be strings`);
  try { attackDescriptor({ tags: source.tags || [], attack: { source: source.sourceType, damageType: source.damageType } }); }
  catch (error) { throw new Error(`${source.id}: ${error.message}`); }
  for (const effect of source.buildup || []) {
    if (typeof effect.status !== 'string') throw new Error(`${source.id}: buildup requires status`);
    assertNumber(effect.amount, `${source.id}.buildup.amount`);
  }
}

export function validateCombatProfile(profile, rules) {
  if (!profile || typeof profile !== 'object') throw new Error('combat profile must be an object');
  assertNumber(profile.armor ?? 0, 'profile.armor');
  assertNumber(profile.impactResistance ?? 0, 'profile.impactResistance', 0, 1);
  for (const row of profile.resistanceSources || []) {
    if (typeof row.group !== 'string' || !row.group || !rules.damageTypes[row.type]) throw new Error('invalid resistance source group/type');
    assertNumber(row.amount, 'resistance source amount', 0, 1);
  }
  for (const [type, amount] of Object.entries(profile.resistances || {})) {
    if (!(type in rules.damageTypes)) throw new Error(`profile.resistances: unknown type '${type}'`);
    assertNumber(amount, `resistance.${type}`, 0, 1);
  }
  for (const type of profile.immunities || []) if (!(type in rules.damageTypes)) throw new Error(`unknown immunity '${type}'`);
  for (const source of Object.values(profile.sources || {})) validateSource(source, rules);
  if (profile.weightClass && !(profile.weightClass in rules.dodge.stamina)) throw new Error('unknown profile weight class');
}


/** Stable largest-remainder allocation, conserving a single integer budget. */
export function allocateInteger(total, weights) {
  assertNumber(total, 'allocation.total');
  if (!weights.length) return [];
  weights.forEach((w) => assertNumber(w, 'allocation.weight'));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error('allocation requires positive total weight');
  const raw = weights.map((w) => Math.floor(total) * w / sum);
  const result = raw.map(Math.floor);
  const order = raw.map((v, i) => ({ i, fraction: v - result[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  let remainder = Math.floor(total) - result.reduce((a, b) => a + b, 0);
  for (const { i } of order) if (remainder-- > 0) result[i]++;
  return result;
}

/**
 * taggedBonusFloor(x, tagged) — a hit's integer damage when `x` is its
 * pre-rounding damage without tag-scoped vulnerability and `tagged` the
 * matched exposure factor (owner, 2026-10-12, #12): the plain part floors as
 * every other multiplier does, the exposure bonus rounds UP, so a base-3
 * starstone card still gains a point on a Frost-Exposed target. Never below
 * floor(x × tagged), the old all-floor result. tagged ≤ 1 floors as before.
 */
export function taggedBonusFloor(x, tagged = 1) {
  if (!(tagged > 1) || !(x > 0)) return Math.floor(x * tagged);
  return Math.floor(x) + Math.ceil(x * (tagged - 1) - 1e-9);
}




