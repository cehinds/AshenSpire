import * as Engagement from './combatEngagement.js';
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
  if (carrier?.counterReturnAttack) merged.combatProfile.counterReturnAttack = true;
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
  Engagement.acceptRangeActions(ctx, source, actions, carrier, group.key);
  // Prefix evaluation uses detached entities so a live predicate sees earlier
  // grants/removals while beforePlay keeps its original immutable snapshot.
  // Prefix chance streams are detached; execution pays those same draws once.
  const prefix = Foundation.candidateState(ctx, { detached: true });
  prefix.queue = []; prefix._buffer = null;
  prefix.emit = () => {}; prefix.enqueue = () => {};
  const prefixEntity = entity => entity && expansionEntity(prefix, { id: entity.id, playerId: ctx.playerIdForEntity?.(entity) });
  // Planning is committed seeded work. Paused effects retain this plan in snapshots.
  for (const [rangeEffectIndex, action] of actions.entries()) {
    action.meta = { ...action.meta, expansionGroup: group };
    const eff = action.effect;
    const shadow = { ...action, source: prefixEntity(action.source), owner: prefixEntity(action.owner), target: prefixEntity(action.target), meta: { ...action.meta, expansionGroup: undefined, expansionAuthoredAction: true } };
    const targeted = ['enemy', 'allEnemies', 'otherEnemies', 'randomEnemy', 'player'].includes(eff.target)
      || ['removeStatus', 'loseHp', 'stagger'].includes(eff.op);
    if (!targeted && !['damage', 'buildup', 'applyStatus', 'poiseDamage', 'wardDamage'].includes(eff.op)) {
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
      for (const entity of (action.meta.rangeTargetBatches?.[r * hits + h]?.map(ref => expansionEntity(ctx, ref)) || Actions.resolveTargets(ctx, action, eff.target))) {
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
        row.contacts.push({ ...profile, ...(carrier.rangePlan ? { rangeContactId: `${rangeEffectIndex}:${r}:${h}:${source.kind === 'enemy' ? `player:${ctx.playerIdForEntity?.(entity) || 'player'}` : `enemy:${entity.id}`}` } : {}), amount, ...split, ...(Number.isFinite(contactCarrier.magicShare) ? { magicShare: contactCarrier.magicShare } : {}), ...(contactCarrier.physicalDamageType ? { physicalDamageType: contactCarrier.physicalDamageType } : {}), ...(eff.op !== 'damage' ? { effect: ['poiseDamage', 'wardDamage'].includes(eff.op) ? 'impact' : 'status', pressure: base } : {}) });
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
  const queued = contactActions(ctx, group, actions);
  for (const action of queued) ctx.enqueue(action);
  ctx.enqueue({ effect: { op: 'completeCombatAction' }, source, owner: source, target, card: carrier,
    meta: { ...completionMeta, expansionGroup: group } });
  // A reaction offer check reads the planned contacts of the card it tries (enemy reactions).
  ctx._groupSink?.push(group);
  return group;
}

// Core's per-contact policy carries the original seeded plan; no target, crit,
// cost or once-per-card rider is replanned when the next contact resumes.
function contactActions(ctx, group, actions) {
  if (ctx.reactionRules?.contactPolicy !== 'perHit' || ctx._expansionPreview || group.carrier?.combatReaction) return actions;
  const contacts = [], queued = [], ancillary = [];
  for (const [effectIndex, action] of actions.entries()) {
    if (action.effect.op !== 'damage' || !action.meta.expansionContacts?.length) {
      if (action.meta.expansionContacts?.length) ancillary.push({ action, index: Math.max(0, contacts.length - 1) });
      queued.push(action); continue;
    }
    for (const [index, batch] of action.meta.expansionContacts.entries()) {
      const targets = {};
      const refs = batch.map(contact => {
        const original = group.targets[contact.key];
        const row = targets[contact.key] ||= { id: original.id, playerId: original.playerId, contacts: [], receipt: null };
        const next = { ...contact, index: row.contacts.length };
        row.contacts.push(original.contacts[contact.index]);
        return next;
      });
      const contactIndex = contacts.push({ targets }) - 1;
      const unit = { ...action, effect: { ...action.effect, hits: 1, repeat: 1 }, meta: { ...action.meta,
        contactIndex, contactEffectIndex: effectIndex, contactEffectFirst: index === 0,
        expansionContacts: [refs], expansionTargets: [action.meta.expansionTargets[index]],
        ...(index > 0 ? { abilityChargeDamage: 0, abilityChargeBreak: 0 } : {}) } };
      queued.push(unit, { ...unit, effect: { op: 'completeCombatAction' }, meta: { ...unit.meta, contactCompletion: true } });
    }
  }
  if (!contacts.length) return actions;
  // Printed status/pressure effects still execute once, in their authored
  // position. Their saved contact indices belong to the adjacent hit receipt.
  for (const { action, index } of ancillary) {
    const targets = contacts[index].targets;
    action.meta.expansionContacts = action.meta.expansionContacts.map(batch => batch.map(contact => {
      const original = group.targets[contact.key];
      const row = targets[contact.key] ||= { id: original.id, playerId: original.playerId, contacts: [], receipt: null };
      const next = { ...contact, index: row.contacts.length };
      row.contacts.push(original.contacts[contact.index]);
      return next;
    }));
  }
  group.contactSequence = { rootKey: group.key, index: -1, contacts, rootTargets: group.targets, gates: {} };
  activateCombatContact(ctx, queued.find(action => action.meta?.contactIndex === 0));
  return queued;
}

export function activateCombatContact(ctx, action) {
  const group = action?.meta?.expansionGroup, sequence = group?.contactSequence;
  const index = action?.meta?.contactIndex;
  if (!sequence) return;
  // These are root budgets, even after JSON has copied the carrier separately
  // onto each pending unit. A reload must not grant a rider for every hit.
  if (action.card) action.card.combatRiderTargets = group.carrier.combatRiderTargets ||= [];
  action.meta.proposalTargetDecisions = sequence.proposalTargetDecisions ||= action.meta.proposalTargetDecisions || {};
  // JSON has no aliases. Reconnect the active receipt to its saved plan before
  // continuing it, including a nested choice or a post-contact status effect.
  if (sequence.index >= 0) sequence.contacts[sequence.index].targets = group.targets;
  if (!Number.isSafeInteger(index) || sequence.index === index || action.meta.contactCompletion) return;
  sequence.index = index;
  group.key = `${sequence.rootKey}:hit:${index}`;
  group.targets = sequence.contacts[index].targets;
  group.begun = false;
  group.payloadStarted = false;
  for (const key of ['reactionAnswered', 'reactionNoticed', 'manualCounterSerials', 'enemyWindows', 'contactTelegraphed']) delete group[key];
}

function completeContact(ctx, action, group) {
  const start = ctx.queue.length;
  for (const [key, row] of Object.entries(group.targets)) {
    const target = expansionEntity(ctx, row), receipt = row.receipt;
    if (!target || !receipt || !expansionTargetPresent(ctx, target)) { Engagement.discardCounterRangeReservation(group,target,row); continue; }
    const serial = group.manualCounterSerials?.[row.playerId || 'player'];
    Matchups.completeTacticalAction(ctx, action.source, target, { ...group.carrier, ...(row.contacts?.[0]?.rangeContactId ? { rangeContactId: row.contacts[0].rangeContactId } : {}), ...(serial ? { manualCounterSerial: serial } : {}) }, receipt,
      { restrictions: Control.controlRestrictions(ctx, target) });
    Engagement.discardCounterRangeReservation(group,target,row);
    const root = group.contactSequence.rootTargets[key];
    const combined = root.receipt ||= { connected: false, statusAccepted: 0, amount: 0 };
    combined.connected ||= receipt.connected;
    combined.statusAccepted += receipt.statusAccepted || 0;
    combined.amount += receipt.amount || 0;
    root.interactions ||= row.interactions;
  }
  // A return and its bounded response finish before the next incoming contact.
  const generated = ctx.queue.splice(start);
  ctx.queue.unshift(...generated);
}

function completedRootTargets(group) {
  const sequence = group.contactSequence;
  const roots = sequence.rootTargets;
  for (const [key, root] of Object.entries(roots)) {
    const receipts = sequence.contacts.map(contact => contact.targets[key]?.receipt).filter(Boolean);
    root.receipt = {
      connected: receipts.some(receipt => receipt.connected),
      statusAccepted: receipts.reduce((sum, receipt) => sum + (receipt.statusAccepted || 0), 0),
      amount: receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0),
      profile: root.contacts[0] || group.carrier.combatProfile,
    };
    root.interactions = { ...root.receipt.profile,
      containsFire: root.contacts.some(contact => contact.amount > 0 && (contact.school === 'fire' || contact.damageType === 'fire')),
      containsBlunt: root.contacts.some(contact => contact.amount > 0 && contact.damageType === 'blunt'),
      containsReveal: root.contacts.some(contact => contact.amount > 0 && (contact.maneuver === 'sweep' || ['sacred', 'holy'].includes(contact.damageType))) };
  }
  return roots;
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
    const carrier = { ...group.carrier, ...(profile.rangeContactId ? { rangeContactId: profile.rangeContactId } : {}), additionalTargets: Math.max(0, Object.keys(group.targets).length - 1), ...(serial ? { manualCounterSerial: serial } : {}) };
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
  if (action.meta.contactCompletion) {
    if (!group.cancelled) completeContact(ctx, action, group);
    return;
  }
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
    if (group.contactSequence) group.targets = completedRootTargets(group);
    for (const row of Object.values(group.targets)) {
      const target = expansionEntity(ctx, row), receipt = row.receipt;
      if (!target || !receipt) continue;
      if (!target.alive) {
        // A Smash that killed the target still broke its Guard; a dead target takes no bonus Poise.
        if (expansionSeatConnected(ctx, target)) Matchups.completeGuardBreak(ctx, action.source, target, group.carrier, receipt);
        continue;
      }
      if (!expansionTargetPresent(ctx, target)) continue;
      if (!group.contactSequence) {
        const serial = group.manualCounterSerials?.[row.playerId || 'player'];
        Matchups.completeTacticalAction(ctx, action.source, target, { ...group.carrier, ...(serial ? { manualCounterSerial: serial } : {}) }, receipt,
          { restrictions: Control.controlRestrictions(ctx, target) });
      }
      Control.completeStatusAction(ctx, target, row.interactions || receipt.profile, { connected: receipt.connected,
        actionKey: group.key, damaging: receipt.amount > 0 });
    }
    for (const row of Object.values(group.targets)) Engagement.discardCounterRangeReservation(group,expansionEntity(ctx,row),row);
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
