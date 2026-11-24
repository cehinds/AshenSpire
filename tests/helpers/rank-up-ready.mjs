// Owner 2026-11-23: with "Rank-up needs a fully upgraded card" on (the default), a card ranks up only once every upgrade
// slot it has is used. Tests of the rank-up itself fill the slots first with plain steps: the authored upgrade, then +1 draw.
import { UpgradeSlots } from '../../src/model/cardUpgradeLimits.js';
import { paidUpgradeCount, upgradeStepsOf } from '../../src/model/cardUpgrade.js';

/** FillUpgradeSlots(run[, cards]) -> the cards, each given steps until its used slots equal its slots. */
export function FillUpgradeSlots(run, cards = [...(run.deck || []), ...(run.sideboard || [])]) {
  for (const card of cards) {
    if (!card) continue;
    const steps = [...upgradeStepsOf(card)];
    let missing = UpgradeSlots(run, card) - paidUpgradeCount(card);
    while (missing > 0) {
      steps.push(steps.some((step) => step.k === 'authored') ? { k: 'fx', fx: 'draw', n: 1 } : { k: 'authored' });
      missing -= 1;
    }
    if (steps.length) { card.upgraded = true; card.upgradeSteps = steps; }
  }
  return cards;
}

/** RankUpRuleOff(run) -> the run with the full-upgrade rule off and its cards' filler steps cleared (tests of bonus steps). */
export function RankUpRuleOff(run) {
  const progression = { ...(run.gameProfile?.modules?.progression || {}), rankUpNeedsFullUpgrades: false };
  run.gameProfile = { ...run.gameProfile, modules: { ...run.gameProfile.modules, progression } };
  for (const card of [...(run.deck || []), ...(run.sideboard || [])]) {
    if (!card) continue;
    delete card.upgradeSteps;
    card.upgraded = false;
  }
  return run;
}
