// The Core card-upgrade service: plan (inert) then commit (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md).
// planCardUpgrade reads the run and writes nothing, so a preview equals the
// commit: the roll is the stateless mulberry32(hash(run.seed, instanceId, stepIndex)).
import { canUpgrade, nextUpgradeStep } from './cardUpgradeLimits.js';
import { upgradeStepsOf, upgradeCount, MAX_CARD_UPGRADES } from './cardUpgrade.js';
import { resolveCard } from './registries.js';
import { projectGameCard } from './gameProfile.js';

const findInstance = (run, instanceId) => [...(run.deck || []), ...(run.sideboard || [])].find((card) => card && card.instanceId === instanceId) || null;
const face = (registries, run, instance) => projectGameCard(run, instance) || resolveCard(registries, instance);

/**
 * planCardUpgrade(run, registries, instanceId) → a quote, mutating nothing:
 * { ok, code, reason, instanceId, n, cost, free, step, before, after }.
 * `step`, `before` and `after` are present whenever the card can be upgraded at
 * all (also when the player is only short of stones, so the picker can still
 * show what the upgrade would do).
 */
export function planCardUpgrade(run, registries, instanceId) {
  const instance = findInstance(run, instanceId);
  const verdict = canUpgrade(registries, run, instance || { instanceId, cardId: '' });
  const quote = { ok: verdict.ok, code: verdict.code, reason: verdict.reason, instanceId, n: verdict.n, cost: verdict.cost, free: verdict.free, step: null, before: null, after: null };
  if (!instance || (!verdict.ok && verdict.code !== 'stones')) return quote;

  const base = registries.cards.get(instance.cardId);
  const applied = upgradeStepsOf(instance);
  const step = nextUpgradeStep(run, instance, base, registries);
  const upgradedInstance = { ...instance, upgraded: true, upgradeSteps: [...applied, step] };
  return { ...quote, step, before: face(registries, run, instance), after: face(registries, run, upgradedInstance) };
}

/**
 * commitCardUpgrade(run, registries, quote) → { instanceId, step, n, spentStones }.
 * Re-plans from the run as it stands, refuses a quote that no longer matches
 * (a different roll, price or upgrade number), spends the stones and appends
 * the step. Throws on a refusal; the run is untouched then.
 */
export function commitCardUpgrade(run, registries, quote) {
  const plan = planCardUpgrade(run, registries, quote && quote.instanceId);
  if (!plan.ok) throw new Error(plan.reason || 'That card cannot be upgraded.');
  if (!quote || quote.n !== plan.n || quote.cost !== plan.cost || JSON.stringify(quote.step) !== JSON.stringify(plan.step)) {
    throw new Error('That upgrade quote is out of date; ask for a new one.');
  }
  const instance = findInstance(run, plan.instanceId);
  run.smithingStones = (Number.isSafeInteger(run.smithingStones) ? run.smithingStones : 0) - plan.cost;
  instance.upgradeSteps = [...upgradeStepsOf(instance), plan.step];
  instance.upgraded = true;
  return { instanceId: plan.instanceId, step: plan.step, n: plan.n, spentStones: plan.cost };
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
