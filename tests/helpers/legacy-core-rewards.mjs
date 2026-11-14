// The Core rewards content as it shipped before 2026-11-14: the 66/4/18/2/10 combat mix (cards, weapon arts, potions, flask relic,
// weapons), no eligibility.playableOnly (a Reaver is offered mana cards) and no eliteRelic. A run pins its profile, so a run saved
// before the change keeps this; tests that need a non-card reward or a mana card for a Reaver pin the run to it (same shape as
// tests/core-reward-stakes.test.mjs, tests/core-reward-mix.test.mjs).
export const LEGACY_REWARD_WEIGHTS = Object.freeze({ cards: 66, weaponArts: 4, potions: 18, flaskRelic: 2, weapons: 10, retired: 0 });
export function pinLegacyRewards(run) {
  const rewards = structuredClone(run.gameProfile.content.rewards);
  delete rewards.eliteRelic;
  delete rewards.eligibility.playableOnly;
  for (const group of rewards.rewardGroups) group.weight = LEGACY_REWARD_WEIGHTS[group.id];
  run.gameProfile = { ...run.gameProfile, content: { ...run.gameProfile.content, rewards },
    modules: { ...run.gameProfile.modules, rewards: { ...run.gameProfile.modules.rewards, rewardGroups: rewards.rewardGroups } } };
  return run;
}
