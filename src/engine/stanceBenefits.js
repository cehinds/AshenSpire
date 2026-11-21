// Stance natural benefits (owner, 2026-11-14, Wave 2.5): each stance gives its holder one benefit on top of the matchup table, which is unchanged.
// The numbers are data (content/source/fixCoreMechanics.json, `stanceBenefits`); this module is one function per hook and owns no state.
// A fight snapshots its rules at creation, so a fight (or run) created before this ruling has no `stanceBenefits` block and every function here
// answers "no benefit". Headless: no document, window or timers; no RNG.
//
//   attack     attacks deal +20% damage                          AttackDamageMultiplier  (profileDamageReceipt, after matching stance)
//   prepared   spells deal +25% damage (chosen over the Mana discount)   AttackDamageMultiplier
//   smash      +50% Poise damage                                 PoiseLossAdjust         (profileDamageReceipt, before the receipt returns)
//   defend     +50% Block gained, -25% Poise damage taken        BlockGainMultiplier (computeBlockGain), PoiseLossAdjust
//              while it holds Block, Poise stays at 1 or more against physical hits and Sweeps (and magic with Ward stacks)  DefendPoiseFloor (2026-11-17)
//   counter    +25% Block gained (BlockGainMultiplier); a saved fight with `hpReturnFraction` also returns that share of the HP lost (CounterReturnAmount); none ships since 2026-11-15
//   sweep      an attack also hits every other enemy in range at 50%   SweepSplashTargets / SplashCarrier (the damage effect, actions.js)
//   neutral    the player draws 1 extra card at its next turn start   NeutralExtraDraw (startPlayerTurn)
// Stance weaknesses (owner 2026-11-17, theme B): a target in Prepared takes x1.25 from melee hits, one in Idle (no stance) x1.25 from every hit.
//              StanceWeaknessMultiplier (profileDamageReceipt, an offense stage)
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { FightMagicShare } from '../model/elementIdentityRules.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { stanceOf } from '../model/stanceRules.js';
import { configuredStance } from '../model/profileStance.js';
import { magicShareOf, isMagicalAttack } from '../model/combatRatings.js';
import * as Engagement from './combatEngagement.js';

const ALIASES = Object.freeze({ casting: 'prepared', cast: 'prepared', spell: 'prepared', ranged: 'attack', evade: 'defend' });
const count = value => Number.isFinite(value) ? value : 0;
const PHYSICAL_POISE = Object.freeze({ combatProfile: Object.freeze({ camp: 'physical' }) });

/** The `stanceBenefits` block this fight plays under, or null (not Core 2, or a fight created before the ruling). */
export function StanceBenefitRules(ctx) {
  if (!fixCoreEnabled(ctx)) return null;
  const rows = fixCoreRules(ctx)?.stanceBenefits;
  return rows?.version === 1 ? rows : null;
}

/** The stance a unit acts from: the card or move it plays when that carries a stance (playing it enters it), else the stance it holds, else neutral. */
export function HeldStance(entity, carrier = null) {
  const entered = carrier && stanceOf(carrier, entity) ? configuredStance(carrier) : null;
  const held = entered || entity?.combatStance?.maneuver || 'neutral';
  return ALIASES[held] || held;
}

const isReturn = carrier => !!(carrier?.counterReturnAttack || carrier?.reflectedHit);

/** Attack +20%, Prepared +25%: the multiplier on a hit's damage before the defender's stance, Block and Poise. 1 for a return hit. */
export function AttackDamageMultiplier(ctx, source, carrier) {
  const rules = StanceBenefitRules(ctx);
  if (!rules || isReturn(carrier)) return 1;
  return count(rules[HeldStance(source, carrier)]?.damageMultiplier) || 1;
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
  const stance = ALIASES[defendingStance] || defendingStance || 'neutral';
  if (stance === 'prepared' && HitRange(profile) === 'melee') return count(rules.prepared?.meleeDamageTakenMultiplier) || 1;
  if (stance === 'neutral' || stance === 'idle') return count(rules.neutral?.damageTakenMultiplier) || 1;
  return 1;
}

/** Counter +25%, Defend +50%: the multiplier on the Block a card or turn-start protection grants. */
export function BlockGainMultiplier(ctx, entity, card = null) {
  const rules = StanceBenefitRules(ctx);
  return rules ? count(rules[HeldStance(entity, card)]?.blockMultiplier) || 1 : 1;
}

/**
 * The Poise a hit costs beyond what the receipt already took. `taken` is what the hit already costs the pool (absorbed + drained), `pool` the Poise the
 * target holds. Smash adds poiseDamageBonus of it (capped at what the pool still holds); a Defend target then spares poiseDamageTakenMultiplier's complement
 * of the total (the absorption itself is unchanged, so the HP the hit costs is not).
 * Returns { extra, spared }: add `extra` to the drain; the pool loses taken + extra - spared.
 */
export function PoiseLossAdjust(ctx, source, carrier, defendingStance, { taken = 0, pool = 0 } = {}) {
  const rules = StanceBenefitRules(ctx);
  if (!rules || isReturn(carrier) || !(taken > 0)) return { extra: 0, spared: 0 };
  const bonus = count(rules[HeldStance(source, carrier)]?.poiseDamageBonus);
  const extra = bonus > 0 ? Math.max(0, Math.min(Math.floor(bonus * taken), Math.floor(pool) - taken)) : 0;
  const keep = rules[ALIASES[defendingStance] || defendingStance]?.poiseDamageTakenMultiplier;
  const spared = Number.isFinite(keep) && keep < 1 ? Math.min(taken + extra, Math.floor((1 - keep) * (taken + extra))) : 0;
  return { extra, spared };
}

/** A hit of magic: a spell-camp carrier, or one with a magic share or a magic school (the same test that makes a hit read PR). */
function magicHit(ctx, carrier) {
  const profile = { ...(carrier?.combatProfile || {}), ...(Number.isFinite(carrier?.magicShare) ? { magicShare: carrier.magicShare } : {}) };
  return profile.camp === 'spell' || FightMagicShare(ctx, profile) > 0 || (!!ctx?.registries?.cards && isMagicalAttack(ctx, carrier));
}

/**
 * Defend (owner 2026-11-17, theme B): the least Poise a hit or a Poise rider leaves a Defend-stance target that holds Block (`blockBefore`, the
 * Block it held when the hit arrived). A physical hit or a Sweep cannot take it below `poiseFloorWhileBlock` (1); a Smash always can; a magic hit
 * can, unless the target also holds Ward stacks and `poiseFloorWardMagic` is set. 0 when no floor applies (no Block, another stance, a return hit,
 * or a fight saved without the key).
 */
export function DefendPoiseFloor(ctx, target, carrier, defendingStance, blockBefore = target?.block || 0) {
  const rules = StanceBenefitRules(ctx)?.defend;
  const floor = Math.max(0, Math.floor(count(rules?.poiseFloorWhileBlock)));
  // Poise damage with no card of its own (a relic, a trigger) is physical: it keeps the floor too (owner decision, 2026-11-17).
  carrier = carrier || PHYSICAL_POISE;
  if (!floor || isReturn(carrier) || (ALIASES[defendingStance] || defendingStance) !== 'defend' || !(blockBefore > 0)) return 0;
  if (configuredStance(carrier) === 'smash' || carrier?.combatProfile?.maneuver === 'smash') return 0;
  if (magicHit(ctx, carrier) && !(count(rules.poiseFloorWardMagic) > 0 && (target?.statuses?.ward?.stacks || 0) > 0)) return 0;
  return floor;
}

/**
 * Applies DefendPoiseFloor to a damage receipt whose pool loss is poiseMitigated + poiseDrain - poiseSpared: the target keeps
 * min(pool, floor) Poise, so poise = max(poise - poiseDamage, 1). The extra Poise kept is added to poiseSpared; HP is unchanged.
 */
export function ApplyDefendPoiseFloor(ctx, target, carrier, receipt) {
  if (!receipt || receipt.evaded) return receipt;
  const floor = DefendPoiseFloor(ctx, target, carrier, receipt.defenseStance);
  const pool = Math.max(0, Math.floor(target?.persistentPoise?.value || 0));
  const keep = Math.min(pool, floor);
  const left = pool - (receipt.poiseMitigated || 0) - (receipt.poiseDrain || 0) + (receipt.poiseSpared || 0);
  if (!(keep > 0) || left >= keep) return receipt;
  receipt.poiseSpared = (receipt.poiseSpared || 0) + (keep - left);
  receipt.defendPoiseFloor = keep;
  return receipt;
}

/** Counter: the HP an attacker takes back from a hit that cost its Counter-stance target `hpLoss` HP (0 when fully blocked, or for a return hit). */
export function CounterReturnAmount(ctx, defendingStance, hpLoss, carrier) {
  const rules = StanceBenefitRules(ctx);
  if (!rules || isReturn(carrier) || !(hpLoss > 0)) return 0;
  return Math.floor(count(rules[ALIASES[defendingStance] || defendingStance]?.hpReturnFraction) * hpLoss);
}

/** Sweep: the share of its damage a hit also deals to every other enemy in range (0 for a splash hit itself, or any other stance). */
export function SweepSplashFraction(ctx, source, carrier) {
  const rules = StanceBenefitRules(ctx);
  if (!rules || isReturn(carrier) || carrier?.stanceSplash) return 0;
  return count(rules[HeldStance(source, carrier)]?.splashFraction);
}

/**
 * The OTHER hostile entities a Sweep hit also strikes: alive, not the primary target, on the primary's side, and inside the band the card can reach
 * (the same contact the hit itself uses, priced without the play's committed range plan). `candidates` is the primary's side, supplied by the caller.
 */
export function SweepSplashTargets(ctx, source, primary, carrier, candidates) {
  if (!primary || !source || primary.kind === source.kind || !(SweepSplashFraction(ctx, source, carrier) > 0)) return [];
  const probe = { ...carrier };
  delete probe.rangePlan; delete probe.rangeContactId;
  return candidates.filter(other => other && other !== primary && other !== source && other.alive && other.kind === primary.kind
    && (Engagement.rangeHitContact(ctx, source, other, probe)?.inRange ?? true));
}

/** The carrier a splash hit travels as: no committed contact, range plan or crit of the main hit, and the fraction its damage carries. */
export function SplashCarrier(ctx, source, carrier) {
  // A splash hit carries no flat break (Smash's breakBlock / breakPoise hit only the aimed target).
  const { rangePlan, rangeContactId, expansionGroup, expansionContact, manualCounterSerial, critMultiplier, breakBlock, breakPoise, ...rest } = carrier;
  return { ...rest, stanceSplash: SweepSplashFraction(ctx, source, carrier), proposalTargetDecisions: {}, combatRiderTargets: [] };
}

/** Neutral: the extra cards a player draws at a turn start when it holds no stance. The first turn has no earlier turn to have rested in. */
export function NeutralExtraDraw(ctx, entity, turn) {
  const rules = StanceBenefitRules(ctx);
  if (!rules || entity?.kind !== 'player' || !(turn > 1)) return 0;
  return HeldStance(entity) === 'neutral' ? Math.max(0, Math.floor(count(rules.neutral?.extraDrawNextTurn))) : 0;
}
