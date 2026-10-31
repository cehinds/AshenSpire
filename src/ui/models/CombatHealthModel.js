import { t, tFull } from '../strings.js';
import { mechanics } from '../../framework/data/mechanics.js';
import { reflectReduceFraction, reflectReturnFraction } from '../../engine/guardStacks.js';
import { healthGuardTone } from '../../model/blockPresentation.js';
// Presentation only: callers supply the live protection values. HP fill
// always represents health, never protection added to the health numerator.
// Defense badges read Block (the Defense badge, owner 2026-10-18), Evade, Precision, Poise and Ward before HP. Poise also
// retains its gold HP trim and value/max accessible label.
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function combatHealthModel({ defense = 0, ward = 0, barrier = 0, poise = 0, poiseMax = 0, wardPool, wardBlock = 0, evasion = null, precision = null, counterStacks = 0, reflectStacks = 0 } = {}) {
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
      ...(shield > 0 ? [{ kind: 'shield', label: t('combat.protection.block'), value: shield }] : []),
      ...(Number.isFinite(evasion) && count(evasion) > 0 ? [{ kind: 'evade', label: t('card.tags.evade'), value: count(evasion) }] : []),
      ...(Number.isFinite(precision) && count(precision) > 0 ? [{ kind: 'precision', label: t('card.tags.precision'), value: count(precision) }] : []),
      // Counter and Reflect stacks (owner 2026-10-31): plain counts on the entity, shown only while above zero.
      ...(count(counterStacks) > 0 ? [{ kind: 'counter', label: t('combat.protection.counter'), value: count(counterStacks),
        help: tFull('combat.protection.counter', { stacks: count(counterStacks), decay: mechanics.counter.decayPerTurn }) }] : []),
      ...(count(reflectStacks) > 0 ? [{ kind: 'reflect', label: t('combat.protection.reflect'), value: count(reflectStacks),
        help: tFull('combat.protection.reflect', { reduce: Math.round(100 * reflectReduceFraction(count(reflectStacks))), back: Math.round(100 * reflectReturnFraction(count(reflectStacks))) }) }] : []),
      ...(poised > 0 ? [{ kind: 'poise', label: t('combat.protection.poise'), value: poised }] : []),
      ...(arcaneWard > 0 ? [{ kind: 'ward', label: t('combat.protection.ward'), value: arcaneWard, barrier: charged, wardBlock: warded }] : []),
    ],
  });
}
