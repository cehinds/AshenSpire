import { friendlyTargetPlan } from './friendlyTargets.js';
import { immediateCardEffects } from './combatCardEffects.js';
export { immediateCardEffects };

const HOSTILE_TARGETS = new Set(['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies']);

// Explicit destinations must agree with the card, even when an effect would
// otherwise ignore the supplied entity and fall back to its source/first foe.
// Omitted targets keep the engine's existing automatic resolution semantics.
export function cardTargetPlan(def, actorId, enemies = [], players = [], { solo = false } = {}) {
  const effects = immediateCardEffects(def);
  const hostile = def?.combatPreview?.needsTarget === true || effects.some(effect => HOSTILE_TARGETS.has(effect.target));
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

// After the "ask to upcast after target" chooser returns a rank, decide the
// next beat from the card's plan at that rank. A remembered legal destination
// plays at once; a hostile card that strikes no single enemy (Contagion:
// allEnemies/random) plays at once with no target; anything else
// (a single-target card whose destination the rank changed) re-arms a picker.
export function upcastNextStep(plan, needsSingleTarget, previousTarget) {
  if (previousTarget != null && plan.legalIds.includes(previousTarget)) return 'play';
  if (plan.mode === 'enemy' && !needsSingleTarget) return 'playUntargeted';
  return 'retarget';
}

// Inert frames are skipped by browser hit testing. A fast flick must still
// refuse a release over a visible combatant on the wrong side of this card.
export function forbiddenCardDrop(plan, point, combatants = []) {
  return combatants.some(({ id, alive, bounds }) => alive && !plan.legalIds.includes(id)
    && bounds?.right > bounds.left && bounds?.bottom > bounds.top
    && point.x >= bounds.left && point.x <= bounds.right
    && point.y >= bounds.top && point.y <= bounds.bottom);
}
