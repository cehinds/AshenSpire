// src/engine/actions.js — effect-DSL opcode implementations (SPEC §3.4)
//
// A queued ACTION is { effect, source, owner?, target?, card?, meta? }:
//   effect — one opcode object from content data
//   source — the entity performing the effect (player, an enemy, or null in
//            run-level contexts)
//   owner  — the entity owning the trigger/status that produced it (defaults
//            to source); formulas' and targets' 'owner' resolves to this
//   target — the contextual target (e.g. the enemy a card was aimed at)
//   card   — { instanceId, cardId, type } when the action came from a card
//   meta   — { energySpent, ordinalThisTurn, ordinalThisCombat, attackOrdinal }
//
// RULE (SPEC §3.9): nothing mutates HP/block/piles/statuses except an executed
// action. Triggers react to events and only enqueue further actions.
//
// Damage math (SPEC §4.2, order contractual, floor ONCE at the end):
//   dmg = base
//   dmg += attacker per-stack 'attackDamageAdd' modifiers
//   dmg *= attacker 'damageDealtMult' modifiers
//   dmg *= defender 'damageTakenMult' modifiers
//   dmg = floor(dmg); below 0 → 0
// The engine consults the generic status model only — never a named status.
//
// Headless: no document/window/localStorage/timers.

import * as F from './combatRules.js';
import { allocateInteger, resolveDamageComponents, groupedResistance } from '../model/combatRules.js';
import { COMBAT_OPCODES, RUN_OPCODES, relicInRewardPool } from '../model/schemas.js';
import { LEGACY_HAND_MAX } from '../model/statRows.js';
import { evaluate, evaluateRaw, isFormula } from '../model/formulas.js';
import * as statuses from '../framework/statusSemantics.js';
import { usesSingleBreakMeter } from '../model/breakMeter.js';
import * as Triggers from './triggers.js';
import { playerWeightClass } from '../model/combatWeight.js';
import { canRemoveDeckCard, removeDeckCard } from '../model/cardRemoval.js';
import { flaskSlotCap, chargeFlaskDefinition } from '../model/gracerefill.js';
import { syncFlaskGrowth } from '../model/flaskgrowth.js';
import { passiveMult } from '../model/registries.js';
import { commitSmithing, smithingPlan } from '../model/smithing.js';
import * as Properties from './properties.js';
import * as Ratings from './combatRatings.js';
import { isMagicalAttack, ratingDamageMultiplier, attackImpact } from '../model/combatRatings.js';
import { swapRunClass } from '../model/classSwap.js';
import { applyGraceRefill } from './encounters.js';
import { orderedReturn } from '../model/deckRules.js';
import { reviveTokenFor, reviveHp, adjustCount } from '../model/consumables.js';
import { reconcileWardBlock, wardBlockReceipt } from '../model/blockPresentation.js';
import { allowAbilityOnce, grantAbilityCharge, recordAbilityOffering, requestAbilityDiscard } from './abilityRiders.js';
import * as Matchups from './combatMatchups.js';
import { creditKnowledgeImpact } from './enemyKnowledge.js';

import * as Expanded from './combatExpansionActions.js';
import * as Control from './combatStatusControl.js';
import * as Blight from './ashenBlight.js';

// ---------------------------------------------------------------------------
// Shared math (also used by combat.js previews — no duplicated math in the UI)
// ---------------------------------------------------------------------------

/**
 * computeAttackDamage(ctx, source, target|null, base) → final integer damage.
 * Pure (no mutation). Pass target = null to preview without defender mods.
 */
export function computeAttackDamage(ctx, source, target, base, attackTags, carrier = null, { matchups = true, beforeDefense = false } = {}) {
  const ratedBase = base + (carrier?.skipRatingBonus ? 0 : Ratings.cardRatingBonus(ctx, source, carrier, 'damage', base));
  if (ctx.foundation) {
    const amount = F.foundationDamage(ctx, source, target, ratedBase, carrier, attackTags || [], { beforeDefense }).amount;
    return matchups ? Matchups.prepareMatchupHit(ctx, source, target, carrier, amount).amount : amount;
  }
  let dmg = ratedBase;
  const school = carrier && carrier.damageSchool;
  if (source && source.kind === 'player' && school) {
    dmg += source.damageBySchoolAdd && Number.isFinite(source.damageBySchoolAdd[school])
      ? source.damageBySchoolAdd[school]
      : 0;
  }
  dmg += statuses.getAdd(ctx, source, 'attackDamageAdd');
  dmg *= statuses.getMult(ctx, source, 'damageDealtMult');
  if (target) dmg *= statuses.getMult(ctx, target, 'damageTakenMult');
  if (target && !beforeDefense) dmg *= ratingDamageMultiplier(ctx, target, isMagicalAttack(ctx, carrier));
  // Tag-scoped extra vulnerability (#61): statuses whose taggedVulnerability
  // tags intersect the hit's effect tags. Composition is the row's DECLARED
  // stacking rule (closed enum, validated): 'multiplicative' sources multiply
  // in like every shipped *Mult (flat per status, stack-count-invariant);
  // 'additive' sources pool (mult − 1) and apply once. Both lanes are
  // stack-invariant, so the ceiling is the closed-form product of DISTINCT
  // table mults — stacks can never raise it.
  if (target && attackTags && attackTags.length) {
    let addPool = 0;
    for (const [id, inst] of Object.entries(target.statuses || {})) {
      if (!inst || (inst.meter ? inst.meter.value : inst.stacks) <= 0) continue;
      const def = ctx.registries.statuses.get(id);
      const tv = def && def.taggedVulnerability;
      if (!tv || !tv.tags.some((t) => attackTags.includes(t))) continue;
      if (tv.stacking === 'multiplicative') dmg *= tv.mult;
      else addPool += tv.mult - 1;
    }
    if (addPool > 0) dmg *= 1 + addPool;
  }
  if (target && school) {
    const resistance = target.damageResistanceBySchool && target.damageResistanceBySchool[school];
    if (!beforeDefense && Number.isFinite(resistance)) dmg *= Math.max(0, 1 - resistance / 100);
    for (const [id, inst] of Object.entries(target.statuses || {})) {
      if (!inst || (inst.meter ? inst.meter.value : inst.stacks) <= 0) continue;
      const def = ctx.registries.statuses.get(id);
      if (def && def.schoolDamageVulnerability && def.schoolDamageVulnerability.school === school) {
        dmg *= 1 + (inst.stacks || 0) / 100;
      }
    }
  }
  dmg = Math.floor(dmg);
  dmg = dmg < 0 ? 0 : dmg;
  return matchups ? Matchups.prepareMatchupHit(ctx, source, target, carrier, dmg).amount : dmg;
}

/**
 * One derivation for live actions and previews: card identity comes from CSV.
 *
 * THERE IS NO MODULE-GLOBAL FALLBACK HERE, AND THAT IS THE POINT. Five review
 * rounds found the same defect at five addresses: a reader that preferred the
 * ACTIVE content but fell back to the shipped fold in content/tags.js whenever
 * the active answer looked uninteresting — absent, then empty, then falsy. Each
 * fix narrowed the condition and the next round found the next condition. The
 * condition was never the bug; having two sources was. So the global is gone
 * from this path: what answers is the active content, in the order the run
 * itself layers it —
 *
 *   1. the card INSTANCE (`cardTags`), which model/registries.js writes only
 *      onto an equipment-generated card. Absent means an ordinary card and is
 *      the one genuine miss; `[]` grants no inherited identity. An explicitly
 *      tagged local effect may still describe its own hit.
 *   2. the card ROW in the supplied registries, stamped from that bundle's own
 *      tagging rows.
 *   3. the EFFECT, which came out of that same bundle, and is what speaks for a
 *      non-card effect (no cardId at all) and for isolated engine fixtures whose
 *      cards carry no rows.
 *
 * A caller with no registries and no effect tags gets `[]` — the honest answer,
 * because nothing it handed us said otherwise. It no longer gets the shipped
 * game's tags for a bundle it never supplied.
 */
export function attackTagsFor(action, effect, registries) {
  if (action.card && Array.isArray(action.card.tags)) {
    return action.card.tags.length || !Array.isArray(effect.tags) ? action.card.tags : effect.tags;
  }
  const cardId = action.card && action.card.cardId;
  if (cardId && registries && registries.cards && registries.cards.has(cardId)) {
    const stamped = registries.cards.get(cardId).tags;
    if (Array.isArray(stamped) && stamped.length) return stamped;
  }
  return Array.isArray(effect.tags) ? effect.tags : [];
}

/**
 * critChance(rules, attributes, tags) → { chance, multiplier } for an attack of
 * these tags (SPEC §13.4o): every matching rule adds base + Σ weight ×
 * attribute / divisor, the sum is capped at the highest matching cap, and the
 * multiplier is the highest matching one. No match is { chance: 0 }.
 */
export function critChance(rules, attributes, tags) {
  const tagSet = new Set(Array.isArray(tags) ? tags : []);
  const matching = (Array.isArray(rules) ? rules : []).filter((rule) => rule && (rule.tags || []).some((tag) => tagSet.has(tag)));
  if (!matching.length) return { chance: 0, multiplier: 1 };
  const sum = matching.reduce((total, rule) => total + (rule.base || 0) + Object.entries(rule.weights || {})
    .reduce((n, [id, w]) => n + w * (Number(attributes && attributes[id]) || 0), 0) / (rule.divisor || 100), 0);
  const cap = Math.max(...matching.map((rule) => (Number.isFinite(rule.cap) ? rule.cap : 1)));
  return { chance: Math.max(0, Math.min(cap, sum)), multiplier: Math.max(...matching.map((rule) => rule.multiplier || 1)) };
}

// The roll: only the player's attacks, only with a crit rule that matches, on
// the combatProcs stream (nothing is drawn without a rule, so a run with no
// such feat draws exactly what it always drew).
export function rollCrit(ctx, source, tags) {
  if (!source || source.kind !== 'player' || !Array.isArray(source.critRules) || !source.critRules.length) return 0;
  const { chance, multiplier } = critChance(source.critRules, ctx.attributes, tags);
  if (!(chance > 0) || !(multiplier > 1)) return 0;
  return ctx.rng.float('combatProcs') < chance ? multiplier : 0;
}

/**
 * applyAttackDamage(ctx, source, target, base) — full attack resolution:
 * §4.2 math, block absorption first, then HP. Emits damageDealt (+ hpLost if
 * HP was touched), handles deaths and phase checks. Returns final damage.
 */
export function applyAttackDamage(ctx, source, target, base, attackTags, carrier = null) {
  if (!target || !target.alive) return 0;
  if (ctx.combatExpansionVersion === 2) return applyExpandedDamage(ctx, source, target, base, attackTags, carrier);
  const targetStatusesBefore = structuredClone(target.statuses || {});
  if (F.consumeFoundationEvade(ctx, source, target, carrier)) return 0;
  const ratedBase = base + (carrier?.skipRatingBonus ? 0 : Ratings.cardRatingBonus(ctx, source, carrier, 'damage', base));
  const receipt = ctx.foundation ? F.foundationDamage(ctx, source, target, ratedBase, carrier, attackTags || []) : null;
  const computed = receipt ? receipt.amount : computeAttackDamage(ctx, source, target, base, attackTags, carrier, { matchups: false });
  // A critical hit multiplies the finished blow, before Block takes its share.
  const critical = carrier && carrier.critMultiplier > 1 ? Math.floor(computed * carrier.critMultiplier) : computed;
  if (critical > computed) ctx.emit('critHit', { sourceId: source?.id, targetId: target.id, multiplier: carrier.critMultiplier, amount: critical });
  const tactical = Matchups.prepareMatchupHit(ctx, source, target, carrier, critical);
  const dmg = tactical.amount;
  const blocked = Math.min(target.block, Math.max(0, dmg - tactical.guardBypass));
  target.block -= blocked;
  reconcileWardBlock(target);
  const hpLoss = dmg - blocked;
  // Mitigation establishes the surviving types and their proportions. Critical
  // and tactical modifiers change the final integer budget, so the receipt must
  // allocate that budget back over those same types before allocating HP loss.
  const componentShares = receipt && dmg > 0 ? allocateInteger(dmg, receipt.components.map(c => c.amount)) : [];
  const components = receipt?.components.map((c, i) => ({ ...c, amount: componentShares[i] || 0 }));
  const hpShares = components && dmg > 0 ? allocateInteger(hpLoss, components.map((c) => c.amount)) : [];
  if (hpLoss > 0) target.hp -= hpLoss;
  creditKnowledgeImpact(ctx, target, dmg, tactical.smash && dmg > critical);
  ctx.emit('damageDealt', {
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source), targetPlayerId: ctx.playerIdForEntity(target) } : {}),
    sourceId: source ? source.id : null,
    targetId: target.id,
    amount: dmg,
    blocked,
    // The card that landed it, for the readers that pay by the piece that lent
    // it (engine/skillXp.js): which hand, which piece. Absent when no card did.
    ...(carrier && carrier.instanceId ? { cardInstanceId: carrier.instanceId, sourceHand: carrier.sourceHand, grantedBy: carrier.grantedBy } : {}),
    blockRemaining: target.block,
    ...wardBlockReceipt(target),
    ...(components ? { components, hpComponents: components.map((c, i) => ({ type: c.type, amount: hpShares[i] || 0 })), sourceInstanceId: F.foundationSource(ctx, source, carrier).id,
      tags: receipt.tags } : {}),
    isAttack: true,
  });
  if (hpLoss > 0) {
    if (ctx.ratingsRules && !carrier?.combatReaction) {
      const multiplier = Matchups.matchupPoiseMultiplier(ctx, source, target, carrier);
      Ratings.applyRatingImpact(ctx, source, target, carrier, multiplier > 1 ? Math.floor(attackImpact(ctx, source, carrier) * multiplier) : null, { knowledgeMatchup: multiplier > 1 });
    }
    ctx.emit('hpLost', { ...seatOf(ctx, target), targetId: target.id, amount: hpLoss, cause: 'attack' });
    if (!usesSingleBreakMeter(ctx) && !carrier?.combatReaction) applyArcaneExposure(ctx, source, target, carrier);
  }
  afterHpChange(ctx, target, { targetStatusesBefore, sourceId: source?.id, ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source) } : {}) });
  Matchups.completeMatchupHit(ctx, source, target, carrier, tactical, { blocked, hpLoss,
    applySmashBreakPoise: amount => dealPoiseDamage(ctx, target, amount, { knowledgeMatchup: true }) });
  for (const effect of Matchups.matchupRiderEffects(ctx, source, target, carrier, { amount: dmg, hpLoss })) {
    ctx.enqueue({ effect, source, owner: source, target, card: { ...carrier, combatReaction: true }, meta: { combatDamageRider: true } });
  }
  return dmg;
}

export function gainBarrier(ctx, entity, base, card = null) {
  if (!entity?.alive) return 0;
  const amount = computeBlockGain(ctx, entity, base, card);
  entity.barrier = (entity.barrier || 0) + amount;
  ctx.emit('barrierGained', { targetId: entity.id, amount, total: entity.barrier, ...seatOf(ctx, entity) });
  return amount;
}

export function restoreExpandedWard(ctx, entity, nominal, options = {}) {
  return Control.restorePersistentWard(ctx, entity, nominal, { source: 'card', ...options });
}

export function prepareExpandedDefense(ctx, target, receipt, carrier) {
  if (receipt.defendedAmounts) return;
  const sums = {}, indices = {};
  receipt.amounts.forEach((amount, index) => {
    const profile = receipt.profiles[index];
    const aliases = { pierce: 'piercing', slash: 'slashing', cold: 'frost', force: 'arcane', holy: 'sacred', necrotic: 'decay' };
    const type = aliases[profile.damageType] || profile.damageType || 'blunt';
    const key = `${profile.camp}:${type}`;
    sums[key] = (sums[key] || 0) + amount;
    (indices[key] ||= []).push(index);
  });
  receipt.defendedAmounts = receipt.amounts.map(() => 0);
  for (const [key, total] of Object.entries(sums)) {
    const [camp, type] = key.split(':');
    let amount;
    if (ctx.foundation) {
      const defense = F.foundationProfile(ctx, target), rules = ctx.foundation.rules;
      amount = resolveDamageComponents(rules, { components: [{ type, amount: total }], armor: defense.armor || 0,
        penetration: carrier?.attack?.penetration || 0,
        resistances: groupedResistance(rules, defense.resistanceSources || [], defense.resistances || {}),
        immunities: defense.immunities || [], multiplier: 1, flatBonus: 0 }).reduce((sum, part) => sum + part.amount, 0);
    } else {
      const resistance = target.damageResistanceBySchool?.[carrier?.damageSchool];
      amount = Math.max(0, Math.floor(total * (camp === 'spell' ? 1 : ratingDamageMultiplier(ctx, target, false))
        * (Number.isFinite(resistance) ? Math.max(0, 1 - resistance / 100) : 1)));
    }
    amount = Math.max(0, Math.ceil(amount * (1 + Math.max(0, target.damageWeaknessPercent?.[type] || 0) / 100))
      - Math.max(0, target.damageResistanceFlat?.[type] || 0));
    const shares = total > 0 ? allocateInteger(amount, indices[key].map(index => receipt.amounts[index])) : indices[key].map(() => 0);
    indices[key].forEach((index, i) => { receipt.defendedAmounts[index] = shares[i]; });
  }
  const magical = receipt.profiles.map((profile, index) => profile.camp === 'spell' ? index : -1).filter(index => index >= 0);
  const total = magical.reduce((sum, index) => sum + receipt.defendedAmounts[index], 0);
  const ward = Math.min(total, target.persistentWard?.value || 0);
  const shares = total > 0 ? allocateInteger(total - ward, magical.map(index => receipt.defendedAmounts[index])) : magical.map(() => 0);
  magical.forEach((index, i) => { receipt.defendedAmounts[index] = shares[i] || 0; });
  receipt.resistedAmounts = receipt.amounts.map((amount, index) => Math.max(0, amount - receipt.defendedAmounts[index]));
  receipt.guardBypassRemaining = receipt.guardBypass || 0;
}

function applyExpandedDamage(ctx, source, target, base, tags, carrier = {}) {
  const planned = carrier.expansionContact;
  const profile = { ...carrier.combatProfile, reach: carrier.combatProfile?.reach || 'contact', targeting: carrier.combatProfile?.targeting || 'single' };
  const raw = planned ? planned.receipt.amounts[planned.index] : Math.floor(computeAttackDamage(ctx, source, target, base, tags, carrier, { matchups: false, beforeDefense: true }) * (carrier.critMultiplier || 1));
  const tactical = planned?.receipt || Matchups.beginTacticalAction(ctx, source, target, carrier, [{ ...profile, amount: raw }],
    { ...Control.statusIncomingModifier(ctx, target, profile), restrictions: Control.controlRestrictions(ctx, target) });
  if (tactical.avoided) return 0;
  if (carrier.critMultiplier > 1) ctx.emit('critHit', { sourceId: source?.id, targetId: target.id, multiplier: carrier.critMultiplier, amount: raw });
  prepareExpandedDefense(ctx, target, tactical, carrier);
  const contactIndex = planned?.index || 0;
  let amount = tactical.defendedAmounts[contactIndex] || 0;
  const spell = profile.camp === 'spell';
  // Matchup and control vulnerabilities precede typed defenses and Ward.
  const type = ctx.combatExpansionRules.matchups.damageAliases[profile.damageType] || profile.damageType;
  const ward = tactical.resistedAmounts[contactIndex] || 0;
  const pool = spell ? 'barrier' : 'block';
  const bypass = Math.min(amount, tactical.guardBypassRemaining || 0);
  tactical.guardBypassRemaining -= bypass;
  const blocked = Math.min(Math.max(0, target[pool] || 0), Math.max(0, amount - bypass));
  target[pool] = Math.max(0, (target[pool] || 0) - blocked);
  const hpLoss = amount - blocked;
  if (hpLoss) target.hp -= hpLoss;
  creditKnowledgeImpact(ctx, target, amount, tactical.knowledgeBonus > 0);
  Matchups.recordTacticalContact(tactical, { hpLoss, blocked, wardResisted: ward });
  ctx.emit('damageDealt', { sourceId: source?.id, targetId: target.id, amount, blocked, wardResisted: ward,
    damageType: type, blockRemaining: target.block || 0, barrierRemaining: target.barrier || 0,
    ...seatOf(ctx, target), ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source) } : {}),
    ...(carrier.instanceId ? { cardInstanceId: carrier.instanceId, sourceHand: carrier.sourceHand, grantedBy: carrier.grantedBy } : {}), isAttack: true });
  if (hpLoss) ctx.emit('hpLost', { targetId: target.id, amount: hpLoss, cause: 'attack', ...seatOf(ctx, target) });
  if (!carrier.combatReaction && !tactical.avoided && target.alive && ctx.ratingsRules) Ratings.applyRatingImpact(ctx, source, target, carrier);
  // Independent pressure resolves even when all direct damage met protection.
  if (!carrier.combatReaction) for (const effect of Matchups.matchupRiderEffects(ctx, source, target, carrier, { amount, hpLoss })) {
    if (['applyStatus', 'buildup'].includes(effect.op)) {
      const pressure = Control.applyStatusPressure(ctx, target, effect.status, effect.amount ?? effect.stacks, source, { camp: effect.camp || profile.camp,
        actionKey: carrier.expansionGroup?.key || `${ctx.turn}:${carrier.instanceId || 'reaction'}` });
      Matchups.recordTacticalStatus(tactical, pressure);
    } else if (effect.op === 'poiseDamage') dealPoiseDamage(ctx, target, effect.amount);
  }
  if (profile.school === 'lightning' && Control.electricalTraits(ctx, target).conductive
    && source?.alive && !Control.electricalTraits(ctx, source).grounded && amount > 0) {
    const backlash = Math.floor(amount / 4);
    if (backlash) applyLoseHp(ctx, source, backlash, 'conductiveBacklash');
  }
  afterHpChange(ctx, target, { sourceId: source?.id });
  return amount;
}

/** Host-only Arcane Exposure mutation, reached only after final HP loss. */
function applyArcaneExposure(ctx, source, target, carrier) {
  if (!target || target.kind !== 'enemy' || !target.arcaneExposure || !carrier) return;
  const schoolMult = ((ctx.registries.balance || {}).arcaneExposure || {}).schoolBuildupMultipliers || {};
  const school = carrier.damageSchool;
  const perHit = carrier.exposureBuildupPerHit;
  const mapped = Number.isFinite(schoolMult[school]) ? schoolMult[school] : 0;
  if (!Number.isInteger(perHit) || perHit <= 0 || mapped <= 0) return;
  // The hit's SOURCE may multiply its buildup: an `exposureBuildupMult` passive
  // on a relic it owns or a property it has mounted (a wand's `overcharge`).
  // Exactly 1 when neither carries one, so every existing hit is unchanged.
  const sourceMult = passiveMult(ctx.registries, (source && source.relicIds) || [], 'exposureBuildupMult', Properties.propertyMountsOf(ctx, source));
  addArcaneExposure(ctx, source, target, { school, attempted: perHit, amountFor: (cfg) => Math.floor(perHit * mapped * cfg.buildupMultiplier * sourceMult) });
}

/**
 * addArcaneExposure(ctx, source, target, { school, attempted, amountFor }) —
 * THE ONE PATH buildup reaches a meter: a hit's (applyArcaneExposure) and a
 * direct pour's (the `arcaneBuildup` opcode, plan phase 8). Immune and locked
 * targets refuse by name; the amount is read off the target's own config once
 * it is known to be configured; a fill resets to zero and breaks.
 */
export function addArcaneExposure(ctx, source, target, { school, attempted = null, amountFor }) {
  if (!target || target.kind !== 'enemy' || !target.arcaneExposure) return 0;
  const cfg = target.arcaneExposure;
  if (cfg.mode === 'immune') {
    ctx.emit('arcaneExposureRefused', { targetId: target.id, sourceId: source && source.id, reason: 'immune', school, attempted });
    return 0;
  }
  if (cfg.mode !== 'configured') return 0;
  if (statuses.hasStatus(target, cfg.onBreak.status)) {
    ctx.emit('arcaneExposureRefused', { targetId: target.id, sourceId: source && source.id, reason: 'locked', school, attempted });
    return 0;
  }
  const amount = Math.floor(amountFor(cfg));
  if (amount <= 0) return 0;
  cfg.value += amount;
  ctx.emit('arcaneExposureChanged', { targetId: target.id, sourceId: source && source.id, school, amount, value: cfg.value, threshold: cfg.threshold });
  if (cfg.value < cfg.threshold) return amount;
  cfg.value = 0; // authored resetMode=zero; overflowPolicy=discard
  ctx.emit('arcaneBreak', {
    targetId: target.id, sourceId: source && source.id, school,
    threshold: cfg.threshold, status: cfg.onBreak.status,
    value: cfg.onBreak.value, duration: cfg.onBreak.duration,
  });
  statuses.applyStatus(ctx, target, cfg.onBreak.status, cfg.onBreak.value, source);
  if (target.statuses[cfg.onBreak.status]) target.statuses[cfg.onBreak.status].duration = cfg.onBreak.duration;
  return amount;
}

/**
 * computeBlockGain(ctx, entity, base) → final integer block gain:
 * base + per-stack 'blockAdd' modifiers, × 'blockGainedMult' modifiers,
 * floored, min 0 (SPEC §4.2). Pure. Cap NOT applied here.
 */
export function computeBlockGain(ctx, entity, base, card = null) {
  let amt = base + Ratings.cardRatingBonus(ctx, entity, card, 'block', base) + statuses.getAdd(ctx, entity, 'blockAdd');
  amt *= statuses.getMult(ctx, entity, 'blockGainedMult');
  amt = Math.floor(amt);
  return amt < 0 ? 0 : amt;
}

/**
 * computeMeterGuardGain(ctx, entity, base, card) → the Poise or Ward guard a
 * gainPoise / gainWard effect grants: its base plus the same rating bonus the
 * card's Block reads (cardRatingBonus 'block' — DR on a physical skill, PR on
 * a magical card), floored, min 0. No Dexterity, Frail or block modifiers: a
 * guard is not Block. Pure; the preview reads it too.
 */
export function computeMeterGuardGain(ctx, entity, base, card = null) {
  const amt = Math.floor(base + Ratings.cardRatingBonus(ctx, entity, card, 'block', base));
  return amt < 0 ? 0 : amt;
}

/**
 * gainMeterGuard — adds to entity.poiseGuard or entity.wardGuard. The guard
 * absorbs physical (Poise) or magical (Ward) impact before the matching meter
 * fills (combatRatings.js absorbMeterGuard) and clears at the start of its
 * owner's turn, with Block.
 */
export function gainMeterGuard(ctx, entity, meter, base, card = null) {
  if (!entity.alive) return 0;
  if (usesSingleBreakMeter(ctx) && meter === 'ward') meter = 'poise';
  const amt = computeMeterGuardGain(ctx, entity, base, card);
  const key = meter + 'Guard';
  if (amt > 0) entity[key] = (entity[key] || 0) + amt;
  ctx.emit('meterGuardGained', {
    targetId: entity.id, meter, amount: amt, total: entity[key] || 0,
    // The weight-priced Dodge Roll's guard is the dodge visual's cue
    // (model/combatEffectEvents.js); any other gainPoise card is not a dodge.
    ...(card?.cardId && ctx.registries.cards.has(card.cardId) && ctx.registries.cards.get(card.cardId).weightClassPriced ? { dodge: true } : {}),
    ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {}),
  });
  return amt;
}

/** gainBlock — mutating block gain with 'blockCap' modifier honored. */
export function gainBlock(ctx, entity, base, card = null) {
  if (!entity.alive) return 0;
  if (ctx.combatExpansionVersion === 2 && card?.combatProfile?.camp === 'spell') return gainBarrier(ctx, entity, base, card);
  let amt = computeBlockGain(ctx, entity, base, card);
  const cap = statuses.getCap(ctx, entity, 'blockCap');
  if (cap != null && entity.block + amt > cap) {
    amt = Math.max(0, cap - entity.block);
  }
  reconcileWardBlock(entity);
  entity.block += amt;
  if (amt > 0 && card && isMagicalAttack(ctx, card)) entity.wardBlock = (entity.wardBlock || 0) + amt;
  ctx.emit('blockGained', {
    targetId: entity.id, amount: amt,
    ...wardBlockReceipt(entity),
    ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {}),
    // The card that raised it, when one did (engine/skillXp.js pays its piece's
    // group), and in co-op the seat that played it — a guard cast on an ally
    // is the caster's shield work, not the ally's.
    ...(card && card.instanceId ? { cardInstanceId: card.instanceId, sourceHand: card.sourceHand, grantedBy: card.grantedBy,
      ...(ctx.playerIdForEntity && ctx.playerKey ? { sourcePlayerId: ctx.playerKey } : {}) } : {}),
  });
  return amt;
}

// Every player entity is id 'player', so in co-op an hpLost receipt names the
// seat it cost, as damageDealt does; readers (triggers, haptics) cannot tell an
// ally from the owner by targetId alone. Solo stamps nothing.
function seatOf(ctx, target) {
  return ctx.playerIdForEntity && target.kind === 'player' ? { targetPlayerId: ctx.playerIdForEntity(target) } : {};
}

/** loseHp — direct HP loss: ignores ALL attack modifiers AND block (SPEC §4.2). */
export function applyLoseHp(ctx, target, amount, cause = 'effect', death = {}) {
  if (!target || !target.alive) return 0;
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return 0;
  target.hp -= n;
  ctx.emit('hpLost', { ...seatOf(ctx, target), targetId: target.id, amount: n, cause });
  afterHpChange(ctx, target, death);
  return n;
}

export function applyHeal(ctx, target, amount) {
  if (!target || !target.alive) return 0;
  const n = Math.max(0, Math.floor(amount));
  const gained = Math.min(n, target.maxHp - target.hp);
  target.hp += gained;
  const playerId = target.kind === 'player' && typeof ctx.playerIdForEntity === 'function'
    ? ctx.playerIdForEntity(target)
    : null;
  ctx.emit('healed', {
    targetId: target.id,
    // `playerId` for the readers that always had it; `targetPlayerId` so
    // eventTargetIsOwner resolves the HEALED seat in co-op, as it does for a
    // hit — an ally's heal is the ally's, not the active seat's.
    ...(playerId ? { playerId, targetPlayerId: playerId } : {}),
    amount: gained,
    requested: n,
  });
  afterHpChange(ctx, target);
  return gained;
}

function afterHpChange(ctx, target, death = {}) {
  // THE DEATH-PREVENTION HOOK (SPEC §14.3): the player about to drop to 0 HP
  // spends one revive token from the fight's copy of the counts and rises at
  // hpPct of max. The copy rides the combat snapshot, so a fight saved after a
  // revive and reloaded still has the token spent; the run's owner settles it
  // back at combat end. Solo only: a co-op seat carries no consumables.
  if (target.hp <= 0 && target.alive && target.kind === 'player' && target === ctx.player && ctx.consumables) {
    const token = reviveTokenFor(ctx.registries, ctx.consumables);
    if (token) {
      adjustCount(ctx.consumables, token.id, -1);
      target.hp = reviveHp(target.maxHp, token.hpPct);
      ctx.emit('reviveSpent', { targetId: target.id, consumableId: token.id, hp: target.hp, left: ctx.consumables[token.id] || 0 });
    }
  }
  if (target.hp <= 0 && target.alive) {
    target.hp = 0;
    target.alive = false;
    if (target.kind === 'enemy') {
      ctx.emit('enemyDied', { targetId: target.id, enemyId: target.enemyId, ...death });
    }
    // Player death is finalized by combat.js's end-of-combat check.
  }
  Triggers.checkPhases(ctx);
}

/**
 * dealPoiseDamage(ctx, enemy, amount) — feed the engine-level poise meter
 * (SPEC §3.7, §4.4). On fill: the enemy's next turn is skipped, any committed
 * delayed move is cancelled (satisfying counterplay), meterFilled +
 * enemyStaggered are emitted, balance.poise.onFill content effects are
 * enqueued (owner = the enemy), and poiseMax grows by balance.poise.growthMult
 * (default 1.25, rounded up) unless growth is disabled.
 */
/**
 * staggerEnemy(ctx, enemy) — break the enemy's next move: cancel what it was
 * winding up, mark the skip, and emit enemyStaggered. One home for the break
 * itself; callers decide HOW it was earned — the poise bar filling
 * (dealPoiseDamage) or a direct proc (the 'stagger' opcode, insanity's row).
 * The direct path deliberately bypasses the bar: a guaranteed break that
 * neither consumes nor grows the poise meter.
 */
export function staggerEnemy(ctx, enemy) {
  if (!enemy || enemy.kind !== 'enemy' || !enemy.alive) return;
  if (ctx.foundation && enemy.impactProtectedUntil >= ctx.turn) return;
  Matchups.clearCombatCounter(enemy, ctx);
  const cancelled = enemy.pendingMove ? enemy.pendingMove.moveId : null;
  enemy.pendingMove = null;
  enemy.skipNextTurn = true;
  if (ctx.foundation) enemy.impactProtectedUntil = ctx.turn + ctx.foundation.rules.impact.protectionTurns;
  enemy.intent = { kind: 'staggered', moveId: null };
  ctx.emit('enemyStaggered', { targetId: enemy.id, enemyId: enemy.enemyId, cancelledMove: cancelled });
}

/**
 * staggerPlayer(ctx, player) — the player's poise meter filled (plan phase 8,
 * SPEC §13.4k): the NEXT turn opens with balance.stagger.player.actionLoss
 * fewer actions, and each status the row names is applied at its stacks
 * (ordinary decay). The engine names no status; the row does. Emits
 * `playerStaggered` with what it took.
 */
export function staggerPlayer(ctx, player) {
  Matchups.clearCombatCounter(player, ctx);
  const cfg = (((ctx.registries.balance || {}).stagger || {}).player) || {};
  const actionLoss = Number.isInteger(cfg.actionLoss) ? cfg.actionLoss : 0;
  const applied = {};
  for (const [status, stacks] of Object.entries(cfg.statuses || {})) {
    if (!(stacks > 0)) continue;
    statuses.applyStatus(ctx, player, status, stacks, null);
    applied[status] = stacks;
  }
  player.pendingActionLoss = (player.pendingActionLoss || 0) + actionLoss;
  // The seat, in co-op: every player entity is `player`, so the receipt
  // names the member as the other player-side events do.
  ctx.emit('playerStaggered', { targetId: player.id, actionLoss, statuses: applied, ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(player) } : {}) });
}

/**
 * dealPoiseDamage(ctx, entity, amount) — an enemy's meter or the PLAYER's
 * (plan phase 8: the player's vessel is real once its max is stamped; an
 * entity with no meter, or a 0 max, takes nothing). A fill Staggers an enemy
 * (staggerEnemy + balance.poise.onFill) or the player (staggerPlayer), and the
 * meter grows by balance.poise.growthMult either way.
 */
export function dealPoiseDamage(ctx, entity, amount, { knowledgeMatchup = false } = {}) {
  if (ctx.ratingsRules) return Ratings.applyRatingImpact(ctx, null, entity, { damageSchool: 'physical' }, amount, { knowledgeMatchup });
  if (!entity || !entity.alive || (entity.kind !== 'enemy' && entity.kind !== 'player')) return;
  if (!entity.poiseMeter || !(entity.poiseMeter.max > 0)) return;
  const isEnemy = entity.kind === 'enemy';
  // A Poise guard (gainPoise) takes the impact before the meter does.
  const n = Math.max(0, Math.floor(amount)) - Ratings.absorbMeterGuard(entity, 'poise', amount);
  if (n <= 0) return;
  creditKnowledgeImpact(ctx, entity, n, knowledgeMatchup);
  if (ctx.foundation && isEnemy && entity.impactProtectedUntil >= ctx.turn) {
    entity.poiseMeter.value = Math.min(entity.poiseMeter.max - 1, entity.poiseMeter.value + n);
    return;
  }
  entity.poiseMeter.value += n;
  const cfg = (ctx.registries.balance && ctx.registries.balance.poise) || {};
  let guard = 0;
  while (entity.poiseMeter.value >= entity.poiseMeter.max) {
    if (++guard > 100) throw new Error('Poise meter fill loop did not terminate');
    entity.poiseMeter.value -= entity.poiseMeter.max;
    ctx.emit('meterFilled', { targetId: entity.id, meter: 'poise', threshold: entity.poiseMeter.max, ...(!isEnemy && ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {}) });
    if (isEnemy) {
      staggerEnemy(ctx, entity);
      for (const eff of cfg.onFill || []) {
        ctx.enqueue({ effect: eff, source: entity, owner: entity, target: entity, meta: {} });
      }
    } else {
      staggerPlayer(ctx, entity);
    }
    const growth = cfg.growthMult != null ? cfg.growthMult : 1.25;
    if (growth !== 1 && !statuses.anyCombatantFlag(ctx, 'meterMaxGrowthDisabled')) {
      entity.poiseMeter.max = Math.ceil(entity.poiseMeter.max * growth);
      // COUNTED, not multiplied. A later restamp from the receipt (an armament
      // swap, a restored fight) replays the same rounded steps; one compound
      // multiply would land a point low, because each live fill rounds up
      // before the next (Codex, #1203).
      entity.poiseMeter.growths = (entity.poiseMeter.growths || 0) + 1;
      entity.poiseMeter.growthMult = growth;
    }
    if (ctx.foundation) { entity.poiseMeter.value = Math.min(entity.poiseMeter.max - 1, entity.poiseMeter.value); break; }
  }
}

// ---------------------------------------------------------------------------
// Card pile operations
// ---------------------------------------------------------------------------

/**
 * drawCards(ctx, n) — draw with reshuffle (stream 'shuffle') when the draw
 * pile empties; cards past the hand limit overflow to discard (SPEC §4.1(3)).
 */
export function drawCards(ctx, n) {
  for (let i = 0; i < n; i++) {
    if (ctx.handRules && ctx.piles.hand.length >= ctx.handMax) return;
    if (ctx.piles.draw.length === 0) {
      if (ctx.handRules?.reshuffle === false) return;
      if (ctx.piles.discard.length === 0) return;
      // Play in deck order (SPEC §14.1) returns the discard in deck order and
      // rolls nothing; the `shuffleDiscardIntoDraw` effect still shuffles.
      if (ctx.orderedDraw) returnDiscardInOrder(ctx);
      else reshuffleDiscardIntoDraw(ctx);
    }
    const card = ctx.piles.draw.shift();
    if (ctx.piles.hand.length >= ctx.handMax) {
      ctx.piles.discard.push(card);
      ctx.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'handFull' });
    } else {
      ctx.piles.hand.push(card);
      ctx.emit('cardDrawn', { cardInstanceId: card.instanceId, cardId: card.cardId });
    }
  }
}

/**
 * discardFromHand(ctx, n) — the discard op's body, one home for both callers:
 * the 'discard' effect below and the ?shotHand pose (main.js), which needs to
 * reach a small hand through the same door a played-down hand goes through —
 * same splice, same pile, same event. Non-random takes from the right end,
 * exactly as the op always has.
 */
export function discardFromHand(ctx, n, { random = false } = {}) {
  for (let i = 0; i < n && ctx.piles.hand.length > 0; i++) {
    const idx = random ? Math.floor(ctx.rng.float('misc') * ctx.piles.hand.length) : ctx.piles.hand.length - 1;
    const card = ctx.piles.hand.splice(idx, 1)[0];
    ctx.piles.discard.push(card);
    ctx.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: random ? 'random' : 'effect', explicit: true, sourceId: ctx.player?.id, ...(ctx.playerKey ? { sourcePlayerId: ctx.playerKey, playerId: ctx.playerKey } : {}) });
  }
}

export function returnDiscardInOrder(ctx) {
  ctx.piles.draw.push(...orderedReturn(ctx.piles.discard, ctx.orderedDraw.order));
  ctx.piles.discard.length = 0;
  ctx.emit('deckShuffled', { size: ctx.piles.draw.length, ordered: true });
}

export function reshuffleDiscardIntoDraw(ctx) {
  ctx.piles.draw.push(...ctx.piles.discard);
  ctx.piles.discard.length = 0;
  ctx.piles.draw = ctx.rng.shuffle('shuffle', ctx.piles.draw);
  ctx.emit('deckShuffled', { size: ctx.piles.draw.length });
}

// ---------------------------------------------------------------------------
// Target + amount resolution
// ---------------------------------------------------------------------------

function livingEnemies(ctx) {
  return (ctx.enemies || []).filter((e) => e.alive);
}

/**
 * resolveTargets(ctx, action, targetSpec) → entity array for one application.
 * Closed target set (SPEC §3.4): self | enemy | allEnemies | randomEnemy |
 * player | owner. An omitted target falls back to the action's contextual
 * target, then its source.
 */
export function resolveTargets(ctx, action, targetSpec) {
  switch (targetSpec) {
    case undefined:
    case null:
      return [action.target || action.source].filter(Boolean);
    case 'self':
      return [action.source].filter(Boolean);
    case 'owner':
      return [action.owner || action.source].filter(Boolean);
    case 'player':
      return [ctx.player].filter(Boolean);
    case 'enemy': {
      if (action.target && action.target.kind === 'enemy' && action.target.alive) return [action.target];
      if (action.source && action.source.kind === 'enemy') return [ctx.player].filter(Boolean);
      const living = livingEnemies(ctx);
      return living.length ? [living[0]] : [];
    }
    case 'allEnemies':
      return livingEnemies(ctx);
    case 'otherEnemies': {
      // Every living enemy but the one the firing event names (and the
      // action's own target): a break's ripple reaches the others.
      const named = action.meta && action.meta.event ? action.meta.event.targetId : null;
      return livingEnemies(ctx).filter((e) => e !== action.target && e.id !== named);
    }
    case 'randomEnemy': {
      const living = livingEnemies(ctx);
      return living.length ? [ctx.rng.pick('misc', living)] : [];
    }
    case 'ally': {
      // Co-op: the explicitly aimed living teammate. Solo — or no pick — falls
      // back to the source, so every ally card stays fully solo-valid.
      const t = action.target;
      if (t && t.kind === 'player' && t !== action.source && t.alive) return [t];
      return [action.source].filter(Boolean);
    }
    default:
      throw new Error(`Unknown effect target '${targetSpec}'`);
  }
}

/** Formula evaluation context for an action (SPEC §3.5). */
export function formulaCtxFor(ctx, action, primaryTarget) {
  const meta = action.meta || {};
  return {
    entities: {
      self: action.source || null,
      owner: action.owner || action.source || null,
      target: primaryTarget || action.target || null,
      enemy: primaryTarget || action.target || null,
      player: ctx.player || null,
      allEnemies: livingEnemies(ctx),
    },
    energySpent: meta.energySpent != null ? meta.energySpent : 0,
    cardsPlayedThisTurn: ctx.player ? ctx.player.counters.cardsPlayedThisTurn : 0,
  };
}

function evalNum(ctx, action, value, dflt, target) {
  if (value === undefined) return dflt;
  let v;
  if (typeof value === 'number') v = Math.floor(value);
  else if (isFormula(value)) v = evaluate(value, formulaCtxFor(ctx, action, target));
  else throw new Error(`Expected number or formula, got ${JSON.stringify(value)}`);
  // Generic amount scaling (e.g. flaskPowerMult): rounded up per SPEC §5.4.
  const mult = action.meta && action.meta.amountMult;
  if (typeof mult === 'number' && mult !== 1) v = Math.ceil(v * mult);
  return v;
}

// The unfloored amount, for the one caller that multiplies before flooring
// (the heal under ctx.healMult). The generic amount scaling applies as above.
function evalRaw(ctx, action, value, dflt, target) {
  if (value === undefined) return dflt;
  let v;
  if (typeof value === 'number') v = value;
  else if (isFormula(value)) v = evaluateRaw(value, formulaCtxFor(ctx, action, target));
  else throw new Error(`Expected number or formula, got ${JSON.stringify(value)}`);
  const mult = action.meta && action.meta.amountMult;
  if (typeof mult === 'number' && mult !== 1) v = Math.ceil(v * mult);
  return v;
}

// ---------------------------------------------------------------------------
// executeAction — the queue interpreter body
// ---------------------------------------------------------------------------

export function executeAction(ctx, action) {
  if (action.effect?.op === 'completeCombatAction') { Expanded.completeExpandedAction(ctx, action); return; }
  if (ctx.result) return; // combat already decided; remaining actions fizzle
  if (action.meta?.expansionGroup?.cancelled) return;
  if (ctx.players && action.source?.kind === 'enemy' && action.target?.kind === 'player'
    && !Expanded.expansionTargetPresent(ctx, action.target)) return;
  if (ctx.combatExpansionVersion === 2) Expanded.beginExpandedAction(ctx, action.meta?.expansionGroup, action.source);
  if (action.meta?.combatCounterReaction && (!action.source?.alive || action.meta.combatCounterInterrupted)) return;
  if (ctx.foundation) ctx._foundationAncestry = action.meta?.foundationAncestry || [];
  const eff = action.effect;

  // Budgeted escape hatch (SPEC §3.1(6)): { script: 'name', ...args }.
  if (typeof eff.script === 'string') {
    const fn = ctx.registries.scripts[eff.script];
    if (typeof fn !== 'function') throw new Error(`Unknown script '${eff.script}'`);
    fn(ctx, action);
    return;
  }

  if (eff.if) {
    const pctx = {
      owner: action.owner || action.source,
      source: action.source,
      target: action.target,
      card: action.card,
      meta: action.meta,
    };
    if (!Triggers.evalPredicate(ctx, eff.if, pctx)) return;
  }
  if (eff.oncePerTurn && !allowAbilityOnce(action.owner || action.source || ctx.player, eff.oncePerTurn, action.card, action.meta?.abilityEffectIndex ?? eff.op)) return;

  const repeat = evalNum(ctx, action, eff.repeat, 1);
  const previous = ctx._abilityAction;
  ctx._abilityAction = action;
  try {
    for (let r = 0; r < repeat; r++) {
      runOpcode(ctx, action, eff);
      if (ctx.result || ctx.pendingAbilityDiscard) return;
    }
  } finally { if (previous) ctx._abilityAction = previous; else delete ctx._abilityAction; }
}

function plannedStatusTargets(ctx, action, eff) {
  const refs = action.meta?.expansionTargets?.[action.meta.statusTargetCursor || 0];
  if (!refs) return resolveTargets(ctx, action, eff.target);
  action.meta.statusTargetCursor = (action.meta.statusTargetCursor || 0) + 1;
  return refs.map(ref => Expanded.expansionEntity(ctx, ref)).filter(entity => Expanded.expansionTargetPresent(ctx, entity));
}

function runOpcode(ctx, action, eff) {
  if (RUN_OPCODES.includes(eff.op)) {
    runRunOpcode(ctx, action, eff);
    return;
  }
  if (!COMBAT_OPCODES.includes(eff.op)) {
    throw new Error(`Unknown opcode '${eff.op}'`);
  }

  switch (eff.op) {
    case 'grantRollMode': {
      if (ctx.combatExpansionVersion !== 2 || eff.roll !== 'evade') throw new Error('Unsupported next-roll mode');
      for (const target of resolveTargets(ctx, action, eff.target)) target.nextEvadeMode = { advantage: !!eff.advantage, disadvantage: !!eff.disadvantage };
      break;
    }
    case 'retain': {
      const owner = action.owner || action.source;
      const piles = ctx.players?.get(ctx.playerIdForEntity?.(owner))?.piles || ctx.piles;
      owner.combatRetainedCards ||= [];
      for (const card of piles.hand.filter(card => !owner.combatRetainedCards.includes(card.instanceId)).slice(0, evalNum(ctx, action, eff.amount, 0))) owner.combatRetainedCards.push(card.instanceId);
      break;
    }
    case 'damage': {
      // hits may legitimately evaluate to 0 (X-cost at 0 energy whiffs, StS-style).
      const hits = Math.max(0, evalNum(ctx, action, eff.hits, 1));
      const attackTags = attackTagsFor(action, eff, ctx.registries);
      const impact = ctx.foundation ? F.foundationImpact(ctx, action, hits) : [];
      // Every queued effect of a committed card shares its carrier budget.
      // Effect metadata is copied for charges/indices and cannot own that budget.
      const combatRiderTargets = action.card?.combatRiderTargets || action.meta?.combatRiderTargets || [];
      if (action.meta) action.meta.combatRiderTargets = combatRiderTargets;
      for (let h = 0; h < hits; h++) {
        // Re-resolve per hit so randomEnemy splits across enemies and per-hit
        // triggers (e.g. stance-applied build-up) see live state.
        const plannedContacts = action.meta?.expansionContacts?.[action.meta.expansionCursor || 0];
        if (plannedContacts) action.meta.expansionCursor = (action.meta.expansionCursor || 0) + 1;
        const targets = plannedContacts ? plannedContacts.map(contact => Expanded.expansionEntity(ctx, contact)).filter(Boolean) : resolveTargets(ctx, action, eff.target);
        for (const t of targets) {
          if (!Expanded.expansionTargetPresent(ctx, t)) continue;
          const bonus = (action.meta?.abilityChargeDamageEffect || 0) + (h === 0 && t === targets[0] ? action.meta?.abilityChargeDamage || 0 : 0);
          const base = evalNum(ctx, action, eff.amount, 0, t) + bonus;
          const carrier = { ...Expanded.effectCarrier(action.card, eff), ...(eff.attack ? { attack: eff.attack } : {}),
            damageSchool: eff.damageSchool || action.card?.damageSchool,
            tags: action.card?.tags || attackTags,
            combatProfile: Expanded.effectCarrier(action.card, eff).combatProfile,
            combatRiderTargets,
            energySpent: action.meta?.energySpent || 0 };
          if (plannedContacts) {
            const contact = plannedContacts.find(row => Expanded.expansionEntity(ctx, row) === t);
            carrier.expansionGroup = action.meta.expansionGroup;
            carrier.expansionContact = { index: contact.index, receipt: action.meta.expansionGroup.targets[contact.key].receipt };
            if (contact.crit) carrier.critMultiplier = contact.crit;
          }
          if (Array.isArray(carrier.appliedStatusEffects)) {
            carrier.appliedStatuses = carrier.appliedStatusEffects
              .filter(effect => !['self', 'owner', 'ally'].includes(effect.target)
                && (!effect.if || Triggers.evalPredicate(ctx, effect.if, { ...action, target: t })))
              .map(effect => effect.status);
          }
          if (ctx.ratingsRules && action.source?.kind === 'enemy') {
            const attackType = ctx.ratingsRules.enemyAttackType?.[`${action.source.enemyId}:${action.meta?.moveId || action.source.intent?.moveId}`];
            if (attackType && attackType !== 'auto') carrier.damageSchool = attackType;
          }
          const evaded = ctx.foundation && t.evade > 0 && carrier?.attack?.dodgeable !== false;
          const hpBefore = t.hp;
          // A skill feat's critical hit (SPEC §13.4o), rolled per hit and target.
          const crit = plannedContacts ? 0 : rollCrit(ctx, action.source, attackTags);
          if (crit) carrier.critMultiplier = crit;
          applyAttackDamage(ctx, action.source, t, base, attackTags, carrier);
          if (h === 0 && t === targets[0] && t.alive && action.meta?.abilityChargeBreak) dealPoiseDamage(ctx, t, action.meta.abilityChargeBreak);
          // OUTSIDE the foundation ruleset (the shipped game creates its combats
          // without one), an enemy blow that draws blood rocks the player by
          // balance.poise.playerImpactPerHit — the one impact the shipped
          // fight has (plan phase 8, SPEC §13.4k). The ruleset's weapon impact
          // below replaces it wherever a ruleset is handed in.
          if (!ctx.ratingsRules && !ctx.foundation && !carrier.combatReaction && t.kind === 'player' && action.source && action.source.kind === 'enemy' && t.alive && t.hp < hpBefore) {
            const perHit = ((ctx.registries.balance || {}).poise || {}).playerImpactPerHit;
            if (Number.isInteger(perHit) && perHit > 0) {
              dealPoiseDamage(ctx, t, perHit);
              ctx.emit('impactDealt', { sourceId: action.source.id, targetId: t.id, amount: perHit, ...(t.poiseMeter ? { poiseMeter: { value: t.poiseMeter.value, max: t.poiseMeter.max } } : {}), ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(t) } : {}) });
            }
          }
          if (ctx.foundation && !evaded && t.alive && !carrier.combatReaction && !(action.meta?.foundationAncestry?.length)) {
            const resistedImpact = Math.floor((impact[h] || 0) * (1 - (F.foundationProfile(ctx, t).impactResistance || 0)) * Matchups.matchupPoiseMultiplier(ctx, action.source, t, carrier));
            dealPoiseDamage(ctx, t, resistedImpact);
            // The player's meter is real too (plan phase 8): the receipt is
            // emitted for every target, and the armour skill hooks read it.
            ctx.emit('impactDealt', { sourceId: action.source?.id, targetId: t.id, amount: resistedImpact, ...(t.poiseMeter ? { poiseMeter: { value: t.poiseMeter.value, max: t.poiseMeter.max } } : {}), ...(t.kind === 'player' && ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(t) } : {}) });
            // Only the resolved source contributes contact buildup. A focus
            // can own effects too; the other hand's sword is never consulted.
            const weaponBuildup = F.foundationSource(ctx, action.source, carrier).buildup || [];
            for (const buildup of [...weaponBuildup, ...(carrier?.attack?.buildup || [])]) statuses.applyStatus(ctx, t, buildup.status, buildup.amount, action.source);
          }
        }
      }
      break;
    }
    case 'block': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        gainBlock(ctx, t, evalNum(ctx, action, eff.amount, 0, t) + (action.meta?.abilityChargeBlock || 0), action.card);
      }
      break;
    }
    case 'gainBarrier': {
      for (const t of resolveTargets(ctx, action, eff.target)) gainBarrier(ctx, t, evalNum(ctx, action, eff.amount, 0, t) + (action.meta?.abilityChargeBlock || 0), action.card);
      break;
    }
    case 'wardDamage': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        const spent = Control.spendPersistentWard(ctx, t,
        evalNum(ctx, action, eff.amount, 0, t) * (!action.card?.combatWardEdgeApplied && action.card?.combatProfile?.camp === 'spell' && action.card?.combatProfile?.damageType === 'piercing' ? 1.25 : 1), { sourceId: action.source?.id });
        creditKnowledgeImpact(ctx, t, spent.spent);
      }
      break;
    }
    case 'buildup': {
      for (const t of plannedStatusTargets(ctx, action, eff)) {
        if (eff.chance !== undefined && !Control.rollStatusChance(ctx, eff.chance, { advantage: eff.advantage, disadvantage: eff.disadvantage, stream: 'statusPressure' }).success) continue;
        const authored = evalNum(ctx, action, eff.amount, 0, t);
        const cinder = ctx.combatExpansionVersion === 2 && action.source ? Blight.ashenBlightSpellBuildup(ctx, action.source,
          { cycleKey: String(action.source.combatOwnerCycle || 0), school: action.card?.combatProfile?.school, buildups: [{ status: eff.status, amount: authored }] }) : null;
        const pressure = Control.applyStatusPressure(ctx, t, eff.status,
          authored + (cinder?.amount || 0) + (action.meta?.abilityChargeBuildup || 0), action.source,
          { camp: eff.camp || action.card?.combatProfile?.camp, actionKey: action.meta?.expansionGroup?.key || `${ctx.turn}:${action.card?.instanceId || 'effect'}`,
            recoveryProfile: eff.recoveryProfile, traits: eff.traits });
        const row = action.meta?.expansionGroup?.targets[ctx.playerIdForEntity?.(t) || t.id];
        if (row?.receipt) Matchups.recordTacticalStatus(row.receipt, pressure);
      }
      break;
    }
    case 'gainPoise':
    case 'gainWard': {
      const meter = eff.op === 'gainPoise' ? 'poise' : 'ward';
      for (const t of resolveTargets(ctx, action, eff.target)) {
        if (ctx.combatExpansionVersion === 2 && meter === 'ward') restoreExpandedWard(ctx, t, evalNum(ctx, action, eff.amount, 0, t), { onceKey: eff.oncePerCombat });
        else gainMeterGuard(ctx, t, meter, evalNum(ctx, action, eff.amount, 0, t), action.card);
      }
      break;
    }
    case 'dodgeRoll': {
      if (ctx.combatExpansionVersion === 2) { Matchups.prepareCombatEvade(ctx, action.source, action.card?.combatProfile?.evade || {}); break; }
      if (ctx.foundation) { F.grantFoundationEvade(ctx, action.source); break; }
      // The dodge (framework contract: Weight Class and Dodge Roll). Player
      // only — the class, Dexterity and the die live on the player's side of
      // the board. The engine rolls on its own stream; the framework decides
      // the check, the difficulty and the temporary guard, which lands as
      // Block through the same door every block does.
      const p = ctx.player;
      if (!action.source || action.source.id !== p.id) break;
      const roll = ctx.rng.int('misc', 1, ctx.registries.framework.dodgeDie());
      // No sheet reads as no Dexterity term (framework weight.js), never as
      // a number from the retired d20 scale.
      const dexterity = ctx.attributes ? ctx.attributes.dexterity : undefined;
      const stance = playerWeightClass(ctx);
      // The run's creation mode picks the Dexterity centre, so a sheet from an
      // older scale keeps its dodge (mechanics.dodgeRoll.dexterityCentreByMode).
      const attributeMode = ctx.attributeMode || undefined;
      const receipt = ctx.registries.framework.dodgeRoll({ roll, dexterity, attributeMode, weightClass: stance.weightClass });
      ctx.emit('dodgeRolled', {
        ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(p) } : {}),
        sourceId: p.id, roll, check: receipt.check, difficulty: receipt.difficulty,
        success: receipt.success, temporaryGuard: receipt.temporaryGuard, weightClass: stance.weightClass.id,
      });
      if (receipt.success && receipt.temporaryGuard > 0) gainBlock(ctx, p, receipt.temporaryGuard);
      break;
    }
    case 'applyStatus': {
      for (const t of plannedStatusTargets(ctx, action, eff)) {
        const stacks = evalNum(ctx, action, eff.stacks, 1, t) + (action.meta?.abilityChargeBuildup || 0);
        statuses.applyStatus(ctx, t, eff.status, stacks, action.source);
        if (ctx.combatExpansionVersion === 2) {
          const row = action.meta?.expansionGroup?.targets[ctx.playerIdForEntity?.(t) || t.id];
          if (row?.receipt) Matchups.recordTacticalStatus(row.receipt, { accepted: stacks });
          if (eff.status === 'grounded') Control.groundStatusPressure(ctx, t);
        }
        if (ctx.ratingsRules && t.id === action.source?.id && action.card && isMagicalAttack(ctx, action.card) && t.statuses[eff.status]) {
          t.statuses[eff.status].ratingCard = structuredClone(action.card);
        }
      }
      break;
    }
    case 'removeStatus': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        statuses.removeStatus(ctx, t, eff.status, { reason: 'consumed', ...(eff.amount !== undefined ? { amount: Math.max(0, evalNum(ctx, action, eff.amount, 0, t)) } : {}) });
      }
      break;
    }
    case 'grantCardCharge': {
      for (const target of resolveTargets(ctx, action, eff.target)) {
        const charge = { ...eff };
        for (const field of ['damage', 'manaDiscount', 'block', 'heal', 'break', 'buildup']) if (eff[field] !== undefined) charge[field] = Math.max(0, evalNum(ctx, action, eff[field], 0, target));
        grantAbilityCharge(target, charge);
      }
      break;
    }
    case 'draw': {
      const amount = Math.max(0, evalNum(ctx, action, eff.amount, 1));
      if (ctx.drawCardsFor) ctx.drawCardsFor(action.owner || action.source, amount);
      else drawCards(ctx, amount);
      break;
    }
    case 'discard': {
      const n = Math.max(0, evalNum(ctx, action, eff.amount, 1));
      if (eff.choose) { requestAbilityDiscard(ctx, action, n); break; }
      discardFromHand(ctx, n, { random: !!eff.random });
      break;
    }
    case 'exhaust': {
      const n = Math.max(0, evalNum(ctx, action, eff.amount, 1));
      for (let i = 0; i < n && ctx.piles.hand.length > 0; i++) {
        const idx = eff.random ? Math.floor(ctx.rng.float('misc') * ctx.piles.hand.length) : ctx.piles.hand.length - 1;
        const card = ctx.piles.hand.splice(idx, 1)[0];
        ctx.piles.exhaust.push(card);
        ctx.emit('cardExhausted', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'effect' });
      }
      break;
    }
    case 'addCard': {
      ctx.registries.cards.get(eff.card); // throws on dangling id
      const count = Math.max(1, evalNum(ctx, action, eff.count, 1));
      const pileName = eff.pile || 'discard';
      for (let i = 0; i < count; i++) {
        const inst = { instanceId: ctx.nextInstanceId(), cardId: eff.card, upgraded: false };
        const pile = ctx.piles[pileName];
        if (!pile) throw new Error(`Unknown pile '${pileName}'`);
        if (pileName === 'hand' && pile.length >= ctx.handMax) {
          ctx.piles.discard.push(inst);
          ctx.emit('cardDiscarded', { cardInstanceId: inst.instanceId, cardId: inst.cardId, reason: 'handFull' });
          continue;
        }
        const position = eff.position || 'random';
        if (position === 'top') pile.unshift(inst);
        else if (position === 'bottom') pile.push(inst);
        else pile.splice(Math.floor(ctx.rng.float('shuffle') * (pile.length + 1)), 0, inst);
      }
      break;
    }
    case 'gainEnergy': {
      const n = Math.max(0, evalNum(ctx, action, eff.amount, 1));
      ctx.player.energy += n;
      ctx.emit('energyGained', { amount: n });
      break;
    }
    case 'restoreStamina': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        const amount = Math.max(0, Math.min(t.maxStamina - t.stamina, Math.max(0, evalNum(ctx, action, eff.amount, 1))));
        t.stamina += amount; ctx.emit('staminaRecovered', { targetId: t.id, amount, reason: 'effect' });
      }
      break;
    }
    case 'restoreMana': {
      // BY an amount, or TO a floor (plan phase 7's floorOrFull rest): a pool
      // under the floor rises to it; one already at or above it fills.
      const toFloor = eff.toFloorPct !== undefined;
      const n = toFloor ? 0 : Math.max(0, evalNum(ctx, action, eff.amount, 1));
      const pct = toFloor ? Math.max(0, evalNum(ctx, action, eff.toFloorPct, 0)) : 0;
      for (const t of resolveTargets(ctx, action, eff.target)) {
        const before = t.mana;
        if (toFloor) {
          const floor = Math.min(t.maxMana, Math.floor((t.maxMana * pct) / 100));
          t.mana = before >= floor ? t.maxMana : floor;
        } else {
          t.mana = Math.min(t.maxMana, t.mana + n);
        }
        ctx.emit('manaRestored', { targetId: t.id, amount: t.mana - before });
      }
      break;
    }
    case 'loseHp': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        // `cause` labels the hpLost event (e.g. 'proc:bleed') so the damage
        // record can attribute the loss — display + instruments read it.
        const amount = Math.max(0, evalNum(ctx, action, eff.amount, 0, t));
        if (eff.nonlethal && amount >= t.hp) throw new Error('Not enough HP for a nonlethal offering');
        applyLoseHp(ctx, t, amount, eff.cause || 'effect', action.meta?.killReceipt || { targetStatusesBefore: structuredClone(t.statuses || {}), sourceId: action.source?.id, ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(action.source) } : {}) });
        if (eff.offering && amount > 0) {
          recordAbilityOffering(t, amount);
          ctx.emit('hpOfferingPaid', { amount, cost: amount, sourceId: t.id, targetId: t.id, ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(t), playerId: ctx.playerIdForEntity(t) } : {}) });
        }
      }
      break;
    }
    case 'heal': {
      // `ctx.healMult` is the run-level door's (createRunContext): a rest's
      // heal scaled by the custom mod and the restHealMult passive. A fight
      // never sets it and reads 1. Under a multiplier the amount is floored
      // ONCE, after it — a percentage of max HP floored first and again after
      // the multiplier would heal less than the single-floor rule it replaces
      // (the review of #1195: 50 × 35% × 1.15 is 20, not 19).
      const mult = typeof ctx.healMult === 'number' ? ctx.healMult : 1;
      for (const t of resolveTargets(ctx, action, eff.target)) {
        const base = eff.ashenBlightBaseAmount ?? eff.amount;
        const nominal = evalRaw(ctx, action, base, 0, t);
        const percentage = ctx.combatExpansionVersion === 2 && nominal > 0
          ? (ctx.restorationModifierPercent?.(t, 'hp') || 0) + (eff.ashenBlightBonusPct || 0) : 0;
        const amount = Math.max(0, Math.floor(nominal * mult * (1 + percentage / 100)));
        applyHeal(ctx, t, amount + Ratings.cardRatingBonus(ctx, action.source, action.card, 'heal', amount) + (action.meta?.abilityChargeHeal || 0));
      }
      break;
    }
    case 'shuffleDiscardIntoDraw': {
      reshuffleDiscardIntoDraw(ctx);
      break;
    }
    case 'enterStance': {
      // A chosen stance (Warrior's Vow) is the play intent's pick, validated
      // before the card was paid for (model/cardChoices.js) and carried on meta.
      const stanceId = eff.choose ? action.meta && action.meta.choice : eff.stance;
      // BOUNDARY (#1449 review, Codex P2): only a played card supplies a
      // choice. The validator checks `choose` wherever enterStance may appear
      // (stance onEnter, status hooks, enemy moves...), but no shipped row
      // outside Warrior's Vow's card effects uses it. Such a row resolves
      // here with no pick and fails loudly rather than entering a guessed
      // stance (tests/warriors-vow.test.mjs pins the throw).
      if (eff.choose && stanceId == null) throw new Error(`enterStance choose '${eff.choose}' needs a play choice; only a played card supplies one`);
      const def = ctx.registries.stances.get(stanceId);
      if (ctx.player.stanceId === stanceId) break; // already in it: no-op (StS)
      if (ctx.player.stanceId) {
        ctx.emit('stanceExited', { stance: ctx.player.stanceId });
      }
      ctx.player.stanceId = stanceId;
      ctx.emit('stanceEntered', { stance: stanceId, playerId: ctx.playerKey || ctx.player.id });
      for (const onEnter of def.onEnter || []) {
        ctx.enqueue({ effect: onEnter, source: ctx.player, owner: ctx.player, target: action.target, meta: action.meta });
      }
      break;
    }
    case 'poiseDamage': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        const multiplier = Matchups.matchupPoiseMultiplier(ctx, action.source, t, action.card);
        const authored = evalNum(ctx, action, eff.amount, 0, t);
        const bonus = ctx.combatExpansionVersion === 2 ? Blight.ashenBlightMartialPoise(ctx, action.source,
          { cycleKey: String(action.source?.combatOwnerCycle || 0), camp: action.card?.combatProfile?.camp, authoredPoise: authored }) : 0;
        const amount = Math.floor((authored + bonus) * multiplier);
        if (ctx.ratingsRules && action.meta?.combatCounterReaction) {
          Ratings.applyRatingImpact(ctx, action.source, t, action.card, amount, { triggerHit: false });
        } else dealPoiseDamage(ctx, t, amount, { knowledgeMatchup: multiplier > 1 });
      }
      break;
    }
    case 'stagger': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        staggerEnemy(ctx, t);
      }
      break;
    }
    case 'arcaneBuildup': {
      // Buildup poured directly (plan phase 8): `pct` of each target's OWN
      // threshold, or `amount` points; the school is the firing event's (a
      // break's), else arcane. Immune and locked targets refuse by name.
      const school = (action.meta && action.meta.event && action.meta.event.school) || 'arcane';
      // A PERCENT IS OF THE FIRING EVENT'S THRESHOLD, not the recipient's: the
      // Goldbough spreads half of the meter that just broke. Read from each
      // recipient instead, breaking an 8-point meter poured 10 into a 20-point
      // foe (Codex, #1203). Without an event to read, the recipient's own
      // threshold is the only scale there is.
      const firedThreshold = action.meta && action.meta.event && action.meta.event.threshold;
      for (const t of resolveTargets(ctx, action, eff.target)) {
        if (usesSingleBreakMeter(ctx)) {
          const threshold = Number.isFinite(firedThreshold) ? firedThreshold : t.poiseMeter?.max || 0;
          const amount = eff.pct !== undefined ? Math.floor(threshold * evalNum(ctx, action, eff.pct, 0, t) / 100) : evalNum(ctx, action, eff.amount, 0, t);
          Ratings.applyRatingImpact(ctx, null, t, { damageSchool: school }, amount, { triggerHit: false });
          continue;
        }
        addArcaneExposure(ctx, action.source, t, {
          school,
          amountFor: (cfg) => (eff.pct !== undefined
            ? Math.floor(((Number.isFinite(firedThreshold) ? firedThreshold : cfg.threshold) * evalNum(ctx, action, eff.pct, 0, t)) / 100)
            : evalNum(ctx, action, eff.amount, 0, t)),
        });
      }
      break;
    }
    default:
      throw new Error(`Opcode '${eff.op}' has no implementation`);
  }
}

/** Validate all authored HP payments before any card, resource, queue or RNG change. */
export function preflightCardHp(ctx, def, source, target, meta) {
  const counters = ctx.rng?.getCounters();
  const remaining = new Map();
  try {
  for (const effect of def.effects || []) {
    if (effect.op !== 'loseHp') continue;
    const action = { effect, source, owner: source, target, card: def, meta };
    if (effect.if && !Triggers.evalPredicate(ctx, effect.if, action)) continue;
    for (const entity of resolveTargets(ctx, action, effect.target)) {
      const amount = Math.max(0, evalNum(ctx, action, effect.amount, 0, entity)) * Math.max(0, evalNum(ctx, action, effect.repeat, 1));
      const hp = remaining.get(entity) ?? entity.hp;
      if (effect.nonlethal && amount >= hp) throw new Error('Not enough HP for a nonlethal offering');
      remaining.set(entity, Math.max(0, hp - amount));
    }
  }
  } finally { if (counters) ctx.rng.restoreCounters(counters); }
}

// ---------------------------------------------------------------------------
// Run-level opcodes (events, shops, rewards reuse the same DSL — SPEC §3.4)
// ---------------------------------------------------------------------------

function runRunOpcode(ctx, action, eff) {
  const run = ctx.run;
  if (!run) {
    throw new Error(`Run-level opcode '${eff.op}' requires a run context (use executeRunEffects)`);
  }
  switch (eff.op) {
    case 'addCinders': {
      const n = evalNum(ctx, action, eff.amount, 0);
      run.cinders = Math.max(0, run.cinders + n);
      ctx.emit('cindersChanged', { amount: n, total: run.cinders });
      break;
    }
    case 'addCardToDeck': {
      ctx.registries.cards.get(eff.card); // throws on dangling id
      run.deck.push({ instanceId: ctx.nextInstanceId(), cardId: eff.card, upgraded: false });
      break;
    }
    case 'removeCardFromDeck': {
      // Run-owned basics retire their slot; item grants remain equipment-owned.
      let idx = -1;
      if (eff.card) idx = run.deck.findIndex((c) => c.cardId === eff.card && canRemoveDeckCard(c));
      else if (eff.random) {
        const candidates = run.deck.map((c, i) => i).filter((i) => canRemoveDeckCard(run.deck[i]));
        idx = candidates.length ? candidates[Math.floor(ctx.rng.float('misc') * candidates.length)] : -1;
      }
      if (idx >= 0) removeDeckCard(run, run.deck[idx].instanceId);
      break;
    }
    case 'upgradeCard': {
      const plan = smithingPlan(ctx.registries, run);
      // Since the item-upgrade redesign the plan also offers non-armament
      // items (no armamentId, no affectedCards); a card upgrade can only ride
      // an armament, so only those become candidates here.
      // AND ONLY AN ARMAMENT WITH CARDS IN THE DECK TODAY. A carried armament
      // with no live cards is a Smithing candidate (the Shrine previews it
      // through its authored roles), but a "random card" upgrade that landed
      // on it would set a tier and upgrade zero cards the player holds — the
      // choice promised a card (Codex, #535).
      const armaments = plan.candidates
        .filter((candidate) => candidate.itemKind === 'armament')
        .filter((candidate) => candidate.affectedCards.length > 0)
        .filter((candidate) => !eff.card || candidate.affectedCards.some((card) => card.cardId === eff.card))
        .map((candidate) => ({ kind: 'armament', id: candidate.armamentId }));
      const ordinary = run.deck
        // Equipment-composed instances are excluded like sourceArmamentId
        // ones: a granted/weaponArt instance (grantedBy) is rebuilt from its
        // package on every reconcile, so a per-copy upgraded flag would not
        // survive an unequip/re-equip — its upgrade rides the armament. An
        // UNARMED role instance (equipmentRole without a source piece — the
        // unarmed Strikes and Evasive Guards) keeps its per-copy flag through
        // reconcile (loadout.js resets it only when a piece takes the slot),
        // so it stays a candidate. A card whose upgrade is not authored — the
        // pure Dodge Roll — is never one: the event would spend for nothing.
        .filter((card) => !card.sourceArmamentId && !card.grantedBy && !card.upgraded && (!eff.card || card.cardId === eff.card))
        .filter((card) => ctx.registries.cards.has(card.cardId) && !!ctx.registries.cards.get(card.cardId).upgrade)
        .map((card) => ({ kind: 'card', card }));
      const candidates = [...armaments, ...ordinary];
      if (candidates.length === 0) break;
      const chosen = eff.random ? ctx.rng.pick('misc', candidates) : candidates[0];
      if (chosen.kind === 'armament') {
        const receipt = commitSmithing(ctx.registries, run, chosen.id, undefined, { free: true });
        ctx.emit('armamentSmithed', receipt);
      } else {
        chosen.card.upgraded = true;
      }
      break;
    }
    case 'addRelic': {
      let relicId = eff.id || null;
      if (!relicId && eff.random) {
        // Quest-pool relics are never "a random relic" — they are the named
        // reward of the choice that grants them (RELIC_POOLS, model/schemas.js).
        const pool = ctx.registries.relics.ids()
          .filter((id) => !run.relics.includes(id) && relicInRewardPool(ctx.registries.relics.get(id)));
        if (pool.length === 0) break;
        relicId = ctx.rng.pick('relicRewards', pool);
      }
      if (relicId && !run.relics.includes(relicId)) {
        ctx.registries.relics.get(relicId); // throws on dangling id
        run.relics.push(relicId);
        syncFlaskGrowth(ctx.registries, run); // growth chain: a relic source binds the moment it is held
      }
      break;
    }
    case 'addFlask': {
      const slots = flaskSlotCap(ctx.registries.balance);
      if (run.flasks.length >= slots) break;
      let flaskId = eff.id || null;
      if (!flaskId && eff.random) {
        const pool = ctx.registries.flasks.ids();
        if (pool.length === 0) break;
        flaskId = ctx.rng.pick('flaskRewards', pool);
      }
      if (flaskId) {
        ctx.registries.flasks.get(flaskId); // throws on dangling id
        run.flasks.push({ flaskId });
      }
      break;
    }
    case 'addFlaskCapacity': {
      const kind = eff.kind;
      if (!run.flaskCharges || !['hp', 'mana'].includes(kind) || !Number.isInteger(eff.amount) || eff.amount <= 0) break;
      run.flaskCharges.capacity += eff.amount;
      run.flaskCharges[kind] += eff.amount;
      run.flaskCharges[`${kind}Current`] += eff.amount;
      // THE MOMENT DOOR'S LEDGER LINE — not optional. Capacity is enforced as
      // base + grown + granted at the save shape (validateRunShape), so a
      // grant that raises capacity without recording itself makes the very
      // next save unaccountable and refused by name. The kind is deliberately
      // not recorded: under pool (D19) the grant's kind is spent the moment it
      // lands above, and the live split stays freely reallocatable at a grace.
      run.flaskCharges.granted += eff.amount;
      break;
    }
    case 'loseMaxHpPct': {
      const pct = evalNum(ctx, action, eff.pct, 0);
      if (!Number.isInteger(run.maxHpAdjustment)) {
        throw new Error('loseMaxHpPct requires the run maxHpAdjustment ledger');
      }
      const before = run.maxHp;
      run.maxHp = Math.max(1, Math.floor(run.maxHp * (1 - pct / 100)));
      run.maxHpAdjustment += run.maxHp - before;
      run.hp = Math.min(run.hp, run.maxHp);
      break;
    }
    case 'startCombat': {
      ctx.registries.encounters.get(eff.encounterId); // throws on dangling id
      run.combatEntered = eff.encounterId;
      break;
    }
    case 'swapClass': {
      // Plan phase 5c: the core card is replaced (model/classSwap.js). A
      // random swap rolls on the 'misc' stream among every other class.
      const others = ctx.registries.classes.ids().filter((id) => id !== run.class);
      const classId = eff.random ? (others.length ? ctx.rng.pick('misc', others) : run.class) : eff.classId;
      swapRunClass(ctx.registries, run, classId);
      break;
    }
    case 'refillFlasks': {
      // Plan phase 7: the grace refill is the `restFlasks` location rule's
      // effect on `arrived`. A top-up by construction (engine/encounters.js),
      // so a re-entry grants nothing twice; the receipt rides the context for
      // the screen's refill line.
      ctx.receipts = ctx.receipts || {};
      ctx.receipts.refill = applyGraceRefill(ctx.registries, run, ctx.refillOpts || {});
      break;
    }
    default:
      throw new Error(`Run opcode '${eff.op}' has no implementation`);
  }
}

/**
 * createRunContext({ run, registries, rng }, opts) → the run-level door's
 * context: a player FACADE over the run's pools (hp / mana) so heal, loseHp
 * and restoreMana apply to the run through the same opcode bodies a fight
 * uses, an empty enemy list, an action queue and a trigger-state map. Combat
 * statistics ops are unavailable. Three doors share it: executeRunEffects
 * (event choices, shop purchases, rewards, flasks on the map), and the
 * location visit (engine/locations.js, plan phase 7), which mounts a place's
 * property rules on it and emits `arrived` / `rested` through the trigger
 * scan. `opts.healMult` scales every heal the context applies (the custom
 * mod's lesser healing × the run's restHealMult passive); `opts.refillOpts`
 * are handed to the refillFlasks opcode. Nothing here is persisted.
 */
export function createRunContext({ run, registries, rng }, { healMult = 1, refillOpts = {} } = {}) {
  const events = [];
  const facade = {
    id: 'player',
    kind: 'player',
    hp: run.hp,
    maxHp: run.maxHp,
    mana: run.mana,
    maxMana: run.maxMana,
    block: 0,
    statuses: {},
    stanceId: null,
    relicIds: [],
    counters: { cardsPlayedThisTurn: 0, cardsPlayedThisCombat: 0, attacksPlayedThisCombat: 0 },
    alive: run.hp > 0,
  };
  const ctx = {
    run,
    registries,
    rng,
    player: facade,
    enemies: [],
    piles: { draw: [], hand: [], discard: [], exhaust: [] },
    // The run context never draws; the retired fallback keeps the field a number.
    handMax: LEGACY_HAND_MAX,
    queue: [],
    eventLog: events,
    _buffer: null,
    result: null,
    turn: 0,
    triggerState: new Map(),
    _idCounter: 0,
    healMult,
    refillOpts,
    receipts: {},
    // An effect's own event (`healed`, `manaRestored`, …) rides the trigger
    // bus, so a rule mounted on this context — a location's (engine/locations.js)
    // — hears what another rule did, as combat properties do. With nothing
    // mounted and no relics on the facade the scan finds no source and the
    // event is simply logged, as before.
    emit(type, payload) {
      Triggers.emitEvent(ctx, type, payload);
    },
    enqueue(a) {
      ctx.queue.push(a);
    },
    // Each run context starts its counter at 0, so an id is skipped while any
    // owned card (deck ∪ sideboard, §14.1) still holds it.
    nextInstanceId() {
      const owned = new Set([...(run.deck || []), ...(run.sideboard || [])].map((c) => c && c.instanceId));
      let id;
      do id = `run${++ctx._idCounter}`; while (owned.has(id));
      return id;
    },
  };
  return ctx;
}

/**
 * syncRunContext(ctx) — re-read the run's pools into the facade. A visit
 * lives across other doors (a level point assigned re-derives maxHp; a flask
 * charge moved), so a context that emits twice reads the run again before
 * the second emission rather than committing a stale copy over it.
 */
export function syncRunContext(ctx) {
  const { run, player } = ctx;
  player.hp = run.hp;
  player.maxHp = run.maxHp;
  player.mana = run.mana;
  player.maxMana = run.maxMana;
  player.alive = run.hp > 0;
  return ctx;
}

/** drainRunContext(ctx) — run the queue to empty (bounded), then write the facade back. */
export function drainRunContext(ctx) {
  let guard = 0;
  while (ctx.queue.length) {
    if (++guard > 1000) throw new Error('Run effect queue did not drain');
    executeAction(ctx, ctx.queue.shift());
  }
  ctx.run.hp = Math.min(ctx.player.hp, ctx.run.maxHp);
  ctx.run.mana = Math.min(ctx.player.mana, ctx.run.maxMana);
  return ctx;
}

/**
 * executeRunEffects({ run, registries, rng }, effects) → { events }.
 * Executes run-level effect lists (event choices, shop purchases, rewards)
 * outside combat. Combat statistics ops are unavailable, but damage / loseHp /
 * heal apply to the run's HP through a player facade so events like
 * "take 6 damage" and "heal 20% max HP" work.
 */
export function executeRunEffects({ run, registries, rng }, effects, meta = {}) {
  const ctx = createRunContext({ run, registries, rng });
  const facade = ctx.player;
  for (const eff of effects) {
    ctx.enqueue({ effect: eff, source: facade, owner: facade, target: facade, meta });
  }
  drainRunContext(ctx);
  return { events: ctx.eventLog };
}

/** Spend one permanent restorative charge and apply its authored run effects. */
export function useRunChargeFlask({ run, registries, rng, kind }) {
  const def = chargeFlaskDefinition(registries, kind);
  const currentKey = `${kind}Current`;
  if (!def || !run.flaskCharges || run.flaskCharges[currentKey] <= 0) {
    throw new Error(`No ${kind} flask charges`);
  }
  // Cracked Tear-style passives scale flask amounts (rounded up, SPEC §5.4).
  // The combat path does this in combat.js; a flask drunk on the map is the
  // same flask and the relic makes the same promise, so it scales here too.
  // The multiplier is applied at THIS call site rather than inside
  // executeRunEffects, because that function also runs event choices and
  // keepsakes, which flaskPowerMult has nothing to do with.
  const amountMult = passiveMult(registries, run.relics || [], 'flaskPowerMult');
  const result = executeRunEffects(
    { run, registries, rng },
    def.effects || [],
    amountMult !== 1 ? { amountMult } : {},
  );
  run.flaskCharges[currentKey] -= 1;
  result.events.unshift({ type: 'flaskUsed', flaskId: def.id, chargeKind: kind });
  return result;
}
