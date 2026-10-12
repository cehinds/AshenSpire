import { combatProfileFor } from './combatCardProfile.js';
import { isPureDodge } from '../framework/importer.js';

export const REAVER_GREATSWORD_PILOT = 'reaver-greatsword-pilot';

/** A presentation opt-in from the active hands, never the class's starter weapon. */
export function selectedWeaponProfileFor({ classId, armourId, grip } = {}) {
  // The attack-v1 greatsword package has no handsRequired, so the real starter
  // projects mode "one". Both canonical single-weapon modes use this reviewed
  // selected painting; an occupied other hand still excludes the pilot.
  if (classId !== 'reaver' || armourId !== 'default' || !['one', 'two'].includes(grip?.mode)) return null;
  return (grip.right === 'greatsword' && !grip.left) || (grip.left === 'greatsword' && !grip.right)
    ? REAVER_GREATSWORD_PILOT : null;
}

function preparesEvade(card) {
  const profile = combatProfileFor(card);
  if (profile.camp !== 'physical') return false;
  // Expanded pure Dodge is typed Counter; its canonical authored marker still
  // chooses this preparation painting. Mixed counters keep their Counter pose.
  return isPureDodge(card) || (profile.maneuver === 'defend'
    && (card.effects?.some(effect => effect.op === 'dodgeRoll') || !!profile.evade));
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
  const held = ['defensive', 'defend', 'immune'].includes(stance) ? 'defend' : stance;
  if (card) return preparesEvade(card) ? 'evade' : held;
  return evadeReady(entity) ? 'evade' : held;
}

/** Only actual target outcomes earn a finite body reaction. */
export function selectedWeaponReactionFor(event, profile) {
  if (profile !== REAVER_GREATSWORD_PILOT || event?.targetId !== 'player') return null;
  if (event.type === 'combatGuardBroken') return 'guard-break';
  if (event.type === 'attackEvaded' || (event.type === 'combatAvoidanceResolved' && event.avoided && event.evade?.success)) return 'evade';
  if (event.type === 'combatAvoidanceResolved' && event.avoided === true
    && event.prevention === 'invulnerability') return 'defend';
  if (event.type === 'damageDealt' && event.isAttack === true
    && event.sourceId && event.sourceId !== event.targetId) {
    const { amount, blocked, wardResisted = 0 } = event;
    // Expanded amount is AFTER resistance/Ward, BEFORE Block/Barrier. Adding
    // wardResisted reconstructs positive incoming damage, never the HP loss:
    // a partly resisted attack that still hurts must keep its normal hurt art.
    if ([amount, blocked, wardResisted].every(value => Number.isFinite(value) && value >= 0)
      && amount === blocked && amount + wardResisted > 0) return 'fully-defended';
  }
  return null;
}
