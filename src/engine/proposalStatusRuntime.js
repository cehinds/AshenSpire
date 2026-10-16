import { combatProfileFor } from '../model/combatCardProfile.js';
import { canonicalDamageType, magicDamageTypeOf } from '../model/combatRatings.js';
import * as Plans from '../model/proposalStatusRules.js';
export function proposalContext(ctx) {
 const profile=ctx.gameProfile;
 return {rules:ctx.registries?.proposalStatusRules?.rules || ctx.registries?.proposalStatusRules || {},capabilities:!profile ? {} : {modules:Object.entries(profile.modules || {}).filter(([,v])=>v!==false && v!=null).map(([k])=>k),...(profile.foundation?.mode==='legacy' ? {} : {elements:[],protections:profile.modules?.defenses?.include || []})}};
}
export function proposalActors(ctx) {return [...(ctx.players ? [...ctx.players.values()].map(p=>p.entity) : [ctx.player]),...(ctx.enemies || [])].filter(Boolean);}
export function proposalAllies(ctx,actor) {return proposalActors(ctx).filter(row=>row.kind===actor?.kind && row.alive);}
export function applyProposalPlan(ctx,plan,source=null,target=null,card=null) {
 const actors=proposalActors(ctx),find=id=>actors.find(a=>a.id===id) || target || source;
 for(const change of plan.statusChanges || []) {
  const entity=find(change.actorId);
  ctx.enqueue({effect:{op:change.delta<0?'removeStatus':'applyStatus',status:change.status,...(change.delta<0 ? {amount:-change.delta} : {stacks:change.delta})},source:entity,owner:entity,target:entity,meta:{proposalReactive:true}});
 }
 for(const job of plan.effects || []) {
  const {sourceId,targetId,proposalReactive,damageType,camp,direct,...effect}=job,actor=find(sourceId) || source,recipient=find(targetId) || target;
  ctx.enqueue({effect,source:actor,owner:actor,target:recipient,card:{...card,proposalReactive:!!proposalReactive,damageType,damageSchool:damageType || card?.damageSchool,combatProfile:{...card?.combatProfile,camp:camp || card?.combatProfile?.camp || 'physical'},skipRatingBonus:!!proposalReactive || !!card?.skipRatingBonus},meta:{proposalReactive:!!proposalReactive,direct:direct!==false}});
 }
}
export function proposalDamageType(card={}) {
 if(typeof card==='string')return canonicalDamageType(card);
 const typed=card.combatProfile || {},explicit=canonicalDamageType(card.attack?.damageType || card.damageType || typed.damageType);
 if(explicit && !['magic','physical'].includes(explicit))return explicit;
 const profile=combatProfileFor(card);
 return canonicalDamageType(profile.damageType || magicDamageTypeOf({...profile,...typed,tags:card.cardTags || card.tags}) || card.magicDamageType || card.physicalDamageType || card.damageSchool);
}
export function proposalCardPlan(ctx,actor,card) {return Plans.proposalCardRules({actor,card,...proposalContext(ctx)});}
export function proposalTargetPlan(ctx,actor,target,card,{resolve=false}={}) {
 const data={actor,target,card:{...card,range:card?.range || card?.combatProfile?.range,camp:card?.combatProfile?.camp,damageType:proposalDamageType(card)},...proposalContext(ctx)};
 const preview=Plans.proposalTargetRules(data);
 if(!resolve)return preview;
 return Plans.proposalTargetRules({...data,...(preview.perceptionChance!==null ? {perceptionRoll:Math.floor(ctx.rng.float('misc')*100)} : {}),...(preview.evadeChance>0 ? {evadeRoll:Math.floor(ctx.rng.float('misc')*100)} : {})});
}
export function proposalHitPlan(ctx,source,target,amount,card={}) {return Plans.proposalHitRules({actor:source,target,card,amount,damageType:proposalDamageType(card),camp:card?.combatProfile?.camp || 'physical',range:card?.range || card?.combatProfile?.range,direct:!card.proposalReactive,reactive:!!card.proposalReactive,allies:proposalAllies(ctx,target),...proposalContext(ctx)});}
export function proposalAfterHit(ctx,source,target,amount,hpDamage,card={}) {applyProposalPlan(ctx,Plans.proposalAfterHitRules({actor:source,target,incomingDamage:amount,hpDamage,damageType:proposalDamageType(card),camp:card?.combatProfile?.camp || 'physical',range:card?.range || card?.combatProfile?.range,direct:!card.proposalReactive,reactive:!!card.proposalReactive,opponents:proposalAllies(ctx,source),...proposalContext(ctx)}),source,target,card);}
export function proposalTurn(ctx,actor,phase) {applyProposalPlan(ctx,Plans.proposalTurnRules({actor,phase,...proposalContext(ctx),roll:()=>Math.floor(ctx.rng.float('misc')*100)}),actor,actor,{skipRatingBonus:true,proposalProtectionFloor:true});}
export function proposalThreshold(ctx,actor) {applyProposalPlan(ctx,Plans.proposalThresholdRules({actor,...proposalContext(ctx)}),actor,actor);}
export function proposalRetained(ctx,actor,pool='block') {return Plans.proposalRetainProtection({actor,pool,...proposalContext(ctx)});}
export function proposalHealingPlan(ctx,target,amount,card) {return Plans.proposalHealingRules({target,amount,damageType:proposalDamageType(card),...proposalContext(ctx)});}
