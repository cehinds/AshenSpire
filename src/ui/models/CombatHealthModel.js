import { t, tFull } from '../strings.js';
import { activeCombatStance } from '../../model/combatTacticsDisplay.js';
import { ACTION_SIGILS } from '../../content/combatSigils.js';
import { stanceRatingBonus } from '../../model/stanceRules.js';
import { mechanics } from '../../framework/data/mechanics.js';
import { reflectReduceFraction, reflectReturnFraction } from '../../engine/guardStacks.js';
import { healthGuardTone } from '../../model/blockPresentation.js';
// Presentation only: callers supply the live protection values. HP fill
// always represents health, never protection added to the health numerator.
// Defense badges read Block (the Defense badge, owner 2026-10-18), Evade, Precision, Poise and Ward before HP. Poise also
// retains its gold HP trim and value/max accessible label.
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function combatHealthModel({ defense = 0, ward = 0, barrier = 0, poise = 0, poiseMax = 0, wardPool, wardBlock = 0, evasion = null, precision = null, counterStacks = 0, reflectStacks = 0, stance = null } = {}) {
  const shield = count(defense);
  const arcaneWard = count(ward);
  const warded = count(wardBlock);
  const charged = count(barrier);
  const poised = count(poise);
  // Without the Barrier-free pool, the badge total less Barrier is the Ward pool.
  const pool = wardPool === undefined ? Math.max(0, arcaneWard - charged) : count(wardPool);
  return Object.freeze({
    shield, ward: arcaneWard, barrier: charged, poise: poised, poiseMax: Math.max(poised, count(poiseMax)),
    guard: healthGuardTone({ barrier: charged, defense: shield, wardPool: pool }),
    protected: shield > 0,
    warded: arcaneWard > 0,
    poised: poised > 0,
    poiseLabel: poised > 0 ? t('combat.protection.poiseValue', { value: poised, max: Math.max(poised, count(poiseMax)) }) : null,
    badges: [
      // The current combat stance (owner 2026-10-31): first in the row, only while one is set; `stance` is built by stanceBadgeFor.
      ...(stance?.maneuver ? [{ kind: 'stance', label: stance.label, value: '', glyph: stance.maneuver, tone: stance.maneuver, help: stance.help }] : []),
      ...(shield > 0 ? [{ kind: 'shield', label: t('combat.protection.block'), value: shield }] : []),
      ...(Number.isFinite(evasion) && count(evasion) > 0 ? [{ kind: 'evade', label: t('card.tags.evade'), value: count(evasion) }] : []),
      ...(Number.isFinite(precision) && count(precision) > 0 ? [{ kind: 'precision', label: t('card.tags.precision'), value: count(precision) }] : []),
      // Counter and Reflect stacks (owner 2026-10-31): plain counts on the entity, shown only while above zero.
      ...(count(counterStacks) > 0 ? [{ kind: 'counter', glyph: 'riposte', label: t('combat.protection.counter'), value: count(counterStacks),
        help: tFull('combat.protection.counter', { stacks: count(counterStacks), decay: mechanics.counter.decayPerTurn }) }] : []),
      ...(count(reflectStacks) > 0 ? [{ kind: 'reflect', label: t('combat.protection.reflect'), value: count(reflectStacks),
        help: tFull('combat.protection.reflect', { reduce: Math.round(100 * reflectReduceFraction(count(reflectStacks))), back: Math.round(100 * reflectReturnFraction(count(reflectStacks))) }) }] : []),
      ...(poised > 0 ? [{ kind: 'poise', label: t('combat.protection.poise'), value: poised }] : []),
      ...(arcaneWard > 0 ? [{ kind: 'ward', label: t('combat.protection.ward'), value: arcaneWard, barrier: charged, wardBlock: warded }] : []),
    ],
  });
}

/**
 * The stance badge's input for one fighter, or null (no stance, or not Core 2): { maneuver, label, help } with
 * help "Stance: Counter · +1 AR, +3 DR" built from the same rating bonuses the card inspector words.
 * `ctx` carries { registries, combatExpansionVersion: 2, stanceRules } as the card inspector builds it.
 */
export function stanceBadgeFor(entity, ctx) {
  const stance = activeCombatStance(entity);
  if (!stance || stance.staggered || ctx?.combatExpansionVersion !== 2) return null;
  const label = ACTION_SIGILS[stance.maneuver]?.label || String(stance.maneuver).replace(/^\w/, c => c.toUpperCase());
  const bonuses = ['ar', 'pr', 'dr', 'ward'].map(id => [id, stanceRatingBonus(ctx, { combatStance: stance }, id)])
    .filter(([, amount]) => amount > 0).map(([id, amount]) => `+${amount} ${id === 'ward' ? 'Ward' : id.toUpperCase()}`);
  return { maneuver: stance.maneuver, label, help: `Stance: ${label}${bonuses.length ? ` · ${bonuses.join(', ')}` : ''}` };
}
