// A tooltip reads one public action. Full deck/knowledge inspection stays on
// the inspection door, and concealed actions never reach private definitions.
import { previewEnemyAction } from '../../engine/enemyActionPreview.js';
import { enemyMoveCards } from '../../model/enemyMoveCards.js';
import { projectCombatIntent } from './CombatIntentProjectionModel.js';
import { ChargingWhen, intentDamageRead } from './CombatIntentModel.js';
import { t } from '../strings.js';
import { enemyMoveOf } from '../../model/enemyMoveSet.js';

const words = value => String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase());

export function enemyIntentRead(combat, enemy, { preview = projectCombatIntent(combat, enemy.id), inspectedMoves = null, unknownDetail = 'Exact action unknown' } = {}) {
  const hidden = preview.hidden === true || preview.revealed === false;
  const shared = { hidden, knowledgeRead: preview.knowledgeRead, stance: preview.stance, profile: preview.profile, active: true };
  if (hidden) return { ...shared, name: preview.label || '?', detail: unknownDetail, lines: [unknownDetail] };
  const moveId = preview.moveId;
  if (!moveId) {
    const name = words(preview.kind || 'Unknown');
    return { ...shared, name, detail: name, lines: [name] };
  }
  let row = inspectedMoves?.find(move => move.moveId === moveId);
  if (!row) {
    // One move only, the instance's own (a level-card move) or its row's: the tooltip never walks the move set.
    const def = combat.registries.enemies.get(enemy.enemyId);
    const move = enemyMoveOf(combat.registries, enemy, moveId);
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
  const detail = row?.detail || words(preview.kind || 'Unknown action');
  // A charging move says when it lands and what it gains now, ahead of the move's own card text (the number is for a later turn).
  const charging = preview.charging, later = charging && intentDamageRead(preview)?.label;
  const lead = charging ? [later != null ? t('combat.intent.chargingAria', { amount: later, when: ChargingWhen(charging.turnsLeft) }) : t('combat.intent.chargingNote', { when: ChargingWhen(charging.turnsLeft) }),
    charging.block != null ? t('combat.intent.chargingBlock', { amount: charging.block }) : null].filter(Boolean).join(' ') : null;
  // A move that only closes a range band reads as Approaching, not by the engine's move name (Advance).
  const effects = preview.actionEffects;
  if ((Array.isArray(effects) ? effects : []).some(effect => effect?.op === 'moveEngagement' && effect.bands < 0)) {
    return { ...shared, name: t('combat.intent.advancing'), detail: lead ? `${lead} ${t('combat.intent.advancingDetail')}` : t('combat.intent.advancingDetail'),
      lines: [lead, t('combat.intent.advancingDetail')].filter(Boolean) };
  }
  // The tooltip reads one effect per line; the tag definitions stay in its glossary, not repeated in the body.
  const lines = [lead, ...(row?.effectLines?.length ? row.effectLines : [detail])].filter(Boolean);
  return { ...shared, name: row?.name || words(moveId), detail: lead ? `${lead} ${detail}` : detail, lines };
}
