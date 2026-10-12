// Reaction rules version 2 tuning (docs/combat-card-traits-contract.md).
// Pure data plus a validator; the card-trait projection lives below its own marker.

const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const pct = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1;
const count = value => Number.isSafeInteger(value) && value >= 0;
// Trait magnitudes stay small: tier 5 at the caps still yields at most 20 + 20 × 2 = 60 (< the 99 a saved carrier may hold).
const TUNING_MAX = 20;
const tuned = value => count(value) && value <= TUNING_MAX;

export const CARD_TRAIT_RULES = Object.freeze({
  counterstrike: Object.freeze({ pct: 0.5, advantagedPct: 0.75 }),
  impact: Object.freeze({ base: Object.freeze({ smash: 2, default: 1 }), perTwoTiers: 1 }),
  flux: Object.freeze({ base: 1, perTwoTiers: 1 }),
  stack: Object.freeze({ maxDepth: 4, counterReturnMaxDepth: 1 }),
  advantage: Object.freeze({
    attack: Object.freeze(['smash', 'casting']),
    smash: Object.freeze(['defend']),
    defend: Object.freeze(['sweep']),
    sweep: Object.freeze(['counter']),
    ranged: Object.freeze(['counter']),
    counter: Object.freeze(['attack', 'smash']),
    casting: Object.freeze([]),
  }),
});

// Returns a list of human-readable problems; an empty list means the rules are valid.
export function reactionRulesProblems(rules) {
  const problems = [];
  if (!record(rules)) return ['Reaction rules must be an object'];
  const { counterstrike, impact, flux, stack, advantage } = rules;
  if (!record(counterstrike) || !pct(counterstrike.pct) || !pct(counterstrike.advantagedPct)) problems.push('Counterstrike percentages must be numbers in (0, 1]');
  if (!record(impact) || !record(impact.base) || !tuned(impact.base.smash) || !tuned(impact.base.default) || !tuned(impact.perTwoTiers)) problems.push(`Impact tuning must be integers from 0 to ${TUNING_MAX}`);
  if (!record(flux) || !tuned(flux.base) || !tuned(flux.perTwoTiers)) problems.push(`Flux tuning must be integers from 0 to ${TUNING_MAX}`);
  if (!record(stack) || !Number.isSafeInteger(stack.maxDepth) || stack.maxDepth < 1 || stack.maxDepth > TUNING_MAX) problems.push(`Reaction stack maxDepth must be an integer from 1 to ${TUNING_MAX}`);
  if (record(stack) && (!Number.isSafeInteger(stack.counterReturnMaxDepth) || stack.counterReturnMaxDepth < 1)) problems.push('Counter return maxDepth must be a positive integer');
  if (!record(advantage) || Object.values(advantage).some(list => !Array.isArray(list) || list.some(item => typeof item !== 'string'))) problems.push('Advantage map must map maneuvers to arrays of maneuvers');
  return problems;
}

// Unfrozen deep copy of the rules a fight or run carries; absent rules mean the shipped tuning.
export function reactionRulesSnapshot(rules = null) {
  const copy = structuredClone(rules || CARD_TRAIT_RULES);
  const problems = reactionRulesProblems(copy);
  if (problems.length) throw new Error(`Invalid reaction rules: ${problems.join('; ')}`);
  return copy;
}

// ---- Card-trait projection (applyCardTraits) is added here by a later change. ----
