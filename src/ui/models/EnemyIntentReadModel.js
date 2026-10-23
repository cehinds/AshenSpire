// A tooltip reads one public action. Full deck/knowledge inspection stays on
// the inspection door, and concealed actions never reach private definitions.
import { previewEnemyAction } from '../../engine/enemyActionPreview.js';
import { enemyMoveCards } from '../../model/enemyMoveCards.js';
import { projectCombatIntent } from './CombatIntentProjectionModel.js';

const words = value => String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase());

export function enemyIntentRead(combat, enemy, { preview = projectCombatIntent(combat, enemy.id), inspectedMoves = null, unknownDetail = 'Exact action unknown' } = {}) {
  const hidden = preview.hidden === true || preview.revealed === false;
  const shared = { hidden, knowledgeRead: preview.knowledgeRead, stance: preview.stance, profile: preview.profile, active: true };
  if (hidden) return { ...shared, name: preview.label || '?', detail: unknownDetail };
  const moveId = preview.moveId;
  if (!moveId) {
    const name = words(preview.kind || 'Unknown');
    return { ...shared, name, detail: name };
  }
  let row = inspectedMoves?.find(move => move.moveId === moveId);
  if (!row) {
    const def = combat.registries.enemies.get(enemy.enemyId);
    const move = def.moves?.[moveId];
    if (move) {
      // previewIntent already materializes this public payload. Reuse it when
      // present; callers with a public move-only read resolve that one move.
      const action = Array.isArray(preview.actionEffects) ? preview : previewEnemyAction(combat, enemy, moveId);
      row = enemyMoveCards({ ...def, moves: { [moveId]: move } }, {
        enemy, preview, registries: combat.registries, combatMatchupRules: combat.combatMatchupRules,
        combatExpansionVersion: combat.combatExpansionVersion, stanceRules: combat.stanceRules,
        actionPreviews: { [moveId]: action },
      })[0];
    }
  }
  return { ...shared, name: row?.name || words(moveId), detail: row?.detail || words(preview.kind || 'Unknown action') };
}
