// The live combat-expansion posture of one fighter, as display rows: the
// combat stance its last accepted play or telegraph set (entity.combatStance)
// and the Evade it has prepared (entity.combatEvade). DOM-free, so the status
// rail, the active-skills list and the inspector read one answer.
import { ACTION_SIGILS } from '../content/combatSigils.js';
import { helpText } from './tooltipSettings.js';

const titleCase = value => String(value || '').replace(/\b\w/g, letter => letter.toUpperCase());

/** Charges of a prepared Evade that can still answer an attack, or 0. */
export function preparedEvadeCharges(entity) {
  const prepared = entity?.combatEvade;
  if (!(prepared?.charges > 0)) return 0;
  if (prepared.whileStatus) {
    const status = entity.statuses?.[prepared.whileStatus];
    if (!(status?.stacks > 0) || status.duration === 0) return 0;
  }
  if (prepared.expiresOnOwnerCycle !== undefined && (entity.combatOwnerCycle || 0) >= prepared.expiresOnOwnerCycle) return 0;
  return Math.floor(prepared.charges);
}

/** The active combat stance, or null once it has expired or was never set. */
export function activeCombatStance(entity) {
  const stance = entity?.combatStance;
  if (!stance?.maneuver) return null;
  if (stance.expiresOnOwnerCycle != null && (entity.combatOwnerCycle || 0) >= stance.expiresOnOwnerCycle) return null;
  return stance;
}

/** One inspector row naming the stance's maneuver, camp and reach. */
export function combatStanceRow(entity) {
  const stance = activeCombatStance(entity);
  if (!stance) return null;
  const sigil = ACTION_SIGILS[stance.maneuver];
  const label = sigil?.label || titleCase(stance.maneuver);
  const posture = [titleCase(stance.school || stance.camp), stance.reach && `${titleCase(stance.reach)} reach`].filter(Boolean).join(' · ');
  return {
    id: 'combat-stance', kind: 'stance', maneuver: stance.maneuver,
    name: `${label} stance`,
    detail: [sigil?.help, posture && `${posture}.`, 'Holds until a new action sets another stance.'].filter(Boolean).join(' '),
  };
}

/** One row for a prepared Evade: "Evade ×N", with its charge rules. */
export function preparedEvadeRow(entity) {
  const charges = preparedEvadeCharges(entity);
  if (!charges) return null;
  return {
    id: 'combat-evade', kind: 'evade', charges,
    name: `Evade ×${charges}`,
    detail: helpText('evade', { count: charges, charges: helpText(charges === 1 ? 'charge' : 'charges') }),
  };
}

/** Stance first, then Evade: the order the active list reads them. */
export function combatTacticsRows(entity) {
  return [combatStanceRow(entity), preparedEvadeRow(entity)].filter(Boolean);
}
