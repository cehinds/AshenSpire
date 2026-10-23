import { gameModule } from './gameProfile.js';
import { skillTracks } from './skills.js';

// Configured runs keep the existing class/weapon-group ledgers and XP curves.
// Equipment's procedural rank remains owned by Smithing tiers.
export function configuredSkillProgression(subject) {
  return subject?.gameProfile?.foundation?.mode === 'configured'
    && gameModule(subject, 'progression')?.mode === 'configured';
}

/** Persist only actual level crossings, never a re-derived modal on reload. */
export function skillLevelNotices(registries, awards, { usedArmaments = [] } = {}) {
  const tracks = skillTracks(registries);
  return awards.filter(award => award?.levelUps > 0).map(award => {
    const weapons = usedArmaments.map(id => registries.equipment.armaments.find(piece => piece.id === id))
      .filter(piece => piece?.itemTypeTags?.includes(award.skillId)).map(piece => piece.name);
    return {
      skillId: award.skillId,
      label: tracks.find(track => track.id === award.skillId)?.label || award.skillId,
      before: award.before,
      after: award.after,
      ...(weapons.length ? { weapons: [...new Set(weapons)] } : {}),
    };
  });
}

export function acknowledgeSkillLevelNotices(pending) {
  delete pending.progression;
}

// Missing means the old snapshotted rate, so loading an existing run never
// retroactively slows its progression. New Core profiles author their own rate.
export function configuredSkillXpMultiplier(subject, kind = 'weapon') {
  const value = gameModule(subject, 'progression')?.[kind === 'class' ? 'classXpMultiplier' : 'weaponXpMultiplier'];
  return Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 1;
}

// Core progression policy v1: preserve earned character ledgers and attributes,
// but stop future character XP, including old saves. Existing earned points
// and already queued character rewards remain claimable.
export const CORE_PROGRESSION_POLICY_VERSION = 1;
export function coreSkillOnlyProgression(subject) {
  return subject?.gameProfile?.foundation?.mode === 'configured'
    && subject.gameProfile.author?.core === 'ashen.core@2.0.0';
}
export function configuredCharacterLevels(subject) {
  return !coreSkillOnlyProgression(subject) && gameModule(subject, 'progression')?.characterLevels === true;
}

// A receipt acknowledges already-paid XP. A failed save keeps it resumable;
// neither opening nor continuing this screen may pay a ledger again.
export function acknowledgeVictoryReceipt(pending, persist) {
  const receipt = pending.victoryReceipt;
  if (!receipt) return false;
  delete pending.victoryReceipt;
  try {
    if (persist() === false) throw new Error('Victory receipt save was refused.');
  } catch (error) {
    pending.victoryReceipt = receipt;
    throw error;
  }
  return true;
}
