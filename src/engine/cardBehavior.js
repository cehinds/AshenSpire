import { equippedIn } from '../model/loadout.js';
import { gameContent } from '../model/gameProfile.js';
// Runtime projections of authored behavior. The same definition is used for
// presentation, affordability and actual effect execution.
import { evalPredicate } from './triggers.js';
export function projectCardBehavior(ctx, instance, def) {
  let result=def;
  if(def.playLimit && (ctx.player.abilityRiders?.instanceUsesCombat?.[instance.instanceId] || 0)>=def.playLimit) result={...result,keywords:[...new Set([...(result.keywords || []),'unplayable'])]};
  const changes=instance.proposalChanges;
  if (changes) result={...result,...(changes.range ? {range:changes.range,combatProfile:{...result.combatProfile,range:changes.range}} : {}),...(changes.maneuver ? {combatProfile:{...result.combatProfile,maneuver:changes.maneuver,...(changes.range ? {range:changes.range} : {})}} : {}),...(changes.retain && (changes.retainUntilTurn ?? ctx.turn)>=ctx.turn ? {keywords:[...new Set([...(result.keywords || []),'retain'])]} : {})};
  if (def.costGrowth) {
    const growth=def.costGrowth, plays=ctx.player.abilityRiders?.cardUsesCombat?.[instance.cardId] || 0;
    const steps=Math.min(growth.max ?? 3,Math.floor(plays/(growth.perUse || 1)));
    const stamina=typeof result.cost==='number' ? Math.max(0,result.cost+steps*(growth.stamina || 0)) : result.cost;
    const mana=Math.max(0,(result.manaCost || 0)+steps*(growth.mana || 0));
    result={...result,cost:stamina,staminaCost:stamina,manaCost:mana,...(result.resourceCosts ? {resourceCosts:{...result.resourceCosts,sp:stamina,mp:mana}} : {})};
  }
  return result;
}
export function selectCardVariant(ctx, def, paid, target=null) {
  if (!def.effectVariants?.length) return def;
  const meta={energySpent:paid.energy || 0,manaSpent:paid.mana || 0,staminaSpent:paid.stamina || 0};
  const variant=def.effectVariants.find(row=>evalPredicate(ctx,row.if,{source:ctx.player,owner:ctx.player,target,card:def,meta}));
  return variant ? {...def,effects:variant.effects,...(variant.textTemplate ? {textTemplate:variant.textTemplate} : {}),activeEffectVariant:def.effectVariants.indexOf(variant)} : def;
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
 return Math.max(0,(profile?.baseValue || 3)+(weapon?.attackRating || 0)+(ctx.itemUpgradeLevels?.[`armament/${weapon?.id}`] || 0));
}
