// The rank-up bonus (SPEC card ranks, owner 2026-11-01): raising a Core card also offers 2-3 rolled upgrade options,
// the blacksmith's pool (damage, Block, Poise, cost, a tag...) at bigger amounts, and the player picks one. The pick
// is an ordinary upgrade step on the card, so the face, the inspector and the save need nothing new.
// Pure: the roll is seeded by (run.seed, instanceId, step count) with its own salt, so a reload offers the same options.
import { nextUpgradeOptions } from './cardUpgradeLimits.js';
import { cardRank } from './cardRank.js';
import { upgradeStepsOf, MAX_CARD_UPGRADES } from './cardUpgrade.js';

export const RANK_UP_BONUS_CHOICES = 3;
export const RANK_UP_BONUS_SALT = 'rankup';

/** The bonus's amount multiplier: balance.skill.rankUpBonusScale, 2 when a registry lacks it. */
export function rankUpBonusScale(registries) {
  const scale = registries?.balance?.skill?.rankUpBonusScale;
  return Number.isFinite(scale) && scale >= 1 ? scale : 2;
}

/** Whether a run's cards upgrade by steps (Core, card ranks on); only those get a rank-up bonus. */
export const rankUpBonusOn = (run) => run?.gameProfile?.modules?.progression?.cardRanks === true;

/**
 * rankUpBonusOptions(registries, run, instance) → up to 3 distinct upgrade steps the rank-up could add, each
 * `{ step, after }` where `after` is the instance as the player would hold it (rank + 1, step appended).
 * [] when the run is not Core, the card is unknown, at the 10-step cap, or no option applies.
 * The roll sees the card at its NEW rank, so a status the rank already caps is not offered more.
 */
export function rankUpBonusOptions(registries, run, instance) {
  if (!rankUpBonusOn(run) || !instance || !registries?.cards?.has(instance.cardId)) return [];
  const applied = upgradeStepsOf(instance);
  if (applied.length >= MAX_CARD_UPGRADES) return [];
  const raised = { ...instance, rank: cardRank(instance) + 1 };
  const steps = nextUpgradeOptions(run, raised, registries.cards.get(instance.cardId), registries, RANK_UP_BONUS_CHOICES,
    { scale: rankUpBonusScale(registries), salt: RANK_UP_BONUS_SALT, noAuthored: true });
  return steps.map((step) => ({ step: { ...step, bonus: true }, after: { ...raised, upgraded: true, upgradeSteps: [...applied, { ...step, bonus: true }] } }));
}
