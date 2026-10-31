import * as Lineage from './combatRangeLineage.js';
import { createRng } from './rng.js';
// Runtime adapter around the pure engagement planner. No pricing or distance is
// inferred from a stance, screen coordinates, or another held weapon.
import { pureEngagementMovement } from '../model/rangeCardAvailability.js';
import { actorRangeKey, createRangeState, snapshotRangePolicy, rangeActionPlan, rangeBand, movedEngagementState, advancedEngagementState } from '../model/combatEngagement.js';
import { core2MultiHitRulesEnabled } from '../model/core2ActionPolicy.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { equippedIn, slotHand } from '../model/loadout.js';
import { attackDescriptor } from '../model/attackTags.js';
import { combatProfileFor } from '../model/combatCardProfile.js';
import * as Foundation from './combatRules.js';
import * as Actions from './actions.js';
import * as CardTactics from './combatCardTactics.js';
import { evaluate } from '../model/formulas.js';

export function initializeCombatRange(ctx, policy = null) {
  if (!fixCoreEnabled(ctx)) return;
  const actors = ctx.players ? [...ctx.players.values()].map(row => ({ entity: row.entity, key: `player:${row.id}`, loadout: row.loadout || row.entity.loadout }))
    : [{ entity: ctx.player, key: 'player:player', loadout: ctx.loadout }];
  for (const enemy of ctx.enemies) actors.push({ entity: enemy, key: `enemy:${enemy.id}` });
  for (const row of actors) {
    row.entity.rangeActorKey = row.key;
    if (row.entity.kind === 'enemy') row.startingRange = ctx.registries.enemies.get(row.entity.enemyId).startingRange || 'melee';
    else {
      let primary;
      for (const hand of ['right', 'left']) {
        for (const slot of ctx.registries.equipment?.slots || []) if (slotHand(slot) === hand) {
          const piece = row.loadout && equippedIn(ctx.registries, row.loadout, row.entity.classId, slot.id);
          if (piece && attackDescriptor(piece).source === 'weapon') { primary = piece; break; }
        }
        if (primary) break;
      }
      row.startingRange = primary?.range || 'melee';
    }
  }
  ctx.rangeState = createRangeState(policy || snapshotRangePolicy(fixCoreRules(ctx).range), actors);
}
function rangeSourceContext(ctx,source) {
  const seatId=ctx.playerIdForEntity?.(source);
  if (!seatId || !ctx.players?.get(seatId)) return ctx;
  const seat=ctx.players.get(seatId);
  return {...ctx,player:source,loadout:seat.loadout,registries:ctx.registriesForPlayer?.(seatId) || ctx.registries};
}
function rangeSourceProfile(carrier,effect) {
  const tagged = effect.tags ? Object.fromEntries(Object.entries(combatProfileFor({ ...carrier,tags:effect.tags,attack:effect.attack || carrier.attack })).filter(([,value])=>value!==null)) : {};
  return { ...combatProfileFor(carrier), ...carrier?.combatProfile, ...tagged, ...effect.combatProfile };
}
function committedRangeSource(ctx,source,carrier,effect,profile) {
  // Impact-only callers can supply a protection rule fragment without a legacy
  // foundation source table. Core still resolves its real configured armament.
  let resolved = carrier?.resolvedRangeSource || carrier?.resolvedSource || (ctx.foundation?.profiles ? Foundation.foundationSource(ctx, source, { ...carrier, attack: effect.attack || carrier.attack }) : null);
  if (!resolved && source.kind !== 'enemy') {
    const attack = attackDescriptor({ ...carrier, attack: effect.attack || carrier.attack });
    const kind = attack.source || (profile.camp === 'spell' ? 'spell' : 'weapon');
    const explicit = { ...carrier, sourceHand: attack.hand || carrier.sourceHand };
    if (attack.hand) delete explicit.sourceArmamentId;
    let piece = kind === 'unarmed' ? null : CardTactics.wieldedArmament(ctx, explicit, source, kind);
    if (piece && attackDescriptor(piece).source !== kind) piece = CardTactics.wieldedArmament(ctx,{...explicit,sourceArmamentId:undefined},source,kind);
    if (piece && attackDescriptor(piece).source !== kind) piece = null;
    resolved = piece ? { sourceType: kind, itemId: piece.id, range: piece.range || 'melee', propertyTags: [...(piece.propertyTags || [])] }
      : { sourceType: kind === 'weapon' ? 'unarmed' : kind };
  }
  return resolved;
}
export function rangeSourceContact(ctx, source, target, carrier = {}, effect = {}, contactId = '0') {
  ctx=rangeSourceContext(ctx,source);
  const profile=rangeSourceProfile(carrier,effect);
  const resolved=committedRangeSource(ctx,source,carrier,effect,profile);
  const weapon = resolved?.sourceType === 'weapon';
  const piece = weapon && (ctx.registries.equipment?.armaments || []).find(row => row.id === resolved.itemId);
  const coverage = weapon ? resolved.range ?? piece?.range ?? 'melee' : resolved?.sourceType === 'unarmed' ? 'melee' : profile.range || resolved?.range || 'melee';
  return { contactId, targetKey: actorRangeKey(ctx, target), coverage, weapon,
    sourceWeaponId: weapon ? resolved.itemId || resolved.id : null,
    throwCapable: weapon && (resolved.propertyTags || piece?.propertyTags || []).includes('throw'),
    bypass: profile.rangeOverride === true || profile.adequateReach === true || profile.traits?.includes('adequateReach') || false };
}
const hostileOps = new Set(['damage','applyStatus','buildup','poiseDamage','wardDamage','loseHp','stagger','arcaneBuildup']);
export function quoteRangeActions(ctx, source, actions, { route = 'advance', context = ctx._rangeContext, preview = false } = {}) {
  if (!ctx.rangeState) return null;
  const contacts = [];
  if (preview) actions = actions.map(action => ({...action,meta:{...action.meta}}));
  const planningCtx = preview ? { ...ctx, rng: createRng(ctx.rng.seed,ctx.rng.getCounters()) } : ctx;
  for (const [index, action] of actions.entries()) {
    if (!hostileOps.has(action.effect.op)) continue;
    const eff = action.effect;
    const repeats = Math.max(0, Math.floor(evaluate(eff.repeat ?? 1, Actions.formulaCtxFor(ctx, action, action.target))));
    const hits = eff.op === 'damage' ? Math.max(0, Math.floor(evaluate(eff.hits ?? 1, Actions.formulaCtxFor(ctx, action, action.target)))) : 1;
    const batches = [];
    for (let r = 0; r < repeats; r++) for (let h = 0; h < hits; h++) {
      // A UI quote exposes the finite public envelope of a random selector;
      // acceptance samples its transactional stream once and retains the refs.
      const targets = Actions.resolveTargets(planningCtx, action, eff.target);
      batches.push(targets.map(target => ({ id: target.id, playerId: ctx.playerIdForEntity?.(target) })));
      for (const target of targets) if (target.alive && source.kind !== target.kind) {
        const contact = rangeSourceContact(ctx, source, target, action.card, eff, `${index}:${r}:${h}:${actorRangeKey(ctx, target)}`);
        contacts.push(contact);
        if (!preview && !action.card.resolvedSource) action.card = { ...action.card, resolvedRangeSource: { sourceType: contact.weapon ? 'weapon' : contact.coverage === 'melee' ? 'unarmed' : 'spell', itemId: contact.sourceWeaponId, range: contact.coverage, propertyTags: contact.throwCapable ? ['throw'] : [] } };
      }
    }
    action.meta = { ...action.meta, rangeTargetBatches: batches };
  }
  const lineage = Lineage.extendRangeEnvelope(planningCtx,source,actions,contacts,{preview,carrier:actions[0]?.card || {}});
  // A card's own leading close (every moveEngagement before its first hostile effect) is part of the plan: the hit is priced
  // at the distance that close reaches, so it never pays an implicit Advance for ground the card itself covers. Movement
  // after a hostile effect (Gale Push) leaves the plan as it was.
  let planState = ctx.rangeState;
  for (const action of actions) {
    // A conditional close is only known at play time: it ends the leading run, as projectEnemyMovement skips it.
    if (hostileOps.has(action.effect.op) || (action.effect.op === 'moveEngagement' && action.effect.if)) break;
    if (action.effect.op !== 'moveEngagement' || !action.target || action.target.kind === source.kind) continue;
    planState = movedEngagementState(planState, actorRangeKey(ctx, source), actorRangeKey(ctx, action.target), action.effect.bands);
  }
  const plan = rangeActionPlan(planState, actorRangeKey(ctx, source), contacts, { route, context });
  Object.defineProperty(plan,'lineage',{value:lineage});
  return plan;
}
export function addRangeCosts(costs, plan) {
  const extra = plan?.advanceSp || 0;
  return { ...costs, energy: costs.energy + extra, stamina: costs.stamina + extra };
}
export function rangeHitContact(ctx, source, target, carrier) {
  if (!ctx.rangeState) return null;
  const targetKey = actorRangeKey(ctx, target), plan = carrier?.rangePlan;
  if (plan) {
    const committed = carrier.rangeContactId ? null : rangeSourceContact(ctx, source, target, carrier);
    const row = carrier.rangeContactId ? plan.targets.find(row => row.contactId === carrier.rangeContactId && row.targetKey === targetKey)
      : plan.targets.find(row => row.targetKey === targetKey && row.sourceWeaponId === committed.sourceWeaponId && row.coverage === rangeBand(committed.coverage) && row.bypass === committed.bypass);
    if (!row) return { inRange: false, precisionDelta: 0, reason: 'unplanned' };
    return { ...row, inRange: !ctx.rangeState.policy.enabled || row.bypass || row.effectiveBand <= Math.min(2, row.coverage + (plan.route === 'throw' && row.throwCapable ? 1 : 0)) };
  }
  const row = rangeActionPlan(ctx.rangeState, actorRangeKey(ctx, source), [rangeSourceContact(ctx, source, target, carrier)], { context: ctx._rangeContext }).targets[0];
  return { ...row, inRange: !ctx.rangeState.policy.enabled || row.bypass || row.band <= row.coverage };
}
export function executeEngagementMovement(ctx, action) {
  if (!ctx.rangeState?.policy.enabled) return;
  let target = action.target;
  if (action.effect.target === 'pendingAttacker' && (!target || target.kind === action.source.kind)) target = ctx.enemies.find(row => row.id === ctx._reactionSourceId) || ctx._reactionSource;
  if (!target || target.kind === action.source.kind) throw Error('Engagement movement requires an opposing target');
  ctx.rangeState = movedEngagementState(ctx.rangeState, actorRangeKey(ctx, action.source), actorRangeKey(ctx, target), action.effect.bands);
  ctx.emit?.('combatEngagementMoved', { sourceId: action.source.id, targetId: target.id, bands: action.effect.bands });
}
export function assertRangeCardEnabled(ctx, def) {
  Lineage.assertPreparingRangeSupported(ctx,ctx.player,def);
  if (ctx.rangeState && !ctx.rangeState.policy.enabled && pureEngagementMovement(def)) throw Foundation.playRefusal('Range mechanics are disabled', 'range-disabled');
}

export function acceptRangeActions(ctx, source, actions, carrier, rootId) {
  if (!ctx.rangeState) return null;
  const authorization = carrier.rangeReturnAuthorization;
  const plan = authorization?.plan || carrier.rangePlan || quoteRangeActions(ctx, source, actions, { route: carrier.rangeRoute || 'advance' });
  const lineage = authorization?.lineage || plan.lineage;
  if (authorization) Lineage.bindReservedRootSites(ctx,actions,lineage);
  const prepaidReturn = !!authorization?.paid;
  if (!plan.available) throw Foundation.playRefusal('The selected range route cannot reach every target', 'range');
  const extra = plan.advanceSp;
  const available = source.kind === 'enemy' ? source.fixCoreStaminaRemaining ?? source.stamina ?? source.maxStamina ?? 0 : source.energy;
  if (!carrier.rangePlan && !prepaidReturn && available < extra) throw Foundation.playRefusal('Not enough Stamina to Advance', 'cost', { resource: 'stamina', need: extra, have: available });
  if (!carrier.rangePlan && !prepaidReturn && extra > 0) {
    if (source.kind === 'enemy') { source.fixCoreStaminaRemaining = available - extra; source.stamina = source.fixCoreStaminaRemaining; }
    else {
      source.energy -= extra;
      source.counters.staminaSpentThisTurn = (source.counters.staminaSpentThisTurn || 0) + extra;
      ctx.emit?.('energySpent', { amount: extra }); ctx.emit?.('staminaSpent', { amount: extra });
    }
  }
  // Core 2 rules version 2: a paid Advance persists; an older fight keeps it temporary to the action.
  // Committing the movement is separate from charging it: a plan prepaid at preparation (a charged enemy attack) has no
  // root yet and commits here, once, at resolution; an accepted plan carries its rootId and is never committed again.
  const unpaidPlan = !carrier.rangePlan, prepaidPlanPending = !!carrier.rangePlan && !carrier.rangePlan.rootId;
  if ((unpaidPlan || prepaidPlanPending) && !prepaidReturn && extra > 0 && !ctx._rangeContext && core2MultiHitRulesEnabled(ctx)) ctx.rangeState = advancedEngagementState(ctx.rangeState, plan);
  const accepted = { ...plan, rootId, paid: carrier.rangePlan?.paid || authorization?.paid || addRangeCosts(carrier.rangeBaseCosts || { energy: 0, stamina: 0, mana: 0 }, plan) };
  carrier.rangePlan = accepted;
  if (lineage) carrier.rangeLineagePlan={...lineage,rootId};
  delete carrier.rangeBaseCosts; delete carrier.rangeRoute; delete carrier.rangeQuotedPlan; delete carrier.rangeReturnAuthorization; delete carrier.rangeCounterReservation;
  for (const action of actions) {
    action.card = { ...action.card, rangePlan: accepted, ...(carrier.rangeLineagePlan ? {rangeLineagePlan:carrier.rangeLineagePlan} : {}) };
    delete action.card.rangeReturnAuthorization; delete action.card.rangeCounterReservation;
    action.meta = { ...action.meta, energySpent: (action.meta?.energySpent || 0) + extra, staminaSpent: (action.meta?.staminaSpent || 0) + extra };
  }
  return accepted;
}

/** Public-context adapter: callers provide already resolved actions/base costs;
 * the pure range planner and ordinary hit preview own all arithmetic. */
export function previewRangeRoutes(ctx, source, actions, baseCosts, { rangeRoute = 'advance', hitPreview } = {}) {
  if (!ctx.rangeState) return null;
  const plans = ['advance', 'throw'].map(route => quoteRangeActions(ctx, source, actions, { route, preview: true }));
  const opponents = ctx.enemies && source.kind !== 'enemy' ? ctx.enemies : ctx.players ? [...ctx.players.values()].map(row => row.entity) : [ctx.player];
  const routeRows = plans.map(plan => {
    const costs = addRangeCosts(baseCosts, plan);
    const targets = [];
    for (const row of plan.targets) {
      const index = Number(row.contactId.split(':')[0]);
      const projected = actions[index]?.target || actions.find(action=>actorRangeKey(ctx,action.target)===row.targetKey)?.target;
      const target = projected && actorRangeKey(ctx, projected) === row.targetKey ? projected : opponents.find(entity => actorRangeKey(ctx, entity) === row.targetKey);
      const carrier = actions[index]?.card || {};
      const current = hitPreview?.(ctx, source, target, carrier);
      const after = hitPreview?.(ctx, source, target, { ...carrier, rangePlan: plan });
      targets.push({ conditional:row.contactId.startsWith('rider:'), contactId: row.contactId, targetKey: row.targetKey, targetId: target?.id, band: row.actualBand, coverage: row.coverage,
        effectiveBand: row.effectiveBand, precisionDelta: row.precisionDelta, inRange: !!after?.inRange,
        hitChance: after?.hitChance ?? null, currentInRange: !!current?.inRange, currentHitChance: current?.hitChance ?? null });
    }
    const grouped = [...new Set(targets.map(row => row.targetKey))].map(key => {
      const all = targets.filter(row => row.targetKey === key), conditionalContacts=all.filter(row=>row.conditional);
      const contacts=all.filter(row=>!row.conditional), first=contacts[0] || conditionalContacts[0];
      const hitChances = contacts.map(row => row.hitChance), currentHitChances = contacts.map(row => row.currentHitChance);
      return { ...first, contacts, conditionalContacts, conditionalOnly:!contacts.length, hitChances, currentHitChances, inRange: contacts.every(row => row.inRange), currentInRange: contacts.some(row => row.currentInRange), allCurrentInRange: contacts.every(row => row.currentInRange), hitChance: hitChances.length && hitChances.every(n => n === hitChances[0]) ? hitChances[0] : null, currentHitChance: currentHitChances.length && currentHitChances.every(n => n === currentHitChances[0]) ? currentHitChances[0] : null };
    });
    const affordable = (source.energy ?? source.stamina ?? 0) >= costs.energy && (source.mana || 0) >= costs.mana;
    return { id: plan.route, available: plan.available, reason: !plan.available ? 'range' : !affordable ? 'stamina' : null,
      advanceSp: plan.advanceSp, precisionDelta: Math.min(0, ...plan.targets.map(row => row.precisionDelta)), costs, affordable, targets: grouped };
  });
  const selected = routeRows.find(row => row.id === rangeRoute);
  if (!selected) throw Error('Unknown range route');
  return { version: 1, enabled: ctx.rangeState.policy.enabled, selectedRoute: rangeRoute,
    choiceRequired: false, targets: selected.targets, routes: routeRows };
}

export function incomingRangeScope(ctx, group, defender) {
  if (!ctx.rangeState || !group?.carrier?.rangePlan) return () => {};
  const prior = { context: ctx._rangeContext, incoming: ctx._rangeIncoming };
  const key = actorRangeKey(ctx, defender);
  const id = group.targets?.[ctx.playerIdForEntity?.(defender) || defender.id]?.contacts?.[0]?.rangeContactId;
  const root = group.carrier.rangePlan;
  const contact = root.targets.find(row => row.contactId === id) || root.targets.find(row => row.targetKey === key);
  if (contact) {
    ctx._rangeContext = { sourceKey: root.sourceKey, targets: [contact] };
    ctx._rangeIncoming = { rootId: root.rootId, contactId: contact.contactId, sourceKey: root.sourceKey, targetKey: key };
  }
  return () => {
    if (prior.context === undefined) delete ctx._rangeContext; else ctx._rangeContext = prior.context;
    if (prior.incoming === undefined) delete ctx._rangeIncoming; else ctx._rangeIncoming = prior.incoming;
  };
}

function quoteCounterReturn(ctx,source,target,carrier,options) {
  const card={...carrier,counterReturnAttack:true};
  delete card.rangePlan;delete card.rangeLineagePlan;delete card.rangeCounterReservation;delete card.rangeReturnAuthorization;
  const ward = carrier.combatProfile?.camp !== 'spell' && (carrier.traitValues?.flux > 0 || source.combatCounter?.payload?.ward > 0 || carrier.combatProfile?.counterPayload?.ward);
  const actions=['damage','poiseDamage',...(ward?['wardDamage']:[])].map(op=>({source,owner:source,target,card,effect:{op,amount:1},meta:{}}));
  return quoteRangeActions(ctx,source,actions,options);
}
function authorizedReturnCarrier(carrier,authorization) {
  const next={...carrier,rangeReturnAuthorization:authorization};
  delete next.rangePlan;delete next.rangeLineagePlan;delete next.rangeLineage;delete next.rangeCounterReservation;
  const frozen=authorization.plan.targets[0];
  if(frozen)next.resolvedRangeSource={sourceType:frozen.weapon?'weapon':carrier.combatProfile?.camp==='spell'?'spell':'unarmed',itemId:frozen.sourceWeaponId,range:['melee','reach','ranged'][frozen.coverage],propertyTags:frozen.throwCapable?['throw']:[]};
  return next;
}

export function paidCounterRange(ctx, source, carrier, baseCosts, route = 'advance') {
  if (!ctx.rangeState || !ctx._rangeIncoming || !ctx._reactionPlaying || carrier.combatProfile?.maneuver !== 'counter') return null;
  const incoming = ctx._rangeIncoming;
  const target = [...(ctx.enemies || []), ...(ctx.players ? [...ctx.players.values()].map(row => row.entity) : [ctx.player])].find(entity => actorRangeKey(ctx,entity) === incoming.sourceKey);
  if (!target) throw Foundation.playRefusal('The incoming attacker is unavailable', 'range');
  const plan = quoteCounterReturn(ctx,source,target,carrier,{route,context:ctx._rangeContext});
  if (!plan.available) throw Foundation.playRefusal('The selected Counter return cannot reach its attacker', 'range');
  const costs = addRangeCosts(baseCosts,plan);
  const rootId = `${incoming.rootId}:return:${incoming.contactId}:${carrier.instanceId || carrier.cardId}`;
  return { costs, reservation:{version:1,sourceKey:plan.sourceKey,targetKey:incoming.sourceKey,
    incomingRootId:incoming.rootId,contactId:incoming.contactId,rangePlan:{...plan,rootId,paid:costs},...(plan.lineage?{rangeLineagePlan:{...plan.lineage,rootId}}:{}),consumed:false} };
}
/** Price an automatic return before any offensive budget or seeded hit work.
 * Its defensive interception has already happened and is never restored. */
export function authorizeCounterRange(ctx, defender, attacker, counterCarrier, incomingCarrier) {
  if (!ctx.rangeState) return counterCarrier;
  const incomingPlan = incomingCarrier.rangePlan;
  const contact = incomingPlan?.targets.find(row => row.contactId === incomingCarrier.rangeContactId)
    || incomingPlan?.targets.find(row => row.targetKey === actorRangeKey(ctx,defender));
  const context = contact ? {sourceKey:incomingPlan.sourceKey,targets:[contact]} : null;
  const reservation = counterCarrier.rangeCounterReservation;
  const bound = reservation && !reservation.consumed && reservation.incomingRootId === incomingPlan?.rootId
    && reservation.contactId === contact?.contactId && reservation.sourceKey === actorRangeKey(ctx,defender) && reservation.targetKey === actorRangeKey(ctx,attacker);
  if (bound) {
    const accepted = structuredClone(reservation.rangePlan);
    delete counterCarrier.rangeCounterReservation;
    return authorizedReturnCarrier(counterCarrier,{plan:accepted,paid:accepted.paid,lineage:reservation.rangeLineagePlan && structuredClone(reservation.rangeLineagePlan)});
  }
  const route = 'advance';
  let plan = quoteCounterReturn(ctx,defender,attacker,counterCarrier,{route,context,preview:true});
  const available = defender.kind === 'enemy' ? defender.fixCoreStaminaRemaining ?? defender.stamina ?? defender.maxStamina ?? 0 : defender.energy;
  if (!bound && available < plan.advanceSp) {
    ctx.emit?.('combatRangeReturnUnavailable',{sourceId:defender.id,targetId:attacker.id,ownerId:ctx.playerIdForEntity?.(defender) || 'player',required:plan.advanceSp,available,advanceSp:plan.advanceSp,reason:'stamina',defenseKept:true});
    return null;
  }
  plan=quoteCounterReturn(ctx,defender,attacker,counterCarrier,{route,context});
  return authorizedReturnCarrier(counterCarrier,{plan,lineage:plan.lineage});
}

export function rangeCardSourceSnapshots(ctx, def, source, carrier) {
  if (!ctx.rangeState) return null;
  const capture = effect => {
    const row = rangeSourceContact(ctx,source,null,carrier,effect || {});
    const scoped=rangeSourceContext(ctx,source),profile=rangeSourceProfile(carrier,effect || {});
    const resolved=committedRangeSource(scoped,source,carrier,effect || {},profile);
    // Freeze source identity only. Stance acceptance and other root metadata
    // are established after this pre-hook boundary and must stay current.
    return {usedArmamentId:resolved?.sourceType==='unarmed'?null:resolved?.itemId || null,
      resolvedRangeSource:{sourceType:row.weapon?'weapon':resolved?.sourceType==='unarmed'?'unarmed':'spell',itemId:row.sourceWeaponId,range:row.coverage,propertyTags:row.throwCapable?['throw']:[]}};
  };
  const snapshots = new Map((def.effects || []).filter(effect=>effect.op==='damage').map(effect=>[effect,capture(effect)]));
  if (!snapshots.size && carrier.combatProfile?.maneuver === 'counter') snapshots.set(null,capture(null));
  return snapshots;
}

export function discardCounterRangeReservation(group, target, row) {
  const rootId = group.carrier?.rangePlan?.rootId;
  const contactIds = new Set((row.contacts || []).map(contact=>contact.rangeContactId));
  for (const carrier of [target?.combatCounter?.carrier,row.receipt?.counter?.carrier]) {
    const reservation=carrier?.rangeCounterReservation;
    if (reservation && reservation.incomingRootId===rootId && contactIds.has(reservation.contactId)) delete carrier.rangeCounterReservation;
  }
}
