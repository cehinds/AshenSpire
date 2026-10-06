import { expandedProgression, classRewardBudget } from './classMilestones.js';
import { classMilestoneOptions } from './classMilestoneOffers.js';
import { classRewardGrants, classRewardPresent } from './classRewardProvenance.js';
import { abilityOfferPool } from './abilityOffers.js';
import { classTreeRows, tierOpensAt } from './classTree.js';
import { carriedIds, equipmentRequirementReceipt, fitsSlot } from './loadout.js';
import {mountRows} from './cardExtraction.js';
import {cardMountRules,isExtraMountKey,mountKey} from './cardMounts.js';
import { itemUpgradeTiers } from './itemUpgrades.js';
import { rebuildClassRespecResources } from './classRespecResources.js';
import { validateRunShape } from './state.js';

const copy = value => structuredClone(value);
const sourceOf = reg => reg.masterySource || reg;
const stateKey = run => { const {zones,collection,...owned}=run;return JSON.stringify(owned); };
const catalogueKey = reg => JSON.stringify([sourceOf(reg).cards.all(),sourceOf(reg).relics.all(),sourceOf(reg).classMastery,sourceOf(reg).classSkillFeats,sourceOf(reg).equipment,sourceOf(reg).classTree,reg.balance.progression]);
const ownedCard = (run,grant) => [...run.deck,...(run.sideboard || [])].find(inst => inst.instanceId === grant.selection?.instanceId && inst.rewardReceiptId === grant.id);
const grantIn = (run,id) => Object.values(run.classMilestones).flatMap(row => Object.values(row.grants)).find(grant => grant.id === id);
const itemPiece = (reg,ref) => ref.startsWith('armament/') ? reg.equipment.armaments.find(piece => piece.id === ref.slice(9)) : reg.equipment.armour.find(piece => `armor/${piece.classId}/${piece.id}` === ref);

export function classRespecAvailability(registries,run) {
  if (!expandedProgression(run)) return {ok:false,reason:'This run uses the earlier class rules.'};
  if (registries.balance.progression?.respec?.enabled === false) return {ok:false,reason:'Class respec is disabled in this run’s rules.'};
  if (run.classUnequipped) return {ok:false,reason:'Equip a class before rebuilding it.'};
  if (run.combatEntered) return {ok:false,reason:'Class respec is available between encounters.'};
  if (run.pendingReward) return {ok:false,reason:'Finish the pending reward before rebuilding your class.'};
  return {ok:true,reason:''};
}
export function classRespecCost(registries,override = undefined) {
  const configured = override === undefined ? registries.balance.progression.respec?.cost : override;
  if (configured == null || configured.enabled === false) return {enabled:false,amount:0,resource:null,label:'Free'};
  if (!['cinders','smithingStones','smithingStonesRefined'].includes(configured.resource) || !Number.isSafeInteger(configured.amount) || configured.amount < 0) throw new Error('Class respec cost must name an available purse and a non-negative whole amount.');
  return {enabled:true,resource:configured.resource,amount:configured.amount,label:`${configured.amount} ${configured.resource === 'cinders' ? 'Cinders' : configured.resource === 'smithingStones' ? 'Smithing Stones' : 'Refined Smithing Stones'}`};
}
export function createClassRespecDraft(registries,run,{meta = {},cost = undefined} = {}) {
  const availability = classRespecAvailability(registries,run);
  if (!availability.ok) return {...availability};
  const level = run.skills?.[`class:${run.class}`]?.level || 0;
  const grants = classRewardGrants(run).filter(grant => grant.level <= level);
  const slots = grants.map(grant => {
    const present = classRewardPresent(run,grant);
    const offer = run.classMilestoneOffers?.[grant.id];
    const ranks = grant.state === 'taken' ? [grant.selection?.abilityRank ?? null] : [...new Set(offer?.abilityRanks || [null])];
    return {receiptId:grant.id,kind:grant.kind,level:grant.level,state:present ? grant.state : 'spent',before:copy(grant.selection || null),ranks,offerId:offer?.receiptId || null,intelligenceSnapshot:offer?.intelligenceSnapshot ?? null};
  });
  const selections = Object.fromEntries(slots.filter(slot => slot.state !== 'spent' && slot.before).map(slot => [slot.receiptId,{id:slot.before.id,abilityRank:slot.before.abilityRank ?? null,transfer:'retain'}]));
  return {ok:true,classId:run.class,level,budgets:classRewardBudget(registries,level),treeBudget:(run.coreTags || []).length+(run.skills?.[`class:${run.class}`]?.pendingDrafts || 0)+(run.classMasteryState?.initialTreeTiers?.length || 0),
    slots,selections,treeNodes:[...(run.coreTags || [])],cost:classRespecCost(registries,cost),meta:copy(meta),baseKey:stateKey(run),catalogueKey:catalogueKey(registries)};
}

function removeGrantItem(candidate,grant) {
  const selection = grant.selection;
  if (!selection || grant.state !== 'taken') return;
  if (grant.kind === 'cards') {
    candidate.deck = candidate.deck.filter(inst => inst.instanceId !== selection.instanceId);
    candidate.sideboard = (candidate.sideboard || []).filter(inst => inst.instanceId !== selection.instanceId);
  } else if (grant.kind === 'relic') candidate.relics = candidate.relics.filter(id => id !== selection.id);
  else if (grant.kind === 'armory') {
    if (selection.id.startsWith('armor/')) {
      const [,classId,id] = selection.id.split('/');
      candidate.loadout.boughtArmour = (candidate.loadout.boughtArmour || []).filter(row => row.classId !== classId || row.id !== id);
      if (classId === candidate.class) candidate.loadout.sets.armor = candidate.loadout.sets.armor.map(value => value === id ? null : value);
    } else {
      const id = selection.id.slice(9);
      candidate.loadout.storage = candidate.loadout.storage.filter(value => value !== id);
      for (const [slot,values] of Object.entries(candidate.loadout.sets)) if (slot !== 'armor') candidate.loadout.sets[slot] = values.map(value => value === id ? null : value);
    }
  }
}
function transferItem(registries,candidate,grant,choice,original,transfers) {
  const oldRef = grant.kind === 'relic' ? `relic/${grant.selection?.id}` : grant.selection?.id;
  const newRef = grant.kind === 'relic' ? `relic/${choice.id}` : choice.id;
  if (!oldRef || oldRef === newRef) return;
  const tier = original.itemUpgradeLevels?.[oldRef] || (oldRef.startsWith('armament/') ? original.armamentLevels?.[oldRef.slice(9)] : 0) || 0;
  const mounts = original.itemMounts?.[oldRef],sigils = original.sigilSlots?.[oldRef];
  if (!tier && !mounts && !sigils) return;
  if (choice.transfer !== 'retain') throw new Error('Review and retain this item’s upgrades and components before exchanging it.');
  if (candidate.itemUpgradeLevels?.[newRef] || candidate.itemMounts?.[newRef] || candidate.sigilSlots?.[newRef]) throw new Error('The replacement has its own upgrade or component history. Choose another item.');
  if (tier && !itemUpgradeTiers(registries,newRef).includes(tier)) throw new Error('The replacement does not support the retained smithing tier.');
  if (mounts) {
    const oldPiece=itemPiece(registries,oldRef),newPiece=itemPiece(registries,newRef);
    if (!oldPiece || !newPiece || oldPiece.kind !== newPiece.kind) throw new Error('Mounted cards can transfer only between the same equipment kind.');
    const originalRows=mountRows(registries,original,{itemRef:oldRef,piece:oldPiece});
    const targetRows=mountRows(registries,candidate,{itemRef:newRef,piece:newPiece}).filter(row=>!row.extra),used=new Set(),mapped={};
    const rules=cardMountRules(registries);
    let extraIndex=0;
    for(const [key,entry] of Object.entries(mounts)){
      const originalRow=originalRows.find(row=>row.mountKey===key);
      if(!originalRow)throw new Error('A saved mount cannot be transferred safely.');
      const target=isExtraMountKey(key)?{mountKey:mountKey.extra(newRef,extraIndex++),kind:rules.extraMounts.kind,accepts:rules.kinds[rules.extraMounts.kind].accepts}:targetRows.find(row=>row.kind===originalRow.kind&&!used.has(row.mountKey));
      if(!target || extraIndex>rules.extraMounts.perItem || (entry.card && !target.accepts.some(tag=>(registries.cards.get(entry.card)?.tags || []).includes(tag))))throw new Error('The replacement has no compatible mount for every retained card.');
      used.add(target.mountKey);mapped[target.mountKey]=copy(entry);
    }
    candidate.itemMounts ||= {};candidate.itemMounts[newRef]=mapped;delete candidate.itemMounts[oldRef];
  }
  if (sigils) { candidate.sigilSlots[newRef]=copy(sigils);delete candidate.sigilSlots[oldRef]; }
  if (tier) { candidate.itemUpgradeLevels[newRef]=tier;delete candidate.itemUpgradeLevels[oldRef];if(candidate.armamentLevels)delete candidate.armamentLevels[oldRef.slice(9)]; }
  transfers.push({from:oldRef,to:newRef,tier,mounts:copy(mounts || null),sigils:copy(sigils || null)});
}
function moveUnusableEquipment(registries,candidate,displaced) {
  for (const [slot,values] of Object.entries(candidate.loadout.sets)) for (let index=0;index<values.length;index++) {
    const id=values[index];if(!id)continue;
    const ref=slot==='armor'?`armor/${candidate.class}/${id}`:`armament/${id}`;
    const piece=itemPiece(registries,ref);
    if (piece && equipmentRequirementReceipt(registries,piece,candidate.attributes,candidate).ok) continue;
    values[index]=null;displaced.push({ref,slot,index,destination:slot==='armor'?'Owned armour':'Inventory'});
    if (slot!=='armor' && !candidate.loadout.storage.includes(id)) candidate.loadout.storage.push(id);
  }
  const cap=registries.balance.equipment.storageSlots;
  if (candidate.loadout.storage.length > cap) throw new Error(`Inventory needs ${candidate.loadout.storage.length-cap} more space before applying this build.`);
}
export function classRespecOptions(registries,run,draft,slot,{attributes = run.attributes,loadout = run.loadout} = {}) {
  if (slot.state==='spent') return [];
  const without=copy(run);without.attributes=copy(attributes);without.loadout=copy(run.loadout);
  for (const grant of classRewardGrants(run)) if (classRewardPresent(run,grant) && ['cards','relic','armory'].includes(grant.kind)) removeGrantItem(without,grant);
  // Eligibility must see the proposed hands, even while ownership checks see
  // an inventory with all exchangeable grants removed.
  if (slot.kind !== 'armory') without.loadout.sets=copy(loadout.sets);
  const classFeats=new Set(classRewardGrants(run).filter(grant=>grant.kind==='feat'&&grant.state==='taken').map(grant=>grant.selection.id));
  without.skillFeats=(without.skillFeats || []).filter(id=>!classFeats.has(id));
  const ids=classMilestoneOptions(registries,without,slot.kind,draft.level,draft.meta);
  if (slot.kind!=='cards') return ids.map(id=>({id,abilityRank:null}));
  const source=sourceOf(registries);
  return ids.flatMap(id=>{
    const card=source.cards.get(id);
    if (!card.gradeProfiles) return slot.ranks.includes(null)?[{id,abilityRank:null}]:[];
    const skill=card.abilityKind==='spell'?'item:magic-focus':'combatManeuvers';
    return slot.ranks.filter(Number.isInteger).filter(rank=>abilityOfferPool(registries,without,skill,rank,{classLevel:draft.level}).includes(id)).map(abilityRank=>({id,abilityRank}));
  });
}
export function previewClassRespec(registries,run,draft,{selections = draft.selections,treeNodes = draft.treeNodes} = {}) {
  const problems=[],changes=[],displaced=[],transfers=[];
  if(!draft || !selections || typeof selections!=='object' || Array.isArray(selections) || !Array.isArray(treeNodes) || treeNodes.some(id=>typeof id!=='string') || Object.values(selections).some(choice=>!choice || typeof choice.id!=='string' || (choice.abilityRank!=null && (!Number.isInteger(choice.abilityRank)||choice.abilityRank<0||choice.abilityRank>5))))return {ok:false,problems:['The proposed build has malformed choices.']};
  if (!draft.ok) return {ok:false,problems:[draft.reason || 'No respec is open.']};
  if (draft.baseKey!==stateKey(run) || draft.catalogueKey!==catalogueKey(registries)) return {ok:false,problems:['The run or catalogue changed. Reopen class respec.']};
  const availability=classRespecAvailability(registries,run);
  if (!availability.ok) return {ok:false,problems:[availability.reason]};
  const candidate=copy(run),source=sourceOf(registries);
  const selected=copy(selections),nodes=copy(treeNodes);
  const byId=new Map(draft.slots.map(slot=>[slot.receiptId,slot]));
  if (Object.keys(selected).some(id=>!byId.has(id)||byId.get(id).state==='spent')) problems.push('A selection has no exchangeable earned slot.');
  const ownFeats=new Set(classRewardGrants(run).filter(grant=>grant.kind==='feat'&&grant.state==='taken').map(grant=>grant.selection.id));
  candidate.skillFeats=(candidate.skillFeats || []).filter(id=>!ownFeats.has(id));
  for (const slot of draft.slots) if(slot.kind==='attribute' && slot.state==='taken') candidate.attributes[slot.before.id]-=1;
  for (const slot of draft.slots) if(slot.kind==='attribute' && slot.state!=='spent' && selected[slot.receiptId]) candidate.attributes[selected[slot.receiptId].id]=(candidate.attributes[selected[slot.receiptId].id] || 0)+1;
  for (const [id,value] of Object.entries(candidate.attributes)) if(!Number.isSafeInteger(value)||value<1)problems.push(`${id} would fall below its minimum.`);
  const tree=classTreeRows(source,run.class),picked=new Set(nodes);
  if(!Array.isArray(nodes)||picked.size!==nodes.length||nodes.length>draft.treeBudget)problems.push('The class tree exceeds its earned point budget.');
  for(const id of nodes){const row=tree.find(row=>row.nodeId===id),rule=source.propertyRules.has(id)?source.propertyRules.get(id):null;
    if(!row||draft.level<tierOpensAt(registries,row.tier)||!rule||(rule.requires || []).some(required=>!picked.has(required))||(rule.excludes || []).some(excluded=>picked.has(excluded)))problems.push(`The completed tree does not permit ${id}.`);
  }
  if(problems.length)return {ok:false,problems,draft};
  candidate.coreTags=nodes;
  const spent=[];
  for(const grant of classRewardGrants(run)) if(!classRewardPresent(run,grant) && grant.state==='taken') {grantIn(candidate,grant.id).state='spent';grantIn(candidate,grant.id).spentReason='no longer owned';spent.push(grant.id);}
  for(const slot of draft.slots){
    if(slot.state==='spent')continue;
    const choice=selected[slot.receiptId];
    if(!choice){if(slot.state==='taken')problems.push(`Choose a replacement for ${slot.receiptId}.`);continue;}
    if(slot.kind==='cards' && !slot.ranks.includes(choice.abilityRank??null)){problems.push('A card exceeds its original earned grade.');continue;}
    const grant=classRewardGrants(run).find(grant=>grant.id===slot.receiptId);
    if(['cards','relic','armory'].includes(slot.kind))removeGrantItem(candidate,grant);
  }
  for(const slot of draft.slots){
    const choice=selected[slot.receiptId];if(slot.state==='spent'||!choice)continue;
    const grant=classRewardGrants(run).find(grant=>grant.id===slot.receiptId),record=grantIn(candidate,slot.receiptId);
    try {
      if(slot.kind==='armory') {
        const piece=itemPiece(source,choice.id);if(!piece)throw new Error('Unknown equipment.');
        transferItem(source,candidate,grant,choice,run,transfers);
        if(choice.id.startsWith('armor/')) {const [,classId,id]=choice.id.split('/');candidate.loadout.boughtArmour ||= [];if(candidate.loadout.boughtArmour.some(row=>row.classId===classId&&row.id===id))throw new Error('The replacement armour is already independently owned.');candidate.loadout.boughtArmour.push({classId,id});}
        else {const id=choice.id.slice(9);if(carriedIds(candidate.loadout).includes(id))throw new Error('The replacement armament is already owned.');
          let placed=false;
          if(slot.before?.id?.startsWith('armament/')) for(const [slotId,values] of Object.entries(run.loadout.sets)) for(let index=0;index<values.length;index++) if(values[index]===slot.before.id.slice(9) && fitsSlot(source.equipment.slots.find(row=>row.id===slotId),piece)){candidate.loadout.sets[slotId][index]=id;placed=true;}
          if(!placed)candidate.loadout.storage.push(id);
        }
      }
    }catch(error){problems.push(error.message);}
    if(slot.kind==='attribute')record.selection={id:choice.id,abilityRank:null};
  }
  try{moveUnusableEquipment(source,candidate,displaced);}catch(error){problems.push(error.message);}
  const used={feat:new Set(),relic:new Set(),armory:new Set()};
  const revision=(run.classRespecReceipts || []).length+1,respecId=`respec:${run.class}:${revision}`;
  for(const slot of draft.slots){
    const choice=selected[slot.receiptId];if(slot.state==='spent'||!choice)continue;
    const options=classRespecOptions(registries,run,draft,slot,{attributes:candidate.attributes,loadout:candidate.loadout});
    const eligible=options.some(option=>option.id===choice.id&&(option.abilityRank??null)===(choice.abilityRank??null));
    const retainedCard=slot.kind==='cards'&&slot.state==='taken'&&slot.before?.id===choice.id&&(slot.before.abilityRank??null)===(choice.abilityRank??null);
    if(!eligible&&!retainedCard)problems.push(`The proposed build cannot receive ${choice.id}.`);
    if(used[slot.kind]?.has(choice.id))problems.push('Two earned slots cannot select the same feat, relic or equipment.');used[slot.kind]?.add(choice.id);
    const grant=classRewardGrants(run).find(grant=>grant.id===slot.receiptId),record=grantIn(candidate,slot.receiptId);
    if (!Object.hasOwn(record,'originalSelection')) record.originalSelection=copy(grant.selection || null);
    const selection={id:choice.id,abilityRank:choice.abilityRank??null,choiceId:`${choice.id}${Number.isInteger(choice.abilityRank)?'@'+choice.abilityRank:''}`};
    if(slot.kind==='cards'){
      const previous=ownedCard(run,grant),instanceId=previous?.instanceId || `respec-card:${slot.receiptId}`;
      if(previous&&(previous.upgraded||previous.mods?.length||previous.smithingLevel) && choice.transfer!=='retain')problems.push('Review the card upgrade and component transfer before confirming.');
      const inst={...(previous || {}),instanceId,cardId:choice.id,upgraded:previous?.upgraded || false,rewardReceiptId:slot.receiptId};
      if(Number.isInteger(choice.abilityRank)){inst.abilityRank=choice.abilityRank;delete inst.rank;}
      else delete inst.abilityRank;
      ((!eligible||(run.sideboard || []).some(card=>card.instanceId===instanceId))?candidate.sideboard:candidate.deck).push(inst);
      selection.instanceId=instanceId;
      if(previous&&(previous.upgraded||previous.mods?.length||previous.smithingLevel))transfers.push({from:previous.cardId,to:choice.id,instanceId,upgraded:previous.upgraded,mods:copy(previous.mods || [])});
    }else if(slot.kind==='relic'){
      if(candidate.relics.includes(choice.id))problems.push('The replacement relic is already independently owned.');else candidate.relics.push(choice.id);
      try{transferItem(source,candidate,grant,choice,run,transfers);}catch(error){problems.push(error.message);}
    }else if(slot.kind==='feat')candidate.skillFeats.push(choice.id);
    record.state='taken';record.selection=selection;record.respecReceiptId=respecId;
    changes.push({receiptId:slot.receiptId,kind:slot.kind,before:slot.before?.id || 'Unassigned',after:choice.id,abilityRank:selection.abilityRank});
  }
  if(problems.length)return {ok:false,problems,changes,displaced,transfers,draft};
  const oldAttributes=draft.slots.filter(slot=>slot.kind==='attribute'&&slot.state==='taken').length;
  const newAttributes=draft.slots.filter(slot=>slot.kind==='attribute'&&slot.state!=='spent'&&selected[slot.receiptId]).length;
  candidate.skillAttributePoints=(run.skillAttributePoints || 0)-oldAttributes+newAttributes;
  candidate.skills[`class:${run.class}`].pendingDrafts=draft.treeBudget-nodes.length;
  candidate.classMasteryState.initialTreeTiers=[];
  if(candidate.classCards?.[run.class])candidate.classCards[run.class].coreTags=[...nodes];
  candidate.classRespecReceipts=[...(run.classRespecReceipts || []),{id:respecId,classId:run.class,level:draft.level,changes:copy(changes),treeBefore:[...(run.coreTags || [])],treeAfter:[...nodes],cost:copy(draft.cost),spent,transfers:copy(transfers)}];
  if(draft.cost.enabled){if(!Number.isSafeInteger(candidate[draft.cost.resource])||candidate[draft.cost.resource]<draft.cost.amount)problems.push(`Not enough ${draft.cost.label}.`);else candidate[draft.cost.resource]-=draft.cost.amount;}
  try{rebuildClassRespecResources(registries,candidate,run);problems.push(...validateRunShape(candidate));}catch(error){problems.push(error.message);}
  return {ok:problems.length===0,problems,draft,selections:selected,treeNodes:nodes,candidate,changes,displaced,transfers,spent,cost:draft.cost,budgets:draft.budgets};
}
export function applyClassRespec(registries,run,preview,{saveCandidate} = {}) {
  if(!preview?.ok)return {ok:false,reason:preview?.problems?.[0] || 'Review a valid replacement build first.'};
  if(typeof saveCandidate!=='function')return {ok:false,reason:'A save owner must commit this build.'};
  const checked=previewClassRespec(registries,run,preview.draft,{selections:preview.selections,treeNodes:preview.treeNodes});
  if(!checked.ok)return {ok:false,reason:checked.problems[0]};
  const committed=copy(checked.candidate);
  try{if(saveCandidate(committed)===false)return {ok:false,reason:'The replacement build could not be saved.'};}catch(error){return {ok:false,reason:error.message};}
  for(const key of Object.keys(run))delete run[key];Object.assign(run,committed);
  return {ok:true,receipt:run.classRespecReceipts.at(-1)};
}
export const cancelClassRespec = () => ({ok:true,cancelled:true});

// A transport-safe presentation: no mutable run, saved candidate or authority
// token crosses from a co-op host into a client-controlled form.
export function classRespecView(registries,run,draft,input = {}) {
  const preview=previewClassRespec(registries,run,draft,input);
  const proposed=preview.candidate || run;
  return {draft:{classId:draft.classId,level:draft.level,budgets:draft.budgets,treeBudget:draft.treeBudget,treeBefore:[...draft.treeNodes],slots:draft.slots,cost:draft.cost},
    selections:copy(input.selections || draft.selections),treeNodes:copy(input.treeNodes || draft.treeNodes),
    options:Object.fromEntries(draft.slots.map(slot=>{
      const options=classRespecOptions(registries,run,draft,slot,{attributes:proposed.attributes,loadout:proposed.loadout});
      // Ownership survives losing the prerequisites. Keep the original face
      // selectable without presenting it as an eligible replacement grant.
      if(slot.kind==='cards'&&slot.state==='taken'&&slot.before&&!options.some(choice=>choice.id===slot.before.id&&(choice.abilityRank??null)===(slot.before.abilityRank??null)))options.push({id:slot.before.id,abilityRank:slot.before.abilityRank??null,retainInSideboard:true});
      return [slot.receiptId,options];
    })),
    treeOptions:classTreeRows(sourceOf(registries),run.class).filter(row=>draft.level>=tierOpensAt(registries,row.tier)).map(row=>({...row,label:registries.nodes.find(node=>node.id===row.nodeId)?.label || row.nodeId,description:registries.nodes.find(node=>node.id===row.nodeId)?.description || ''})),
    preview:{ok:preview.ok,problems:preview.problems,changes:preview.changes || [],displaced:preview.displaced || [],transfers:preview.transfers || [],spent:preview.spent || [],cost:draft.cost}};
}

// Expanded saves always open the reviewed class rebuild instead of clearing
// their tree in place. Older callers may supply their existing reset owner.
export function resetClassTree(registries,run,{openRespec,legacyReset}={}) {
  if(expandedProgression(run)){const availability=classRespecAvailability(registries,run);if(!availability.ok)return availability;if(typeof openRespec!=='function')return {ok:false,reason:'Open class respec to rebuild this tree.'};return openRespec();}
  return typeof legacyReset==='function'?legacyReset():{ok:false,reason:'This run uses the earlier class tree rules.'};
}
