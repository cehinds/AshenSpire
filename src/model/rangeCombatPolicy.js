// New encounter adoption only. Restoring an active fight never calls this.
import { fixCoreEnabled, fixCoreRules } from './fixCoreMechanics.js';
import { snapshotRangePolicy } from './combatEngagement.js';
export function rangePolicyForNewCombat(subject) {
  return fixCoreEnabled(subject) ? structuredClone(subject.rangePolicy || snapshotRangePolicy(fixCoreRules(subject).range)) : null;
}
