import { gameModule } from './gameProfile.js';
import { skillTracks } from './skills.js';

// Configured runs keep the existing class/weapon-group ledgers and XP curves.
// Equipment's procedural rank remains owned by Smithing tiers.
export function configuredSkillProgression(subject) {
  return subject?.gameProfile?.foundation?.mode === 'configured'
    && gameModule(subject, 'progression')?.mode === 'configured';
}

/** Persist only actual level crossings, never a re-derived modal on reload. */
export function skillLevelNotices(registries, awards) {
  const tracks = skillTracks(registries);
  return awards.filter(award => award?.levelUps > 0).map(award => ({
    skillId: award.skillId,
    label: tracks.find(track => track.id === award.skillId)?.label || award.skillId,
    before: award.before,
    after: award.after,
  }));
}

export function acknowledgeSkillLevelNotices(pending) {
  delete pending.progression;
}
