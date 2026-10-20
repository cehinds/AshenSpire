// Runtime adapter around the pure engagement planner. No pricing or distance is
// inferred from a stance, screen coordinates, or another held weapon.
import { actorRangeKey, createRangeState, snapshotRangePolicy, rangeActionPlan, rangeBand, movedEngagementState } from '../model/combatEngagement.js';
import { fixCoreEnabled, fixCoreRules } from '../model/fixCoreMechanics.js';
import { equippedIn, slotHand } from '../model/loadout.js';
import { attackDescriptor } from '../model/attackTags.js';
import { combatProfileFor } from '../model/combatCardProfile.js';
import * as Foundation from './combatRules.js';
import * as Actions from './actions.js';
import { wieldedArmament } from './combatCardTactics.js';
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
export function rangeSourceContact(ctx, source, target, carrier = {}, effect = {}, contactId = '0') {
  const profile = { ...combatProfileFor(carrier), ...carrier?.combatProfile, ...effect.combatProfile };
  let resolved = carrier?.resolvedRangeSource || carrier?.resolvedSource || (ctx.foundation ? Foundation.foundationSource(ctx, source, { ...carrier, attack: effect.attack || carrier.attack }) : null);
  if (!resolved && source.kind !== 'enemy') {
    const attack = attackDescriptor({ ...carrier, attack: effect.attack || carrier.attack });
    const kind = attack.source || (profile.camp === 'spell' ? 'spell' : 'weapon');
    const piece = kind === 'unarmed' ? null : wieldedArmament(ctx, { ...carrier, sourceHand: attack.hand || carrier.sourceHand }, source, kind);
    resolved = piece ? { sourceType: kind, itemId: piece.id, range: piece.range || 'melee', propertyTags: [...(piece.propertyTags || [])] }
      : { sourceType: kind === 'weapon' ? 'unarmed' : kind };
  }
  const weapon = resolved?.sourceType === 'weapon';
  const piece = weapon && (ctx.registries.equipment?.armaments || []).find(row => row.id === resolved.itemId);
  const coverage = weapon ? resolved.range ?? piece?.range ?? 'melee' : resolved?.sourceType === 'unarmed' ? 'melee' : profile.range || 'melee';
  return { contactId, targetKey: actorRangeKey(ctx, target), coverage, weapon,
    sourceWeaponId: weapon ? resolved.itemId || resolved.id : null,
    throwCapable: weapon && (resolved.propertyTags || piece?.propertyTags || []).includes('throw'),
    bypass: profile.rangeOverride === true || profile.adequateReach === true || profile.traits?.includes('adequateReach') || false };
}
const hostileOps = new Set(['damage','applyStatus','buildup','poiseDamage','wardDamage','loseHp','stagger']);
export function quoteRangeActions(ctx, source, actions, { route = 'advance', context = ctx._rangeContext, preview = false } = {}) {
  if (!ctx.rangeState) return null;
  const contacts = [];
  const planningCtx = preview && actions.some(action => action.effect.target === 'randomEnemy') ? { ...ctx, rng: Foundation.candidateState(ctx, { detached: true }).rng } : ctx;
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
    if (!preview) action.meta = { ...action.meta, rangeTargetBatches: batches };
  }
  return rangeActionPlan(ctx.rangeState, actorRangeKey(ctx, source), contacts, { route, context });
}
export function addRangeCosts(costs, plan) {
  const extra = plan?.advanceSp || 0;
  return { ...costs, energy: costs.energy + extra, stamina: costs.stamina + extra };
}
export function rangeHitContact(ctx, source, target, carrier) {
  if (!ctx.rangeState) return null;
  const targetKey = actorRangeKey(ctx, target), plan = carrier?.rangePlan;
  if (plan) {
    const committed = rangeSourceContact(ctx, source, target, carrier);
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
  if (action.effect.target === 'pendingAttacker') target = ctx.enemies.find(row => row.id === ctx._reactionSourceId) || ctx._reactionSource;
  if (!target || target.kind === action.source.kind) throw Error('Engagement movement requires an opposing target');
  ctx.rangeState = movedEngagementState(ctx.rangeState, actorRangeKey(ctx, action.source), actorRangeKey(ctx, target), action.effect.bands);
  ctx.emit?.('combatEngagementMoved', { sourceId: action.source.id, targetId: target.id, bands: action.effect.bands });
}
export function assertRangeCardEnabled(ctx, def) {
  if (ctx.rangeState && !ctx.rangeState.policy.enabled && def.effects?.length && def.effects.every(effect => effect.op === 'moveEngagement')) throw Foundation.playRefusal('Range mechanics are disabled', 'range-disabled');
}

export function acceptRangeActions(ctx, source, actions, carrier, rootId) {
  if (!ctx.rangeState) return null;
  const plan = carrier.rangePlan || carrier.rangeQuotedPlan || quoteRangeActions(ctx, source, actions, { route: carrier.rangeRoute || 'advance' });
  if (!plan.available) throw Foundation.playRefusal('The selected range route cannot reach every target', 'range');
  const extra = plan.advanceSp;
  const available = source.kind === 'enemy' ? source.fixCoreStaminaRemaining ?? source.stamina ?? source.maxStamina ?? 0 : source.energy;
  if (!carrier.rangePlan && available < extra) throw Foundation.playRefusal('Not enough Stamina to Advance', 'cost', { resource: 'stamina', need: extra, have: available });
  if (!carrier.rangePlan && extra > 0) {
    if (source.kind === 'enemy') { source.fixCoreStaminaRemaining = available - extra; source.stamina = source.fixCoreStaminaRemaining; }
    else {
      source.energy -= extra;
      source.counters.staminaSpentThisTurn = (source.counters.staminaSpentThisTurn || 0) + extra;
      ctx.emit?.('energySpent', { amount: extra }); ctx.emit?.('staminaSpent', { amount: extra });
    }
  }
  const accepted = { ...plan, rootId, paid: carrier.rangePlan?.paid || addRangeCosts(carrier.rangeBaseCosts || { energy: 0, stamina: 0, mana: 0 }, plan) };
  carrier.rangePlan = accepted;
  delete carrier.rangeBaseCosts; delete carrier.rangeRoute; delete carrier.rangeQuotedPlan;
  for (const action of actions) {
    action.card = { ...action.card, rangePlan: accepted };
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
      const projected = actions[index]?.target;
      const target = projected && actorRangeKey(ctx, projected) === row.targetKey ? projected : opponents.find(entity => actorRangeKey(ctx, entity) === row.targetKey);
      const carrier = actions[index]?.card || {};
      const current = hitPreview?.(ctx, source, target, carrier);
      const after = hitPreview?.(ctx, source, target, { ...carrier, rangePlan: plan });
      targets.push({ contactId: row.contactId, targetKey: row.targetKey, targetId: target?.id, band: row.actualBand, coverage: row.coverage,
        effectiveBand: row.effectiveBand, precisionDelta: row.precisionDelta, inRange: !!after?.inRange,
        hitChance: after?.hitChance ?? null, currentInRange: !!current?.inRange, currentHitChance: current?.hitChance ?? null });
    }
    const grouped = [...new Set(targets.map(row => row.targetKey))].map(key => {
      const contacts = targets.filter(row => row.targetKey === key), first = contacts[0];
      const hitChances = contacts.map(row => row.hitChance), currentHitChances = contacts.map(row => row.currentHitChance);
      return { ...first, contacts, hitChances, currentHitChances, inRange: contacts.every(row => row.inRange), currentInRange: contacts.some(row => row.currentInRange), allCurrentInRange: contacts.every(row => row.currentInRange), hitChance: hitChances.every(n => n === hitChances[0]) ? hitChances[0] : null, currentHitChance: currentHitChances.every(n => n === currentHitChances[0]) ? currentHitChances[0] : null };
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
