import { t } from '../strings.js';
import { healthGuardTone } from '../../model/blockPresentation.js';
// Presentation only: callers supply the live protection values. HP fill
// always represents health, never protection added to the health numerator.
// Defense badges read Evade, Poise, Ward and Block before HP. Poise also
// retains its gold HP trim and value/max accessible label.
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function combatHealthModel({ defense = 0, ward = 0, barrier = 0, poise = 0, poiseMax = 0, wardPool, wardBlock = 0, evasion = null } = {}) {
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
      ...(Number.isFinite(evasion) ? [{ kind: 'evade', label: t('card.tags.evade'), value: count(evasion) }] : []),
      ...(poised > 0 ? [{ kind: 'poise', label: t('combat.protection.poise'), value: poised }] : []),
      ...(arcaneWard > 0 ? [{ kind: 'ward', label: t('combat.protection.ward'), value: arcaneWard, barrier: charged, wardBlock: warded }] : []),
      ...(shield > 0 ? [{ kind: 'shield', label: t('combat.protection.block'), value: shield }] : []),
    ],
  });
}
