// Tactical profiles share the ordinary action queue. No card IDs or UI state.
import { combatMatchups, combatExpansionMatchups } from '../content/combatMatchups.js';
import * as Avoidance from './combatAvoidance.js';
import { creditKnowledgeBenefit } from './enemyKnowledge.js';
import { enqueueExpandedAction } from './combatExpansionActions.js';

export function matchupRules(ctx) {
  return ctx?.combatMatchupRules || ctx?.registries?.balance?.combatMatchups || combatMatchups;
}

export function combatProfileOf(carrier) {
  const profile = carrier?.combatProfile;
  return ['physical', 'spell', 'spells', 'magic', 'magical'].includes(profile?.camp) ? profile : null;
}

function physicalProjectile(profile) {
  return profile?.camp === 'physical' && (profile.maneuver === 'ranged' || profile.delivery === 'projectile');
}

function isSpell(profile) {
  return ['spell', 'spells', 'magic', 'magical'].includes(profile?.camp);
}

function eventCarrier(source, carrier) {
  return { sourceKind: source?.kind, cardId: carrier?.cardId,
    enemyId: source?.enemyId, moveId: carrier?.moveId,
    ...(carrier?.combatProfile ? { combatProfile: structuredClone(carrier.combatProfile) } : {}),
    ...(carrier?.committedInstance ? { cardInstance: structuredClone(carrier.committedInstance) } : {}),
    ...(Number.isInteger(carrier?.upcastTier) ? { upcastTier: carrier.upcastTier } : {}),
    cardInstanceId: carrier?.instanceId, cardType: carrier?.type,
    cardTags: carrier?.authoredTags || carrier?.tags || [], abilityKind: carrier?.abilityKind };
}

function counterEligible(ctx, target, carrier, profile) {
  const counter = target?.combatCounter;
  if (!counter || !profile || carrier?.combatReaction || counter.charges <= 0) return false;
  if (counter.expiresOnTurn != null && Number.isFinite(ctx?.turn) && ctx.turn >= counter.expiresOnTurn) return false;
  const rules = matchupRules(ctx);
  const cfg = rules.counter;
  const mode = counter.mode || 'melee';
  if (profile.maneuver === 'sweep') return false;
  if (mode === 'spell' || mode === 'magic') return isSpell(profile) || physicalProjectile(profile);
  if (mode === 'ranged') return physicalProjectile(profile);
  return profile.camp === 'physical'
    && cfg.meleeIncomingManeuvers.includes(profile.maneuver)
    && !physicalProjectile(profile)
    && !cfg.meleeBypassDamageTypes.includes(rules.damageAliases?.[profile.damageType] || profile.damageType);
}

export function armCombatCounter(ctx, entity, carrier, options = {}) {
  const profile = combatProfileOf(carrier);
  if (!entity || !profile) return null;
  if (combatExpansionEnabled(ctx)) return armExpansionCounter(ctx, entity, carrier, options);
  entity.combatCounter = {
    charges: 1,
    mode: options.mode || profile.counterMode || (isSpell(profile) ? 'spell' : 'melee'),
    damage: Math.max(0, Number(options.damage) || 0),
    poiseDamage: Math.max(0, Number(options.poiseDamage) || 0),
    bonus: Math.max(0, Number(options.bonus) || 0),
    ...(Number.isFinite(ctx?.turn) ? { expiresOnTurn: ctx.turn + 1 } : {}),
    carrier: structuredClone(carrier),
  };
  ctx.emit?.('combatCounterArmed', { ...eventCarrier(entity, carrier),
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(entity) } : {}),
    sourceId: entity.id, mode: entity.combatCounter.mode });
  return entity.combatCounter;
}

export function clearCombatCounter(entity, ctx = null) {
  if (!entity) return;
  delete entity.combatCounter;
  // A triggered reply has spent its charge, but may still be waiting behind
  // the root action's remaining effects. Interruption cancels only that reply.
  for (const action of ctx?.queue || []) {
    if (action.source === entity && action.meta?.combatCounterReaction) {
      action.meta = { ...action.meta, combatCounterInterrupted: true };
    }
  }
}

/** Pure: both ordinary damage previews and live resolution call this once. */
export function prepareMatchupHit(ctx, source, target, carrier, computedDamage) {
  if (combatExpansionEnabled(ctx)) {
    // The central action interpreter normally passes the shared action plan.
    // This pure fallback also supports a single-contact inspection.
    const action = previewTacticalAction(ctx, source, target, carrier, [{ amount: computedDamage }]);
    return { amount: action.amounts[0] || 0, profile: combatProfileOf(carrier),
      guardBefore: action.guardBefore, smash: action.smash, counterEligible: action.counterEligible,
      counter: action.counter, guardBypass: action.guardBypass };
  }
  const profile = combatProfileOf(carrier);
  const raw = Math.max(0, Number(computedDamage) || 0);
  const guardBefore = Math.max(0, (target?.block || 0) - (target?.wardBlock || 0));
  const cfg = matchupRules(ctx);
  const smash = !!profile && !carrier?.combatReaction && profile.maneuver === 'smash' && guardBefore > 0;
  const counter = raw > 0 && counterEligible(ctx, target, carrier, profile);
  const damageType = cfg.damageAliases?.[profile?.damageType] || profile?.damageType;
  const targetKey = ctx.playerIdForEntity?.(target) || target?.id;
  const riderSpent = carrier?.combatRiderTargets?.includes(targetKey);
  const bypass = profile && !carrier?.combatReaction && !riderSpent ? cfg.damageRiders?.[damageType]?.guardBypass || 0 : 0;
  const amount = Math.max(0, Math.floor(raw * (smash ? cfg.smash.guardedMultiplier : 1) * (counter ? cfg.counter.incomingMultiplier : 1)));
  return { amount, profile, guardBefore, smash, counterEligible: counter,
    counter: counter ? structuredClone(target.combatCounter) : null,
    guardBypass: counter && ['ranged', 'spell', 'magic'].includes(target.combatCounter.mode) ? 0 : Math.min(amount, guardBefore, bypass) };
}

export function matchupPoiseMultiplier(ctx, source, target, carrier) {
  const profile = combatProfileOf(carrier);
  if (!profile || carrier?.combatReaction || profile.camp !== 'physical' || profile.maneuver !== 'attack') return 1;
  const targetProfile = combatExpansionEnabled(ctx) ? target?.combatStance : target?.intent?.combatProfile || target?.combatProfile;
  if (combatExpansionEnabled(ctx)) return targetProfile?.maneuver === 'smash' || targetProfile?.maneuver === 'casting'
    ? expansionMatchupRules(ctx).attack.preparedPoiseMultiplier : 1;
  const prepared = target?.pendingMove || target?.intent?.delayed || target?.intent?.pending
    || targetProfile?.maneuver === 'smash' || isSpell(targetProfile);
  return prepared ? matchupRules(ctx).attack.preparedPoiseMultiplier : 1;
}

function seats(ctx, source, target) {
  return ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source), targetPlayerId: ctx.playerIdForEntity(target) } : {};
}

/** Runs only from an executed action; Ward loss cannot spill into Health. */
export function stripCombatWard(ctx, source, target, amount) {
  if (!target?.alive) return 0;
  if (combatExpansionEnabled(ctx)) {
    const ward = target.persistentWard;
    if (!ward) return 0;
    const stripped = Math.min(Math.max(0, ward.value), Math.max(0, Math.floor(amount)));
    ward.value -= stripped;
    if (stripped) ctx.emit?.('combatWardStripped', { ...seats(ctx, source, target), sourceId: source?.id, sourceKind: source?.kind, targetId: target.id, amount: stripped });
    return stripped;
  }
  let remaining = Math.max(0, Math.floor(amount));
  const ward = Math.max(0, Math.min(target.block || 0, target.wardBlock || 0));
  const blockLoss = Math.min(ward, remaining);
  if (blockLoss > 0) {
    target.block -= blockLoss;
    target.wardBlock = ward - blockLoss;
    remaining -= blockLoss;
  }
  const guardLoss = Math.min(Math.max(0, target.wardGuard || 0), remaining);
  if (guardLoss > 0) target.wardGuard -= guardLoss;
  const stripped = blockLoss + guardLoss;
  if (stripped) ctx.emit?.('combatWardStripped', { ...seats(ctx, source, target), sourceId: source?.id, sourceKind: source?.kind, targetId: target.id, amount: stripped });
  return stripped;
}

export function completeMatchupHit(ctx, source, target, carrier, receipt, { blocked = 0, hpLoss = 0, applySmashBreakPoise = null } = {}) {
  // Version 2 finalizes the complete action through completeTacticalAction.
  if (combatExpansionEnabled(ctx)) return;
  if (!receipt.profile || carrier?.combatReaction) return;
  const cfg = matchupRules(ctx);
  if (receipt.smash && receipt.guardBefore > 0 && (target.block || 0) - (target.wardBlock || 0) <= 0 && target.alive) {
    const amount = Math.max(0, receipt.profile.breakPoiseBonus ?? cfg.smash.guardBreakPoiseBonus);
    // The same hit's Guard-break consequence precedes its retaliation. Resolve
    // through the ordinary Poise implementation so a real stagger can clear
    // Counter before either its queued damage or synchronous Ward reply starts.
    if (amount && receipt.counterEligible && typeof applySmashBreakPoise === 'function') applySmashBreakPoise(amount);
    else if (amount) ctx.enqueue({ effect: { op: 'poiseDamage', amount }, source, owner: source, target, card: { ...carrier, combatReaction: true }, meta: { combatSmashBreak: true } });
  }
  if (receipt.counterEligible && target?.combatCounter?.charges > 0) {
    const counter = receipt.counter;
    delete target.combatCounter;
    ctx.emit?.('combatCounterConsumed', { ...eventCarrier(target, counter.carrier), ...seats(ctx, target, source), sourceId: target.id, targetId: source?.id, fullyBlocked: hpLoss === 0 && blocked >= receipt.amount });
    if (receipt.amount > 0 && hpLoss === 0 && blocked >= receipt.amount && target.alive && source?.alive) {
      const amount = Math.floor(counter.damage * cfg.counter.retaliationMultiplier) + cfg.counter.retaliationFlat + counter.bonus;
      const poise = counter.poiseDamage > 0 ? Math.floor(counter.poiseDamage * cfg.counter.poiseMultiplier) : 0;
      const wardOnly = ['spell', 'magic'].includes(counter.mode) && !isSpell(receipt.profile);
      ctx.emit?.('combatCounterTriggered', { ...eventCarrier(target, counter.carrier), ...seats(ctx, target, source), sourceId: target.id, targetId: source.id, amount, poiseDamage: wardOnly ? 0 : poise, wardOnly });
      if (wardOnly) creditKnowledgeBenefit(ctx, target, source, { amount: stripCombatWard(ctx, target, source, amount), kind: 'counter', actionSerial: source.knowledgeAction?.serial });
      else {
        const reactionCarrier = { ...counter.carrier, combatReaction: true, skipRatingBonus: true };
        ctx.enqueue({ effect: { op: 'damage', amount }, source: target, owner: target, target: source, card: reactionCarrier, meta: { combatCounterReaction: true, enemyKnowledgeActionSerial: source.knowledgeAction?.serial } });
        if (poise > 0) ctx.enqueue({ effect: { op: 'poiseDamage', amount: poise }, source: target, owner: target, target: source, card: reactionCarrier, meta: { combatCounterReaction: true, enemyKnowledgeActionSerial: source.knowledgeAction?.serial } });
      }
    }
  }
}

/** Once per action and target. Reactions never generate another rider chain. */
export function matchupRiderEffects(ctx, source, target, carrier, { amount = 0, hpLoss = 0 } = {}) {
  const profile = combatProfileOf(carrier);
  if (!profile || carrier?.combatReaction || !(amount > 0) || !target) return [];
  const key = ctx.playerIdForEntity?.(target) || target.id;
  const seen = carrier.combatRiderTargets;
  if (seen?.includes(key)) return [];
  const cfg = combatExpansionEnabled(ctx) ? expansionMatchupRules(ctx) : matchupRules(ctx);
  const type = cfg.damageAliases?.[profile.damageType] || profile.damageType;
  const rider = cfg.damageRiders?.[type];
  if (!rider || (rider.requiresHpLoss && hpLoss <= 0)
    || (!target.alive && !(rider.cleanse && source?.alive))) return [];
  if (seen) seen.push(key);
  const effects = [];
  if (target.alive && rider.poise) effects.push({ op: 'poiseDamage', amount: rider.poise });
  if (target.alive && rider.wardDrain) stripCombatWard(ctx, source, target, rider.wardDrain);
  if (target.alive && rider.status && !carrier.appliedStatuses?.includes(rider.status) && ctx.registries?.statuses?.has(rider.status)) {
    if (combatExpansionEnabled(ctx)) {
      if (!carrier.appliedBuildupStatuses?.includes(rider.status)) effects.push({ op: 'buildup', status: rider.status,
        amount: rider.pressure, camp: profile.camp, recoveryProfile: rider.recoveryProfile });
    } else effects.push({ op: 'applyStatus', status: rider.status, stacks: rider.stacks });
  }
  if (rider.cleanse && source?.alive) {
    const status = cfg.cleanseStatuses.find(id => source.statuses?.[id] && ctx.registries?.statuses?.has(id));
    if (status) effects.push({ op: 'removeStatus', target: 'self', status, amount: rider.cleanse });
  }
  return effects;
}

export const combatExpansionEnabled = ctx => ctx?.combatExpansionVersion === 2;
export function expansionMatchupRules(ctx) {
  return ctx?.combatExpansionRules?.matchups || ctx?.combatExpansionMatchupRules
    || ctx?.registries?.balance?.combatExpansionMatchups || combatExpansionMatchups;
}

const number = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const hasTrait = (profile, name) => profile?.traits?.includes(name) || profile?.combatTraits?.[name] === true
  || (Array.isArray(profile?.combatTraits) && profile.combatTraits.includes(name))
  || profile?.tags?.includes(`trait:${name}`) || profile?.[name] === true;
const targetKey = (ctx, target) => ctx.playerIdForEntity?.(target) || target?.id;

function normalizedProfile(carrier, contact = {}) {
  const base = combatProfileOf(carrier) || {};
  const profile = { ...base, ...contact };
  profile.camp = isSpell(profile) ? 'spell' : profile.camp;
  // Compatibility mapping uses existing authored delivery, never card names.
  profile.reach ||= profile.delivery === 'projectile' || profile.maneuver === 'ranged' ? 'near' : 'contact';
  profile.targeting ||= profile.maneuver === 'sweep' ? 'area' : 'single';
  profile.projectile ??= carrier?.attack?.delivery === 'projectile' || hasTrait(profile, 'projectile');
  profile.dodgeable ??= carrier?.attack?.dodgeable;
  return profile;
}

function restrictions(ctx, entity, options = {}) {
  return options.restrictions || ctx.combatControlRestrictions?.(entity) || {
    counterDisabled: false, evadeDisabled: false,
  };
}

/** Called only for an accepted play/telegraph; support preserves posture. */
export function setCombatStance(ctx, entity, carrier) {
  if (!combatExpansionEnabled(ctx) || !entity) return null;
  const profile = normalizedProfile(carrier);
  if (!profile.maneuver || profile.stanceTrigger === false) return entity.combatStance || null;
  clearCombatCounter(entity, ctx);
  entity.combatStance = { maneuver: profile.maneuver, camp: profile.camp,
    reach: profile.reach, ...(profile.school ? { school: profile.school } : {}),
    ...(Number.isInteger(profile.stanceExpiry) ? { expiresOnOwnerCycle: (entity.combatOwnerCycle || 0) + profile.stanceExpiry } : {}),
  };
  ctx.emit?.('combatStanceChanged', { sourceId: entity.id,
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(entity) } : {}), ...entity.combatStance });
  return entity.combatStance;
}

/** The turn owner calls this once; grants are returned for normal DSL gain. */
export function startTacticalTurn(ctx, entity) {
  if (!combatExpansionEnabled(ctx) || !entity) return { block: 0, barrier: 0 };
  entity.combatOwnerCycle = (entity.combatOwnerCycle || 0) + 1;
  clearCombatCounter(entity, ctx);
  delete entity.combatEvade;
  if (entity.combatStance?.expiresOnOwnerCycle != null
    && entity.combatOwnerCycle >= entity.combatStance.expiresOnOwnerCycle) delete entity.combatStance;
  const stance = entity.combatStance;
  if (stance?.maneuver !== 'defend') return { block: 0, barrier: 0 };
  const amount = Math.floor(expansionMatchupRules(ctx).defend.turnStartProtection + number(entity.ratings?.dr));
  return isSpell(stance) ? { block: 0, barrier: amount } : { block: amount, barrier: 0 };
}

export function prepareCombatEvade(ctx, entity, config = {}) {
  if (!combatExpansionEnabled(ctx) || !entity?.alive) return null;
  if (config.whileStatus && !(entity.statuses?.[config.whileStatus]?.stacks > 0)) return null;
  entity.combatEvade = { charges: Math.max(1, Math.floor(config.charges || 1)),
    bonus: Number(config.bonus) || 0, advantage: Boolean(config.advantage), disadvantage: Boolean(config.disadvantage),
    ...(config.whileStatus ? { whileStatus: config.whileStatus } : {}),
    expiresOnOwnerCycle: (entity.combatOwnerCycle || 0) + 1 };
  ctx.emit?.('evadeGained', { sourceId: entity.id,
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(entity) } : {}), charges: entity.combatEvade.charges });
  return entity.combatEvade;
}

function armExpansionCounter(ctx, entity, carrier, options) {
  const profile = normalizedProfile(carrier);
  const mode = options.mode || profile.counterMode || (isSpell(profile) ? 'spell' : 'melee');
  entity.combatPreparationSerial = (entity.combatPreparationSerial || 0) + 1;
  const authored = options.payload || profile.counterPayload;
  entity.combatCounter = {
    version: 2, charges: 1, serial: entity.combatPreparationSerial, mode,
    coverage: structuredClone(options.coverage || profile.counterCoverage || expansionMatchupRules(ctx).counter.defaultCoverage[mode]),
    payload: authored ? { hp: Math.floor(number(authored.hp)), poise: Math.floor(number(authored.poise)), ward: Math.floor(number(authored.ward)),
      ...(authored.smashPoiseBonus !== undefined ? { smashPoiseBonus: Math.floor(number(authored.smashPoiseBonus)) } : {}),
      ...(authored.hpAgainstNonCaster !== undefined ? { hpAgainstNonCaster: authored.hpAgainstNonCaster } : {}) } : { hp: number(options.damage) + number(options.bonus),
      poise: number(options.poiseDamage), ward: number(options.wardDamage) },
    expiresOnOwnerCycle: (entity.combatOwnerCycle || 0) + 1,
    ...(profile.schoolEffect ? { schoolEffect: profile.schoolEffect } : {}),
    carrier: structuredClone(carrier),
  };
  ctx.emit?.('combatCounterArmed', { ...eventCarrier(entity, carrier), ...seats(ctx, entity, null), sourceId: entity.id, mode });
  return entity.combatCounter;
}

/** Every declared filter must match; Area is never inferred from target count. */
export function counterCoverageMatches(coverage, profile, effect = 'damage') {
  if (!coverage || !profile) return false;
  const filters = [['camps', 'camp'], ['schools', 'school'], ['reaches', 'reach'],
    ['targeting', 'targeting'], ['maneuvers', 'maneuver']];
  for (const [list, key] of filters) {
    const values = coverage[list];
    if (values?.length && !values.includes(profile[key])) return false;
  }
  if (coverage.effects?.length && !coverage.effects.includes(effect)) return false;
  if (profile.targeting === 'area' && !coverage.targeting?.includes('area')) return false;
  if (coverage.requiredTraits?.some(trait => !hasTrait(profile, trait))) return false;
  if (coverage.excludedTraits?.some(trait => hasTrait(profile, trait))) return false;
  return true;
}

function preparedCounter(ctx, target, carrier, options) {
  const counter = target?.combatCounter;
  if (!counter?.charges || (carrier?.combatReaction && carrier.manualCounterSerial !== counter.serial) || restrictions(ctx, target, options).counterDisabled) return null;
  if (target.combatStance?.maneuver !== 'counter') return null;
  if ((target.combatOwnerCycle || 0) >= counter.expiresOnOwnerCycle) return null;
  return counter;
}

function stanceMultiplier(ctx, target, profile) {
  const stance = target?.combatStance;
  const cfg = expansionMatchupRules(ctx);
  if (profile.maneuver === 'attack' && stance?.maneuver === 'smash') return cfg.attack.smashMultiplier;
  if (profile.maneuver === 'smash' && stance?.maneuver === 'defend') return cfg.smash.defendedMultiplier;
  if (profile.maneuver === 'sweep' && stance?.maneuver === 'defend') return cfg.defend.sweepMultiplier;
  return 1;
}

/** Largest-remainder distribution conserves the once-rounded action budget. */
export function allocateTacticalDamage(total, weights) {
  const sum = weights.reduce((n, weight) => n + number(weight), 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map(weight => total * number(weight) / sum);
  const parts = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, fraction: value - parts[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < total - parts.reduce((n, part) => n + part, 0); i++) parts[order[i % order.length].index]++;
  return parts;
}

/** No mutation/RNG. Contacts are complete pre-defense printed damage/effects. */
export function assertSingleActionCamp(carrier, contacts = []) {
  const camp = combatProfileOf(carrier)?.camp;
  const camps = [...new Set([camp, ...contacts.map(contact => contact.camp)].filter(Boolean)
    .map(value => isSpell({ camp: value }) ? 'spell' : value))];
  if (camps.length > 1) throw new Error('A combat action cannot mix Martial and Spell camps');
  return camps[0] || null;
}

export function previewTacticalAction(ctx, source, target, carrier, contacts = [], options = {}) {
  assertSingleActionCamp(carrier, contacts);
  const cfg = expansionMatchupRules(ctx);
  const control = restrictions(ctx, target, options);
  const counter = preparedCounter(ctx, target, carrier, options);
  const profiles = contacts.map(contact => normalizedProfile(carrier, contact));
  const covered = profiles.map((profile, index) => counterCoverageMatches(counter?.coverage, profile, profile.effect || 'damage')
    && (profile.effect === 'status' ? number(contacts[index].pressure ?? contacts[index].amount) > 0 : number(contacts[index].amount) > 0));
  const eligible = !!counter && covered.some(Boolean);
  const multiplier = profiles.map((profile, index) => (carrier?.combatReaction ? 1 : stanceMultiplier(ctx, target, profile))
    * (eligible && covered[index] && ['attack', 'smash'].includes(profile.maneuver) ? cfg.counter.incomingMultiplier : 1));
  const weighted = contacts.map((contact, index) => contact.effect === 'status' ? 0 : number(contact.amount) * multiplier[index]);
  const rawTotal = weighted.reduce((n, amount) => n + amount, 0);
  const statusPercent = Array.isArray(options.contactModifiers) && rawTotal > 0
    ? weighted.reduce((sum, weight, index) => sum + weight * (Number(options.contactModifiers[index]?.percent) || 0), 0) / rawTotal
    : Number(options.percent) || 0;
  const stanceAmount = Math.max(0, Math.ceil(rawTotal - 1e-9));
  const knowledgeBonus = Math.max(0, stanceAmount - contacts.reduce((sum, contact) => sum + (contact.effect === 'status' ? 0 : number(contact.amount)), 0));
  const amount = Math.max(0, Math.ceil(stanceAmount * Math.max(0, 1 + statusPercent / 100) - 1e-9));
  const amounts = allocateTacticalDamage(amount, contacts.map(contact => contact.effect === 'status' ? 0 : number(contact.amount)));
  const profile = normalizedProfile(carrier);
  const avoidance = Avoidance.previewAvoidance(ctx, target, profile, amount, { evadeDisabled: control.evadeDisabled, evadeBonus: options.evadeBonus || 0 });
  const guardBefore = number(target?.block) - Math.min(number(target?.block), number(target?.wardBlock));
  const pierce = profiles.some((p, i) => p.camp === 'physical' && amounts[i] > 0
    && (cfg.damageAliases[p.damageType] === 'piercing' || p.damageType === 'piercing'));
  return { version: 2, targetKey: targetKey(ctx, target), profile, profiles, amount, amounts, knowledgeBonus,
    guardBefore, guardBypass: pierce && !carrier?.combatReaction ? Math.min(amount, guardBefore, cfg.damageRiders.piercing?.guardBypass || 0) : 0,
    smash: profiles.some(p => p.maneuver === 'smash') && target?.combatStance?.maneuver === 'defend',
    counterEligible: eligible, counter: eligible ? structuredClone(counter) : null, covered,
    counterDisabledAtStart: Boolean(control.counterDisabled), avoidance,
    hpLoss: 0, blocked: 0, wardResisted: 0, statusAccepted: 0, statusResisted: 0,
    avoided: false, connected: false, completed: false };
}

/** Consume preparation once, before a seeded action-wide avoidance decision. */
export function beginTacticalAction(ctx, source, target, carrier, contacts = [], options = {}) {
  if (options.receipt?.begun) return options.receipt;
  const receipt = previewTacticalAction(ctx, source, target, carrier, contacts, options);
  receipt.begun = true;
  if (receipt.counterEligible) {
    target.combatCounter.charges = 0;
    ctx.emit?.('combatCounterConsumed', { ...eventCarrier(target, receipt.counter.carrier), ...seats(ctx, target, source),
      sourceId: target.id, targetId: source?.id, serial: receipt.counter.serial });
  }
  const control = restrictions(ctx, target, options);
  receipt.avoidance = Avoidance.resolveAvoidance(ctx, source, target, receipt.profile, receipt.amount,
    { evadeDisabled: control.evadeDisabled, evadeBonus: options.evadeBonus || 0 });
  receipt.avoided = receipt.avoidance.avoided;
  receipt.connected = receipt.amount > 0 && !receipt.avoided;
  const groundedStatus = ctx.combatExpansionRules?.statuses?.interactions?.grounded || 'grounded';
  if (receipt.connected && receipt.profiles.some(p => p.school === 'lightning' || p.damageType === 'lightning')
    && !hasTrait(target, 'grounded') && !number(target?.statuses?.[groundedStatus]?.stacks)) {
    clearCombatCounter(target, ctx);
    receipt.counterBroken = true;
  }
  return receipt;
}

export function recordTacticalContact(receipt, { hpLoss = 0, blocked = 0, wardResisted = 0 } = {}) {
  receipt.hpLoss += number(hpLoss);
  receipt.blocked += number(blocked);
  receipt.wardResisted += number(wardResisted);
  return receipt;
}

export function recordTacticalStatus(receipt, pressure = {}) {
  const accepted = pressure.accepted ?? number(pressure.acceptedBuildup) + number(pressure.activeAdded);
  receipt.statusAccepted += number(accepted);
  receipt.statusResisted += number(pressure.resisted) + number(pressure.wardSpent);
  return receipt;
}

function schoolReturnMultiplier(ctx, counter, incoming) {
  const school = counter.carrier?.combatProfile?.school;
  const cfg = expansionMatchupRules(ctx).counter;
  const match = cfg.schoolMatchups[school];
  if (!match || !counter.schoolEffect) return 1;
  const check = (prefix) => match[`${prefix}Schools`]?.includes(incoming.school)
    || match[`${prefix}DamageTypes`]?.includes(incoming.damageType)
    || match[`${prefix}Reaches`]?.includes(incoming.reach)
    || match[`${prefix}Targeting`]?.includes(incoming.targeting)
    || match[`${prefix}Traits`]?.some(trait => hasTrait(incoming, trait));
  if (check('weak')) return cfg.schoolWeakMultiplier;
  return check('strong') ? cfg.schoolStrongMultiplier : 1;
}

/** Root finalizes only after all direct contacts, pressure, and impact. */
export function completeTacticalAction(ctx, source, target, carrier, receipt, options = {}) {
  if (!receipt || receipt.completed) return [];
  receipt.completed = true;
  const queue = [];
  const enqueue = effect => {
    const action = { effect, source: target, owner: target, target: source,
      card: { ...receipt.counter.carrier, combatReaction: true, skipRatingBonus: true,
        reactionDepth: Math.max(receipt.counter.carrier.reactionDepth || 0, carrier?.reactionDepth || 0),
        ...(effect.op === 'wardDamage' ? { combatWardEdgeApplied: true } : {}) }, meta: { combatCounterReaction: true, enemyKnowledgeActionSerial: source.knowledgeAction?.serial } };
    queue.push(action);
    if (ctx.reactionRulesVersion !== 1) ctx.enqueue?.(action);
  };
  if (receipt.smash && receipt.connected && receipt.guardBefore > 0 && number(target?.block) <= 0 && target?.alive) {
    const amount = carrier?.combatProfile?.breakPoiseBonus ?? expansionMatchupRules(ctx).smash.guardBreakPoiseBonus;
    if (amount > 0) ctx.enqueue?.({ effect: { op: 'poiseDamage', amount }, source, owner: source, target,
      card: { ...carrier, combatReaction: true }, meta: { combatSmashBreak: true } });
  }
  const counter = receipt.counter;
  const stillPrepared = counter && target?.combatCounter?.serial === counter.serial;
  const blocked = restrictions(ctx, target, options).counterDisabled || receipt.counterDisabledAtStart;
  const unreflectable = receipt.profiles.some(p => hasTrait(p, 'unreflectable'));
  const resistedPayload = receipt.amount > 0 ? receipt.blocked + receipt.wardResisted >= receipt.amount : receipt.statusResisted > 0;
  if (!stillPrepared || blocked || receipt.avoided || receipt.counterBroken || unreflectable
    || !target?.alive || !source?.alive || receipt.hpLoss > 0 || receipt.statusAccepted > 0 || !resistedPayload
    || target.combatCounterReturnedCycle === (target.combatOwnerCycle || 0)) return queue;
  target.combatCounterReturnedCycle = target.combatOwnerCycle || 0;
  const payload = { hp: number(counter.payload.hp), poise: number(counter.payload.poise), ward: number(counter.payload.ward) };
  if (receipt.profiles.some((profile, index) => receipt.covered[index] && profile.effect !== 'status' && profile.maneuver === 'smash')) {
    payload.poise += number(counter.payload.smashPoiseBonus);
  }
  if (target.statuses?.prone?.stacks > 0 && receipt.profiles.some((profile, index) => receipt.covered[index] && profile.reach === 'contact')) {
    payload.poise += number(counter.carrier.combatProfile?.pronePoiseBonus);
  }
  const magical = isSpell(counter.carrier.combatProfile);
  const caster = hasTrait(source, 'caster');
  if (magical && !caster && counter.payload.hpAgainstNonCaster !== true) payload.hp = 0;
  const schoolEffect = counter.schoolEffect;
  const edges = receipt.profiles.filter((profile, index) => receipt.covered[index])
    .map(profile => schoolReturnMultiplier(ctx, counter, profile));
  const schoolEdge = edges.some(edge => edge < 1) ? Math.min(...edges) : Math.max(1, ...edges);
  if (schoolEffect && schoolEffect in payload && schoolEffect !== 'ward') payload[schoolEffect] = Math.floor(payload[schoolEffect] * schoolEdge);
  // Ward pressure retains fractional carry. A declared school edge replaces
  // Piercing's generic Ward advantage; the same return never multiplies both.
  const pierceWard = magical && counter.carrier.combatProfile?.damageType === 'piercing';
  const wardEdge = schoolEffect === 'ward' && schoolEdge !== 1 ? schoolEdge : pierceWard ? 1.25 : 1;
  payload.ward *= wardEdge;
  const event = { ...eventCarrier(target, counter.carrier), ...seats(ctx, target, source),
    sourceId: target.id, targetId: source.id, amount: payload.hp, poiseDamage: payload.poise, wardDamage: payload.ward, wardOnly: magical && payload.hp === 0 };
  if (payload.hp > 0) enqueue({ op: 'damage', amount: payload.hp });
  if (payload.poise > 0) enqueue({ op: 'poiseDamage', amount: payload.poise });
  if (payload.ward > 0) enqueue({ op: 'wardDamage', amount: payload.ward });
  if (ctx.reactionRulesVersion === 1 && queue.length) {
    const group = enqueueExpandedAction(ctx, queue, { source: target, target: source, carrier: queue[0].card });
    if (group) group.counterReturn = event;
  } else ctx.emit?.('combatCounterTriggered', event);
  return queue;
}
