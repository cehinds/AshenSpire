import { BLOOD_RITE_STATUSES, COMBAT_POSE_STATES } from '../content/combatPoseStates.js';

export function readinessPose(statusId) {
  return statusId === 'prepared' || statusId === 'starstoneCharge' ? statusId
    : BLOOD_RITE_STATUSES.includes(statusId) ? 'bloodRite' : null;
}

// Keep receipt order in the presentation session, never in a combat/save shape.
// On reconnect, stable snapshot order provides a deterministic fallback.
export function readinessAfterEvent(order, event, actorId) {
  if (event.targetId !== actorId || !readinessPose(event.status)) return order;
  if (event.type === 'statusExpired' || (event.type === 'statusApplied' && event.total <= 0)) return order.filter(id => id !== event.status);
  if (event.type !== 'statusApplied') return order;
  return [...order.filter(id => id !== event.status), event.status];
}

export function resolveCombatPose(entity = {}, rest = 'idle', order = []) {
  if (entity.alive === false || entity.hp <= 0) return 'defeated';
  if (Object.hasOwn(COMBAT_POSE_STATES, entity.stanceId || '')) return entity.stanceId;
  const statuses = entity.statuses || {};
  const candidates = [...Object.keys(statuses).filter(id => !order.includes(id)), ...order];
  for (const id of candidates.reverse()) {
    const instance = statuses[id];
    if ((instance?.stacks ?? 0) > 0 && instance.duration !== 0 && readinessPose(id)) return readinessPose(id);
  }
  return ['guard', 'shieldGuard', 'parry'].includes(rest) ? rest : 'idle';
}

export function bloodRiteReaction(entity, event, actorId) {
  if (event.targetId !== actorId || !(event.amount > 0) ||
      !BLOOD_RITE_STATUSES.some(id => entity?.statuses?.[id]?.stacks > 0)) return null;
  if (event.type === 'healed') return 'heal';
  if (event.type === 'hpLost' && event.cause !== 'attack' && !String(event.cause).startsWith('proc:')) return 'hp';
  return null;
}
