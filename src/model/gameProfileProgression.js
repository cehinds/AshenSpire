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
