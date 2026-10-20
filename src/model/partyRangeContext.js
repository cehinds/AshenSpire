// New encounters only. The active co-op snapshot owns its existing policy.
import { rangePolicyForNewCombat } from './rangeCombatPolicy.js';
import { rangePolicyProblems, RANGE_POLICY_DEFAULTS } from './combatEngagement.js';
export function partyRangeContext(runs) {
  if (!runs.length || !runs.every(run => run.combatExpansionVersion === 2 && run.gameProfile?.modules?.effects?.fixCoreVersion === 1)) return {};
  const profile = runs[0].gameProfile;
  if (!profile.hash || !runs.every(run => run.gameProfile.hash === profile.hash)) throw Error('Core party profiles must match');
  const policies = runs.map(rangePolicyForNewCombat);
  for (const policy of policies) if (rangePolicyProblems(policy).length) throw Error('Invalid Core party range policy');
  const key = policy => JSON.stringify(Object.keys(RANGE_POLICY_DEFAULTS).map(field => policy[field]));
  if (!policies.every(policy => key(policy) === key(policies[0]))) throw Error('Core party range policies must match');
  return { gameProfile: structuredClone(profile), rangePolicy: structuredClone(policies[0]) };
}
