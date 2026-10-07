import { isAbilitySkill } from './abilityGrades.js';

// Shared ledger operation stays below skills and class mastery. Importing
// skills from classMasteryRun closes a cycle that captures undefined exports
// in the standalone bundle's classic module loader.
export function activateAbilitySkill(run, skillId) {
  if (!isAbilitySkill(skillId)) return false;
  run.skills ||= {};
  const row = run.skills[skillId] ||= { xp: 0, level: 0, pendingDrafts: 0 };
  if (row.level > 0) return false;
  row.level = 1; row.pendingDrafts += 1;
  return true;
}
