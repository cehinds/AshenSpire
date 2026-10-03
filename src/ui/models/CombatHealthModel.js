import { t } from '../strings.js';
// Presentation only: callers supply the two live protection values. HP fill
// always represents health, never protection added to the health numerator.
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function combatHealthModel({ defense = 0, ward = 0 } = {}) {
  const shield = count(defense);
  const arcaneWard = count(ward);
  return Object.freeze({
    shield, ward: arcaneWard,
    protected: shield > 0,
    warded: arcaneWard > 0,
    badges: [
      ...(arcaneWard > 0 ? [{ kind: 'ward', label: t('combat.protection.ward'), value: arcaneWard }] : []),
      ...(shield > 0 ? [{ kind: 'shield', label: t('combat.protection.block'), value: shield }] : []),
    ],
  });
}
