// How many Core card upgrades are free, what the next one costs, and whether it
// can be bought (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md, owner rulings of
// 2026-10-28). Pure reads of the run: nothing here mutates.
import { cardRank } from './cardRank.js';
import { upgradeCount, upgradeStepsOf, MAX_CARD_UPGRADES } from './cardUpgrade.js';
import { rollUpgradeStep, upgradeStepRng } from './cardUpgradeSteps.js';

/**
 * upgradeBasic(def) → whether a card is "Basic" for upgrades (owner ruling,
 * 2026-10-28): a common card that is not a spell, or any cantrip. Uncommon,
 * rare and starter cards (the class specials, Mana Surge) are not. This is
 * deliberately not the Martial Adept training rule (model/basicCardRule.js),
 * which marks almost every martial card Basic.
 */
export function upgradeBasic(def) {
  const tags = (def && def.tags) || [];
  if (tags.includes('rank.cantrip')) return true;
  const spell = tags.includes('source:spell') || tags.includes('camp:spell');
  return !!def && def.rarity === 'common' && !spell;
}

/**
 * freeAllowance(instance, def) → F. An upgradeBasic card gets 1; every other
 * card gets its rank (default 1, at most 10): a rank-3 Ironbreaker has 3 free
 * upgrades, a Strike has 1 at any rank.
 */
export function freeAllowance(instance, def) {
  if (!def) return 0;
  if (upgradeBasic(def)) return 1;
  return Math.min(MAX_CARD_UPGRADES, cardRank(instance));
}

/**
 * nextUpgradeStep(run, instance, base, registries) → the step the next upgrade
 * would add: `authored` for a first upgrade when the card has an upgrade block,
 * else the seeded roll; null when no kind is eligible (the card is maxed).
 * Stateless: the same run, instance and count always give the same step.
 */
export function nextUpgradeStep(run, instance, base, registries) {
  const applied = upgradeStepsOf(instance);
  if (applied.length === 0 && base.upgrade) return { k: 'authored' };
  const mana = (registries && registries.balance && registries.balance.mana) || {};
  return rollUpgradeStep(base, applied, applied.length, upgradeStepRng(run.seed, instance.instanceId, applied.length), mana);
}

/**
 * upgradeCost(run, instance, def[, registries]) → the Smithing Stones the NEXT
 * upgrade costs: 0 while its number n (1-based) is within F, else 1; null when
 * the card is at the 10-upgrade cap or maxed (no step is eligible any more).
 */
export function upgradeCost(run, instance, def, registries) {
  const n = upgradeCount(instance) + 1;
  if (n > MAX_CARD_UPGRADES) return null;
  if (def && instance && nextUpgradeStep(run, instance, def, registries) === null) return null;
  return n <= freeAllowance(instance, def) ? 0 : 1;
}

const stonesOf = (run) => (Number.isSafeInteger(run && run.smithingStones) ? run.smithingStones : 0);

/**
 * canUpgrade(registries, run, instance) → { ok, code, reason, cost, n, free }.
 * Codes: 'missing' (not a known card), 'armament' (an armament's own cards upgrade
 * with their armament), 'cap' (10 upgrades), 'maxed' (no step is eligible any more), 'stones'.
 */
export function canUpgrade(registries, run, instance) {
  const def = instance && registries.cards.has(instance.cardId) ? registries.cards.get(instance.cardId) : null;
  const n = upgradeCount(instance) + 1;
  const refuse = (code, reason, cost = null) => ({ ok: false, code, reason, cost, n, free: null });
  if (!def) return refuse('missing', 'That card is not in the deck.');
  if (instance.sourceArmamentId || instance.grantedBy) return refuse('armament', `${def.name} is upgraded with its armament.`);
  const cost = upgradeCost(run, instance, def, registries);
  if (cost === null) {
    return n > MAX_CARD_UPGRADES ? refuse('cap', `${def.name} is already at ${MAX_CARD_UPGRADES} upgrades.`)
      : refuse('maxed', `${def.name} is fully upgraded.`);
  }
  if (cost > stonesOf(run)) return refuse('stones', `Needs ${cost} Smithing Stone; you have ${stonesOf(run)}.`, cost);
  return { ok: true, code: '', reason: '', cost, n, free: cost === 0 };
}
