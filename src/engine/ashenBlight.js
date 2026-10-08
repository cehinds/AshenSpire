import { ASHEN_BLIGHT_RULES, ashenBlightFeat } from '../content/ashenBlight.js';
import { createAshenBlightState, createAshenBlightCombatState, ashenBlightProblems, ashenBlightCombatProblems, ashenBlightBonuses, effectiveAshenBlightAttributes } from '../model/ashenBlight.js';
export { ashenBlightBonuses, effectiveAshenBlightAttributes };

const enabled = ctx => ctx?.combatExpansionVersion === 2;
const textKey = (value, name) => { if (typeof value !== 'string' || !value) throw new Error(`${name} must be a non-empty string`); };
function stateOf(owner) {
  const state = owner.ashenBlight || createAshenBlightState();
  const problems = ashenBlightProblems(state);
  if (problems.length) throw new Error(problems.join('; '));
  return state;
}
function draw(ctx) {
  const value = typeof ctx.draw === 'function' ? ctx.draw() : ctx.rng.float('ashenBlight');
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Blight draw must be in [0, 1)');
  return value;
}
function tuning(ctx) {
  const rules = { ...ASHEN_BLIGHT_RULES, ...(ctx.ashenBlightRules || ctx.combatExpansionRules?.ashenBlight || {}) };
  for (const field of ['thresholdLossPct', 'encounterLossPct', 'convertedPrintedBonusPct']) {
    if (!Number.isFinite(rules[field]) || rules[field] < 0 || (field !== 'convertedPrintedBonusPct' && rules[field] > 100)) throw new Error(`Invalid Ashen Blight ${field}`);
  }
  if (!Number.isSafeInteger(rules.convertedActionDiscount) || rules.convertedActionDiscount < 0) throw new Error('Invalid Ashen Blight discount');
  return rules;
}

/** Mutates only the candidate owner. Its host must durably save before adopting/presenting. */
export function payAshenBlight(ctx, owner, { amount, receiptId, combatKey }) {
  if (!enabled(ctx)) return { active: false, paid: 0, terminal: false };
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Blight price must be a non-negative whole number');
  if (amount === 0 && owner?.ashenBlight?.thresholdOutcome !== 'survived') return { active: true, paid: 0, terminal: false };
  textKey(receiptId, 'Blight receipt id'); textKey(combatKey, 'Combat key');
  const current = stateOf(owner);
  const found = current.payments.find(row => row.id === receiptId);
  if (found) {
    if (found.amount !== amount || found.combatKey !== combatKey) throw new Error('Blight receipt conflicts with its committed payment');
    return { active: true, duplicate: true, paid: 0, terminal: found.thresholdOutcome === 'lost', outcome: found.thresholdOutcome, value: current.value };
  }
  if (current.thresholdOutcome === 'lost' || current.entries.some(row => row.outcome === 'lost')) throw new Error('Blight loss is terminal');
  const rules = tuning(ctx);
  const next = structuredClone(current), before = next.value;
  next.value = Math.min(100, before + amount);
  let outcome = null;
  if (next.value === 100 && next.thresholdOutcome === null) {
    outcome = draw(ctx) * 100 < rules.thresholdLossPct ? 'lost' : 'survived';
    next.thresholdOutcome = outcome;
    if (outcome === 'survived') next.convertedAtCombat = combatKey;
  }
  if (outcome !== 'lost') for (const [index, threshold] of ASHEN_BLIGHT_RULES.milestones.entries()) {
    if (next.value >= threshold && !next.milestones.some(row => row.threshold === threshold)) next.milestones.push({ threshold, tier: index + 1, path: null });
  }
  next.payments.push({ id: receiptId, combatKey, amount, before, after: next.value, thresholdOutcome: outcome });
  owner.ashenBlight = next;
  return { active: true, recorded: true, paid: amount, added: next.value - before, value: next.value, outcome,
    terminal: outcome === 'lost', converted: outcome === 'survived', pending: next.milestones.filter(row => row.path === null).map(row => ({ ...row })) };
}

export function rollAshenBlightEncounter(ctx, owner, combatKey) {
  if (!enabled(ctx)) return { active: false, rolled: false, terminal: false };
  textKey(combatKey, 'Combat key');
  const current = stateOf(owner);
  if (current.thresholdOutcome === 'lost') return { active: true, rolled: false, terminal: true, outcome: 'lost' };
  if (current.thresholdOutcome !== 'survived' || current.convertedAtCombat === combatKey) return { active: true, rolled: false, terminal: false };
  const found = current.entries.find(row => row.combatKey === combatKey);
  if (found) return { active: true, rolled: false, duplicate: true, terminal: found.outcome === 'lost', outcome: found.outcome };
  if (current.entries.some(row => row.outcome === 'lost')) return { active: true, rolled: false, terminal: true, outcome: 'lost' };
  const rules = tuning(ctx), next = structuredClone(current);
  const outcome = draw(ctx) * 100 < rules.encounterLossPct ? 'lost' : 'survived';
  next.entries.push({ combatKey, outcome }); owner.ashenBlight = next;
  return { active: true, rolled: true, terminal: outcome === 'lost', outcome };
}

export function chooseAshenBlightFeat(ctx, owner, { threshold, path }) {
  if (!enabled(ctx)) throw new Error('Ashen Blight feats require expansion version 2');
  const current = stateOf(owner), feat = ashenBlightFeat(threshold, path);
  if (!feat) throw new Error('Unknown Ashen Blight milestone/path');
  if (current.thresholdOutcome === 'lost' || current.entries.some(row => row.outcome === 'lost')) throw new Error('Blight loss grants no milestone choice');
  const row = current.milestones.find(milestone => milestone.threshold === threshold);
  if (!row || row.path !== null) throw new Error('This Blight milestone is not pending');
  if (current.milestones.some(milestone => milestone.threshold < threshold && milestone.path === null)) throw new Error('Choose the earlier Blight milestone first');
  const next = structuredClone(current); next.milestones.find(milestone => milestone.threshold === threshold).path = path;
  owner.ashenBlight = next;
  return feat;
}

export function corruptedCardProjection(ctx, owner, definition) {
  if (!enabled(ctx) || owner?.ashenBlight?.thresholdOutcome !== 'survived' || definition.ashenBlightConverted) return definition;
  const rules = tuning(ctx);
  const scale = amount => typeof amount === 'number' ? amount * (1 + rules.convertedPrintedBonusPct / 100)
    : { f: 'mul', args: [1 + rules.convertedPrintedBonusPct / 100, structuredClone(amount)] };
  return { ...definition, corrupted: true, ashenBlightConverted: true, ashenBlightCost: definition.ashenBlightCost || 0,
    cost: typeof definition.cost === 'number' ? Math.max(0, definition.cost - rules.convertedActionDiscount) : definition.cost,
    effects: (definition.effects || []).map(effect => ['damage', 'heal', 'block', 'barrier', 'gainBarrier'].includes(effect.op) && effect.amount !== undefined
      ? { ...effect, amount: scale(effect.amount), ...(effect.op === 'heal' ? {
        ashenBlightBaseAmount: structuredClone(effect.amount), ashenBlightBonusPct: rules.convertedPrintedBonusPct,
      } : {}) } : { ...effect }),
  };
}

/** Called at owner-turn start, including cycles where incapacitated; Ward carry survives. */
export function beginAshenBlightCycle(ctx, owner, cycleKey) {
  if (!enabled(ctx)) return null;
  textKey(cycleKey, 'Owner cycle key');
  const state = owner.ashenBlightCombat || createAshenBlightCombatState();
  const problems = ashenBlightCombatProblems(state); if (problems.length) throw new Error(problems.join('; '));
  if (state.cycleKey !== cycleKey) { state.cycleKey = cycleKey; state.used = { martial: false, spell: false, survivor: false }; }
  owner.ashenBlightCombat = state;
  return state;
}

export function claimAshenBlightProc(ctx, owner, family, cycleKey) {
  if (!enabled(ctx)) return false;
  if (!['martial', 'spell', 'survivor'].includes(family)) throw new Error('Unknown Ashen Blight family');
  const bonus = ashenBlightBonuses(owner);
  if (!(family === 'martial' ? bonus.martialPoise : family === 'spell' ? bonus.spellBuildup : bonus.restorationBonusPct)) return false;
  const state = beginAshenBlightCycle(ctx, owner, cycleKey);
  if (state.used[family]) return false;
  state.used[family] = true; return true;
}

export function ashenBlightMartialPoise(ctx, owner, { cycleKey, camp, authoredPoise }) {
  if (camp !== 'physical' || !(authoredPoise > 0) || !claimAshenBlightProc(ctx, owner, 'martial', cycleKey)) return 0;
  return ashenBlightBonuses(owner).martialPoise;
}

export function ashenBlightSpellBuildup(ctx, owner, { cycleKey, school, buildups, selectedStatus }) {
  if (!['fire', 'frost', 'lightning'].includes(school)) return null;
  const eligible = (buildups || []).filter(row => ['burn', 'frost', 'paralysis'].includes(row.status) && row.amount > 0);
  if (!eligible.length) return null;
  const chosen = selectedStatus === undefined ? eligible[0] : eligible.find(row => row.status === selectedStatus);
  if (!chosen) throw new Error('Cinder Sight selection must name an authored eligible buildup');
  if (!claimAshenBlightProc(ctx, owner, 'spell', cycleKey)) return null;
  return { status: chosen.status, amount: 1 };
}

/** Percentage hook for the shared status-restoration authority; it owns Ward carry. */
export function ashenBlightRestorationPercent(ctx, owner, kind, cycleKey) {
  if (!enabled(ctx)) return 0;
  const bonus = ashenBlightBonuses(owner);
  const claimed = claimAshenBlightProc(ctx, owner, 'survivor', cycleKey);
  return (claimed ? bonus.restorationBonusPct : 0) - (kind === 'ward' ? bonus.wardPenaltyPct : 0);
}

/** Returns the actual whole-point grant; caller updates the pool and source budget. */
export function modulateAshenBlightRestoration(ctx, owner, { kind, amount, cycleKey, missing = Infinity, sourceBudget = Infinity, extraPct = 0 }) {
  if (!['hp', 'ward'].includes(kind) || !Number.isFinite(amount) || amount < 0 || !(missing >= 0) || !(sourceBudget >= 0) || !Number.isFinite(extraPct)) throw new Error('Invalid restoration request');
  const active = enabled(ctx), bonus = active ? ashenBlightBonuses(owner) : { wardPenaltyPct: 0, restorationBonusPct: 0 };
  const claimed = amount > 0 && active && claimAshenBlightProc(ctx, owner, 'survivor', cycleKey);
  const pct = extraPct + (claimed ? bonus.restorationBonusPct : 0) - (kind === 'ward' ? bonus.wardPenaltyPct : 0);
  const nominal = Math.max(0, amount * (1 + pct / 100));
  const capped = Math.min(nominal, missing, sourceBudget);
  if (kind === 'hp' || !active) return { amount: Math.floor(capped + 1e-10), credited: capped, nominal, claimed };
  const state = beginAshenBlightCycle(ctx, owner, cycleKey);
  if (missing === 0) { state.wardCarry = 0; return { amount: 0, credited: 0, nominal, claimed }; }
  const available = capped + state.wardCarry;
  const actual = Math.min(Math.floor(available + 1e-10), Math.floor(missing), Math.floor(sourceBudget));
  state.wardCarry = actual >= missing || nominal >= missing ? 0 : Math.max(0, available - Math.floor(available + 1e-10));
  return { amount: actual, credited: capped, nominal, claimed, carry: state.wardCarry };
}
