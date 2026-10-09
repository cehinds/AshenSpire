import { resolveCombatCard } from '../../engine/combatExpansion.js';
import { registriesForClassMastery } from '../../model/classMasteryRun.js';

// A paid play owns its instance and temporary tier. Neither a consumed hand
// card nor the UI's cleared tier picker is an authority after dispatch.
export function resolvePlayedCombatCard(context, receipt, capturedInstance) {
  const instance = receipt.cardInstance || capturedInstance || receipt;
  const definition = resolveCombatCard(context, instance, { upcastTier: receipt.upcastTier });
  return { ...definition,
    ...(instance.sourceArmamentId ? { sourceArmamentId: instance.sourceArmamentId } : {}),
    ...(Array.isArray(receipt.cardTags) ? { cardTags: receipt.cardTags } : {}) };
}

export function resolveCoopPlayedCombatCard(registries, snapshot, receipt) {
  const ownerId = receipt.playerId || receipt.sourcePlayerId || receipt.sourceId;
  const member = snapshot.party.find(entry => entry.id === ownerId);
  const owner = snapshot.scene.players.find(entry => entry.id === ownerId);
  if (!member || !owner) throw new Error(`Missing played-card owner ${ownerId}`);
  const context = {
    registries: registriesForClassMastery(registries, { ...member, class: member.classId }),
    player: owner,
    combatExpansionVersion: owner.combatExpansionVersion || 1,
    breakMeterVersion: snapshot.scene.breakMeterVersion ?? receipt.cardInstance?.breakMeterVersion ?? 0,
  };
  return resolvePlayedCombatCard(context, receipt, owner.hand?.find(card => card.instanceId === receipt.cardInstanceId));
}
