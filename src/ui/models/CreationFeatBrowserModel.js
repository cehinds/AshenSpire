// Browse eligibility only. Meeting a level requirement never grants a feat.
import { feats } from '../../content/feats.js';
import { skillTracks, skillLevel, trackSkillFeats } from '../../model/skills.js';
import { getFeatDescription } from '../../model/classSkillFeatDescription.js';
import { hasClassMastery, masteryProfileFor } from '../../model/classMasteryRun.js';
import { masteryRowId } from '../../model/classMastery.js';
import { t } from '../strings.js';

export function creationFeatBrowserGroups(registries, run) {
  const source = registries.masterySource || registries;
  const classId = run.class;
  const classTrack = `class:${classId}`;
  const tracks = skillTracks(source);
  const labels = new Map(tracks.map(track => [track.id, track.label]));
  const characterLevel = run.level?.level || 1;
  const row = (feat, group, trackId, requiredLevel, unlocked = false) => {
    const currentLevel = trackId === 'character' ? characterLevel : skillLevel(run, trackId);
    return { id: feat.id, name: feat.name,
      description: group === 'class' ? getFeatDescription(source, feat) : feat.description,
      group, trackId, trackLabel: trackId === 'character' ? t('progression.tab.character') : labels.get(trackId) || trackId,
      currentLevel, requiredLevel, unlockedByProfile: unlocked, locked: !unlocked && currentLevel < requiredLevel };
  };
  // main.rollLevelChoices offers the general catalogue at each earned
  // character level; birth is level 1, so its first level-up is level 2.
  const character = feats.map(feat => row(feat, 'character', 'character', 2));
  const classRows = (source.classSkillFeats || []).filter(feat => feat.skillId === classTrack).map(feat => {
    const gates = (source.classMastery || []).filter(gate => gate.kind === 'feat' && gate.ref === feat.id && gate.classId === classId);
    const gateLevel = gates.length ? Math.min(...gates.map(gate => gate.level)) : 0;
    // Mastery feat options use the authored gate instead of minLevel.
    const required = gates.length ? gateLevel : (feat.minLevel || 0);
    const unlockedRows = masteryProfileFor(run).classMastery?.[classId]?.unlockedRows || [];
    const unlocked = hasClassMastery(run) && gates.some(gate => unlockedRows.includes(masteryRowId(gate)));
    return row(feat, 'class', classTrack, required, unlocked);
  });
  const every = source.balance.skill.featEvery;
  const skill = tracks.filter(track => track.kind !== 'class')
    .flatMap(track => trackSkillFeats(track.id, false, source).map(feat => {
      // The authored minLevel is additionally bounded by the existing
      // skill reward cadence; no new starting allowance is introduced.
      const minimum = Math.max(1, feat.minLevel || 0);
      const required = Number.isInteger(every) && every > 0 ? Math.ceil(minimum / every) * every : null;
      const result = row(feat, 'skill', track.id, required);
      if (required === null) result.locked = true;
      return result;
    }));
  return [{ id: 'character', rows: character }, { id: 'class', rows: classRows }, { id: 'skill', rows: skill }];
}
