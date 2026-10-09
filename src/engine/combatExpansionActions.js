// A committed card/move owns one receipt per defender across all its contacts.
import { evaluate } from '../model/formulas.js';
import * as Triggers from './triggers.js';
import * as Actions from './actions.js';
import * as Foundation from './combatRules.js';
import { combatProfileFor } from '../model/combatCardProfile.js';
import { mountCombatCombo } from './combatExpansionCombos.js';
import * as Matchups from './combatMatchups.js';
import * as Control from './combatStatusControl.js';

const keyOf = (ctx, entity) => ctx.playerIdForEntity?.(entity) || entity?.id;
export function effectCarrier(carrier, effect) {
  const merged = { ...carrier, ...(effect.attack ? { attack: effect.attack } : {}),
    ...(effect.tags ? { tags: effect.tags } : {}), ...(effect.damageSchool ? { damageSchool: effect.damageSchool } : {}) };
  merged.combatProfile = { ...carrier?.combatProfile, ...combatProfileFor(merged), ...effect.combatProfile };
  // The action stance belongs to the card; an effect can override its delivery/type.
  merged.combatProfile.maneuver = effect.combatProfile?.maneuver || carrier?.combatProfile?.maneuver || merged.combatProfile.maneuver;
  return merged;
}
export function enqueueExpandedAction(ctx, actions, { source, target, carrier } = {}) {
  if (ctx.combatExpansionVersion !== 2 || (carrier?.combatReaction && ctx.reactionRulesVersion !== 1)) {
    for (const action of actions) ctx.enqueue(action);
    return null;
  }
  if (carrier?.combatReaction) {
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
  const prefix = Foundation.candidateState(ctx);
  prefix.queue = []; prefix._buffer = null;
  prefix.emit = () => {}; prefix.enqueue = () => {};
  const prefixEntity = entity => entity && expansionEntity(prefix, { id: entity.id, playerId: ctx.playerIdForEntity?.(entity) });
  // Planning is committed seeded work. Paused effects retain this plan in snapshots.
  for (const action of actions) {
    action.meta = { ...action.meta, expansionGroup: group };
    const eff = action.effect;
    const shadow = { ...action, source: prefixEntity(action.source), owner: prefixEntity(action.owner), target: prefixEntity(action.target), meta: { ...action.meta, expansionGroup: undefined } };
    if (!['damage', 'buildup', 'applyStatus', ...(carrier?.combatReaction ? ['poiseDamage', 'wardDamage'] : [])].includes(eff.op)) {
      Actions.executeAction(prefix, shadow);
      continue;
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
        let amount = eff.op === 'damage' ? Actions.computeAttackDamage(prefix, shadow.source, projected, base
          + (action.meta.abilityChargeDamageEffect || 0) + (h === 0 ? action.meta.abilityChargeDamage || 0 : 0),
        tags, contactCarrier, { matchups: false, beforeDefense: true }) : 0;
        if (crit) amount = Math.floor(amount * crit);
        const index = row.contacts.length;
        row.contacts.push({ ...profile, amount, ...(eff.op !== 'damage' ? { effect: ['poiseDamage', 'wardDamage'].includes(eff.op) ? 'impact' : 'status', pressure: base } : {}) });
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
    meta: { expansionGroup: group } });
  return group;
}

export function expansionEntity(ctx, row) {
  return row.playerId ? ctx.players?.get(row.playerId)?.entity : row.id === ctx.player?.id ? ctx.player
    : ctx.enemies?.find(entity => entity.id === row.id);
}

// Saved contacts retain their original target; a disconnected body is frozen.
export function expansionTargetPresent(ctx, entity) {
  if (!entity?.alive) return false;
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
    const carrier = serial ? { ...group.carrier, manualCounterSerial: serial } : group.carrier;
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
  const local = Foundation.candidateState(ctx);
  local._expansionPreview = true;
  local.queue = []; local.emit = () => {}; local.enqueue = () => {};
  const entity = original => original && expansionEntity(local, { id: original.id, playerId: ctx.playerIdForEntity?.(original) });
  const copied = actions.map(action => ({ ...action, source: entity(action.source), owner: entity(action.owner), target: entity(action.target), meta: { ...action.meta } }));
  const group = enqueueExpandedAction(local, copied, { ...options, source: entity(options.source), target: entity(options.target) });
  beginExpandedAction(local, group, entity(options.source));
  return copied.map(action => (action.meta.expansionContacts || []).flat().map(contact => ({ ...contact,
    amount: group.targets[contact.key].receipt.defendedAmounts[contact.index] || 0,
    receipt: group.targets[contact.key].receipt })));
}

export function completeExpandedAction(ctx, action) {
  const group = action.meta?.expansionGroup;
  if (!group) return;
  if (group.cancelled) { ctx.pendingExpansionActions = Math.max(0, (ctx.pendingExpansionActions || 0) - 1); return; }
  beginExpandedAction(ctx, group, action.source);
  for (const row of Object.values(group.targets)) {
    const target = expansionEntity(ctx, row), receipt = row.receipt;
    if (!expansionTargetPresent(ctx, target) || !receipt) continue;
    Matchups.completeTacticalAction(ctx, action.source, target, group.carrier, receipt,
      { restrictions: Control.controlRestrictions(ctx, target) });
    Control.completeStatusAction(ctx, target, row.interactions || receipt.profile, { connected: receipt.connected,
      actionKey: group.key, damaging: receipt.amount > 0 });
  }
  ctx.pendingExpansionActions = Math.max(0, (ctx.pendingExpansionActions || 0) - 1);
}
