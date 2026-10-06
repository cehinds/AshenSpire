import { friendlyTargetPlan } from './friendlyTargets.js';

const HOSTILE_TARGETS = new Set(['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies']);

// Explicit destinations must agree with the card, even when an effect would
// otherwise ignore the supplied entity and fall back to its source/first foe.
// Omitted targets keep the engine's existing automatic resolution semantics.
export function cardTargetPlan(def, actorId, enemies = [], players = [], { solo = false } = {}) {
  const effects = def?.effects || [];
  const hostile = effects.some(effect => HOSTILE_TARGETS.has(effect.target));
  if (hostile) return { mode: 'enemy', legalIds: enemies.filter(enemy => enemy.alive).map(enemy => enemy.id) };
  const friendly = friendlyTargetPlan(def, actorId, players);
  const actor = players.find(player => player.id === actorId && player.alive && player.connected !== false);
  // Solo ally effects historically fall back to their source (SPEC/engine
  // regression 23). Untargeted source effects such as draw share that door.
  const legalIds = friendly.active ? friendly.legalIds : actor ? [actorId] : [];
  if (solo && actor && !legalIds.length && friendly.mode === 'ally') legalIds.push(actorId);
  return { mode: 'friendly', legalIds };
}

export function assertCardTarget(plan, requestedId) {
  if (requestedId != null && !plan.legalIds.includes(requestedId)) {
    throw new Error(`Invalid ${plan.mode} target '${requestedId}'`);
  }
  return requestedId;
}

// Inert frames are skipped by browser hit testing. A fast flick must still
// refuse a release over a visible combatant on the wrong side of this card.
export function forbiddenCardDrop(plan, point, combatants = []) {
  return combatants.some(({ id, alive, bounds }) => alive && !plan.legalIds.includes(id)
    && bounds?.right > bounds.left && bounds?.bottom > bounds.top
    && point.x >= bounds.left && point.x <= bounds.right
    && point.y >= bounds.top && point.y <= bounds.bottom);
}
