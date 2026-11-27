// The `?shotRankUp` pose's card setup: the after-fight rank-up door opens only when a queued card may rise now
// (the full-upgrade rule, rankUpService.js), so the pose fills each candidate's upgrade slots with real rolled steps.
import { rankUpCandidates } from './../model/skills.js';
import { applyFreeCardUpgrade, freeCardUpgradeStep } from './../model/cardUpgradeService.js';
import { paidUpgradeCount } from './../model/cardUpgrade.js';
import { UpgradeSlots } from './../model/cardUpgradeLimits.js';

/** FillRankUpCandidateSlots(registries, run, skillId) -> the candidates, each upgraded until its slots are used. */
export function FillRankUpCandidateSlots(registries, run, skillId) {
  const cards = rankUpCandidates(registries, run, skillId);
  for (const card of cards) {
    while (paidUpgradeCount(card) < UpgradeSlots(run, card, registries) && freeCardUpgradeStep(run, registries, card)) applyFreeCardUpgrade(run, registries, card);
  }
  return cards;
}
