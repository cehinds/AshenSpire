// How many Core card upgrades are free, what the next one costs, and whether it
// can be bought (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md, owner rulings of
// 2026-10-28). Pure reads of the run: nothing here mutates.
import { cardRank } from './cardRank.js';
import { upgradeCount, upgradeStepsOf, MAX_CARD_UPGRADES } from './cardUpgrade.js';
import { rollUpgradeOptions, upgradeStepRng } from './cardUpgradeSteps.js';

/**
 * upgradeBasic(def) → whether a card is "Basic" for upgrades (owner ruling,
 * 2026-10-28): a common card that is not a spell, or any cantrip. Uncommon,
 * rare and starter cards (the class specials, Mana Surge) are not. This is
 * deliberately not the Martial Adept training rule (model/basicCardRule.js),
 * which marks almost every martial card Basic.
 */
export function upgradeBasic(def, instance = null) {
  const tags = (def && def.tags) || [];
  if (tags.includes('rank.cantrip')) return true;
  // A rank-down upgrade step (tag rank.cantrip) makes this copy count as a cantrip.
  if (upgradeStepsOf(instance || {}).some((step) => step.k === 'tag' && step.tag === 'rank.cantrip')) return true;
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
  if (upgradeBasic(def, instance)) return 1;
  return Math.min(MAX_CARD_UPGRADES, cardRank(instance));
}

/**
 * upgradeChoiceCount(def, instance, { blacksmith }) → how many options a player picks from (owner, 2026-10-31):
 * a blacksmith offers 2 on a Basic card and 3 on a ranked (not Basic) card; a rest-site upgrade, an event
 * reward and co-op keep the single roll (1).
 */
export function upgradeChoiceCount(def, instance, { blacksmith = false } = {}) {
  if (!blacksmith) return 1;
  return upgradeBasic(def, instance) ? 2 : 3;
}

/**
 * nextUpgradeOptions(run, instance, base, registries, count) → up to `count` distinct steps the next upgrade could
 * add, [] when the card is maxed. A first upgrade of a card with an upgrade block lists `authored` (the card's
 * designed upgrade) first, then one rolled alternative when count > 1; otherwise the seeded roll's options.
 * The first entry is always what nextUpgradeStep returns. Stateless.
 */
export function nextUpgradeOptions(run, instance, base, registries, count = 1) {
  const applied = upgradeStepsOf(instance);
  const mana = (registries && registries.balance && registries.balance.mana) || {};
  // Core ranks scale the face after the steps, so the roll sees the rank the card will be shown at.
  const rank = run.gameProfile?.modules?.progression?.cardRanks === true ? cardRank(instance) : 1;
  const roll = (n) => rollUpgradeOptions(base, applied, applied.length, upgradeStepRng(run.seed, instance.instanceId, applied.length), { ...mana, rank, exposure: registries?.balance?.exposure?.buildupPerManaSpell }, n);
  if (applied.length === 0 && base.upgrade) return count > 1 ? [{ k: 'authored' }, ...roll(1)] : [{ k: 'authored' }];
  return roll(count);
}

/**
 * nextUpgradeStep(run, instance, base, registries) → the step the next upgrade
 * would add: `authored` for a first upgrade when the card has an upgrade block,
 * else the seeded roll; null when no kind is eligible (the card is maxed).
 * Stateless: the same run, instance and count always give the same step.
 */
export function nextUpgradeStep(run, instance, base, registries) {
  return nextUpgradeOptions(run, instance, base, registries, 1)[0] || null;
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
