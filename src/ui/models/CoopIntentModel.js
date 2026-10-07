import { concealIntent, combatIntentStance } from '../../model/combatIntentVisibility.js';

// Couch seat switches project the same host roll; reading never rolls again.
export function coopEnemyIntent(enemy, seatId, profile = null) {
  const intent = enemy.intent || { kind: 'unknown', moveId: null };
  const identity = intent.profile || intent.combatProfile || profile || {};
  const read = enemy.intentReads ? enemy.intentReads[seatId] === true : !identity.camp;
  if ((intent.hidden || !read) && intent.kind !== 'staggered') return concealIntent(intent, identity);
  return { ...intent, profile: identity, stance: combatIntentStance(intent, identity), hidden: false, revealed: true };
}
