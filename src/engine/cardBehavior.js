// Runtime projections of authored behavior. The same definition is used for
// presentation, affordability and actual effect execution.
import { evalPredicate } from './triggers.js';
export function projectCardBehavior(ctx, instance, def) {
  let result=def;
  const changes=instance.proposalChanges;
  if (changes) result={...result,...(changes.range ? {range:changes.range,combatProfile:{...result.combatProfile,range:changes.range}} : {}),...(changes.maneuver ? {combatProfile:{...result.combatProfile,maneuver:changes.maneuver,...(changes.range ? {range:changes.range} : {})}} : {}),...(changes.retain ? {keywords:[...new Set([...(result.keywords || []),'retain'])]} : {})};
  if (def.costGrowth) {
    const growth=def.costGrowth, plays=ctx.player.abilityRiders?.sameCardPlays?.[instance.cardId] || 0;
    const steps=Math.min(growth.max ?? 3,Math.floor(plays/(growth.perUse || 1)));
    const stamina=typeof result.cost==='number' ? Math.max(0,result.cost+steps*(growth.stamina || 0)) : result.cost;
    result={...result,cost:stamina,staminaCost:stamina,manaCost:Math.max(0,(result.manaCost || 0)+steps*(growth.mana || 0))};
  }
  return result;
}
export function selectCardVariant(ctx, def, paid, target=null) {
  if (!def.effectVariants?.length) return def;
  const meta={energySpent:paid.energy || 0,manaSpent:paid.mana || 0,staminaSpent:paid.stamina || 0};
  const variant=def.effectVariants.find(row=>evalPredicate(ctx,row.if,{source:ctx.player,owner:ctx.player,target,card:def,meta}));
  return variant ? {...def,effects:variant.effects,...(variant.textTemplate ? {textTemplate:variant.textTemplate} : {}),activeEffectVariant:def.effectVariants.indexOf(variant)} : def;
}
