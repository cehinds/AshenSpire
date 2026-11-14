import { previewIntent } from '../../engine/combat.js';
import { captureEnemyIntent } from '../../engine/enemyIntentReceipt.js';
import { projectEnemyIntentDamage } from '../../engine/enemyIntentProjection.js';
import { EnemyChargingState } from '../../engine/enemyCharging.js';

// Apply the production observer gate before inspecting the queued payload.
// A reaction pause belongs to one pending contact, not the full original move.
export function projectCombatIntent(combat, enemyInstanceId) {
  const intent = projectUncharged(combat, enemyInstanceId);
  if (intent.hidden || intent.revealed === false || intent.kind === 'staggered') return intent;
  // Owner, 2026-11-14: a delayed move that does not land this turn says so (Charging, turns left, the Block it gains now); its damage number
  // is the later one and reads as such. The turn it lands it is an ordinary attack.
  const charging = EnemyChargingState(combat, combat.enemies.find(row => row.id === enemyInstanceId));
  return charging ? { ...intent, charging } : intent;
}

function projectUncharged(combat, enemyInstanceId) {
  const intent = previewIntent(combat, enemyInstanceId);
  if (intent.hidden || intent.revealed === false || intent.kind === 'staggered') return intent;
  const enemy = combat.enemies.find(row => row.id === enemyInstanceId);
  const pending = combat.pendingReaction;
  const queuedContact = row => row.source?.id === enemy.id && row.effect?.op === 'damage';
  const action = pending?.sourceId === enemy.id
    ? combat.queue.find(row => queuedContact(row) && row.meta?.expansionGroup?.key === pending.groupKey)
    // A response with a nested card/discard choice temporarily owns the live
    // queue; the unanswered incoming contact waits in its saved resume queue.
    : combat.reactionResume?.queue?.find(queuedContact);
  if (action) return captureEnemyIntent(combat, enemy, action) || intent;
  return projectEnemyIntentDamage(combat, enemy, intent);
}

// Playback advances only on public receipts. Clear a consumed contact before
// its successor is announced; never paint its previous damage as a forecast.
//
// `deferred` (a Map, optional): an enemy's intent stays on screen until its action has resolved
// (owner, 2026-11-02: hit floater out, statuses applied). With it, a clearing receipt is parked
// in the map under the actor's id instead of applied, and any receipt that announces another
// contact for that actor drops the parked clear. flushDeferredIntentClears applies what is
// parked once the beat's resolution is reached.
//
// `later` (an array, optional): the receipts after this one. A clear is skipped when the same actor
// announces its next contact with its own intent inside this enemy turn (see announcesNextContact), so
// a plan of several moves never flashes "?" between them (owner, 2026-11-05: enemy intent changed
// during the enemy's turn).
const ANNOUNCING = ['combatContactPrepared', 'combatHitStarted', 'enemyMoveStarted'];
export function announcesNextContact(later, actorId) {
  for (const next of later || []) {
    if (next.type === 'enemyTurnEnd' || next.type === 'playerTurnStart') return false;
    if (next.sourceId === actorId && !next.reaction && next.intentPreview && ANNOUNCING.includes(next.type)) return true;
  }
  return false;
}

export function applyCombatIntentReceipt(entities, event, deferred = null, later = null) {
  const actor = entities[event.sourceId];
  if (!actor || actor.kind !== 'enemy') return;
  const announces = event.type === 'enemyActorTurnStarted'
    || ['combatContactPrepared', 'combatHitStarted', 'enemyMoveStarted'].includes(event.type)
    || event.type === 'combatCounterTriggered' && event.sourceKind === 'enemy';
  if (deferred && announces) deferred.delete(event.sourceId);
  const clears = event.type === 'enemyMoveEnded' || actor.intentInFlight
    && (event.type === 'damageDealt' || event.type === 'attackMissed' || event.type === 'attackEvaded'
      || event.type === 'combatAvoidanceResolved' && event.avoided);
  if (deferred && !announces && clears && !event.reaction && later && announcesNextContact(later, event.sourceId)) {
    // The move is over and the same actor announces another one: park a promotion (see flushDeferredIntentClears).
    if (event.type === 'enemyMoveEnded') deferred.set(event.sourceId, { type: 'intentPromote', sourceId: event.sourceId });
    return;
  }
  if (deferred && !announces && clears) {
    deferred.set(event.sourceId, event);
    return;
  }
  if (event.type === 'enemyActorTurnStarted') {
    actor.intentPreview = event.intentPreview || { ...event.intent, profile: event.intent?.combatProfile || {}, revealed: true, hidden: false };
    actor.intentInFlight = false;
    delete actor.intentBeforeReaction;
  } else if (['combatContactPrepared', 'combatHitStarted', 'enemyMoveStarted'].includes(event.type)) {
    if (event.type === 'enemyMoveStarted' && !event.reaction) delete actor.intentBeforeReaction;
    if (event.reaction && !actor.intentBeforeReaction) actor.intentBeforeReaction = actor.intentPreview;
    if (event.intentPreview) actor.intentPreview = event.intentPreview;
    actor.intentInFlight = true;
  } else if (event.type === 'combatCounterTriggered' && event.sourceKind === 'enemy') {
    actor.intentBeforeReaction ||= actor.intentPreview;
    actor.intentPreview = { kind: 'attack', moveId: event.moveId, damage: event.amount,
      hits: 1, counterDamage: event.amount, counterPoiseDamage: event.poiseDamage,
      counterWardDamage: event.wardDamage, profile: event.combatProfile || {}, stance: 'countering', revealed: true, hidden: false };
    actor.intentInFlight = true;
  } else if (event.type === 'enemyMoveEnded' || actor.intentInFlight
    && (event.type === 'damageDealt' || event.type === 'attackMissed' || event.type === 'attackEvaded'
      || event.type === 'combatAvoidanceResolved' && event.avoided)) {
    if (event.type === 'enemyMoveEnded' && event.reaction && !actor.intentBeforeReaction) return;
    actor.intentPreview = actor.intentBeforeReaction || { kind: 'unknown', moveId: null, revealed: true, hidden: false };
    actor.intentInFlight = false;
    delete actor.intentBeforeReaction;
  }
}

/**
 * Apply the clears parked by applyCombatIntentReceipt(..., deferred), then empty the map. A parked promotion
 * (`intentPromote`, the move ended and the actor announces its next one) calls promote(actorId), which moves the next
 * planned move into the head slot; without it, or when it declines, the head stays as it did before promotion existed.
 * Returns true when something on screen changed.
 */
export function flushDeferredIntentClears(entities, deferred, promote = null) {
  if (!deferred?.size) return false;
  const parked = [...deferred.values()];
  deferred.clear();
  let changed = false;
  for (const event of parked) {
    if (event.type === 'intentPromote') {
      if (promote?.(event.sourceId)) changed = true;
      continue;
    }
    applyCombatIntentReceipt(entities, event);
    changed = true;
  }
  return changed;
}
