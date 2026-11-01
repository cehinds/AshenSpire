// Pure lifecycle/impact plans for the authored base-card statuses. Engine
// adapters execute ordinary effects and apply statusChanges; these functions
// never mutate actors, spend resources, roll randomness or execute reactions.
// Chance checks take a d20 roll (owner, 2026-11-01) and pass on roll >= 21 - round(chance% / 5).
import { chanceToD20Target } from '../engine/d20Chance.js';
const stacksOf = instance => Math.max(0, Number(typeof instance === 'number' ? instance : instance?.stacks) || 0);
const idOf = actor => actor?.id ?? actor?.actorId ?? 'player';
const tagsOf = card => card?.cardTags ?? card?.tags ?? [];
const rangeOf = card => card?.range ?? tagsOf(card).find(tag => tag.startsWith('range:'))?.slice(6);
const matches = (list, value) => !list?.length || list.includes(value);
const rounded = value => Math.max(0, Math.floor(Number(value) || 0));
const change = (actor, status, delta) => ({ actorId: idOf(actor), status, delta });
const effect = (actor, target, data) => ({ ...data, sourceId: idOf(actor), targetId: idOf(target) });
const hasAnyTag = (card, tags) => !tags?.length || tags.some(tag => tagsOf(card).includes(tag));

export function proposalRuleEnabled(rule, capabilities = {}) {
  if (!rule) return false;
  return Object.entries(rule.requires || {}).every(([key, values]) => capabilities[key] == null
    || values.every(value => capabilities[key].includes(value)));
}

function* active(actor, rules = {}, capabilities) {
  for (const [status, instance] of Object.entries(actor?.statuses || {})) {
    const stacks = stacksOf(instance), rule = rules[status];
    if (!stacks || !proposalRuleEnabled(rule, capabilities)) continue;
    for (const behavior of rule.behaviors || []) yield { status, stacks, rule, behavior };
  }
}

/** Connected positive matching damage consumes protection even when HP loss is zero. */
export function proposalTurnRules({ actor, phase, rules = {}, capabilities, roll } = {}) {
  const effects = [], statusChanges = [], checks = [];
  for (const { status, stacks, behavior: b } of active(actor, rules, capabilities)) {
    if (phase === 'start' && b.kind === 'persistentProtection') {
      const amount = Math.max(0, stacks - rounded(actor?.[b.pool]));
      if (amount) effects.push(effect(actor, actor, { op: b.pool === 'barrier' ? 'gainBarrier' : 'block', amount }));
    }
    if (b.kind === 'turnDamage' && b.phase === phase) effects.push(effect(actor, actor,
      { op: 'damage', amount: rounded(stacks * b.amountPerStack), damageType: b.damageType, camp: b.camp, direct: false, proposalReactive: true }));
    if (b.kind === 'turnChance' && b.phase === phase) {
      const check = { actorId: idOf(actor), status, chance: b.chance, kind: 'status' };
      checks.push(check);
      if (typeof roll === 'function' && roll(check) >= chanceToD20Target(b.chance)) effects.push(effect(actor, actor, { op: 'applyStatus', status: b.status, stacks: b.stacks }));
    }
  }
  for (const [status, instance] of Object.entries(actor?.statuses || {})) {
    const rule = rules[status];
    if (stacksOf(instance) && proposalRuleEnabled(rule, capabilities) && rule.decay?.phase === phase)
      statusChanges.push(change(actor, status, -Math.min(stacksOf(instance), rule.decay.stacks)));
  }
  return { effects, statusChanges, checks };
}

export function proposalThresholdRules({ actor, rules = {}, capabilities } = {}) {
  const effects = [];
  for (const { stacks, behavior: b } of active(actor, rules, capabilities)) {
    if (b.kind === 'lethalThreshold' && actor?.hp > 0 && stacks >= actor.hp)
      effects.push(effect(actor, actor, { op: 'loseHp', amount: actor.hp, damageType: b.damageType, proposalReactive: true }));
  }
  return { effects };
}

/** Taxes are flat while active; stacks extend their duration, not their magnitude. */
export function proposalCardRules({ actor, card, rules = {}, capabilities, reactive = false } = {}) {
  const out = { allowed: true, refusal: null, staminaTax: 0, manaTax: 0, additionalStanceCapacity: 0,
    effects: [], statusChanges: [] };
  for (const { status, stacks, behavior: b } of active(actor, rules, capabilities)) {
    if (b.kind === 'restriction' && matches(b.cardTypes, card?.type)) {
      out.allowed = false; out.refusal = `Restricted by ${status}`;
    }
    if (b.kind === 'cardTax' && matches(b.ranges, rangeOf(card))) {
      out.staminaTax += b.stamina || 0; out.manaTax += b.mana || 0;
    }
    if (b.kind === 'stanceCapacity') out.additionalStanceCapacity += stacks * b.additionalPerStack;
    if (reactive || !hasAnyTag(card, b.requiredTags)) continue;
    if (b.kind === 'extraWeapon' && card?.type === 'attack') {
      const hit = card.effects?.find(row => row.op === 'damage');
      // Formula amounts remain expressions for the ordinary action evaluator.
      out.effects.push({ ...hit, op: 'damage', amount: hit?.amount ?? b.fallbackDamage,
        target: hit?.target ?? 'enemy', sourceId: idOf(actor), proposalReactive: true });
      out.statusChanges.push(change(actor, status, -Math.min(stacks, b.consumeStacks)));
    }
    if (b.kind === 'extraShield') {
      const protection = card.effects?.find(row => ['block', 'gainBarrier'].includes(row.op));
      out.effects.push(effect(actor, actor, { op: protection?.op ?? 'block', amount: protection?.amount ?? b.fallbackBlock, proposalReactive: true }));
      out.statusChanges.push(change(actor, status, -Math.min(stacks, b.consumeStacks)));
    }
  }
  return out;
}

function perception(actor, rules, capabilities) {
  let value = Number(actor?.perception ?? ((actor?.attributes?.wisdom || 0) + (actor?.attributes?.intelligence || 0))) || 0;
  for (const { stacks, behavior: b } of active(actor, rules, capabilities)) if (b.kind === 'perception') value += stacks * b.amountPerStack;
  return value;
}

/** Optional rolls are 0..99. Previews omit rolls and receive pending checks. */
export function proposalTargetRules({ actor, target, card, rules = {}, capabilities, perceptionRoll, evadeRoll, direct = true } = {}) {
  const out = { allowed: true, avoided: false, accuracyDelta: 0, unavoidable: false,
    perceptionChance: null, evadeChance: 0, checks: [], statusChanges: [] };
  const range = rangeOf(card), camp = card?.camp ?? (tagsOf(card).includes('camp:spell') ? 'spell' : 'physical');
  const damageType = card?.damageType ?? card?.attack?.damageType
    ?? card?.effects?.find(row => row.op === 'damage' && row.damageType)?.damageType
    ?? tagsOf(card).find(tag => tag.startsWith('damage:'))?.slice(7);
  for (const { behavior: b } of active(actor, rules, capabilities))
    if (b.kind === 'accuracy' && matches(b.ranges, range)) out.accuracyDelta += b.delta;
  for (const { status, stacks, behavior: b } of active(target, rules, capabilities)) {
    if (b.kind === 'greaseFire' && matches(b.damageTypes, damageType)) out.unavoidable = true;
    if (b.kind === 'veil' && !(b.areaBypass && (card?.targeting === 'area' || tagsOf(card).includes('targeting:area')))) {
      const chance = Math.max(b.minimum, Math.min(b.maximum,
        b.baseChance + (perception(actor, rules, capabilities) - perception(target, rules, capabilities)) * b.perceptionScale - stacks * b.penaltyPerStack));
      out.perceptionChance = chance;
      out.checks.push({ kind: 'perception', chance, status, actorId: idOf(actor), targetId: idOf(target) });
      if (perceptionRoll != null && !(perceptionRoll >= chanceToD20Target(chance))) out.allowed = false;
    }
  }
  if (!out.allowed || out.unavoidable || !direct) return out;
  for (const { status, stacks, behavior: b } of active(target, rules, capabilities)) {
    if (b.kind === 'evade' && matches(b.camps, camp)) {
      out.evadeChance = Math.max(out.evadeChance, b.chance);
      out.checks.push({ kind: 'evade', chance: b.chance, status, actorId: idOf(target) });
      if (evadeRoll != null) {
        out.avoided ||= evadeRoll >= chanceToD20Target(b.chance);
        out.statusChanges.push(change(target, status, -Math.min(stacks, b.consumeStacks)));
      }
    }
  }
  return out;
}

/** Input amount is the connected pre-protection hit; apply this plan exactly once.
 * Configured receipts defer primary-damage rounding until all offense modifiers
 * have run. Independent rider effects keep their integer quantity boundaries. */
export function proposalHitRules({ actor, target, card, amount, damageType, camp = 'physical', range,
  direct = true, reactive = false, allies = [], rules = {}, capabilities, roundDamage = true } = {}) {
  const damageQuantity = roundDamage ? rounded : value => Math.max(0, Number(value) || 0);
  const original = damageQuantity(amount);
  const out = { amount: original, healing: 0, unavoidable: false, effects: [], statusChanges: [], redirect: null };
  let outgoingMultiplier = 1;
  for (const { behavior: b } of active(actor, rules, capabilities)) {
    if (!reactive && b.kind === 'outgoingMultiplier' && (!b.directOnly || direct)) outgoingMultiplier *= b.multiplier;
    if (b.kind === 'weaponBonus' && direct && !reactive && hasAnyTag(card, b.requiredTags))
      out.effects.push(effect(actor, target, { op: 'damage', amount: b.amount, damageType: b.damageType, camp: b.camp, proposalReactive: true }));
  }
  out.amount = damageQuantity(out.amount * outgoingMultiplier);
  let incomingCap = Infinity, healingMultiplier = null;
  for (const { status, stacks, behavior: b } of active(target, rules, capabilities)) {
    if (b.kind === 'greaseFire' && matches(b.damageTypes, damageType)) {
      out.unavoidable = true; out.amount = damageQuantity(out.amount * b.multiplier);
      out.effects.push(effect(actor, target, { op: 'applyStatus', status: b.burnStatus, stacks: b.burnStacks }));
      if (!reactive) for (const ally of allies.filter(row => idOf(row) !== idOf(target) && row.hp > 0))
        out.effects.push(effect(actor, ally, { op: 'damage', amount: rounded(original * b.splashMultiplier), damageType, camp, proposalReactive: true }));
      out.statusChanges.push(change(target, status, -Math.min(stacks, b.consumeStacks)));
    }
    if (b.kind === 'incomingCap' && (!b.directOnly || direct)) incomingCap = Math.min(incomingCap, b.maximum);
    if (b.kind === 'damageToHealing' && matches(b.damageTypes, damageType)) healingMultiplier = b.multiplier;
  }
  if (healingMultiplier != null) { out.healing = rounded(out.amount * healingMultiplier); out.amount = 0; }
  else out.amount = Math.min(out.amount, incomingCap);
  if (direct && !reactive && out.amount > 0) {
    const guards = allies.filter(row => idOf(row) !== idOf(target) && row.hp > 0).sort((a, b) => String(idOf(a)) < String(idOf(b)) ? -1 : String(idOf(a)) > String(idOf(b)) ? 1 : 0);
    outer: for (const guard of guards) for (const { status, stacks, behavior: b } of active(guard, rules, capabilities)) {
      if (b.kind !== 'guard') continue;
      const intercepted = Math.min(out.amount, stacks * b.amountPerStack);
      out.redirect = { targetId: idOf(guard), amount: intercepted };
      out.amount -= intercepted;
      out.effects.push(effect(actor, guard, { op: 'damage', amount: intercepted, damageType, camp, proposalReactive: true }));
      out.statusChanges.push(change(guard, status, -Math.min(stacks, b.consumeStacks)));
      break outer;
    }
  }
  return out;
}

/** Pass positive incomingDamage even for completely blocked matching hits. */
export function proposalAfterHitRules({ actor, target, hpDamage = 0, incomingDamage = hpDamage,
  damageType, camp = 'physical', range, direct = true, reactive = false, opponents = [], rules = {}, capabilities } = {}) {
  const effects = [], statusChanges = [];
  for (const { status, stacks, behavior: b } of active(target, rules, capabilities)) {
    if (b.kind === 'persistentProtection' && direct && camp === b.camp && incomingDamage >= b.minimumIncomingDamage)
      statusChanges.push(change(target, status, -Math.min(stacks, 1)));
    if (!direct || reactive || idOf(actor) === idOf(target)) continue;
    if (b.kind === 'reflect' && hpDamage > 0) effects.push(effect(target, actor,
      { op: 'damage', amount: rounded(hpDamage * b.multiplier), damageType, camp, proposalReactive: true }));
    if (b.kind === 'autoReaction' && incomingDamage > 0 && matches(b.ranges, range)) {
      const targets = b.mode === 'sweep' ? opponents.filter(row => row.hp > 0) : [actor];
      for (const opponent of targets) effects.push(effect(target, opponent,
        { op: 'damage', amount: b.amount, damageType: b.damageType, camp: b.camp, proposalReactive: true }));
      statusChanges.push(change(target, status, -Math.min(stacks, b.consumeStacks)));
    }
  }
  return { effects, statusChanges };
}

export function proposalHealingRules({ target, amount, damageType, rules = {}, capabilities } = {}) {
  const out = { healing: rounded(amount), damage: 0, damageType };
  for (const { behavior: b } of active(target, rules, capabilities)) if (b.kind === 'healingToDamage' && matches(b.damageTypes, damageType)) {
    out.damage = rounded(out.healing * b.multiplier); out.healing = 0; out.damageType = b.damageType;
  }
  return out;
}

export function proposalRetainProtection({ actor, pool = 'block', amount = actor?.[pool] || 0, rules = {}, capabilities } = {}) {
  let retain = 0;
  for (const { stacks, behavior: b } of active(actor, rules, capabilities))
    if (b.kind === 'retainProtection' && b.pool === pool) retain += stacks * b.amountPerStack;
  return Math.min(rounded(amount), retain);
}
