import { t } from '../strings.js';
import { healthGuardTone } from '../../model/blockPresentation.js';
// Presentation only: callers supply the two live protection values. HP fill
// always represents health, never protection added to the health numerator.
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function combatHealthModel({ defense = 0, ward = 0, barrier = 0, poise = 0, wardPool } = {}) {
  const shield = count(defense);
  const arcaneWard = count(ward);
  const charged = count(barrier);
  const poised = count(poise);
  // Without the Barrier-free pool, the badge total less Barrier is the Ward pool.
  const pool = wardPool === undefined ? Math.max(0, arcaneWard - charged) : count(wardPool);
  return Object.freeze({
    shield, ward: arcaneWard, barrier: charged, poise: poised,
    guard: healthGuardTone({ barrier: charged, defense: shield, wardPool: pool }),
    protected: shield > 0,
    warded: arcaneWard > 0,
    badges: [
      ...(arcaneWard > 0 ? [{ kind: 'ward', label: t('combat.protection.ward'), value: arcaneWard, barrier: charged }] : []),
      ...(poised > 0 ? [{ kind: 'poise', label: t('combat.protection.poise'), value: poised }] : []),
      ...(shield > 0 ? [{ kind: 'shield', label: t('combat.protection.block'), value: shield }] : []),
    ],
  });
}
