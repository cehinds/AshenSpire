// src/model/rewardOdds.js — the card reward door's rarity odds, headless and
// pure (SPEC §6, §13.4e). engine/encounters.js draws with them; the wise
// master's appraisal and live lesson check (model/master.js) read the same
// odds without drawing, so a rarity the door can never draw (weight 0, or
// every rarity equal under Chaos Rewards) is judged the same way in both.

/** One authored reward table for every class; Chaos always bypasses pool weights. */
export function cardRewardRarityWeights(registries, { pool = 'normal', flatRarity = false } = {}) {
  if (flatRarity) return { common: 1, uncommon: 1, rare: 1 };
  const rewards = registries.balance.rewards;
  const poolId = Object.hasOwn(rewards.rarityWeights, pool) ? pool : 'normal';
  return rewards.rarityWeights[poolId];
}
