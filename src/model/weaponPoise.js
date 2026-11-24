// src/model/weaponPoise.js — JSON-configured inherent weapon poise damage and stance-gated poise mitigation helpers.
import { GEAR_TYPES } from '../content/gearTypes.js';
import { FixCoreWeaponPoiseRules } from './fixCoreMechanics.js';
import { configuredStance } from './profileStance.js';

const STANCE_ALIASES = Object.freeze({ casting: 'prepared', cast: 'prepared', spell: 'prepared', ranged: 'attack', evade: 'defend', guard: 'defend' });

export function CanonicalPoiseStance(stance) {
  if (!stance) return 'neutral';
  return STANCE_ALIASES[stance] || stance;
}

/** True when `defendingStance` grants Poise damage reduction under the active JSON poise rules. */
export function StanceHasPoiseMitigation(rules, defendingStance) {
  if (!rules || !Array.isArray(rules.mitigationStances)) return false;
  const canonical = CanonicalPoiseStance(defendingStance);
  return rules.mitigationStances.some(s => CanonicalPoiseStance(s) === canonical);
}

/** Resolve the attacking weapon id and type for `source` and `carrier`. */
export function ResolveWeaponForPoise(ctx, source, carrier = null) {
  if (source?.kind === 'enemy') return { weaponId: null, weaponType: null };
  const weaponId = carrier?.sourceArmamentId || carrier?.usedArmamentId
    || ctx?.loadout?.rightHand || ctx?.loadout?.leftHand || null;
  const weaponType = (weaponId && GEAR_TYPES.items?.[weaponId])
    || source?.itemProps?.mainWeaponType
    || (ctx?.loadout?.rightHand && GEAR_TYPES.items?.[ctx.loadout.rightHand])
    || (ctx?.loadout?.leftHand && GEAR_TYPES.items?.[ctx.loadout.leftHand])
    || null;
  return { weaponId, weaponType };
}

/** Base inherent poise damage of the attacking weapon (including natural sceptre/bow/staff +20% multiplier). */
export function BaseWeaponPoiseDamage(ctx, source, carrier = null, rulesOverride = null) {
  const rules = rulesOverride || FixCoreWeaponPoiseRules(ctx);
  if (!rules) return { base: 0, typeMultiplier: 1, raw: 0, amount: 0, weaponId: null, weaponType: null };
  if (source?.kind === 'enemy') {
    const base = Math.max(0, Number(rules.enemyWeaponPoise ?? rules.defaultWeaponPoise ?? 1) || 0);
    return { base, typeMultiplier: 1, raw: base, amount: base > 0 ? Math.ceil(base - 1e-9) : 0, weaponId: null, weaponType: null };
  }
  const { weaponId, weaponType } = ResolveWeaponForPoise(ctx, source, carrier);
  const authoredItem = weaponId != null ? GEAR_TYPES.itemPoiseDamage?.[weaponId] : undefined;
  const authoredType = weaponType != null ? GEAR_TYPES.weaponTypes?.[weaponType]?.poiseDamage : undefined;
  const base = Number.isFinite(authoredItem) ? Math.max(0, authoredItem)
    : Number.isFinite(authoredType) ? Math.max(0, authoredType)
    : Math.max(0, Number(rules.defaultWeaponPoise ?? 2) || 0);
  const typeMult = weaponType && Number.isFinite(rules.weaponTypePoiseMultiplier?.[weaponType])
    ? rules.weaponTypePoiseMultiplier[weaponType]
    : 1;
  const raw = base * typeMult;
  return { base, typeMultiplier: typeMult, raw, amount: raw > 0 ? Math.ceil(raw - 1e-9) : 0, weaponId, weaponType };
}

/**
 * WeaponPoiseDamage(ctx, source, target, carrier, opts) -> full per-hit weapon poise damage.
 * Applies natural weapon type multiplier (sceptre/bow/staff +20%), Smash (1.25x), and Smash vs Guarding/Defend (2x).
 */
export function WeaponPoiseDamage(ctx, source, target, carrier = null, { attacking = null, defending = null, rules = null } = {}) {
  const active = rules || FixCoreWeaponPoiseRules(ctx);
  if (!active) return { amount: 0, baseAmount: 0, raw: 0, weaponId: null, weaponType: null, smashMultiplier: 1 };
  const baseInfo = BaseWeaponPoiseDamage(ctx, source, carrier, active);
  const atk = CanonicalPoiseStance(attacking || configuredStance(carrier));
  const def = CanonicalPoiseStance(defending ?? target?.combatStance?.maneuver ?? 'neutral');
  const isSmash = atk === 'smash' || carrier?.combatProfile?.maneuver === 'smash';
  const isGuarding = def === 'defend';
  const smashMultiplier = isSmash
    ? (isGuarding ? (active.smashVsGuardingPoiseMultiplier ?? 2) : (active.smashPoiseMultiplier ?? 1.25))
    : 1;
  const raw = baseInfo.raw * smashMultiplier;
  const amount = raw > 0 ? Math.ceil(raw - 1e-9) : 0;
  return {
    amount,
    baseAmount: baseInfo.amount,
    raw,
    weaponId: baseInfo.weaponId,
    weaponType: baseInfo.weaponType,
    smashMultiplier,
  };
}
