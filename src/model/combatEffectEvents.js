import { STANCE_EFFECTS, STATUS_EFFECTS, PROC_EFFECTS } from '../content/combatDefenseEffects.js';
const lookup=(map,key)=>Object.hasOwn(map,key)?map[key]:null;

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
 else if(event.type==='damageDealt' && event.blocked>0)kind='physicalGuard';
 return kind&&targetId?{kind,targetId}:null;
}
