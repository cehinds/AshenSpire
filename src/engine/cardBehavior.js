import { equippedIn } from '../model/loadout.js';
import { gameContent } from '../model/gameProfile.js';
// Runtime projections of authored behavior. The same definition is used for
// presentation, affordability and actual effect execution.
import * as Triggers from './triggers.js';
import { GearCardDefinition } from './gearHooks.js';
import { RetreatRulesActive } from '../model/fixCoreMechanics.js';
import { EffectiveCostGrowth, EffectiveWitherLimit, MechanicRule } from '../model/combatMechanics.js';
const growthSteps = (growth, uses) => growth.uncapped ? Math.floor(uses / (growth.perUse || 1))
  : Math.min(growth.max ?? 3, Math.floor(uses / (growth.perUse || 1)));

/** Plays left before Wither exhausts this copy, or null when Wither is inactive or absent. */
export function WitherRemaining(entity, instance, def, ctx = null) {
  const limit = EffectiveWitherLimit(def, ctx);
  if (!limit) return null;
  const rule = MechanicRule('wither', ctx);
  const riders = entity?.abilityRiders;
  const plays = (rule?.countScope === 'card' || !instance?.instanceId
    ? riders?.cardUsesCombat?.[instance?.cardId || def?.id]
    : riders?.instanceUsesCombat?.[instance.instanceId]) || 0;
  return Math.max(0, limit - plays);
}

/** True once this copy has reached its Wither limit (exhausts instead of discarding). */
export function Withered(entity, instance, def, ctx = null) {
  const left = WitherRemaining(entity, instance, def, ctx);
  return left !== null && left <= 0;
}
export function projectCardBehavior(ctx, instance, def, { applyGear = true } = {}) {
  let result=applyGear ? GearCardDefinition(ctx,def) : def;
  if(def.playLimit && (ctx.player.abilityRiders?.instanceUsesCombat?.[instance.instanceId] || 0)>=def.playLimit) result={...result,keywords:[...new Set([...(result.keywords || []),'unplayable'])]};
  const changes=instance.proposalChanges;
  if (changes) result={...result,...(changes.range ? {range:changes.range,combatProfile:{...result.combatProfile,range:changes.range}} : {}),...(changes.maneuver ? {combatProfile:{...result.combatProfile,maneuver:changes.maneuver,...(changes.range ? {range:changes.range} : {})}} : {}),...(changes.retain && (changes.retainUntilTurn ?? ctx.turn)>=ctx.turn ? {keywords:[...new Set([...(result.keywords || []),'retain'])]} : {})};
  const growth = EffectiveCostGrowth(result, ctx);
  if (growth) {
    // Plays of this copy (review of #2819): an upgraded copy's plays never raise an unupgraded copy's cost. A projection with no instance id counts by card.
    // `perCard` / `scope: 'card'` (costGrowth.shared): counts plays of this card id across the fight.
    const riders=ctx.player.abilityRiders;
    const plays=((instance.instanceId && !growth.perCard) ? riders?.instanceUsesCombat?.[instance.instanceId] : riders?.cardUsesCombat?.[instance.cardId]) || 0;
    const steps=growthSteps(growth,plays);
    const baseStamina=result.resourceCosts?.sp ?? result.staminaCost ?? result.cost;
    const stamina=typeof baseStamina==='number' ? Math.max(0,baseStamina+steps*(growth.stamina || 0)) : baseStamina;
    const mana=Math.max(0,(result.manaCost || 0)+steps*(growth.mana || 0));
    result={...result,costGrowthApplied:{stamina:steps*(growth.stamina || 0)},cost:stamina,staminaCost:stamina,manaCost:mana,...(result.resourceCosts ? {resourceCosts:{...result.resourceCosts,sp:stamina,mp:mana}} : {})};
  }
  if (RetreatRulesActive(ctx) && result.choiceModes?.some(mode => mode.costGrowth)) {
    const riders = ctx.player.abilityRiders;
    result = { ...result, choiceModes: result.choiceModes.map(mode => {
      if (!mode.costGrowth) return mode;
      const growth = EffectiveCostGrowth(mode, ctx, 'costGrowth.choiceMode');
      if (!growth) return mode;
      const uses = (instance.instanceId && !growth.perCard ? riders?.instanceModeUsesCombat?.[instance.instanceId]?.[mode.id]
        : riders?.cardModeUsesCombat?.[instance.cardId || def.id]?.[mode.id]) || 0;
      const steps = growthSteps(growth, uses);
      return { ...mode, costGrowthApplied: { stamina: steps * (growth.stamina || 0), mana: steps * (growth.mana || 0) } };
    }) };
  }
  return result;
}

/** Price the selected mode's projected growth. Re-reading a projected definition never adds it twice. */
export function ChoiceModeCard(def, choice = null) {
  if (!def.choiceModes?.length) return def;
  const selected = choice ?? def.selectedChoice ?? def.choiceModes[0].id;
  const mode = def.choiceModes.find(row => row.id === selected);
  if (!mode) throw new Error(`Unknown card mode '${selected}'`);
  const growth = mode.costGrowthApplied || { stamina: 0, mana: 0 };
  const prior = def.modeCostGrowthApplied || { stamina: 0, mana: 0 };
  const base = def.resourceCosts?.sp ?? def.staminaCost ?? def.cost;
  const stamina = typeof base === 'number' ? Math.max(0, base - prior.stamina + growth.stamina) : base;
  const mana = Math.max(0, (def.resourceCosts?.mp ?? def.manaCost ?? 0) - prior.mana + growth.mana);
  return { ...def, selectedChoice: selected, choiceModeGrowth: !!mode.costGrowthApplied, modeCostGrowthApplied: growth,
    cost: def.cost === 'X' ? 'X' : stamina, staminaCost: stamina, manaCost: mana,
    ...(def.resourceCosts ? { resourceCosts: { ...def.resourceCosts, sp: stamina, mp: mana } } : {}) };
}
/** Whether a card's `playIf` holds with `target` aimed. A card without one is always allowed. */
export function PlayConditionMet(ctx, def, target=null, source=ctx.player) {
  return !def?.playIf || Triggers.evalPredicate(ctx,def.playIf,{source,owner:source,target,card:def});
}
/** Living enemy targets in board order whose play condition holds. */
export function PlayConditionEnemies(ctx, def, source = ctx.player) {
  return (ctx.enemies || []).filter(enemy => enemy.alive && PlayConditionMet(ctx, def, enemy, source));
}
/** Restrict the enemy destinations a card's targeting plan offers. */
export function PlayConditionTargetPlan(ctx, def, plan) {
  if (!def?.playIf || plan.mode !== 'enemy') return plan;
  const eligible = new Set(PlayConditionEnemies(ctx, def).map(enemy => enemy.id));
  return { ...plan, legalIds: plan.legalIds.filter(id => eligible.has(id)) };
}
/** Whether some living enemy could be aimed so that the card's `playIf` holds (the hand's playable check). */
export function PlayConditionReachable(ctx, def, source=ctx.player) {
  if (!def?.playIf) return true;
  if (ctx.enemies?.some(enemy => enemy.alive)) return PlayConditionEnemies(ctx, def, source).length > 0;
  return PlayConditionMet(ctx, def, null, source);
}
export function selectCardVariant(ctx, def, paid, target=null) {
  if (!def.effectVariants?.length) return def;
  const meta={energySpent:paid.energy || 0,manaSpent:paid.mana || 0,staminaSpent:paid.stamina || 0};
  const variant=def.effectVariants.find(row=>Triggers.evalPredicate(ctx,row.if,{source:ctx.player,owner:ctx.player,target,card:def,meta}));
  return variant ? {...def,effects:variant.effects,...(variant.gearApplied ? {gearApplied:variant.gearApplied} : {}),...(variant.textTemplate ? {textTemplate:variant.textTemplate} : {}),activeEffectVariant:def.effectVariants.indexOf(variant)} : def;
}

export function weaponDamageBasis(ctx,actor=ctx.player) {
 const seat=ctx.players?.get(ctx.playerIdForEntity?.(actor)),loadout=seat?.loadout || (actor===ctx.player ? ctx.loadout : null);
 if(!loadout)return Math.max(0,actor?.attackDamage || 0);
 const equipment=ctx.registries.equipment || {},weapon=equippedIn(ctx.registries,loadout,actor.classId,'rightHand') || equippedIn(ctx.registries,loadout,actor.classId,'leftHand');
 if(ctx.gameProfile?.modules?.cards?.mode==='configured') {
  const strike=(gameContent(ctx,'cards') || []).find(card=>card.id==='core.strike');
  return Math.max(0,(strike?.effects?.find(e=>e.op==='damage')?.amount || 6)+(actor.ratings?.ar || 0));
 }
 const profile=equipment.basicCardProfiles?.find(row=>row.id===(weapon?.weaponCardPackage?.combatKit?.attackProfileId || weapon?.attackProfile || 'unarmedAttack'));
 return Math.max(0,(profile?.baseValue || 3)+(ctx.itemUpgradeLevels?.[`armament/${weapon?.id}`] || 0));
}
