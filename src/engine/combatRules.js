// Revision adapter for the existing solo/co-op action interpreters. No second
// simulator: the same opcodes, damage entry point, piles, triggers and RNG run.
import { validateCombatRules, validateCombatProfile, validateAttack, allocateInteger, resolveDamageComponents, weaponImpact, groupedResistance } from '../model/combatRules.js';
import { evaluate } from '../model/formulas.js';
import { createRng } from './rng.js';
import * as S from '../framework/statusSemantics.js';
import { equippedIn, slotHand } from '../model/loadout.js';
import { attackDescriptor, resolvedAttackTags } from '../model/attackTags.js';

export function rulesFingerprint(rules) {
  let hash = 2166136261;
  for (const c of JSON.stringify(rules)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

export function createFoundation(rules, profiles = {}, registries = null) {
  if (!rules) return null;
  validateCombatRules(rules, registries);
  for (const card of registries?.cards.all() || []) {
    if (card.attack) validateAttack(card.attack, rules);
    for (const effect of card.effects || []) if (effect.attack) validateAttack(effect.attack, rules);
  }
  for (const profile of Object.values(profiles)) validateCombatProfile(profile, rules);
  return { rules: structuredClone(rules), fingerprint: rulesFingerprint(rules), profiles: structuredClone(profiles), actionSerial: 0, eventSerial: 0, eventCount: 0, rolls: {}, counts: {} };
}

export function validateFoundationSnapshot(saved) {
  if (!saved || !saved.profiles || Array.isArray(saved.profiles)) throw new Error('Invalid saved combat profiles');
  validateCombatRules(saved.rules);
  if (saved.fingerprint !== rulesFingerprint(saved.rules)) throw new Error('Saved combat rules fingerprint mismatch');
  for (const profile of Object.values(saved.profiles || {})) validateCombatProfile(profile, saved.rules);
  for (const key of ['actionSerial', 'eventSerial', 'eventCount']) if (!Number.isInteger(saved[key]) || saved[key] < 0) throw new Error(`Invalid saved ${key}`);
  for (const value of Object.values(saved.rolls || {})) if (typeof value !== 'boolean') throw new Error('Invalid saved proc roll');
  for (const value of Object.values(saved.counts || {})) if (!Number.isInteger(value) || value < 0) throw new Error('Invalid saved trigger count');
}

export function cardSourceSnapshots(ctx, def, source, card) {
  if (!ctx.foundation) return null;
  return new Map((def.effects || []).filter((effect) => effect.op === 'damage')
    .map((effect) => [effect, foundationCarrier(ctx, source, card, effect.attack)]));
}

export function cardActions(ctx, def, source, target, card, meta, sourceSnapshots = null) {
  if (!ctx.foundation) return (def.effects || []).map((effect) => ({ effect, source, owner: source, target, card, meta }));
  if (card.attack) validateAttack(card.attack, ctx.foundation.rules);
  const formulaContext = { entities: { self: source, owner: source, player: ctx.player, target, enemy: target, allEnemies: ctx.enemies.filter((e) => e.alive) }, energySpent: meta.energySpent, cardsPlayedThisTurn: meta.ordinalThisTurn };
  const rows = [];
  for (const effect of def.effects || []) {
    if (effect.attack) validateAttack(effect.attack, ctx.foundation.rules);
    const repeats = Math.max(0, Math.floor(evaluate(effect.repeat ?? 1, formulaContext)));
    if (repeats > ctx.foundation.rules.triggers.maxEvents) throw new Error('effect repeat exceeds action bound');
    for (let r = 0; r < repeats; r++) rows.push({ effect: { ...effect, repeat: 1 }, snapshot: sourceSnapshots?.get(effect), hits: effect.op === 'damage' ? Math.max(0, Math.floor(evaluate(effect.hits ?? 1, formulaContext))) : 0 });
  }
  const total = rows.reduce((sum, row) => sum + row.hits, 0);
  if (!Number.isFinite(total) || total > ctx.foundation.rules.triggers.maxEvents) throw new Error('resolved hits exceed action bound');
  let offset = 0;
  return rows.map(({ effect, hits, snapshot }) => {
    // Live plays supply snapshots captured before payment. Standalone callers
    // capture here; later hits keep that source if a trigger changes equipment.
    const carrier = hits > 0 ? snapshot || foundationCarrier(ctx, source, card, effect.attack) : card;
    const action = { effect, source, owner: source, target, card: carrier, meta: { ...meta, foundationHitCount: total, foundationHitOffset: offset } };
    offset += hits; return action;
  });
}

export function foundationActorId(ctx, entity) {
  return ctx.playerIdForEntity?.(entity) || entity?.id || 'none';
}

export function foundationProfile(ctx, entity) {
  return ctx.foundation?.profiles[foundationActorId(ctx, entity)] || {};
}

export function foundationSource(ctx, entity, carrier = null) {
  if (carrier?.resolvedSource) return carrier.resolvedSource;
  const state = ctx.foundation;
  const profile = foundationProfile(ctx, entity);
  const attack = attackDescriptor(carrier || {});
  if (attack.source === 'unarmed') return { ...state.rules.fallbackSource, sourceType: 'unarmed' };
  const kind = attack.source || 'weapon';
  const canonicalHand = (hand) => ({ right: 'mainHand', left: 'offHand' }[hand] || hand);
  const explicitHand = canonicalHand(attack.hand || carrier?.sourceHand);
  const hands = explicitHand ? [explicitHand] : [...new Set([profile.defaultSource || 'mainHand', 'mainHand', 'offHand'])];
  const compatible = (source) => source && (source.sourceType || (source.family === 'focus' ? 'spell' : 'weapon')) === kind;
  // Supplied profiles are a complete source snapshot (including old saves).
  // A missing focus must never borrow a physical weapon's properties.
  if (profile.sources) {
    for (const hand of hands) if (compatible(profile.sources[hand])) return { ...profile.sources[hand], sourceType: kind, hand };
    if (kind === 'spell' || explicitHand) throw new Error(`No ${kind} source for ${foundationActorId(ctx, entity)}${explicitHand ? ` in ${explicitHand}` : ''}`);
    return { ...state.rules.fallbackSource, sourceType: 'unarmed' };
  }
  if (entity === ctx.player && ctx.loadout) {
    for (const hand of hands) {
      const slot = ctx.registries.equipment.slots.find((row) => slotHand(row) === (hand === 'mainHand' ? 'right' : 'left'));
      const piece = slot && equippedIn(ctx.registries, ctx.loadout, entity.classId, slot.id);
      if (!piece) continue;
      const identity = attackDescriptor(piece);
      if (identity.source !== kind) continue;
      const family = state.rules.equipmentSources?.itemFamilies?.[piece.id] || state.rules.equipmentSources?.profileFamilies?.[piece.attackProfile];
      if (!family || !identity.damageType) throw new Error(`Missing attack source mapping for '${piece.id}'`);
      return { id: `armament/${piece.id}/${hand}`, itemId: piece.id, name: piece.name, hand, sourceType: kind,
        weight: piece.weight, grip: 'oneHand', family, damageType: identity.damageType, tags: [...piece.tags], buildup: [] };
    }
    if (kind === 'spell') throw new Error(`No spell source for ${foundationActorId(ctx, entity)}`);
    if (explicitHand) return { ...state.rules.fallbackSource, sourceType: 'unarmed', hand: explicitHand };
  }
  if (kind === 'spell') throw new Error(`No spell source for ${foundationActorId(ctx, entity)}`);
  return { ...state.rules.fallbackSource, sourceType: 'unarmed' };
}

export function foundationCarrier(ctx, entity, carrier = {}, effectAttack = null) {
  const attack = attackDescriptor({ ...carrier, attack: effectAttack || carrier.attack });
  validateAttack(attack, ctx.foundation.rules);
  const source = structuredClone(foundationSource(ctx, entity, { ...carrier, attack }));
  if (source.sourceType === 'unarmed') attack.source = 'unarmed';
  const tags = resolvedAttackTags(carrier.tags || [], source, attack, ctx.foundation.rules.damageTypes);
  return { ...carrier, attack, tags, resolvedSource: source };
}

export function foundationDamage(ctx, source, target, base, carrier = null, attackTags = []) {
  const rules = ctx.foundation.rules;
  const weapon = foundationSource(ctx, source, carrier);
  const attack = attackDescriptor(carrier || {});
  const defense = foundationProfile(ctx, target);
  const weights = attack.components || [{ type: attack.damageType || weapon.damageType, weight: 1 }];
  attackTags = resolvedAttackTags(attackTags, weapon, attack, rules.damageTypes);
  const totalWeight = weights.reduce((sum, c) => sum + c.weight, 0);
  if (!(totalWeight > 0)) throw new Error('attack components need positive weight');
  const attackerMultiplier = source ? S.getMult(ctx, source, 'damageDealtMult') : 1;
  let multiplier = target ? S.getMult(ctx, target, 'damageTakenMult') : 1;
  let vulnerability = 0;
  for (const [id, inst] of Object.entries(target?.statuses || {})) {
    if ((inst.meter ? inst.meter.value : inst.stacks) <= 0) continue;
    const tv = ctx.registries.statuses.get(id).taggedVulnerability;
    if (tv && tv.tags.some((tag) => attackTags.includes(tag))) {
      if (tv.stacking === 'multiplicative') multiplier *= tv.mult;
      else vulnerability += tv.mult - 1;
    }
  }
  multiplier = attackerMultiplier * Math.min(rules.vulnerabilityCap, multiplier * (1 + vulnerability));
  const components = resolveDamageComponents(rules, {
    components: weights.map((c) => ({ type: c.type, amount: Math.max(0, base) * c.weight / totalWeight })),
    armor: defense.armor || 0, penetration: attack.penetration || 0,
    resistances: groupedResistance(rules, defense.resistanceSources || [], defense.resistances || {}), immunities: defense.immunities || [], multiplier,
    flatBonus: (source ? S.getAdd(ctx, source, 'attackDamageAdd') : 0) + (source?.damageBySchoolAdd?.[carrier?.damageSchool] || 0),
  });
  return { components, amount: components.reduce((sum, c) => sum + c.amount, 0), source: weapon, tags: attackTags };
}

export function foundationImpact(ctx, action, hits) {
  const attack = action.effect?.attack || action.card?.attack || {};
  const source = foundationSource(ctx, action.source, { ...action.card, attack });
  const totalHits = action.meta?.foundationHitCount ?? hits;
  if (totalHits <= 0) return [];
  const budget = weaponImpact(ctx.foundation.rules, source, {
    magical: attack.source === 'spell', bonus: attack.impactBonus || 0, factor: attack.impactFactor ?? 1,
  });
  const weights = attack.hitWeights || Array(totalHits).fill(1);
  if (weights.length !== totalHits) throw new Error('attack hitWeights must match resolved hit count');
  return allocateInteger(budget, weights).slice(action.meta?.foundationHitOffset || 0, (action.meta?.foundationHitOffset || 0) + hits);
}

export function foundationCosts(ctx, def, weightClass, legacy) {
  if (!ctx.foundation || !def.effects?.some((e) => e.op === 'dodgeRoll')) return legacy;
  const rules = ctx.foundation.rules.dodge;
  const weight = foundationProfile(ctx, ctx.player).weightClass || weightClass.id;
  return { ...legacy, action: rules.actions, mana: 0, stamina: rules.stamina[weight], variable: false };
}

export function assertFoundationPlayable(ctx, def) {
  if (!ctx.foundation) return;
  if (def.effects?.some((e) => e.op === 'dodgeRoll')) {
    if ((ctx.player.evade || 0) >= ctx.foundation.rules.dodge.charges) throw new Error('Evade is already active');
    if ((ctx.player.evadeUses || 0) >= ctx.foundation.rules.dodge.usesPerTurn) throw new Error('Dodge Roll already used this turn');
  }
  if (def.effects?.some((e) => e.op === 'enterStance' && e.stance === ctx.player.stanceId)) throw new Error('That stance is already active');
}

export function startFoundationTurn(ctx, entity) {
  if (!ctx.foundation) return;
  entity.evade = 0; entity.evadeUses = 0;
  // Setup starts with the supplied pool. Recovery occurs only on later turns.
  if (ctx.turn > 1) {
    for (const resource of ['stamina', 'mana']) {
      const maxKey = resource === 'stamina' ? 'maxStamina' : 'maxMana';
      const amount = Math.min(entity[maxKey] - entity[resource], ctx.foundation.rules.recovery[`${resource}PerTurn`]);
      if (amount > 0) { entity[resource] += amount; ctx.emit(`${resource}Recovered`, { targetId: entity.id, amount, reason: 'turnStart' }); }
    }
  }
}

export function grantFoundationEvade(ctx, source) {
  if (!ctx.foundation || !source?.alive) return;
  source.evade = ctx.foundation.rules.dodge.charges;
  source.evadeUses = (source.evadeUses || 0) + 1;
  ctx.emit('evadeGained', { sourceId: source.id, sourcePlayerId: ctx.playerIdForEntity?.(source), charges: source.evade });
}

export function consumeFoundationEvade(ctx, source, target, carrier) {
  if (!ctx.foundation || !target?.evade || carrier?.attack?.dodgeable === false) return false;
  target.evade--;
  ctx.emit('attackEvaded', { sourceId: source?.id, targetId: target.id, targetPlayerId: ctx.playerIdForEntity?.(target), charges: target.evade });
  return true;
}

/** Clone one graph, preserving references between players, piles and seats. */
function candidateState(ctx) {
  const data = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (typeof value !== 'function' && key !== 'registries' && key !== 'rng') data[key] = value;
  }
  const candidate = { ...structuredClone(data), registries: ctx.registries, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), _emitEvent: ctx._emitEvent };
  candidate.emit = (type, payload) => candidate._emitEvent(candidate, type, payload);
  candidate.enqueue = (action) => candidate.queue.push(action);
  candidate.nextInstanceId = () => `gen${++candidate._idCounter}`;
  if (ctx.players) candidate.playerIdForEntity = (entity) => {
    for (const [id, seat] of candidate.players) if (seat.entity === entity) return id;
    return null;
  };
  return candidate;
}

/** Reject malformed/looping actions without consuming cards, pools or RNG. */
export function foundationTransaction(ctx, execute) {
  const candidate = candidateState(ctx);
  candidate._foundationTransaction = true;
  candidate.foundation.actionSerial++;
  candidate.foundation.eventCount = 0;
  candidate.foundation.rolls = {}; candidate.foundation.counts = {};
  candidate._foundationAncestry = [];
  const result = execute(candidate);
  delete candidate._foundationTransaction;
  delete candidate._foundationAncestry;
  // Keep the run's loadout object identity when committing an equipment change.
  if (!ctx.players && ctx.loadout && candidate.loadout) {
    for (const key of Object.keys(ctx.loadout)) delete ctx.loadout[key];
    Object.assign(ctx.loadout, candidate.loadout); candidate.loadout = ctx.loadout;
  }
  for (const [key, value] of Object.entries(candidate)) {
    if (key === 'rng') ctx.rng.restoreCounters(value.getCounters());
    else if (typeof value !== 'function' && key !== 'registries') ctx[key] = value;
  }
  return result;
}

/** Execute against a clone for an exact, RNG-neutral preview of any intent. */
export function previewFoundationAction(ctx, execute) {
  if (!ctx.foundation) throw new Error('Exact preview requires foundation rules');
  const candidate = candidateState(ctx);
  const result = execute(candidate);
  return { result, state: candidate };
}

export function foundationEvent(ctx, type, payload) {
  const f = ctx.foundation;
  if (!f) return payload;
  if (++f.eventCount > f.rules.triggers.maxEvents) throw new Error(`combat event limit exceeded at '${type}'`);
  const ancestry = ctx._foundationAncestry || [];
  if (ancestry.length > f.rules.triggers.maxDepth) throw new Error(`combat trigger depth exceeded: ${ancestry.join(' -> ')}`);
  return { rootActionId: f.actionSerial, eventId: ++f.eventSerial, ancestry: [...ancestry], ...payload };
}

export function foundationTriggerAllowed(ctx, key, trigger, event) {
  if (!ctx.foundation) return true;
  const f = ctx.foundation;
  if (event.ancestry?.includes(key)) return false;
  if (event.ancestry?.length && !trigger.allowSecondary) return false;
  const count = f.counts[key] || 0;
  if (count >= (trigger.limitPerAction ?? f.rules.triggers.limitPerAction)) return false;
  const chance = trigger.chance ?? f.rules.triggers.chance;
  const scope = trigger.rollScope || f.rules.triggers.rollScope;
  const suffix = scope === 'play' ? '' : scope === 'target' ? `:${event.targetPlayerId || event.targetId}` : `:${event.eventId}`;
  const rollKey = `${key}${suffix}`;
  if (!(rollKey in f.rolls)) f.rolls[rollKey] = chance === 0 ? false : chance === 1 ? true : ctx.rng.float('combatProcs') < chance;
  if (!f.rolls[rollKey]) return false;
  f.counts[key] = count + 1;
  return true;
}
