import { STANCE_EFFECTS, STATUS_EFFECTS, PROC_EFFECTS } from '../content/combatDefenseEffects.js';
import {resolveCard} from './registries.js';
import {combatEffectPlan,combatEffectTags} from './combatEffects.js';
const lookup=(map,key)=>Object.hasOwn(map,key)?map[key]:null;

// Co-op entities share the engine id "player". Presentation uses the actual
// seat identities recorded at resolution, including spells cast on an ally.
export function combatEffectReceipt(event){
 return {...event,sourceId:event.sourcePlayerId||event.sourceId,targetId:event.targetPlayerId||(event.targetId==='player'&&event.playerId)||event.targetId};
}

// Receipt-driven overlays: attempted/resisted buildup and paired HP receipts
// do not create a second proc burst. No state or combat mechanics are changed.
export function combatEffectForEvent(event={}){
 let kind=null,targetId=event.targetId;
 if(event.type==='stanceEntered'){
  kind=lookup(STANCE_EFFECTS,event.stance);targetId=event.playerId||'player';
 }else if(event.type==='statusApplied' && event.stacks>0){
  kind=lookup(STATUS_EFFECTS,event.status);
 }else if(event.type==='procBurst')kind=lookup(PROC_EFFECTS,event.status);
 else if(event.type==='enemyStaggered')kind='staggerBreak';
 else if(event.type==='procResisted' && event.blocked>0)kind='resist';
 else if(event.type==='dodgeRolled' && event.success){kind='dodge';targetId=event.sourceId;}
 else if(event.type==='damageDealt' && event.blocked>0)kind=event.barrierVisual?(event.blockRemaining===0?'barrierBreak':'barrierHit'):(event.defenseVisual||'physicalGuard');
 return kind&&targetId?{kind,targetId}:null;
}

// Local presentation memory. No combat state is mutated, including on skips.
// Only a confirmed block gain from a barrier card establishes its visual.
export function decorateCombatEffects(events,registries,barriers=new Map()){
 let defenseCast=null;
 return events.map(event=>{
  if(event.type==='cardPlayed'){
   const card=resolveCard(registries,{cardId:event.cardId,profileId:event.profileId,upgraded:event.upgraded});
   const kind=combatEffectPlan({...card,cardTags:combatEffectTags(registries,card)})?.kind;
   defenseCast=['barrier','magicGuard','arcaneWard','physicalGuard','parry','guardPulse','ward'].includes(kind)?kind:null;
  }
  if(['playerTurnStart','enemyMoveStarted','enemyTurnStart'].includes(event.type))defenseCast=null;
  if(event.type==='playerTurnStart')barriers.delete(event.playerId||'player');
  if(event.type==='blockGained'&&event.amount>0&&defenseCast)barriers.set(event.targetId,defenseCast);
  if(event.type==='damageDealt'){
   const defenseVisual=barriers.get(event.targetId),barrierVisual=defenseVisual==='barrier';
   if(event.blockRemaining===0)barriers.delete(event.targetId);
   return {...event,barrierVisual,defenseVisual};
  }
  if(['enemyDied','playerDowned'].includes(event.type))barriers.delete(event.targetId);
  return event;
 });
}
