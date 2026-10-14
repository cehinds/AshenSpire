import { ASHEN_BLIGHT_RULES, ASHEN_BLIGHT_PATHS } from '../content/ashenBlight.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = value => Number.isSafeInteger(value) && value >= 0;
const key = value => typeof value === 'string' && value.length > 0;
const outcomes = [null, 'survived', 'lost'];

export function createAshenBlightState() {
  return { schemaVersion: 1, value: 0, thresholdOutcome: null, convertedAtCombat: null,
    milestones: [], payments: [], entries: [] };
}

/** Strict save validation; restoring this data must never roll or claim a feat. */
export function ashenBlightProblems(state, path = 'ashenBlight') {
  if (!object(state)) return [`${path} must be an object`];
  const problems = [];
  if (state.schemaVersion !== 1) problems.push(`${path}.schemaVersion must be 1`);
  if (!whole(state.value) || state.value > 100) problems.push(`${path}.value must be a whole number from 0 to 100`);
  if (!outcomes.includes(state.thresholdOutcome)) problems.push(`${path}.thresholdOutcome is invalid`);
  if ((state.value === 100) !== (state.thresholdOutcome === 'survived' || state.thresholdOutcome === 'lost')) problems.push(`${path}.thresholdOutcome must record the 100 event exactly once`);
  if (state.thresholdOutcome === 'survived' ? !key(state.convertedAtCombat) : state.convertedAtCombat !== null) problems.push(`${path}.convertedAtCombat must identify a surviving transformation`);
  for (const field of ['milestones', 'payments', 'entries']) if (!Array.isArray(state[field])) problems.push(`${path}.${field} must be an array`);
  const tiers = new Set();
  for (const row of Array.isArray(state.milestones) ? state.milestones : []) {
    const index = ASHEN_BLIGHT_RULES.milestones.indexOf(row?.threshold);
    if (!object(row) || index < 0 || row.tier !== index + 1 || row.threshold > state.value || tiers.has(row.threshold)
      || (row.path !== null && !ASHEN_BLIGHT_PATHS.includes(row.path))) problems.push(`${path}.milestones contains an invalid or repeated locked-tier choice`);
    tiers.add(row?.threshold);
  }
  if (state.thresholdOutcome !== 'lost') for (const threshold of ASHEN_BLIGHT_RULES.milestones) {
    if (state.value >= threshold && !tiers.has(threshold)) problems.push(`${path}.milestones omits crossed threshold ${threshold}`);
  }
  let previous = 0;
  let committedOutcome = null;
  let conversionKey = null;
  const ids = new Set();
  for (const row of Array.isArray(state.payments) ? state.payments : []) {
    if (!object(row) || !key(row.id) || ids.has(row.id) || !key(row.combatKey) || !whole(row.amount)
      || row.before !== previous || row.after !== Math.min(100, row.before + row.amount)
      || !outcomes.includes(row.thresholdOutcome)) problems.push(`${path}.payments contains an invalid or repeated payment receipt`);
    const reachesThreshold = row?.before < 100 && row?.after === 100;
    if (row?.amount === 0 && (row.before !== 100 || committedOutcome !== 'survived')) problems.push(`${path}.payments may record zero only for a converted surviving character`);
    if (reachesThreshold ? !['survived', 'lost'].includes(row.thresholdOutcome) : row?.thresholdOutcome !== null) problems.push(`${path}.payments must record an outcome only on first reaching 100`);
    if (committedOutcome === 'lost') problems.push(`${path}.payments cannot follow terminal loss`);
    if (reachesThreshold) { committedOutcome = row.thresholdOutcome; if (committedOutcome === 'survived') conversionKey = row.combatKey; }
    ids.add(row?.id);
    previous = row?.after;
  }
  if (previous !== state.value) problems.push(`${path}.value must match its committed payment history`);
  if (committedOutcome !== state.thresholdOutcome || conversionKey !== state.convertedAtCombat) problems.push(`${path}.thresholdOutcome must match its threshold payment receipt`);
  const rooms = new Set();
  let entryLoss = false;
  for (const row of Array.isArray(state.entries) ? state.entries : []) {
    if (!object(row) || !key(row.combatKey) || rooms.has(row.combatKey) || row.combatKey === state.convertedAtCombat
      || !['survived', 'lost'].includes(row.outcome) || state.thresholdOutcome !== 'survived') problems.push(`${path}.entries contains an invalid or repeated encounter receipt`);
    if (entryLoss) problems.push(`${path}.entries cannot follow terminal loss`);
    if (row?.outcome === 'lost') entryLoss = true;
    rooms.add(row?.combatKey);
  }
  return problems;
}

export function createAshenBlightCombatState() {
  return { cycleKey: null, used: { martial: false, spell: false, survivor: false }, wardCarry: 0 };
}

export function ashenBlightCombatProblems(state, path = 'ashenBlightCombat') {
  if (!object(state)) return [`${path} must be an object`];
  const problems = [];
  if (state.cycleKey !== null && !key(state.cycleKey)) problems.push(`${path}.cycleKey is invalid`);
  if (!object(state.used) || ASHEN_BLIGHT_PATHS.some(family => typeof state.used[family] !== 'boolean')) problems.push(`${path}.used must contain each family's shared cycle budget`);
  if (!Number.isFinite(state.wardCarry) || state.wardCarry < 0 || state.wardCarry >= 1) problems.push(`${path}.wardCarry must be a fraction from 0 to less than 1`);
  return problems;
}

export function ashenBlightBonuses(owner) {
  const selected = (owner?.ashenBlight?.milestones || []).filter(row => ASHEN_BLIGHT_PATHS.includes(row.path));
  const strengths = Object.fromEntries(ASHEN_BLIGHT_PATHS.map(path => [path,
    Math.max(0, ...selected.filter(row => row.path === path).map(row => row.tier))]));
  const attributes = { strength: 0, intelligence: 0, constitution: 0 };
  const attribute = { martial: 'strength', spell: 'intelligence', survivor: 'constitution' };
  for (const row of selected) attributes[attribute[row.path]] += row.tier;
  return { attributes, martialPoise: strengths.martial, spellBuildup: strengths.spell ? 1 : 0,
    restorationBonusPct: [0, 10, 15, 20][strengths.survivor], wardPenaltyPct: [0, 10, 15, 20][strengths.martial],
    maxStaminaPenalty: strengths.spell, openingHandPenalty: strengths.survivor ? 1 : 0 };
}

/** Allocation stays untouched; call on the allocated base, never an already boosted projection. */
export function effectiveAshenBlightAttributes(owner, allocated = owner?.allocatedAttributes || owner?.attributes || {}) {
  const result = { ...allocated };
  if (owner?.combatExpansionVersion !== 2) return result;
  for (const [id, bonus] of Object.entries(ashenBlightBonuses(owner).attributes)) result[id] = (result[id] || 0) + bonus;
  return result;
}
