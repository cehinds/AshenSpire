import { concealIntent, combatIntentStance } from '../../model/combatIntentVisibility.js';
import { concealKnowledgeIntent } from '../../model/enemyIntentKnowledge.js';

// Couch seat switches project the same host roll; reading never rolls again.
export function coopEnemyIntent(enemy, seatId, profile = null) {
  if (enemy.knowledgeAction && enemy.intent?.kind !== 'staggered') {
    const read = enemy.knowledgeAction.reads?.[seatId];
    return read?.visibility === 'exact' ? enemy.intentPreviews?.[seatId] || enemy.intent
      : concealKnowledgeIntent(read, enemy.knowledgeAction.serial);
  }
  const intent = enemy.intent || { kind: 'unknown', moveId: null };
  const identity = intent.profile || intent.combatProfile || profile || {};
  const read = enemy.intentReads ? enemy.intentReads[seatId] === true : !identity.camp;
  if ((intent.hidden || !read) && intent.kind !== 'staggered') return concealIntent(intent, identity);
  // The host prices each observer's own defenses. Selecting a different seat
  // cannot bypass the reveal gate or reuse another seat's tactical preview.
  const preview = enemy.intentPreviews?.[seatId] || intent;
  const previewIdentity = preview.profile || preview.combatProfile || identity;
  if (preview.hidden && preview.kind !== 'staggered') return concealIntent(preview, previewIdentity);
  return { ...preview, profile: previewIdentity,
    stance: combatIntentStance(preview, previewIdentity), hidden: false, revealed: true };
}
