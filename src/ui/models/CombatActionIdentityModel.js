import { combatProfileFor } from '../../model/combatCardProfile.js';
import { ownerItemRef } from '../../model/cardMounts.js';
import { t } from '../strings.js';

const moveLabel = id => typeof id === 'string' ? id.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, letter => letter.toUpperCase()) : null;

// Read only the action's committed receipt. A Counter must never borrow its
// owner's next planned move or the weapon currently selected in the Armoury.
export function combatActionIdentity(beat, registries, enemyFor = () => null) {
  const event = beat.events.find(row => ['cardPlayed', 'enemyMoveStarted', 'combatHitStarted', 'combatContactPrepared', 'combatCounterTriggered', 'flaskUsed'].includes(row.type));
  if (!event) return null;
  const card = event.cardId && registries.cards.has(event.cardId) ? registries.cards.get(event.cardId) : null;
  const enemyId = event.enemyId || enemyFor(event.sourceId)?.enemyId;
  const move = event.moveId && registries.enemies.has(enemyId) ? registries.enemies.get(enemyId)?.moves?.[event.moveId] : null;
  const carrier = card || move;
  const maneuver = beat.kind === 'counter' ? 'counter' : event.combatProfile?.maneuver || (carrier && combatProfileFor(carrier).maneuver);
  const type = ['attack', 'smash', 'defend', 'counter', 'sweep', 'evade'].includes(maneuver)
    ? t(`stance.name.${maneuver}`) : maneuver ? maneuver[0].toUpperCase() + maneuver.slice(1) : null;
  const name = carrier?.name || event.cardName || event.moveName || event.name || moveLabel(event.moveId);
  const instance = event.cardInstance;
  const committed = instance && Object.hasOwn(instance, 'usedArmamentId');
  const grant = ownerItemRef(instance);
  const grantId = grant?.startsWith('armament/') ? grant.slice('armament/'.length) : null;
  const weaponId = committed ? instance.usedArmamentId : instance?.sourceArmamentId || instance?.weaponId || grantId;
  const weapon = (registries.equipment?.armaments || []).find(row => row.id === weaponId);
  return [...new Set([type, name, committed && weaponId === null ? 'Unarmed' : weapon?.name].filter(Boolean))].join(' · ') || null;
}
