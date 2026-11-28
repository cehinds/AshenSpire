// The live combat-expansion posture of one fighter, as display rows: the
// combat stance its last accepted play or telegraph set (entity.combatStance)
// and the Evade it has prepared (entity.combatEvade). DOM-free, so the status
// rail, the active-skills list and the inspector read one answer.
import { ACTION_SIGILS } from '../content/combatSigils.js';
import { helpText } from './tooltipSettings.js';
import { FIXCORE_BROKEN_DAMAGE_MULTIPLIER } from './fixCoreMechanics.js';
import { UiShortText, UiFullText } from './strings.js';

// Display-only id, kind and maneuver every stance row carries.
const STANCE_ROW_ID = 'combat-stance';
const STANCE_ROW_KIND = 'stance';
const STAGGERED_MANEUVER = 'staggered';
// A Broken multiplier of 1 means the break's statuses do the work, so the row names none.
const NO_EXTRA_DAMAGE = 1;
const DETAIL_SEPARATOR = ' ';
const POSTURE_SEPARATOR = ' · ';
const STANCE_STRINGS = Object.freeze(
  {
    broken: 'combat.stanceRow.broken',
    brokenByStatuses: 'poise.broken.stanceRow',
    staggered: 'combat.stanceRow.staggered',
    staggeredStamina: 'combat.stanceRow.staggeredStamina',
    staggeredVulnerable: 'combat.stanceRow.staggeredVulnerable',
    staggeredHolds: 'combat.stanceRow.staggeredHolds',
    active: 'combat.stanceRow.active',
  },
);

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

function stanceRow(maneuver, name, detail)
{
  return {
    id: STANCE_ROW_ID,
    kind: STANCE_ROW_KIND,
    maneuver,
    name,
    detail,
  };
}

function joinDetail(parts, separator = DETAIL_SEPARATOR)
{
  return parts.filter(Boolean).join(separator);
}

function brokenRow(stance)
{
  const multiplier = stance.damageMultiplier ?? FIXCORE_BROKEN_DAMAGE_MULTIPLIER;
  const detail = multiplier === NO_EXTRA_DAMAGE
    ? UiFullText(STANCE_STRINGS.brokenByStatuses)
    : UiFullText(STANCE_STRINGS.broken, { multiplier });
  return stanceRow(STAGGERED_MANEUVER, UiShortText(STANCE_STRINGS.broken), detail);
}

function staggeredRow(stance)
{
  const staminaLine = stance.staminaLoss > 0
    ? UiFullText(STANCE_STRINGS.staggeredStamina, { stamina: stance.staminaLoss })
    : '';
  const vulnerableLine = stance.vulnerableStacks > 0
    ? UiFullText(STANCE_STRINGS.staggeredVulnerable, { stacks: stance.vulnerableStacks })
    : '';
  const detail = joinDetail(
    [
      UiFullText(STANCE_STRINGS.staggered),
      staminaLine,
      vulnerableLine,
      UiFullText(STANCE_STRINGS.staggeredHolds),
    ],
  );
  return stanceRow(STAGGERED_MANEUVER, UiShortText(STANCE_STRINGS.staggered), detail);
}

function activeStanceRow(stance)
{
  const sigil = ACTION_SIGILS[stance.maneuver];
  const label = sigil?.label || titleCase(stance.maneuver);
  const reach = stance.reach && `${titleCase(stance.reach)} reach`;
  const posture = joinDetail(
    [
      titleCase(stance.school || stance.camp),
      reach,
    ],
    POSTURE_SEPARATOR,
  );
  const detail = joinDetail(
    [
      sigil?.help,
      posture && `${posture}.`,
      UiFullText(STANCE_STRINGS.active),
    ],
  );
  return stanceRow(stance.maneuver, UiShortText(STANCE_STRINGS.active, { label }), detail);
}

/** One inspector row naming the stance's maneuver, camp and reach. */
export function combatStanceRow(entity)
{
  const stance = activeCombatStance(entity);
  if (!stance)
  {
    return null;
  }
  if (stance.broken)
  {
    return brokenRow(stance);
  }
  if (stance.staggered)
  {
    return staggeredRow(stance);
  }
  return activeStanceRow(stance);
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
