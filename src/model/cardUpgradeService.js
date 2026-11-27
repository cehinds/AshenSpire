// The Core card-upgrade service: plan (inert) then commit (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md).
// planCardUpgrade reads the run and writes nothing, so a preview equals the
// commit: the roll is the stateless mulberry32(hash(run.seed, instanceId, stepIndex)).
import { canUpgrade, nextUpgradeStep, nextUpgradeOptions, RestUpgradeRule } from './cardUpgradeLimits.js';
import { CardUpgradeRules } from './cardUpgradeRules.js';
import { upgradeStepsOf, paidUpgradeCount, MAX_CARD_UPGRADES } from './cardUpgrade.js';
import { playsEverOf } from './cardRamp.js';
import { VisibleCardRank } from './cardRank.js';
import { UpgradeOfferKey } from './upgradeOffer.js';
import { GetActiveScoring } from './activeScoring.js';
import { resolveCard } from './registries.js';
import { projectGameCard } from './gameProfile.js';
import * as MechanicalProjection from './cardMechanicalProjection.js';

const MAX_PLAN_CACHE_PER_RUN = 256;
const planCacheByRun = new WeakMap();

const findInstance = (run, instanceId) => [...(run.deck || []), ...(run.sideboard || [])].find((card) => card && card.instanceId === instanceId) || null;
const face = (registries, run, instance) => projectGameCard(run, instance) || resolveCard(registries, instance);

/** Compact fingerprint of run-level gear/stat/relic/skill state that affects projected faces and checkDamageUpgrade. */
export function RunUpgradeStateFingerprint(run) {
  if (!run || typeof run !== 'object') return '';
  return JSON.stringify([
    run.loadout?.active || null,
    run.loadout?.sets || null,
    run.itemUpgradeLevels || null,
    run.itemUpgradePicks || null,
    run.itemCategories || null,
    run.relics || null,
    run.skills || null,
    run.attributes || null,
    run.baseAttributes || null,
    run.attributeBonuses || null,
    run.combatMechanics || run.gameProfile?.combatMechanics || null,
  ]);
}

function planCacheKey(run, instance, count, combos, vendor, runFingerprint) {
  return [
    run?.seed ?? 0,
    UpgradeOfferKey(run),
    run?.actNumber ?? 0,
    run?.mapNodeId ?? '',
    run?.level?.level ?? 1,
    run?.rangePolicy?.maxRange ?? '',
    Number.isSafeInteger(run?.smithingStones) ? run.smithingStones : 0,
    runFingerprint,
    instance.instanceId,
    instance.cardId,
    JSON.stringify(upgradeStepsOf(instance)),
    VisibleCardRank(instance),
    instance.rank ?? '',
    instance.rarityOverride ?? '',
    instance.abilityRank ?? '',
    instance.sourceArmamentId ?? '',
    instance.grantedBy ?? '',
    playsEverOf(instance),
    count,
    combos ? 1 : 0,
    vendor || '',
  ].join('|');
}

/** Clear the in-memory upgrade plan cache for a run (or when custom scoring changes). */
export function ClearCardUpgradePlanCache(run) {
  if (run && typeof run === 'object') planCacheByRun.delete(run);
}

/**
 * planCardUpgrade(run, registries, instanceId) → a quote, mutating nothing:
 * { ok, code, reason, instanceId, n, cost, free, step, before, after }.
 * `step`, `before` and `after` are present whenever the card can be upgraded at
 * all (also when the player is only short of stones, so the picker can still
 * show what the upgrade would do).
 * `choices` > 1 (a blacksmith; see upgradeChoiceCount) adds `options: [{ step, after }]`, the distinct steps the
 * player picks from, `step`/`after` being the first; the quote remembers `choices` so a commit re-plans the same list.
 */
export function planCardUpgrade(run, registries, instanceId, options = {}) {
  return planCardUpgradeInOperation(run, registries, instanceId, options, null);
}

/**
 * Plan an ordered, synchronous list of { instanceId, choices?, combos?, vendor? }.
 * Only invariant setup is shared; every request owns its menu, CP baseline and
 * RNG/rejection state. No callback, fingerprint or reusable scratch is accepted
 * or returned. A new operation is created on every call, including after edits.
 */
export function PlanCardUpgradeBatch(run, registries, requests = []) {
  if (!Array.isArray(requests)) throw new TypeError('Upgrade batch requests must be an array.');
  if (!requests.length) return [];
  const operation = {
    fingerprint: RunUpgradeStateFingerprint(run),
    projectionScope: MechanicalProjection.CreateCardUpgradeProjectionScope(),
    scorer: undefined,
  };
  return requests.map((request) => planCardUpgradeInOperation(run, registries, request.instanceId, request, operation));
}

function planCardUpgradeInOperation(run, registries, instanceId, { choices = 1, combos = false, vendor = '' } = {}, operation = null) {
  const instance = findInstance(run, instanceId);
  const maxChoices = CardUpgradeRules(registries).offers.maxChoices;
  const count = Number.isInteger(choices) && choices > 1
    ? Math.min(choices, maxChoices)
    : 1;
  const activeScoring = GetActiveScoring();
  let runMap = null;
  let cacheKey = '';
  if (run && typeof run === 'object' && instance) {
    runMap = planCacheByRun.get(run);
    if (!runMap) {
      runMap = new Map();
      planCacheByRun.set(run, runMap);
    }
    cacheKey = planCacheKey(run, instance, count, combos, vendor,
      operation ? operation.fingerprint : RunUpgradeStateFingerprint(run));
    const hit = runMap.get(cacheKey);
    if (hit && hit.scoring === activeScoring && hit.registries === registries && hit.gameProfile === run.gameProfile) return hit.quote;
  }

  // Eligibility and the offered roll use the same structural menu. This
  // preparation lives for this synchronous plan only, never in a run cache.
  const preparation = { projectionScope: operation ? operation.projectionScope : MechanicalProjection.CreateCardUpgradeProjectionScope() };
  if (operation) Object.defineProperty(preparation, 'scorer', {
    get: () => operation.scorer,
    set: (value) => { operation.scorer = value; },
  });
  const verdict = canUpgrade(registries, run, instance || { instanceId, cardId: '' }, { preparation });
  const quote = { ok: verdict.ok, code: verdict.code, reason: verdict.reason, instanceId, n: verdict.n, cost: verdict.cost, free: verdict.free, step: null, before: null, after: null };
  let result = quote;
  if (instance && (verdict.ok || verdict.code === 'stones')) {
    const base = registries.cards.get(instance.cardId);
    const applied = upgradeStepsOf(instance);
    const after = (step) => face(registries, run, { ...instance, upgraded: true, upgradeSteps: [...applied, step] });
    if (count === 1) {
      const step = vendor ? nextUpgradeOptions(run, instance, base, registries, 1, { vendor, preparation })[0] || null : nextUpgradeStep(run, instance, base, registries, { preparation });
      result = { ...quote, ...(vendor ? { vendor } : {}), step, before: face(registries, run, instance), after: after(step) };
    } else {
      const options = nextUpgradeOptions(run, instance, base, registries, count, { combos, vendor, preparation }).map((step) => ({ step, after: after(step) }));
      result = { ...quote, choices: count, combos, ...(vendor ? { vendor } : {}), step: options[0].step, options, before: face(registries, run, instance), after: options[0].after };
    }
  }
  if (runMap && cacheKey) {
    if (runMap.size >= MAX_PLAN_CACHE_PER_RUN) runMap.delete(runMap.keys().next().value);
    runMap.set(cacheKey, { scoring: activeScoring, registries, gameProfile: run.gameProfile, quote: result });
  }
  return result;
}

/** The quote a rest-site Upgrade Card shows for an instance: 1 option up to the third upgrade, 2 (some with two effects) from the fourth. */
export function PlanRestCardUpgrade(run, registries, instanceId) {
  const instance = findInstance(run, instanceId);
  return planCardUpgrade(run, registries, instanceId, instance ? RestUpgradeRule(instance, registries) : {});
}

/**
 * commitCardUpgrade(run, registries, quote) → { instanceId, step, n, spentStones }.
 * Re-plans from the run as it stands, refuses a quote that no longer matches
 * (a different roll, price or upgrade number), spends the stones and appends
 * the step. Throws on a refusal; the run is untouched then.
 */
export function commitCardUpgrade(run, registries, quote) {
  const plan = planCardUpgrade(run, registries, quote && quote.instanceId, { choices: quote && quote.choices, combos: !!(quote && quote.combos), vendor: (quote && quote.vendor) || '' });
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
  if (step?.nextRarity) instance.rarityOverride = step.nextRarity;
  if (Number.isInteger(step?.nextRank) && step.nextRank > (instance.rank || 0)) instance.rank = step.nextRank;
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
  if (paidUpgradeCount(instance) >= MAX_CARD_UPGRADES) return null; // the cap counts slot-using steps (canUpgrade)
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
