// The Core card-upgrade service: plan (inert) then commit (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md).
// planCardUpgrade reads the run and writes nothing, so a preview equals the
// commit: the roll is the stateless mulberry32(hash(run.seed, instanceId, stepIndex)).
import { canUpgrade } from './cardUpgradeLimits.js';
import { rollUpgradeStep, upgradeStepRng } from './cardUpgradeSteps.js';
import { upgradeStepsOf } from './cardUpgrade.js';
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
  const stepIndex = applied.length;
  const mana = (registries.balance && registries.balance.mana) || {};
  const step = stepIndex === 0 && base.upgrade
    ? { k: 'authored' }
    : rollUpgradeStep(base, applied, stepIndex, upgradeStepRng(run.seed, instance.instanceId, stepIndex), mana);
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
