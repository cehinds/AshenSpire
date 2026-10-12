import { combatProfileFor } from './combatCardProfile.js';

export const REAVER_GREATSWORD_PILOT = 'reaver-greatsword-pilot';

/** A presentation opt-in from the active hands, never the class's starter weapon. */
export function selectedWeaponProfileFor({ classId, armourId, grip } = {}) {
  if (classId !== 'reaver' || armourId !== 'default' || grip?.mode !== 'two') return null;
  return (grip.right === 'greatsword' && !grip.left) || (grip.left === 'greatsword' && !grip.right)
    ? REAVER_GREATSWORD_PILOT : null;
}

function preparesEvade(card) {
  const profile = combatProfileFor(card);
  // utility.evasion's authored pure-dodge marker survives the no-roll guard rewrite.
  // A ranged attack with an evade rider keeps its ranged action identity.
  return profile.camp === 'physical' && profile.maneuver === 'defend'
    && (card.weightClassPriced === true || card.effects?.some(effect => effect.op === 'dodgeRoll') || !!profile.evade);
}

function evadeReady(entity) {
  const prepared = entity?.combatEvade;
  const status = prepared?.whileStatus && entity.statuses?.[prepared.whileStatus];
  return entity?.evade > 0 || (prepared?.charges > 0
    && (!prepared.whileStatus || (status?.stacks > 0 && status.duration !== 0))
    && (prepared.expiresOnOwnerCycle === undefined || (entity.combatOwnerCycle || 0) < prepared.expiresOnOwnerCycle));
}

/** Resolve art only; the receipt ledger and authored glyph retain their identity. */
export function selectedWeaponStanceFor({ profile, stance, card, entity } = {}) {
  if (profile !== REAVER_GREATSWORD_PILOT || entity?.alive === false) return stance;
  // An armed or last-confirmed action wins over leftover readiness from an older card.
  if (card) return preparesEvade(card) ? 'evade' : stance;
  return evadeReady(entity) ? 'evade' : stance;
}

/** Only actual target outcomes earn a finite body reaction. */
export function selectedWeaponReactionFor(event, profile) {
  if (profile !== REAVER_GREATSWORD_PILOT || event?.targetId !== 'player') return null;
  if (event.type === 'combatGuardBroken') return 'guard-break';
  if (event.type === 'attackEvaded' || (event.type === 'combatAvoidanceResolved' && event.avoided && event.evade?.success)) return 'evade';
  return null;
}
