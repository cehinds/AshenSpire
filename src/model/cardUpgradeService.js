// The Core card-upgrade service: plan (inert) then commit (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md).
// planCardUpgrade reads the run and writes nothing, so a preview equals the
// commit: the roll is the stateless mulberry32(hash(run.seed, instanceId, stepIndex)).
import { canUpgrade, nextUpgradeStep, nextUpgradeOptions } from './cardUpgradeLimits.js';
import { upgradeStepsOf, upgradeCount, MAX_CARD_UPGRADES } from './cardUpgrade.js';
import { resolveCard } from './registries.js';
import { projectGameCard } from './gameProfile.js';

const MAX_CHOICES = 3;
const findInstance = (run, instanceId) => [...(run.deck || []), ...(run.sideboard || [])].find((card) => card && card.instanceId === instanceId) || null;
const face = (registries, run, instance) => projectGameCard(run, instance) || resolveCard(registries, instance);

/**
 * planCardUpgrade(run, registries, instanceId) → a quote, mutating nothing:
 * { ok, code, reason, instanceId, n, cost, free, step, before, after }.
 * `step`, `before` and `after` are present whenever the card can be upgraded at
 * all (also when the player is only short of stones, so the picker can still
 * show what the upgrade would do).
 * `choices` > 1 (a blacksmith; see upgradeChoiceCount) adds `options: [{ step, after }]`, the distinct steps the
 * player picks from, `step`/`after` being the first; the quote remembers `choices` so a commit re-plans the same list.
 */
export function planCardUpgrade(run, registries, instanceId, { choices = 1 } = {}) {
  const instance = findInstance(run, instanceId);
  const verdict = canUpgrade(registries, run, instance || { instanceId, cardId: '' });
  const quote = { ok: verdict.ok, code: verdict.code, reason: verdict.reason, instanceId, n: verdict.n, cost: verdict.cost, free: verdict.free, step: null, before: null, after: null };
  if (!instance || (!verdict.ok && verdict.code !== 'stones')) return quote;

  const base = registries.cards.get(instance.cardId);
  const applied = upgradeStepsOf(instance);
  const count = Number.isInteger(choices) && choices > 1 ? Math.min(choices, MAX_CHOICES) : 1;
  const after = (step) => face(registries, run, { ...instance, upgraded: true, upgradeSteps: [...applied, step] });
  if (count === 1) {
    const step = nextUpgradeStep(run, instance, base, registries);
    return { ...quote, step, before: face(registries, run, instance), after: after(step) };
  }
  const options = nextUpgradeOptions(run, instance, base, registries, count).map((step) => ({ step, after: after(step) }));
  return { ...quote, choices: count, step: options[0].step, options, before: face(registries, run, instance), after: options[0].after };
}

/**
 * commitCardUpgrade(run, registries, quote) → { instanceId, step, n, spentStones }.
 * Re-plans from the run as it stands, refuses a quote that no longer matches
 * (a different roll, price or upgrade number), spends the stones and appends
 * the step. Throws on a refusal; the run is untouched then.
 */
export function commitCardUpgrade(run, registries, quote) {
  const plan = planCardUpgrade(run, registries, quote && quote.instanceId, { choices: quote && quote.choices });
  if (!plan.ok) throw new Error(plan.reason || 'That card cannot be upgraded.');
  // A quote with several options commits whichever one the player chose, as long as it is still on the re-planned list.
  const offered = (plan.options ? plan.options.map((o) => o.step) : [plan.step]).map((s) => JSON.stringify(s));
  if (!quote || quote.n !== plan.n || quote.cost !== plan.cost || !offered.includes(JSON.stringify(quote.step))) {
    throw new Error('That upgrade quote is out of date; ask for a new one.');
  }
  const step = plan.options ? plan.options[offered.indexOf(JSON.stringify(quote.step))].step : plan.step;
  const instance = findInstance(run, plan.instanceId);
  run.smithingStones = (Number.isSafeInteger(run.smithingStones) ? run.smithingStones : 0) - plan.cost;
  instance.upgradeSteps = [...upgradeStepsOf(instance), step];
  instance.upgraded = true;
  return { instanceId: plan.instanceId, step, n: plan.n, spentStones: plan.cost };
}

/** Core (card ranks on) upgrades cards through steps; Legacy and Current keep the single authored upgrade. */
export const cardUpgradeStepsOn = (run) => run?.gameProfile?.modules?.progression?.cardRanks === true;

/**
 * freeCardUpgradeStep(run, registries, instance) → the step an event's free upgrade would add, or null when the
 * card is not an upgrade candidate (armament-bound, granted, at the cap, or maxed). Price is not asked: an event
 * reward is free. Same roll as the plan, so what the rules allow is what the picker would show.
 */
export function freeCardUpgradeStep(run, registries, instance) {
  if (!instance || instance.sourceArmamentId || instance.grantedBy || !registries.cards.has(instance.cardId)) return null;
  if (upgradeCount(instance) >= MAX_CARD_UPGRADES) return null;
  return nextUpgradeStep(run, instance, registries.cards.get(instance.cardId), registries);
}

/** applyFreeCardUpgrade(run, registries, instance) → { step, n }: appends the next step at no cost (an event reward). */
export function applyFreeCardUpgrade(run, registries, instance) {
  const step = freeCardUpgradeStep(run, registries, instance);
  if (!step) throw new Error('That card cannot be upgraded.');
  instance.upgradeSteps = [...upgradeStepsOf(instance), step];
  instance.upgraded = true;
  return { step, n: instance.upgradeSteps.length };
}
