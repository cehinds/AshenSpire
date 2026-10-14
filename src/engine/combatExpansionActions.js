// A committed card/move owns one receipt per defender across all its contacts.
import { evaluate } from '../model/formulas.js';
import * as Triggers from './triggers.js';
import * as Actions from './actions.js';
import * as Foundation from './combatRules.js';
import { combatProfileFor } from '../model/combatCardProfile.js';
import { mountCombatCombo } from './combatExpansionCombos.js';
import * as Matchups from './combatMatchups.js';
import * as Control from './combatStatusControl.js';
import { allowAbilityOnce } from './abilityRiders.js';
import { traitHitAmount } from './combatCardTraitMath.js';

const keyOf = (ctx, entity) => ctx.playerIdForEntity?.(entity) || entity?.id;
export function effectCarrier(carrier, effect) {
  const merged = { ...carrier, ...(effect.attack ? { attack: effect.attack } : {}),
    ...(effect.tags ? { tags: effect.tags } : {}), ...(effect.damageSchool ? { damageSchool: effect.damageSchool } : {}) };
  const typed = combatProfileFor(merged);
  // An untagged weapon card's type was resolved from the equipped piece
  // (tacticalCarrier); a tagless re-read must not erase it (owner #19).
  if (!typed.damageType && carrier?.combatProfile?.damageType) delete typed.damageType;
  merged.combatProfile = { ...carrier?.combatProfile, ...typed, ...effect.combatProfile };
  // An effect retyped to a single damage type is no longer the card's mixed hit.
  if (effect.attack && !typed.damageComponents) delete merged.combatProfile.damageComponents;
  // The action stance belongs to the card; an effect can override its delivery/type.
  merged.combatProfile.maneuver = effect.combatProfile?.maneuver || carrier?.combatProfile?.maneuver || merged.combatProfile.maneuver;
  return merged;
}
export function enqueueExpandedAction(ctx, actions, { source, target, carrier, completionMeta } = {}) {
  if (ctx.combatExpansionVersion !== 2 || (carrier?.combatReaction && !(ctx.reactionRulesVersion >= 1) && !carrier?.counterReturnAttack)) {
    for (const action of actions) ctx.enqueue(action);
    return null;
  }
  if (carrier?.combatReaction && !carrier?.counterReturnAttack) {
    carrier = { ...carrier, combatProfile: { ...carrier.combatProfile, maneuver: 'attack' } };
    for (const action of actions) action.card = carrier;
  }
  Matchups.assertSingleActionCamp(carrier, actions.filter(action => ['damage', 'buildup', 'applyStatus'].includes(action.effect.op))
    .map(action => effectCarrier({ ...carrier, ...action.card }, action.effect).combatProfile));
  mountCombatCombo(ctx, source, carrier);
  const group = { key: `${ctx.combatKey || 'combat'}:${++ctx.expansionActionSerial || (ctx.expansionActionSerial = 1)}`,
    sourceId: source?.id, sourcePlayerId: ctx.playerIdForEntity?.(source), carrier, targets: {}, begun: false };
  // Prefix evaluation uses detached entities so a live predicate sees earlier
  // grants/removals while beforePlay keeps its original immutable snapshot.
  // Prefix chance streams are detached; execution pays those same draws once.
  const prefix = Foundation.candidateState(ctx, { detached: true });
  prefix.queue = []; prefix._buffer = null;
  prefix.emit = () => {}; prefix.enqueue = () => {};
  const prefixEntity = entity => entity && expansionEntity(prefix, { id: entity.id, playerId: ctx.playerIdForEntity?.(entity) });
  // Planning is committed seeded work. Paused effects retain this plan in snapshots.
  for (const action of actions) {
    action.meta = { ...action.meta, expansionGroup: group };
    const eff = action.effect;
    const shadow = { ...action, source: prefixEntity(action.source), owner: prefixEntity(action.owner), target: prefixEntity(action.target), meta: { ...action.meta, expansionGroup: undefined, expansionAuthoredAction: true } };
    if (!['damage', 'buildup', 'applyStatus', 'poiseDamage', 'wardDamage'].includes(eff.op)) {
      Actions.executeAction(prefix, shadow);
      continue;
    }
    if (eff.oncePerTurn) {
      if (eff.if && !Triggers.evalPredicate(prefix, eff.if, shadow)) { action.meta.expansionContacts = []; action.meta.expansionTargets = []; continue; }
      const accepted = allowAbilityOnce(shadow.owner || shadow.source || prefix.player, eff.oncePerTurn, action.card, action.meta?.abilityEffectIndex ?? eff.op);
      if (!accepted) { action.meta.expansionContacts = []; action.meta.expansionTargets = []; continue; }
      shadow.effect = { ...eff, oncePerTurn: undefined };
    }
    const repeat = Math.max(0, evaluate(eff.repeat ?? 1, Actions.formulaCtxFor(ctx, action, action.target)));
    const hits = eff.op === 'damage' ? Math.max(0, evaluate(eff.hits ?? 1, Actions.formulaCtxFor(ctx, action, action.target))) : 1;
    action.meta.expansionContacts = [];
    action.meta.expansionTargets = [];
    for (let r = 0; r < repeat; r++) for (let h = 0; h < hits; h++) {
      const contacts = [];
      const targetRefs = [];
      for (const entity of Actions.resolveTargets(ctx, action, eff.target)) {
        const projected = prefixEntity(entity);
        if (!entity?.alive || (eff.if && !Triggers.evalPredicate(prefix, eff.if, { ...shadow, target: projected }))) continue;
        targetRefs.push({ id: entity.id, playerId: ctx.playerIdForEntity?.(entity) });
        if (entity === source || (entity.kind === source?.kind && eff.op !== 'damage')) continue;
        const key = keyOf(ctx, entity);
        const row = group.targets[key] ||= { id: entity.id, playerId: ctx.playerIdForEntity?.(entity), contacts: [], receipt: null };
        const contactCarrier = effectCarrier({ ...carrier, ...action.card }, eff);
        const profile = contactCarrier.combatProfile;
        const base = evaluate(eff.amount ?? eff.stacks ?? 1, Actions.formulaCtxFor(prefix, shadow, projected));
        const tags = Actions.attackTagsFor({ ...action, card: contactCarrier }, eff, ctx.registries);
        const crit = eff.op === 'damage' && !ctx._expansionPreview && !carrier?.combatReaction ? Actions.rollCrit(ctx, source, tags) : 0;
        if (crit) contactCarrier.critMultiplier = crit;
        const attackBase = base + (action.meta.abilityChargeDamageEffect || 0) + (h === 0 ? action.meta.abilityChargeDamage || 0 : 0);
        let amount = eff.op === 'damage' ? Actions.computeAttackDamage(prefix, shadow.source, projected, attackBase,
          tags, contactCarrier, { matchups: false, beforeDefense: true }) : 0;
        if (crit) amount = Math.floor(amount * crit);
        // The card's own damage is the split base; its rating bonus is typed by the rating and added after the split.
        const split = eff.op === 'damage' ? { splitBase: Math.max(0, Math.floor(base)),
          ratingBonus: Actions.cardRatingDamage(prefix, shadow.source, contactCarrier, attackBase), ratingPart: Actions.ratingBonusPart(prefix, contactCarrier) } : {};
        const index = row.contacts.length;
        row.contacts.push({ ...profile, amount, ...split, ...(Number.isFinite(contactCarrier.magicShare) ? { magicShare: contactCarrier.magicShare } : {}), ...(contactCarrier.physicalDamageType ? { physicalDamageType: contactCarrier.physicalDamageType } : {}), ...(eff.op !== 'damage' ? { effect: ['poiseDamage', 'wardDamage'].includes(eff.op) ? 'impact' : 'status', pressure: base } : {}) });
        contacts.push({ key, index, id: entity.id, playerId: ctx.playerIdForEntity?.(entity), ...(crit ? { crit } : {}) });
      }
      action.meta.expansionContacts.push(contacts);
      action.meta.expansionTargets.push(targetRefs);
    }
    if (eff.op !== 'damage') {
      shadow.meta.expansionTargets = action.meta.expansionTargets;
      Actions.executeAction(prefix, shadow);
    }
  }
  ctx.pendingExpansionActions = (ctx.pendingExpansionActions || 0) + 1;
  for (const action of actions) ctx.enqueue(action);
  ctx.enqueue({ effect: { op: 'completeCombatAction' }, source, owner: source, target, card: carrier,
    meta: { ...completionMeta, expansionGroup: group } });
  // A reaction offer check reads the planned contacts of the card it tries (enemy reactions).
  ctx._groupSink?.push(group);
  return group;
}

export function expansionEntity(ctx, row) {
  return row.playerId ? ctx.players?.get(row.playerId)?.entity : row.id === ctx.player?.id ? ctx.player
    : ctx.enemies?.find(entity => entity.id === row.id);
}

// Saved contacts retain their original target; a disconnected body is frozen.
export function expansionTargetPresent(ctx, entity) {
  return !!entity?.alive && expansionSeatConnected(ctx, entity);
}

export function expansionSeatConnected(ctx, entity) {
  const playerId = ctx.playerIdForEntity?.(entity);
  return !ctx.players || !playerId || ctx.players.get(playerId)?.connected === true;
}

export function beginExpandedAction(ctx, group, source) {
  if (!group || group.begun) return;
  group.begun = true;
  for (const row of Object.values(group.targets)) {
    const target = expansionEntity(ctx, row);
    if (!expansionTargetPresent(ctx, target)) continue;
    const profile = row.contacts[0] || group.carrier?.combatProfile || {};
    const serial = group.manualCounterSerials?.[row.playerId || 'player'];
    const carrier = { ...group.carrier, additionalTargets: Math.max(0, Object.keys(group.targets).length - 1), ...(serial ? { manualCounterSerial: serial } : {}) };
    row.receipt = (ctx._expansionPreview ? Matchups.previewTacticalAction : Matchups.beginTacticalAction)(ctx, source, target, carrier, row.contacts,
      { ...Control.statusIncomingModifier(ctx, target, profile), contactModifiers: row.contacts.map(contact => Control.statusIncomingModifier(ctx, target, contact)), restrictions: Control.controlRestrictions(ctx, target) });
    row.interactions = { ...profile,
      containsFire: row.contacts.some(contact => contact.amount > 0 && (contact.school === 'fire' || contact.damageType === 'fire')),
      containsBlunt: row.contacts.some(contact => contact.amount > 0 && contact.damageType === 'blunt'),
      containsReveal: row.contacts.some(contact => contact.amount > 0 && (contact.maneuver === 'sweep' || ['sacred', 'holy'].includes(contact.damageType))) };
    Control.beforeStatusAction(ctx, target, row.interactions, { connected: row.receipt.connected });
    Actions.prepareExpandedDefense(ctx, target, row.receipt, group.carrier);
  }
}

/** Same once-rounded typed/Ward budget as execution, without spending a roll. */
export function previewExpandedActions(ctx, actions, options) {
  const local = Foundation.candidateState(ctx, { detached: true });
  local._expansionPreview = true;
  local.queue = []; local.emit = () => {}; local.enqueue = () => {};
  const entity = original => original && expansionEntity(local, { id: original.id, playerId: ctx.playerIdForEntity?.(original) });
  const copied = actions.map(action => ({ ...action, source: entity(action.source), owner: entity(action.owner), target: entity(action.target), meta: { ...action.meta } }));
  const group = enqueueExpandedAction(local, copied, { ...options, source: entity(options.source), target: entity(options.target) });
  beginExpandedAction(local, group, entity(options.source));
  return copied.map(action => (action.meta.expansionContacts || []).flat().map(contact => ({ ...contact,
    amount: group.targets[contact.key].receipt.hpAmounts?.[contact.index] || 0,
    receipt: group.targets[contact.key].receipt })));
}

export function completeExpandedAction(ctx, action) {
  const group = action.meta?.expansionGroup;
  if (!group) return;
  if (group.cancelled) { ctx.pendingExpansionActions = Math.max(0, (ctx.pendingExpansionActions || 0) - 1); return; }
  // Completion can enqueue guard-break and trait pressure after the scoped action returns.
  // Copy the delayed round receipt onto only those completion-generated actions; reaction
  // stack actions never pass through this wrapper and therefore cannot borrow the multiplier.
  const roundPoiseMultiplier = action.meta?.roundPoiseMultiplier;
  const previousEnqueue = ctx.enqueue;
  if (roundPoiseMultiplier) ctx.enqueue = queued => previousEnqueue({
    ...queued,
    meta: { ...queued.meta, roundPoiseMultiplier: { ...roundPoiseMultiplier } },
  });
  try {
    beginExpandedAction(ctx, group, action.source);
    for (const row of Object.values(group.targets)) {
      const target = expansionEntity(ctx, row), receipt = row.receipt;
      if (!target || !receipt) continue;
      if (!target.alive) {
        // A Smash that killed the target still broke its Guard; a dead target takes no bonus Poise.
        if (expansionSeatConnected(ctx, target)) Matchups.completeGuardBreak(ctx, action.source, target, group.carrier, receipt);
        continue;
      }
      if (!expansionTargetPresent(ctx, target)) continue;
      Matchups.completeTacticalAction(ctx, action.source, target, group.carrier, receipt,
        { restrictions: Control.controlRestrictions(ctx, target) });
      Control.completeStatusAction(ctx, target, row.interactions || receipt.profile, { connected: receipt.connected,
        actionKey: group.key, damaging: receipt.amount > 0 });
    }
    applyTraitImpact(ctx, action, group);
    ctx.pendingExpansionActions = Math.max(0, (ctx.pendingExpansionActions || 0) - 1);
  } finally {
    if (roundPoiseMultiplier) ctx.enqueue = previousEnqueue;
  }
}

// A target counts as hit when a damage contact connected (not avoided; a fully
// blocked hit still connected), or, for a card with no damage contact, when a
// status landed or its own Poise/Ward reached the target.
function traitLanded(row, own) {
  const receipt = row?.receipt;
  if (receipt && row.contacts?.some(contact => !contact.effect)) return receipt.connected === true;
  if (receipt?.statusAccepted > 0) return true;
  return own.poiseDealt > 0 || own.wardDealt > 0;
}

/**
 * Reaction rules version 2 (docs/combat-card-traits-contract.md, "Impact and
 * Flux"): a completed card's Impact adds Poise and its Flux adds Ward, once per
 * target that was hit. A card with its own Poise/Ward doubles it; otherwise N.
 * A Power with Flux deals its Ward to every living enemy when played.
 */
export function applyTraitImpact(ctx, action, group) {
  const carrier = group.carrier || {};
  if (ctx.reactionRulesVersion !== 2 || carrier.combatReaction) return;
  const impact = carrier.traitValues?.impact > 0 ? carrier.traitValues.impact : 0;
  const flux = carrier.traitValues?.flux > 0 ? carrier.traitValues.flux : 0;
  if (!impact && !flux) return;
  const power = flux > 0 && carrier.type === 'power';
  if (power) for (const enemy of ctx.enemies || []) {
    if (!expansionTargetPresent(ctx, enemy)) continue;
    dealTraitFlux(ctx, action, carrier, enemy, flux, false);
  }
  const keys = new Set([...Object.keys(group.targets), ...Object.keys(group.ownPressure || {})]);
  for (const key of keys) {
    const row = group.targets[key];
    const own = group.ownPressure?.[key] || { poiseDealt: 0, wardDealt: 0 };
    const target = expansionEntity(ctx, row || own);
    if (!expansionTargetPresent(ctx, target) || !traitLanded(row, own)) continue;
    if (impact) {
      const amount = traitHitAmount(own.poiseDealt, impact);
      Actions.dealPoiseDamage(ctx, target, amount, { cause: 'trait:impact', source: action.source, cardId: carrier.cardId });
      ctx.emit?.('combatImpactApplied', { cardId: carrier.cardId, sourceId: action.source?.id, targetId: target.id,
        ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(target) } : {}), amount, doubled: own.poiseDealt > 0 });
    }
    if (flux && !power) dealTraitFlux(ctx, action, carrier, target, traitHitAmount(own.wardDealt, flux), own.wardDealt > 0);
  }
}

function dealTraitFlux(ctx, action, carrier, target, amount, doubled) {
  if (!(amount > 0)) return;
  Control.spendPersistentWard(ctx, target, amount, { sourceId: action.source?.id });
  ctx.emit?.('combatFluxApplied', { cardId: carrier.cardId, sourceId: action.source?.id, targetId: target.id,
    ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(target) } : {}), amount, doubled });
}
