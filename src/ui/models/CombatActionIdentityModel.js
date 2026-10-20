import { combatProfileFor } from '../../model/combatCardProfile.js';
import { t } from '../strings.js';

// Read only the action's committed receipt. A Counter must never borrow its
// owner's next planned move or the weapon currently selected in the Armoury.
export function combatActionIdentity(beat, registries, enemyFor = () => null) {
  const event = beat.events.find(row => ['cardPlayed', 'enemyMoveStarted', 'combatCounterTriggered', 'flaskUsed'].includes(row.type));
  if (!event) return null;
  const card = event.cardId && registries.cards.has(event.cardId) ? registries.cards.get(event.cardId) : null;
  const enemyId = event.enemyId || enemyFor(event.sourceId)?.enemyId;
  const move = event.moveId && registries.enemies.has(enemyId) ? registries.enemies.get(enemyId)?.moves?.[event.moveId] : null;
  const carrier = card || move;
  const maneuver = beat.kind === 'counter' ? 'counter' : event.combatProfile?.maneuver || (carrier && combatProfileFor(carrier).maneuver);
  const type = ['attack', 'smash', 'defend', 'counter', 'sweep', 'evade'].includes(maneuver)
    ? t(`stance.name.${maneuver}`) : maneuver ? maneuver[0].toUpperCase() + maneuver.slice(1) : null;
  const name = carrier?.name || event.cardName || event.moveName || event.name;
  const instance = event.cardInstance;
  const weaponId = instance?.sourceArmamentId || instance?.weaponId || instance?.grantedBy;
  const weapon = (registries.equipment?.armaments || []).find(row => row.id === weaponId);
  return [...new Set([type, name, weapon?.name].filter(Boolean))].join(' · ') || null;
}
