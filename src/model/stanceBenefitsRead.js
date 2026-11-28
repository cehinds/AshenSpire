// Natural stance readers shared by the live receipt and detached first-play probes.
import { fixCoreEnabled } from './fixCoreMechanics.js';
import { fixCoreRules } from './fixCoreRulesCache.js';
import { stanceOf } from './stanceRules.js';
import { configuredStance } from './profileStance.js';
import { isSpellCard } from './combatCardProfile.js';
import { SpellTraditionsActive } from './spellTraditions.js';
import { StanceBenefitsEnabled } from './simpleCombatFlags.js';

export const STANCE_ALIASES = Object.freeze({ casting: 'prepared', cast: 'prepared', spell: 'prepared', ranged: 'attack', evade: 'defend' });
const count = value => Number.isFinite(value) ? value : 0;

/** The `stanceBenefits` block this fight plays under, or null (not Core 2, or a fight created before the ruling). */
export function StanceBenefitRules(ctx) {
  if (!fixCoreEnabled(ctx)) return null;
  const rows = fixCoreRules(ctx)?.stanceBenefits;
  return rows?.version === 1 ? rows : null;
}

/** The rows each stance's own bonus reads: null when stances.builtInBenefits is off.
 * Weaknesses keep StanceBenefitRules. */
export function StanceBonusRules(ctx)
{
  if (!StanceBenefitsEnabled(ctx))
  {
    return null;
  }
  return StanceBenefitRules(ctx);
}

/** The stance a unit acts from: the card or move it plays (playing it enters it), else the
 * stance it holds, else neutral. `ctx` lets the triangle ruleset resolve the card. */
export function HeldStance(entity, carrier = null, ctx = null)
{
  const entered = carrier && stanceOf(carrier, entity, ctx)
    ? configuredStance(carrier, ctx)
    : null;
  const held = entered || entity?.combatStance?.maneuver || 'neutral';
  return STANCE_ALIASES[held] || held;
}

const isReturn = carrier => !!(carrier?.counterReturnAttack || carrier?.reflectedHit);

/**
 * The stance row whose damage bonus a hit reads: under spell traditions a Spell played into a stance (a mirrored Strike, Smash or
 * Sweep included) reads Prepared, never the basic's row; anything else reads the stance it acts from.
 */
const damageStance = (ctx, source, carrier) => SpellTraditionsActive(ctx) && isSpellCard(carrier) && stanceOf(carrier, source)
  ? 'prepared' : HeldStance(source, carrier, ctx);

/** Attack +20%, Prepared +25%: the multiplier on a hit's damage before the defender's stance, Block and Poise. 1 for a return hit. */
export function AttackDamageMultiplier(ctx, source, carrier) {
  const rules = StanceBonusRules(ctx);
  if (!rules || isReturn(carrier)) return 1;
  return count(rules[damageStance(ctx, source, carrier)]?.damageMultiplier) || 1;
}

/**
 * The range a hit is delivered at: its authored range, else the engine's default for a card or move that names none (expandedEnemyMove,
 * combatCardTactics.js; applyExpandedDamage reads a missing range as melee too): a Ranged maneuver or a spell reaches, everything else is melee.
 * So core.strike and core.smash, which name no range, are melee.
 */
export const HitRange = (profile = {}) => profile?.range || (profile?.maneuver === 'ranged' || profile?.camp === 'spell' ? 'reach' : 'melee');

/**
 * Stance weakness (owner 2026-11-17, theme B): the multiplier on a hit against a target holding `defendingStance`. Prepared takes
 * `prepared.meleeDamageTakenMultiplier` from a melee hit (HitRange); Idle (no stance, 'neutral') takes `neutral.damageTakenMultiplier` from every hit.
 * 1 for a return hit, another stance, or a fight saved without the key.
 */
export function StanceWeaknessMultiplier(ctx, carrier, defendingStance, profile = carrier?.combatProfile, target = null) {
  const rules = StanceBenefitRules(ctx);
  // A preview whose target's intent cannot be read hides its stance (combat.js previewCard): unknown is no weakness, never Idle.
  if (!rules || isReturn(carrier) || target?.combatStanceUnknown) return 1;
  const stance = STANCE_ALIASES[defendingStance] || defendingStance || 'neutral';
  if (stance === 'prepared' && HitRange(profile) === 'melee') return count(rules.prepared?.meleeDamageTakenMultiplier) || 1;
  if (stance === 'neutral' || stance === 'idle') return count(rules.neutral?.damageTakenMultiplier) || 1;
  return 1;
}
