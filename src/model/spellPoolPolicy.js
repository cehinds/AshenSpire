import { spellTraditions as rules } from '../content/generated/spellTraditions.js';
import { cardSpellTraditions, spellPoolRole, spellTraditionsActive } from './spellTraditions.js';
import { gameProfileEffectiveAttributes } from './gameProfileGear.js';
import { isSpellCard } from './combatCardProfile.js';

export function rewardSpellTradition(registries, run) {
  const attributes = gameProfileEffectiveAttributes(registries, run);
  const intelligence = Number(attributes.intelligence) || 0, wisdom = Number(attributes.wisdom) || 0;
  return intelligence > wisdom ? 'arcane' : wisdom > intelligence ? 'divine'
    : rules.classTraditions[run.class] || 'arcane';
}
export function spellRewardEligible(registries, run, card) {
  return !spellTraditionsActive(run) || !isSpellCard(card)
    || cardSpellTraditions(card).includes(rewardSpellTradition(registries, run));
}
// Preserve the existing total weight of magical rewards and the relative
// rarity/ownership/depth bias within each role. Only the role distribution
// changes. If an eligible role is empty, keep the available role playable.
export function balanceSpellRewardWeights(registries, run, cards, weights) {
  if (!spellTraditionsActive(run)) return weights;
  const target = rules.traditions[rewardSpellTradition(registries, run)];
  const totals = { offense: 0, support: 0 };
  cards.forEach((card, i) => { if (isSpellCard(card)) totals[spellPoolRole(card)] += weights[i]; });
  const total = totals.offense + totals.support;
  const denominator = Object.keys(totals).reduce((sum, role) => sum + (totals[role] > 0 ? target[role] : 0), 0);
  if (!denominator || !total) return weights;
  return cards.map((card, i) => {
    if (!isSpellCard(card) || !totals[spellPoolRole(card)]) return weights[i];
    const role = spellPoolRole(card);
    return weights[i] * total * target[role] / denominator / totals[role];
  });
}
