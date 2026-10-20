// Pure versioned engagement and action quotes. Stances and formation positions
// never own these distances; callers supply the committed contact sources.
import { RANGES } from './combatRanges.js';
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string' && v.length > 0;
const band = v => Number.isInteger(v) && v >= 0 && v <= 2;
const count = v => Number.isSafeInteger(v) && v >= 0;
const fields = (v, keys) => record(v) && Object.keys(v).every(k => keys.includes(k));
export const RANGE_POLICY_DEFAULTS = Object.freeze({ version: 1, enabled: true, advanceSpPerBand: 1, reachPrecisionBonus: 1, throwPrecisionPenalty: 1 });
export const RANGE_SETTING_KEYS = Object.freeze({ enabled: 'rangeMechanics', advanceSpPerBand: 'rangeAdvanceSpPerBand', reachPrecisionBonus: 'rangeReachPrecisionBonus', throwPrecisionPenalty: 'rangeThrowPrecisionPenalty' });
export function rangePolicyProblems(policy) {
  return fields(policy, Object.keys(RANGE_POLICY_DEFAULTS)) && policy.version === 1 && typeof policy.enabled === 'boolean'
    && ['advanceSpPerBand', 'reachPrecisionBonus', 'throwPrecisionPenalty'].every(k => count(policy[k])) ? [] : ['Invalid range policy'];
}
export function snapshotRangePolicy(authored = RANGE_POLICY_DEFAULTS, settings = {}) {
  const policy = { ...RANGE_POLICY_DEFAULTS, ...authored };
  for (const [field, key] of Object.entries(RANGE_SETTING_KEYS)) if (Object.hasOwn(settings, key)) policy[field] = settings[key];
  const problems = rangePolicyProblems(policy); if (problems.length) throw Error(problems.join('; '));
  return policy;
}
export const rangeBand = range => typeof range === 'number' && band(range) ? range : RANGES.indexOf(range);
export function actorRangeKey(ctx, entity) {
  if (!entity) return null;
  if (entity.kind === 'enemy' || entity.enemyId) return `enemy:${entity.id}`;
  const seat = ctx.playerIdForEntity?.(entity) || [...(ctx.players?.entries?.() || [])].find(([, row]) => row.entity === entity)?.[0];
  return seat ? `player:${seat}` : entity.rangeActorKey || (entity === ctx.player || entity.id === 'player' ? 'player:player' : null);
}
export const rangePairKey = (a, b) => JSON.stringify([a, b].sort());
export const opposingRangeKeys = (a, b) => text(a) && text(b) && ((a.startsWith('player:') && b.startsWith('enemy:')) || (a.startsWith('enemy:') && b.startsWith('player:')));
export function createRangeState(policy, actors) {
  if (rangePolicyProblems(policy).length) throw Error('Invalid range policy');
  const engagements = {};
  for (const a of actors) for (const b of actors) if (opposingRangeKeys(a.key, b.key)) {
    const aa = rangeBand(a.startingRange ?? 'melee'), bb = rangeBand(b.startingRange ?? 'melee');
    if (!band(aa) || !band(bb)) throw Error('Invalid starting engagement band');
    engagements[rangePairKey(a.key, b.key)] = Math.max(aa, bb);
  }
  const state = { version: 1, policy: structuredClone(policy), engagements };
  const problems = rangeStateProblems(state, actors.map(row => row.key));
  if (problems.length) throw Error(problems.join('; '));
  return state;
}
export function rangeStateProblems(state, actorKeys = null) {
  const problems = [];
  if (!fields(state, ['version', 'policy', 'engagements']) || state.version !== 1 || !record(state.engagements)) return ['Invalid engagement state'];
  problems.push(...rangePolicyProblems(state.policy));
  const known = actorKeys && new Set(actorKeys);
  if (known && (known.size !== actorKeys.length || actorKeys.some(key => !text(key) || !/^(player|enemy):.+/.test(key)))) problems.push('Invalid range actor identities');
  for (const [key, value] of Object.entries(state.engagements)) {
    let pair; try { pair = JSON.parse(key); } catch {}
    if (!Array.isArray(pair) || pair.length !== 2 || !opposingRangeKeys(...pair) || rangePairKey(...pair) !== key || !band(value)
      || known && pair.some(id => !known.has(id))) problems.push('Invalid engagement pair');
  }
  if (known) for (const a of known) for (const b of known) if (opposingRangeKeys(a, b) && !Object.hasOwn(state.engagements, rangePairKey(a, b))) problems.push('Missing engagement pair');
  return [...new Set(problems)];
}
export function engagementBand(state, sourceKey, targetKey) {
  const value = state?.engagements?.[rangePairKey(sourceKey, targetKey)];
  if (!band(value)) throw Error('Missing engagement pair');
  return value;
}
export function movedEngagementState(state, sourceKey, targetKey, bands) {
  if (!state?.policy.enabled) return state;
  if (![1, -1].includes(bands)) throw Error('Engagement movement requires one band');
  const next = Math.max(0, Math.min(2, engagementBand(state, sourceKey, targetKey) + bands));
  return { ...state, engagements: { ...state.engagements, [rangePairKey(sourceKey, targetKey)]: next } };
}
const contextBand = (context, sourceKey, targetKey, fallback) => {
  const row = context?.targets?.find(row => rangePairKey(context.sourceKey, row.targetKey) === rangePairKey(sourceKey, targetKey));
  return row ? row.effectiveBand : fallback;
};
/** Each contact supplies targetKey, coverage, weapon, throwCapable and bypass.
 * Multiple contacts may share a target but keep their own committed source.
 * An incoming root context supplies temporary distance to nested reactions. */
export function rangeActionPlan(state, sourceKey, contacts, { route = 'advance', context = null } = {}) {
  if (!state) return null;
  if (!['advance', 'throw'].includes(route)) throw Error('Unknown range route');
  if (rangeStateProblems(state).length || !Array.isArray(contacts)) throw Error('Invalid engagement plan input');
  const policy = state.policy;
  let available = route !== 'throw' || policy.enabled, maxMissing = 0;
  const targets = contacts.map((contact, index) => {
    const { targetKey, weapon = false, throwCapable = false, bypass = false, sourceWeaponId = null } = contact;
    const coverage = rangeBand(contact.coverage ?? 'melee');
    if (!opposingRangeKeys(sourceKey, targetKey) || !band(coverage)) throw Error('Invalid range contact');
    const actualBand = engagementBand(state, sourceKey, targetKey);
    const distance = contextBand(context, sourceKey, targetKey, actualBand);
    const missingBands = policy.enabled && !bypass ? Math.max(0, distance - coverage) : 0;
    const extended = route === 'throw' && missingBands > 0;
    if (extended && (!throwCapable || missingBands > 1)) available = false;
    maxMissing = Math.max(maxMissing, missingBands);
    return { contactId: contact.contactId ?? String(index), targetKey, actualBand, band: distance, coverage,
      weapon: !!weapon, throwCapable: !!throwCapable, bypass: !!bypass, sourceWeaponId,
      missingBands, effectiveBand: !policy.enabled || bypass ? Math.min(distance, coverage) : route === 'advance' ? Math.min(distance, coverage) : distance,
      precisionDelta: policy.enabled ? (weapon && coverage === 1 && actualBand === 0 ? policy.reachPrecisionBonus : 0) - (extended ? policy.throwPrecisionPenalty : 0) : 0 };
  });
  // Approach changes one temporary pair distance, shared by every source in
  // this root. A bow and dagger cannot put the same opponent in two places.
  const approachByPair = new Map();
  if (policy.enabled && route === 'advance') for (const row of targets) {
    approachByPair.set(row.targetKey, Math.max(approachByPair.get(row.targetKey) || 0, row.missingBands));
  }
  for (const row of targets) row.effectiveBand = policy.enabled ? Math.max(0, row.band - (approachByPair.get(row.targetKey) || 0)) : row.band;
  const advanceSp = policy.enabled && route === 'advance' ? maxMissing * policy.advanceSpPerBand : 0;
  if (!count(advanceSp)) throw Error('Range payment exceeds the safe integer limit');
  return { version: 1, sourceKey, route, available, advanceSp, targets };
}
export function rangePlanProblems(plan, state, actorKeys = null) {
  if (!fields(plan, ['version', 'sourceKey', 'route', 'available', 'advanceSp', 'targets', 'rootId', 'paid']) || plan.version !== 1
    || !['advance', 'throw'].includes(plan.route) || typeof plan.available !== 'boolean' || !count(plan.advanceSp) || !Array.isArray(plan.targets)
    || !text(plan.sourceKey) || !/^(player|enemy):.+/.test(plan.sourceKey) || actorKeys && !actorKeys.includes(plan.sourceKey)
    || plan.rootId !== undefined && !text(plan.rootId)) return ['Invalid range action plan'];
  for (const row of plan.targets) if (!fields(row, ['contactId', 'targetKey', 'actualBand', 'band', 'coverage', 'weapon', 'throwCapable', 'bypass', 'sourceWeaponId', 'missingBands', 'effectiveBand', 'precisionDelta'])
    || !text(row.contactId) || !opposingRangeKeys(plan.sourceKey, row.targetKey) || actorKeys && !actorKeys.includes(row.targetKey)
    || !['actualBand', 'band', 'coverage', 'effectiveBand'].every(k => band(row[k])) || !count(row.missingBands) || row.missingBands > 2
    || !Number.isSafeInteger(row.precisionDelta) || !['weapon', 'throwCapable', 'bypass'].every(k => typeof row[k] === 'boolean')
    || row.sourceWeaponId !== null && !text(row.sourceWeaponId)) return ['Invalid range contact receipt'];
  if (new Set(plan.targets.map(row => row.contactId)).size !== plan.targets.length) return ['Duplicate range contacts'];
  if (plan.paid !== undefined && (!fields(plan.paid, ['energy', 'stamina', 'mana']) || !['energy', 'stamina', 'mana'].every(k => count(plan.paid[k])) || plan.paid.stamina < plan.advanceSp)) return ['Invalid range payment receipt'];
  if (state) {
    // Persistent movement may already differ; validate against the frozen quote.
    const frozen = { ...state, engagements: { ...state.engagements } };
    for (const row of plan.targets) frozen.engagements[rangePairKey(plan.sourceKey, row.targetKey)] = row.actualBand;
    const context = { sourceKey: plan.sourceKey, targets: plan.targets.map(row => ({ targetKey: row.targetKey, effectiveBand: row.band })) };
    try {
      const expected = rangeActionPlan(frozen, plan.sourceKey, plan.targets, { route: plan.route, context });
      if (expected.advanceSp !== plan.advanceSp || expected.available !== plan.available
        || expected.targets.some((row, i) => JSON.stringify(row) !== JSON.stringify(plan.targets[i]))) return ['Range receipt does not match its frozen quote'];
    } catch { return ['Invalid range action plan']; }
  }
  return [];
}
