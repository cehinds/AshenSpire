import { spellTraditions as rules } from '../content/generated/spellTraditions.js';
import { CardSpellTraditions, SpellPoolRole, SpellTraditionsActive } from './spellTraditions.js';
import { gameProfileEffectiveAttributes } from './gameProfileGear.js';
import { isSpellCard } from './combatCardProfile.js';

export function RewardSpellTradition(registries, run) {
  const attributes = gameProfileEffectiveAttributes(registries, run);
  const intelligence = Number(attributes.intelligence) || 0, wisdom = Number(attributes.wisdom) || 0;
  return intelligence > wisdom ? 'arcane' : wisdom > intelligence ? 'divine'
    : rules.classTraditions[run.class] || 'arcane';
}
function rewardPolicyActive(run) {
  return run?.gameProfile?.modules?.effects?.spellRewardPolicyVersion === 1 && SpellTraditionsActive(run);
}

export function SpellRewardEligible(registries, run, card) {
  return !rewardPolicyActive(run) || !isSpellCard(card)
    || CardSpellTraditions(card).includes(RewardSpellTradition(registries, run));
}
// Preserve the existing total weight of magical rewards and the relative
// rarity/ownership/depth bias within each role. Only the role distribution
// changes. If an eligible role is empty, keep the available role playable.
export function BalanceSpellRewardWeights(registries, run, cards, weights) {
  if (!rewardPolicyActive(run)) return weights;
  const target = rules.traditions[RewardSpellTradition(registries, run)];
  const totals = { offense: 0, support: 0 };
  cards.forEach((card, i) => { if (isSpellCard(card)) totals[SpellPoolRole(card)] += weights[i]; });
  const total = totals.offense + totals.support;
  const denominator = Object.keys(totals).reduce((sum, role) => sum + (totals[role] > 0 ? target[role] : 0), 0);
  if (!denominator || !total) return weights;
  return cards.map((card, i) => {
    if (!isSpellCard(card) || !totals[SpellPoolRole(card)]) return weights[i];
    const role = SpellPoolRole(card);
    return weights[i] * total * target[role] / denominator / totals[role];
  });
}
