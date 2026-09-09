import {COMBAT_EFFECT_RULES} from '../content/combatEffectRules.js';
import {tagService} from './tagService.js';

// Profile visuals replace the base card's visuals; neither enters damage tags.
export function combatEffectTags(registries,card){
 const service=tagService(registries);
 const visual=card.equipmentProfileId?service.presentationIdsOf('basicCardProfile',{id:card.equipmentProfileId}):service.presentationIdsOf('card',card);
 return visual.length?visual:(card.cardTags?.length?card.cardTags:service.idsOf('card',card));
}
export function combatEffectPlan(card={}){
 const tags=new Set((card.cardTags||card.tags||[]).map(t=>(typeof t==='string'?t:t.id).replace(/^fx:/,'')));
 const effects=card.effects||[],hostile=e=>['enemy','allEnemies','randomEnemy'].includes(e.target);
 const hits=effects.filter(e=>e.op==='damage'&&hostile(e));
 const facts={type:card.type,profile:card.equipmentProfileId,damaging:hits.length>0,ranged:tags.has('ranged'),hostile:effects.some(hostile),selfHeal:effects.some(e=>e.op==='heal'&&e.target==='self'),multiHit:hits.filter(e=>!e.if).length>1||hits.some(e=>!e.if&&e.hits===2),enemyDebuff:effects.some(e=>e.op==='applyStatus'&&hostile(e)&&['weak','vulnerable'].includes(e.status))};
 const match=r=>(!r.all||r.all.every(t=>tags.has(t)))&&(!r.any||r.any.some(t=>tags.has(t)))&&(!r.none||r.none.every(t=>!tags.has(t)))&&Object.entries(r.when||{}).every(([k,v])=>facts[k]===v);
 const rule=COMBAT_EFFECT_RULES.find(match);if(!rule)return null;
 const projectile=facts.damaging&&facts.ranged;
 return {kind:rule.kind,projectile,...(rule.at?{at:rule.at}:{}),ruleId:rule.id,phase:projectile?'release':rule.at==='target'?'impact':'cast',cast:rule.cast||null,targetEvent:facts.damaging?'damageDealt':'statusApplied',tags:[...tags].sort()};
}
export function combatEffectFor(card={}){
 const p=combatEffectPlan(card);return p?{kind:p.kind,projectile:p.projectile,...(p.at?{at:p.at}:{})}:null;
}
// Actual outcomes own target effects, including each confirmed AoE victim.
export function combatEffectTargetIds(plan,events=[],ownerId=null){
 if(!plan||plan.at!=='target')return [];
 return [...new Set(events.filter(e=>e.type===plan.targetEvent&&e.targetId&&(!ownerId||(e.sourceId===ownerId&&e.targetId!==ownerId))&&(e.type==='damageDealt'?e.amount>0:e.stacks>0)).map(e=>e.targetId))];
}
