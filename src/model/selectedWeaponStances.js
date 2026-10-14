import { combatProfileFor } from './combatCardProfile.js';
import { entities as frameworkEntities } from '../framework/data/entities.js';
import { cardPropertyInstances } from '../framework/importer.js';
import { isPureDodge } from '../framework/importer.js';
import { preparedEvadeCharges } from './combatTacticsDisplay.js';

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
  return entity?.evade > 0 || preparedEvadeCharges(entity) > 0;
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
  if (event.type === 'attackMissed' && event.missReason === 'accuracy'
    && (event.evadeActive || event.evadeStacks > 0)) return 'evade';
  if (event.type === 'attackEvaded' || (event.type === 'combatAvoidanceResolved' && event.avoided && event.evade?.success)) return 'evade';
  if (event.type === 'combatAvoidanceResolved' && event.avoided === true
    && event.prevention === 'invulnerability') return 'defend';
  if (event.type === 'damageDealt' && event.isAttack === true
    && event.sourceId && event.sourceId !== event.targetId) {
    // `resisted` is the whole protection before Block (typed reduction, immunity,
    // Barrier, Ward); a receipt without it carries that figure as wardResisted.
    const { amount, blocked, wardResisted = 0, resisted = wardResisted } = event;
    // Expanded amount is AFTER resistance/Ward, BEFORE Block/Barrier. Adding
    // the resisted figure reconstructs positive incoming damage, never the HP loss:
    // a partly resisted attack that still hurts must keep its normal hurt art.
    if ([amount, blocked, resisted].every(value => Number.isFinite(value) && value >= 0)
      && amount === blocked && amount + resisted > 0) return 'fully-defended';
  }
  return null;
}

/** Canonical authored Guard wins for the mixed guard+evasion fallback. */
export function selectedWeaponCounterFor(card, profile, authoredCard = card) {
  if (profile !== REAVER_GREATSWORD_PILOT || combatProfileFor(card).camp !== 'physical') return null;
  const tags = new Set(card?.cardTags ?? card?.tags ?? []);
  const canonical = frameworkEntities.entities.find(row=>row.id === 'framework.'+(authoredCard?.id || card?.cardId));
  const properties = new Set((canonical?.properties || (authoredCard?.id && authoredCard?.type ? cardPropertyInstances(authoredCard) : [])).map(row=>row.propertyId));
  if (tags.has('guard') || tags.has('classification.guard') || properties.has('classification.guard')) return 'counter-guard';
  if (tags.has('utility.evasion') || properties.has('utility.evasion')) return 'counter-evade';
  return null;
}
