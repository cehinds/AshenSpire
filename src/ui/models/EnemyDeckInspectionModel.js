import { t } from '../strings.js';
// Read-only identity bridge: authored cards are joined to the runtime moves by
// their explicit legacyMove hint, never by guessing names or inventing a deck.
import { gameContent } from '../../model/gameProfile.js';
import { enemyActionEffectText } from '../../model/enemyMoveCards.js';
import { enemyMoveSp } from '../../engine/combatRoundsAdapter.js';

export function enemyDeckInspection(combat, enemy, moves, preview) {
  const authored = gameContent(combat, 'enemies')?.find(row => row.id === enemy.enemyId);
  if (!authored) return null;
  const definitions = new Map((gameContent(combat, 'enemyCards') || []).map(card => [card.id, card]));
  const runtime = combat.registries.enemies.get(enemy.enemyId);
  const lastMoveId = enemy.performedMoves?.at(-1);
  const copies = new Map();
  for (const cardId of authored.defaultDeck || []) copies.set(cardId, (copies.get(cardId) || 0) + 1);
  // An unlock is an available additional identity, not another copy of an
  // already owned card. Counts never imply a runtime draw order.
  for (const cardId of authored.unlockCards || []) if (!copies.has(cardId)) copies.set(cardId, 1);
  const rows = [...copies].map(([cardId, count]) => {
    const card = definitions.get(cardId);
    const moveId = authored.cardHints?.[cardId]?.legacyMove;
    const move = moves.find(row => row.moveId === moveId);
    if (!card || !move || !runtime.moves?.[moveId]) return null;
    const cost = enemyMoveSp(runtime.moves[moveId], { enemy, moveId, combat });
    const active = !preview?.hidden && preview?.moveId === moveId;
    const last = moveId === lastMoveId;
    const state = [active && 'Current action', last && 'Last played', move.locked && 'Locked'].filter(Boolean).join(' · ');
    return { ...move, id: cardId, cardId, copies: count, name: card.name, active, last,
      meta: [state || t('settings.group.Deck'), count > 1 ? `${count} copies` : '', `Action cost: ${cost} SP`, `Card base: ${card.staminaCost || 0} SP + ${card.manaCost || 0} MP`, move.meta].filter(Boolean).join(' · '),
      // Execution uses the shared runtime move projection, whose formulas and
      // tier scaling may differ from the printed base card definition.
      detail: move.detail };
  }).filter(Boolean);
  const last = rows.find(row => row.last) || null;
  const receipt = [...(combat.eventLog || [])].reverse().find(event => event.type === 'enemyMoveStarted' && event.sourceId === enemy.id && event.moveId === lastMoveId)?.actionPreview;
  const played = last && receipt ? { ...last, meta: `Last played · Paid ${receipt.totalSp ?? receipt.spCost} SP · ${last.cardId}`,
    detail: receipt.actionEffects.map(effect => `${enemyActionEffectText(effect, combat.registries)}${effect.conditionMet === false ? ' (condition not met)' : ''}`).join(' · ') || last.detail } : last;
  return { cards: rows, current: preview?.hidden ? null : rows.find(row => row.active) || null,
    last: played, currentHidden: !!preview?.hidden };
}
