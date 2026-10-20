// A Core action reserves its finite causal hook envelope before payment. Only
// the same typed actor inherits it; turn hooks and other actors stay separate.
import * as Triggers from './triggers.js';
import * as Engagement from './combatEngagement.js';
import * as Actions from './actions.js';
import { actorRangeKey, rangeBand } from '../model/combatEngagement.js';
import { TRIGGER_EVENTS } from '../model/schemas.js';
import { combatRules } from '../content/combatRules.js';
import { evaluate } from '../model/formulas.js';
import * as Rules from './combatRules.js';
const hostile = new Set(['damage','applyStatus','buildup','poiseDamage','wardDamage','loseHp','stagger','arcaneBuildup']);
const keyOf = (ctx,entity)=>actorRangeKey(ctx,entity);
const find = (ctx,key)=>[...(ctx.enemies || []),...(ctx.players ? [...ctx.players.values()].map(row=>row.entity) : [ctx.player])].find(entity=>keyOf(ctx,entity)===key);
const eventKey = event=>JSON.stringify([event.type,event.type==='statusApplied'?event.status || null:null]);

const flags = row=>({coverage:rangeBand(row.coverage),weapon:row.weapon,throwCapable:row.throwCapable,bypass:row.bypass,sourceWeaponId:row.sourceWeaponId});
function possible(pred,event,sourceKey,targetKey,carrier) {
  if (!pred || typeof pred!=='object') return true;
  if (pred.p==='all') return (pred.preds || []).every(row=>possible(row,event,sourceKey,targetKey,carrier));
  if (pred.p==='any') return (pred.preds || []).some(row=>possible(row,event,sourceKey,targetKey,carrier));
  if (pred.p==='eventStatusIs') return event.status===pred.status;
  if (pred.p==='eventTargetIsOwner') return targetKey===sourceKey;
  if (pred.p==='eventSourceIsOwner') return true;
  if (pred.p==='eventIsAttack') return event.type==='damageDealt';
  if (pred.p==='cardTagIs') return (carrier.authoredTags || carrier.tags || []).includes(pred.tag);
  // Mutable HP, statuses, resources and previous-hit conditions remain possible.
  return true;
}
function rawEventsFor(ctx,effect,target) {
  if (effect.op==='damage') return [{type:'damageDealt'},{type:'hpLost'},{type:'attackHit'},{type:'attackMissed'},{type:'enemyStaggered'},{type:'enemyDied'},{type:'blockBroken'},...(target?.arcaneExposure ? [{type:'arcaneBreak'}] : []),{type:'statusApplied',status:'vulnerable'}];
  if (effect.op==='applyStatus' || effect.op==='buildup') return [{type:'statusApplied',status:effect.status}];
  if (effect.op==='arcaneBuildup') return target?.arcaneExposure ? [{type:'arcaneBreak'},{type:'statusApplied',status:target.arcaneExposure.onBreak?.status}] : [];
  if (effect.op==='poiseDamage' || effect.op==='stagger') return [{type:'poiseBroken'},{type:'enemyStaggered'},{type:'statusApplied',status:'vulnerable'}];
  if (effect.op==='wardDamage') return [{type:'wardBroken'}];
  if (effect.op==='heal') return [{type:'healed'}];
  if (effect.op==='restoreMana') return [{type:'manaRestored'}];
  if (effect.op==='restoreStamina') return [{type:'staminaRestored'}];
  if (effect.op==='enterStance') return [{type:'stanceEntered'},{type:'stanceExited'}];
  if (effect.op==='loseHp') return [{type:'hpLost'}];
  return [];
}
const eventsFor=(ctx,effect,target)=>rawEventsFor(ctx,effect,target).filter(event=>TRIGGER_EVENTS.includes(event.type));
function gateSpent(ctx,row) {
  const state=ctx.triggerState.get(row.key),trigger=row.trigger;
  return trigger.once && state?.fires>0 || trigger.limitPerTurn!=null && state?.turn===ctx.turn && state.turnFires>=trigger.limitPerTurn;
}
function sourceStatuses(ctx,source,actions) {
  const ids=new Set(Object.keys(source.statuses || []));
  for (const action of actions) if (action.effect.op==='applyStatus' && ['self','owner'].includes(action.effect.target)) ids.add(action.effect.status);
  // Include immediately applicable statuses authored by any owned hook, even
  // when its condition is currently false but could pass after an earlier hit.
  let changed=true;
  while(changed) { changed=false; for(const {trigger} of Triggers.rangeHookSources(ctx,source,[...ids])) for(const effect of trigger.do || []) if(effect.op==='applyStatus' && ['self','owner'].includes(effect.target) && !ids.has(effect.status)){ids.add(effect.status);changed=true;} }
  return [...ids];
}
function sampledTargets(ctx,source,target,effect,carrier) {
  return Actions.resolveTargets(ctx,{source,owner:source,target,card:carrier,effect,meta:{}},effect.target);
}
export function assertPreparingRangeSupported(ctx,source,def) {
  if(!ctx.rangeState) return;
  const carrier={authoredTags:def.cardTags || def.tags || []};
  const hooks=Triggers.rangeHookSources(ctx,source,sourceStatuses(ctx,source,[]));
  const visited=new Set();
  const walk=(event,targetKey,depth)=>{
    if(depth>combatRules.triggers.maxDepth) throw Rules.playRefusal('This preparation has an unbounded range-trigger chain','range-preparing');
    for(const row of hooks) {
      if(row.trigger.on!==event.type || gateSpent(ctx,row) || !possible(row.trigger.if,event,keyOf(ctx,source),targetKey,carrier))continue;
      const stamp=JSON.stringify([row.key,eventKey(event),targetKey]); if(visited.has(stamp))continue; visited.add(stamp);
      for(const effect of row.trigger.do || []) {
        if(hostile.has(effect.op) && !['self','owner','player','ally','allAllies'].includes(effect.target)) throw Rules.playRefusal('A hostile preparation trigger needs a separately quoted action before this card can be played','range-preparing');
        for(const next of eventsFor(ctx,effect,source))walk(next,keyOf(ctx,source),depth+1);
      }
    }
  };
  walk({type:'cardPreparing'},keyOf(ctx,source),0);
}
export function extendRangeEnvelope(ctx,source,actions,contacts,{preview=false,carrier={}}={}) {
  const sourceKey=keyOf(ctx,source),sites=[],edges=[];
  const hooks=Triggers.rangeHookSources(ctx,source,sourceStatuses(ctx,source,actions));
  if (!hooks.some(({trigger})=>(trigger.do || []).some(effect=>hostile.has(effect.op) && !['self','owner','player','ally','allAllies'].includes(effect.target)))) return null;
  const sourceContact=(target,card,effect,id)=>Engagement.rangeSourceContact(ctx,source,target,card,effect,id);
  const maxEvents=ctx.foundation?.rules?.triggers?.maxEvents || combatRules.triggers.maxEvents;
  const maxDepth=ctx.foundation?.rules?.triggers?.maxDepth || combatRules.triggers.maxDepth;
  const visit=(site,card,path=[])=>{
    if(sites.length>maxEvents || edges.length>maxEvents || path.length>maxDepth) throw Rules.playRefusal('This action has an unbounded range-trigger envelope','range');
    const target=find(ctx,site.targetKey);
    for(const event of site.events) for(const hook of hooks) {
      if(hook.trigger.on!==event.type || gateSpent(ctx,hook) || !possible(hook.trigger.if,event,sourceKey,site.targetKey,card))continue;
      const prior=path.filter(key=>key===hook.key).length;
      const limit=hook.trigger.once ? 1 : hook.trigger.limitPerTurn;
      if(limit!=null && prior>=limit)continue;
      for(const [effectIndex,effect]of(hook.trigger.do || []).entries()) {
        const id=`e${edges.length}`;
        const edge={id,parentId:site.id,event:event.type,...(event.status?{status:event.status}:{}),triggerKey:hook.key,effectIndex,targets:[]};
        edges.push(edge);
        const probe={source,owner:source,target,card,effect,meta:{}};
        const repeats=Math.max(0,Math.floor(evaluate(effect.repeat ?? 1,Actions.formulaCtxFor(ctx,probe,target))));
        const hits=effect.op==='damage'?Math.max(0,Math.floor(evaluate(effect.hits ?? 1,Actions.formulaCtxFor(ctx,probe,target)))):1;
        for(let r=0;r<repeats;r++)for(let h=0;h<hits;h++)for(const childTarget of sampledTargets(ctx,source,target,effect,card)) {
          const targetKey=keyOf(ctx,childTarget),childId=`s${sites.length}`;
          const delivery=effect.attack || effect.tags ? flags(sourceContact(childTarget,{},effect,childId)) : site.delivery;
          const contactId=hostile.has(effect.op)&&source.kind!==childTarget.kind?`rider:${childId}`:null;
          if(contactId) contacts.push({contactId,targetKey,...delivery});
          const child={id:childId,targetKey,parentId:site.id,events:eventsFor(ctx,effect,childTarget),delivery};
          sites.push(child);edge.targets.push({targetKey,siteId:childId,contactId,batch:r*hits+h});
          visit(child,{},[...path,hook.key]);
        }
      }
    }
  };
  for(const [index,action]of actions.entries()) {
    const effect=action.effect,probe={...action,meta:action.meta || {}};
    if (!eventsFor(ctx,effect,action.target).length) continue;
    const repeats=Math.max(0,Math.floor(evaluate(effect.repeat ?? 1,Actions.formulaCtxFor(ctx,probe,action.target))));
    const hits=effect.op==='damage'?Math.max(0,Math.floor(evaluate(effect.hits ?? 1,Actions.formulaCtxFor(ctx,probe,action.target)))):1;
    const batches=[];
    for(let r=0;r<repeats;r++)for(let h=0;h<hits;h++) {
      const batch=r*hits+h;
      const targets=action.meta?.rangeTargetBatches?.[batch]?.map(ref=>ref.playerId?ctx.players?.get(ref.playerId)?.entity:ref.id===ctx.player?.id?ctx.player:ctx.enemies.find(enemy=>enemy.id===ref.id)) || sampledTargets(ctx,source,action.target,effect,action.card);
      const refs=[];
      for(const target of targets) {
        const targetKey=keyOf(ctx,target),id=`s${sites.length}`;
        const site={id,targetKey,parentId:null,events:eventsFor(ctx,effect,target),delivery:flags(sourceContact(target,action.card,effect,id))};
        sites.push(site);refs.push({id:target.id,...(ctx.playerIdForEntity?.(target)?{playerId:ctx.playerIdForEntity(target)}:{}),siteId:id});
        visit(site,action.card);
      }
      batches.push(refs);
    }
    if(!preview)action.meta={...action.meta,rangeSiteBatches:batches};
  }
  for(const type of carrier.instanceId && !carrier.counterReturnAttack && !carrier.moveId ? ['cardPlayed','cardResolved'] : []) {
    const target=actions.find(action=>action.target)?.target || source;
    const site={id:`lifecycle:${type}`,targetKey:keyOf(ctx,target),parentId:null,events:[{type}],delivery:flags(sourceContact(target,carrier,{},`lifecycle:${type}`))};
    sites.push(site);visit(site,carrier);
  }
  if (!edges.length) { if(!preview)for(const action of actions)if(action.meta)delete action.meta.rangeSiteBatches; return null; }
  return {version:1,rootId:'pending',sourceKey,sites,edges};
}

// Find the precise event site without retaining ambient context across queue
// boundaries. Each split hit retains only its own rangeSiteBatches entry.
export function eventRangeOrigin(ctx,type,payload,action) {
  const carrier=action?.card,graph=carrier?.rangeLineagePlan;
  if(!graph)return null;
  if(type==='cardPlayed' || type==='cardResolved') {
    const site=graph.sites.find(site=>site.id===`lifecycle:${type}`);
    return site?{version:1,rootId:graph.rootId,siteId:site.id,sourceKey:graph.sourceKey}:null;
  }
  const targetId=payload.targetId;
  const targetKey=!targetId ? graph.sourceKey : targetId==='player' ? `player:${payload.targetPlayerId || payload.playerId || ctx.playerKey || 'player'}` : targetId?`enemy:${targetId}`:null;
  const hits=action.effect?.op==='damage'?Math.max(0,Math.floor(evaluate(action.effect.hits ?? 1,Actions.formulaCtxFor(ctx,action,action.target)))):1;
  const batch=(action.meta?.expansionExecutionRepeat || 0)*hits+(action.meta?.rangeHitIndex || 0);
  const refs=action.meta?.rangeSiteBatches?.[batch] || [];
  const site=refs.map(ref=>graph.sites.find(site=>site.id===ref.siteId)).find(site=>site.targetKey===targetKey && site.events.some(event=>event.type===type && (!event.status || event.status===payload.status)));
  return site?{version:1,rootId:graph.rootId,siteId:site.id,sourceKey:graph.sourceKey}:null;
}
export function inheritedRangeAction(ctx,key,owner,event,effect,effectIndex,baseCarrier=null) {
  const origin=event.rangeOrigin;if(!origin)return null;
  if(keyOf(ctx,owner)!==origin.sourceKey)return null;
  const parent=ctx._abilityAction?.card || ctx.pendingAbilityPlay?.ref;
  const graph=parent?.rangeLineagePlan,plan=parent?.rangePlan;
  if(!graph || !plan || graph.rootId!==origin.rootId)throw Rules.playRefusal('The committed trigger envelope is missing','range-lineage');
  const edge=graph.edges.find(edge=>edge.parentId===origin.siteId && edge.event===event.type && edge.status===(event.type==='statusApplied'?event.status || undefined:undefined) && edge.triggerKey===key && edge.effectIndex===effectIndex);
  if(!edge)throw Rules.playRefusal('This trigger is outside the committed range envelope','range-lineage');
  const batches=[];
  for(const row of edge.targets) {
    const entity=find(ctx,row.targetKey); if(!entity)continue;
    (batches[row.batch] ||= []).push({id:entity.id,...(ctx.playerIdForEntity?.(entity)?{playerId:ctx.playerIdForEntity(entity)}:{}),siteId:row.siteId});
  }
  const first=graph.sites.find(site=>site.id===edge.targets[0]?.siteId);
  const delivery=first?.delivery;
  const carrier={...(baseCarrier || {}),rangePlan:plan,rangeLineagePlan:graph,rangeLineage:{version:1,rootId:graph.rootId,edgeId:edge.id},
    ...(delivery?{resolvedRangeSource:{sourceType:delivery.weapon?'weapon':'spell',itemId:delivery.sourceWeaponId,range:['melee','reach','ranged'][delivery.coverage],propertyTags:delivery.throwCapable?['throw']:[]}}:{})};
  return {carrier,batches};
}
export function rangeTargetsFor(ctx,action) {
  if(!action.card?.rangeLineage && !action.meta?.rangeTargetBatches)return null;
  const hits=action.effect?.op==='damage'?Math.max(0,Math.floor(evaluate(action.effect.hits ?? 1,Actions.formulaCtxFor(ctx,action,action.target)))):1;
  const batch=(action.meta?.expansionExecutionRepeat || 0)*hits+(action.meta?.rangeHitIndex || 0);
  const refs=action.card?.rangeLineage ? action.meta?.rangeSiteBatches?.[batch] || [] : action.meta.rangeTargetBatches[batch] || [];
  return refs.map(ref=>ref.playerId?ctx.players?.get(ref.playerId)?.entity:ref.id===ctx.player?.id?ctx.player:ctx.enemies.find(enemy=>enemy.id===ref.id)).filter(entity=>entity?.alive);
}
export function inheritedContactId(ctx,action,target) {
  const carrier=action.card,graph=carrier?.rangeLineagePlan,edge=graph?.edges.find(edge=>edge.id===carrier.rangeLineage?.edgeId);
  const hits=action.effect.op==='damage'?Math.max(0,Math.floor(evaluate(action.effect.hits ?? 1,Actions.formulaCtxFor(ctx,action,action.target)))):1;
  const batch=(action.meta?.expansionExecutionRepeat || 0)*hits+(action.meta?.rangeHitIndex || 0);
  return edge?.targets.find(row=>row.batch===batch && row.targetKey===keyOf(ctx,target))?.contactId || null;
}

/** Hostile triggers owned by another actor (or a turn hook) are independent
 * actions. They may not borrow the causing card's approach or its old payment.
 * Quote on a detached RNG first so an unaffordable automatic effect spends no
 * resources or samples, while its already-resolved defensive cause remains. */
export function acceptIndependentTrigger(ctx,source,actions,key) {
  if(!ctx.rangeState || !actions.some(action=>hostile.has(action.effect.op))) return actions;
  for(const action of actions) {
    const inherited=action.card?.rangeLineage;
    if(inherited)return actions;
    const range=action.effect.tags?.find(tag=>tag.startsWith('range:'))?.slice(6) || 'melee';
    action.card={...(action.card || {}),resolvedRangeSource:{sourceType:'spell',itemId:null,range,propertyTags:[]}};
    delete action.card.rangePlan;delete action.card.rangeLineagePlan;
    delete action.card.rangeCounterReservation;delete action.card.rangeReturnAuthorization;
  }
  const quoted=Engagement.quoteRangeActions(ctx,source,actions,{preview:true,context:null});
  if(!quoted.targets.length)return actions;
  const available=source.kind==='enemy' ? source.fixCoreStaminaRemaining ?? source.stamina ?? 0 : source.energy;
  if(!quoted.available || available<quoted.advanceSp) {
    ctx.emit?.('combatRangeActionUnavailable',{sourceId:source.id,ownerId:ctx.playerIdForEntity?.(source) || 'player',required:quoted.advanceSp,available,advanceSp:quoted.advanceSp,reason:'stamina',triggerKey:key});
    return actions.filter(action=>!hostile.has(action.effect.op));
  }
  const carrier=actions[0].card;
  const rootId=`${ctx.combatKey || 'combat'}:trigger:${++ctx.expansionActionSerial}`;
  const prior=ctx._rangeContext;delete ctx._rangeContext;
  try{Engagement.acceptRangeActions(ctx,source,actions,carrier,rootId);}
  finally{if(prior!==undefined)ctx._rangeContext=prior;}
  return actions;
}
