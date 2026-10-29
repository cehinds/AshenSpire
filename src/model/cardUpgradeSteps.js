// The Core card-upgrade step generator (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md).
// Pure and stateless: the roll is mulberry32(hash(run.seed, instanceId, stepIndex)),
// so a preview equals the commit and no named RNG stream moves. A leaf module:
// it imports only rng.js (a leaf) and cardUpgrade.js (a leaf).
//
// `retain` is deliberately NOT an option: Core's end-of-turn fate
// (src/engine/handRules.js endTurnCardFate, configured branch) never reads the
// `retain` keyword, so a Retain upgrade would show a keyword that does nothing.
import { mulberry32 } from '../engine/rng.js';
import { applyUpgradeSteps, firstPlainIndex, isPlainStatus } from './cardUpgrade.js';
import { STACK_CAPS, rankedEffectsCapped } from './cardRank.js';

export { STACK_CAPS };
const WEIGHTS = Object.freeze({ dmg: 30, blk: 25, stk: 20, addStatus: 8, cost: 10, hits: 5 });
const RESTRICTED_TYPES = new Set(['power', 'status', 'curse', 'consumable']);

/** FNV-1a over the three roll inputs: a stable 32-bit seed. */
export function upgradeSeed(runSeed, instanceId, stepIndex) {
  const text = `${runSeed}|${instanceId}|${stepIndex}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The stateless roll stream for one step of one card instance. */
export function upgradeStepRng(runSeed, instanceId, stepIndex) {
  return mulberry32(upgradeSeed(runSeed, instanceId, stepIndex));
}

const hitsOf = (effect) => (Number.isInteger(effect.hits) && effect.hits > 1 ? effect.hits : 1);
const totalOf = (effects, op) => {
  const index = firstPlainIndex(effects, op);
  return index < 0 ? 0 : effects[index].amount * hitsOf(effects[index]);
};

function options(base, current, applied, limits) {
  const type = base.type;
  const restricted = RESTRICTED_TYPES.has(type);
  const found = {};
  const spMin = Math.max(1, limits.minStaminaCost | 0);
  const actionMin = Math.max(1, limits.minActionCost | 0);

  // cost: once per card; SP never below 1, MP never below 1, cost tracks staminaCost.
  if (!applied.some((s) => s.k === 'cost')) {
    const pools = [];
    if (Number.isInteger(current.staminaCost) && current.staminaCost - 1 >= spMin && current.cost === current.staminaCost
      && current.cost - 1 >= actionMin) pools.push('sp');
    if (Number.isInteger(current.manaCost) && current.manaCost >= 2) pools.push('mp');
    if (pools.length) found.cost = { pools };
  }
  if (restricted) return found;

  const effects = current.effects || [];
  const baseEffects = base.effects || [];
  const dmgIndex = firstPlainIndex(effects, 'damage');
  if (dmgIndex >= 0 && effects[dmgIndex].target === 'enemy') {
    const baseTotal = totalOf(baseEffects, 'damage') || totalOf(effects, 'damage');
    const n = Math.max(2, Math.ceil(baseTotal * 0.15));
    const after = (effects[dmgIndex].amount + n) * hitsOf(effects[dmgIndex]);
    if (after - baseTotal <= baseTotal) found.dmg = { n };
  }
  const blkIndex = firstPlainIndex(effects, 'block');
  if (blkIndex >= 0) {
    const baseTotal = totalOf(baseEffects, 'block') || totalOf(effects, 'block');
    const n = Math.max(2, Math.ceil(baseTotal * 0.2));
    if (effects[blkIndex].amount + n - baseTotal <= baseTotal) found.blk = { n };
  }
  // apply raises the FIRST plain effect of a status, so only that one is a candidate. It is judged on the
  // FINAL face, rank applied: a status the rank already holds at its cap gains nothing from a step.
  const rank = limits.rank > 1 ? limits.rank : 1;
  const finalStacks = (card, status) => {
    const shown = rank > 1 ? { ...card, effects: rankedEffectsCapped(card, rank - 1) } : card;
    return (shown.effects || []).find((e) => isPlainStatus(e) && e.status === status)?.stacks;
  };
  const seenStatus = new Set();
  const stackable = effects.find((e) => {
    if (!isPlainStatus(e) || seenStatus.has(e.status)) return false;
    seenStatus.add(e.status);
    if (STACK_CAPS[e.status] === undefined || e.stacks + 1 > STACK_CAPS[e.status]) return false;
    const stepped = applyUpgradeSteps(base, [...applied, { k: 'stk', status: e.status, n: 1 }]);
    return finalStacks(stepped, e.status) > finalStacks(current, e.status);
  });
  if (stackable) found.stk = { status: stackable.status };

  if (!effects.some((e) => e.op === 'applyStatus') && dmgIndex >= 0 && effects[dmgIndex].target === 'enemy') {
    // The card's school: its damage school, else its `camp:` tag (kept unquoted so the
    // mechanics generator does not take this file for the tag's reader).
    const camp = ((base.tags || []).find((tag) => tag.startsWith('camp:')) || '').slice(5);
    const school = base.damageSchool === 'magic' || camp === 'spell' ? 'spell' : base.damageSchool === 'physical' || camp === 'physical' ? 'physical' : '';
    if (school === 'spell') found.addStatus = { statuses: ['burn', 'vulnerable'] };
    else if (school === 'physical') found.addStatus = { statuses: ['bleed', 'weak'] };
  }

  if (dmgIndex >= 0 && !applied.some((s) => s.k === 'hits') && !effects.some((e) => e.op === 'damage' && hitsOf(e) > 1)
    && effects[dmgIndex].target === 'enemy' && effects[dmgIndex].amount <= 8) {
    const baseTotal = totalOf(baseEffects, 'damage') || totalOf(effects, 'damage');
    const amount = effects[dmgIndex].amount;
    const per = Math.ceil(amount * 0.6);
    const counts = [2, 3].filter((hits) => hits <= 3 && per * hits - baseTotal <= baseTotal && per * hits > amount);
    if (counts.length) found.hits = { per, counts };
  }
  return found;
}

/**
 * rollUpgradeStep(baseDef, appliedSteps, stepIndex, rng, limits?) → the next (limits: minStaminaCost, minActionCost, rank)
 * stored step. `appliedSteps` are the steps the card already has; `rng` is
 * upgradeStepRng(run.seed, instanceId, stepIndex). Filters the options to the
 * ones the card is eligible for, then makes a weighted pick; if none is
 * eligible the card is fully upgraded and the result is null (no filler step).
 */
export function rollUpgradeStep(baseDef, appliedSteps, stepIndex, rng, limits = {}) {
  const applied = appliedSteps || [];
  const current = applied.length ? applyUpgradeSteps(baseDef, applied) : baseDef;
  const found = options(baseDef, current, applied, limits);
  const kinds = Object.keys(WEIGHTS).filter((kind) => found[kind]);
  // Draw order is fixed (pick, then the kind's own choice) so a roll is a pure function of its stream.
  const pick = rng();
  const choice = rng();
  if (!kinds.length) return null;
  let roll = pick * kinds.reduce((sum, kind) => sum + WEIGHTS[kind], 0);
  let kind = kinds[kinds.length - 1];
  for (const candidate of kinds) {
    roll -= WEIGHTS[candidate];
    if (roll < 0) { kind = candidate; break; }
  }
  const option = found[kind];
  const pickOf = (list) => list[Math.min(list.length - 1, Math.floor(choice * list.length))];
  switch (kind) {
    case 'dmg': return { k: 'dmg', n: option.n };
    case 'blk': return { k: 'blk', n: option.n };
    case 'stk': return { k: 'stk', status: option.status, n: 1 };
    case 'addStatus': return { k: 'addStatus', status: pickOf(option.statuses), stacks: 1 };
    case 'cost': return { k: 'cost', pool: pickOf(option.pools) };
    default: {
      // Three hits only on the rarer roll; two otherwise.
      const hits = option.counts.includes(3) && choice >= 0.7 ? 3 : option.counts[0];
      return { k: 'hits', hits, per: option.per };
    }
  }
}
