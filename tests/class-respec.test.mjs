import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState,serializeRun,deserializeRun,validateRunShape,initializeRunDerivedStats} from '../src/model/state.js';
import {openRunClassMastery,registriesForClassMastery} from '../src/model/classMasteryRun.js';
import {bankSkillXp,claimBankedSkillLevel,xpToNext} from '../src/model/skills.js';
import {rollClassMilestoneRewards,claimClassMilestoneReward} from '../src/model/classMilestoneOffers.js';
import {createClassRespecDraft,previewClassRespec,applyClassRespec,cancelClassRespec,classRespecOptions,classRespecView} from '../src/model/classRespec.js';
import {removeOwnedRelic} from '../src/model/classRewardProvenance.js';
import {removeDeckCard} from '../src/model/cardRemoval.js';
import {armamentSalePlan,commitArmamentSale} from '../src/model/armamentTrading.js';
import {createSession,restoreSession} from '../tools/session.mjs';
import {itemUpgradeTiers} from '../src/model/itemUpgrades.js';
import {mountRows} from '../src/model/cardExtraction.js';
import {createRng} from '../src/engine/rng.js';

const root=createRegistries(contentBundle);
function built(level=12){
  const run=createRunState({registries:root,classId:'reaver',seed:6,enemyKnowledgeVersion:null});
  openRunClassMastery(root,run,{}, {receiptId:'respec'});
  const reg=registriesForClassMastery(root,run),rng=createRng(6);
  for(let at=1;at<=level;at++){
    const cost=xpToNext(reg,'class',at-1);bankSkillXp(reg,run,'class:reaver',cost);run.classMasteryState.earnedXp.reaver+=cost;
    claimBankedSkillLevel(reg,run,'class:reaver');
    for(const offer of rollClassMilestoneRewards(reg,rng,run)) {
      const choice=(offer.choiceIds || offer.options)[0];
      assert.equal(claimClassMilestoneReward(reg,run,offer.receiptId,choice,{collectEquipment:ref=>{
        if(ref.startsWith('armament/'))run.loadout.storage.push(ref.slice(9));
        else {const [,classId,id]=ref.split('/');run.loadout.boughtArmour ||= [];run.loadout.boughtArmour.push({classId,id});}
        return true;
      }}),true);
    }
  }
  return {run,reg,rng};
}
const xpState=run=>Object.fromEntries(Object.entries(run.skills).map(([id,row])=>[id,{level:row.level,xp:row.xp}]));

test('level 12 and 20 respec have their original budgets and preserve ledgers/resources through a saved atomic apply',()=>{
  for(const level of [12,20]){
    const {run,reg,rng}=built(level),draft=createClassRespecDraft(reg,run);
    assert.deepEqual(draft.budgets,level===12?{cards:6,feat:4,armory:4,relic:3,attribute:2}:{cards:10,feat:6,armory:6,relic:6,attribute:4});
    assert.equal(draft.cost.label,'Free');
    run.hp=Math.max(1,run.hp-5);run.mana=0;run.stamina=0;run.flaskCharges.hpCurrent=0;
    const updated=createClassRespecDraft(reg,run),before=structuredClone(run),counters=rng.getCounters();
    const preview=previewClassRespec(reg,run,updated);
    assert.equal(preview.ok,true,preview.problems?.join('\n'));
    let saved=null;
    assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:candidate=>{saved=serializeRun(candidate);}}).ok,true);
    assert.deepEqual(xpState(run),xpState(before));
    assert.deepEqual(run.classMasteryState.profile,before.classMasteryState.profile);
    assert.deepEqual(run.classMasteryState.earnedXp,before.classMasteryState.earnedXp);
    assert.deepEqual(rng.getCounters(),counters);
    assert.equal(run.hp,before.hp);assert.equal(run.mana,0);assert.equal(run.stamina,0);
    assert.deepEqual(run.flaskCharges,before.flaskCharges);
    const restored=deserializeRun(saved);assert.deepEqual(validateRunShape(restored),[]);
    assert.doesNotThrow(()=>initializeRunDerivedStats(restored,reg,{preserveDeficits:true}));
  }
});

test('a later unlocked catalogue can replace an early feat without adding slots or erasing independent cards',()=>{
  const {run,reg}=built(12),draft=createClassRespecDraft(reg,run);
  const slot=draft.slots.find(slot=>slot.kind==='feat');
  const later=classRespecOptions(reg,run,draft,slot).find(option=>root.classMastery.some(row=>row.ref===option.id&&row.level===8));
  assert.ok(later);
  const originalCard=structuredClone(run.deck[0]);
  const selections=structuredClone(draft.selections);selections[slot.receiptId]=later;
  const other=draft.slots.find(row=>row.kind==='feat'&&row.before?.id===later.id);
  if(other)selections[other.receiptId]={id:slot.before.id,abilityRank:null};
  const preview=previewClassRespec(reg,run,draft,{selections});
  assert.equal(preview.ok,true,preview.problems?.join('\n'));
  assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>true}).ok,true);
  assert.equal(run.skillFeats.length,draft.budgets.feat);
  assert.ok(run.skillFeats.includes(later.id));
  const preserved=run.deck.find(card=>card.instanceId===originalCard.instanceId);
  for(const key of ['instanceId','cardId','upgraded','rank','abilityRank','mods'])assert.deepEqual(preserved[key],originalCard[key]);
  assert.deepEqual(validateRunShape(deserializeRun(serializeRun(run))),[]);
});

test('sold relics, removed cards and sold gear remain spent after an independent same-ID reacquisition',()=>{
  const {run,reg}=built(12),grants=Object.values(run.classMilestones).flatMap(row=>Object.entries(row.grants).map(([kind,grant])=>({...grant,kind})));
  const relic=grants.find(grant=>grant.kind==='relic');
  assert.equal(removeOwnedRelic(run,relic.selection.id,{reason:'sold'}),true);
  run.relics.push(relic.selection.id);
  const card=grants.find(grant=>grant.kind==='cards');
  assert.equal(removeDeckCard(run,card.selection.instanceId),true);
  const gear=grants.find(grant=>grant.kind==='armory'&&grant.selection.id.startsWith('armament/'));
  if(gear){run.shopStock={kind:'market',offerings:[],tradeRevision:0};const quote=armamentSalePlan(reg,run,gear.selection.id.slice(9));assert.equal(quote.ok,true,quote.reason);commitArmamentSale(reg,run,quote);run.loadout.storage.push(gear.selection.id.slice(9));}
  const draft=createClassRespecDraft(reg,run);
  assert.equal(draft.slots.find(slot=>slot.receiptId===relic.id).state,'spent');
  assert.equal(draft.slots.find(slot=>slot.receiptId===card.id).state,'spent');
  const count=run.deck.length,preview=previewClassRespec(reg,run,draft);
  assert.equal(preview.ok,true,preview.problems?.join('\n'));
  assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>true}).ok,true);
  assert.ok(run.relics.includes(relic.selection.id));assert.equal(run.deck.length,count);
});

test('cancel, stale preview, invalid selection and refused saves never mutate or charge the run',()=>{
  const {run,reg}=built(12);run.cinders=100;
  const draft=createClassRespecDraft(reg,run,{cost:{enabled:true,resource:'cinders',amount:25}}),before=serializeRun(run);
  assert.equal(draft.cost.label,'25 Cinders');
  const preview=previewClassRespec(reg,run,draft);
  assert.equal(preview.ok,true,preview.problems?.join('\n'));
  assert.equal(cancelClassRespec().cancelled,true);assert.equal(serializeRun(run),before);
  assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>false}).ok,false);assert.equal(serializeRun(run),before);
  assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>{throw new Error('quota');}}).reason,'quota');assert.equal(serializeRun(run),before);
  run.attributes.intelligence+=1;
  const stale=serializeRun(run);assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>true}).ok,false);assert.equal(serializeRun(run),stale);
  run.attributes.intelligence-=1;
  assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>true}).ok,true);assert.equal(run.cinders,75);
  assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>true}).ok,false);assert.equal(run.cinders,75);
});

test('final composed inventory capacity and malformed builds refuse without mutation',()=>{
  const {run,reg}=built(12);
  const balance={...reg.balance,equipment:{...reg.balance.equipment,storageSlots:0}},limited={...reg,balance,masterySource:{...reg.masterySource,balance}};
  const draft=createClassRespecDraft(limited,run),before=serializeRun(run);
  const overfull=previewClassRespec(limited,run,draft);
  assert.equal(overfull.ok,false);assert.match(overfull.problems.join(' '),/Inventory needs/);
  assert.equal(applyClassRespec(limited,run,overfull,{saveCandidate:()=>true}).ok,false);assert.equal(serializeRun(run),before);
  const valid=createClassRespecDraft(reg,run);
  const malformed=previewClassRespec(reg,run,valid,{treeNodes:[42]});assert.equal(malformed.ok,false);
  const selections=structuredClone(valid.selections),slot=valid.slots.find(row=>row.kind==='cards');selections[slot.receiptId]={id:'absent',abilityRank:99};
  assert.equal(previewClassRespec(reg,run,valid,{selections}).ok,false);assert.equal(serializeRun(run),before);
});

test('original earned card grades and INT offers cannot reroll or raise after INT growth',()=>{
  const {run,reg}=built(12),slotId=Object.values(run.classMilestones).flatMap(row=>Object.values(row.grants)).find(grant=>grant.selection?.instanceId).id;
  const grant=Object.values(run.classMilestones).flatMap(row=>Object.values(row.grants)).find(grant=>grant.id===slotId),offer=run.classMilestoneOffers[slotId];
  const card=run.deck.find(card=>card.instanceId===grant.selection.instanceId);
  const original=reg.masterySource.cards.get(card.cardId);
  const ranked={...original,abilityKind:'maneuver',source:'unarmed',gradeProfiles:[0,1,2,3,4,5].map(rank=>({rank,actionCost:rank?1:0,manaCost:0,effects:original.effects,textTemplate:original.textTemplate}))};
  const cards={...reg.masterySource.cards,get:id=>id===card.cardId?ranked:reg.masterySource.cards.get(id),all:()=>reg.masterySource.cards.all().map(row=>row.id===card.cardId?ranked:row)};
  const source={...reg.masterySource,cards},fixture={...reg,masterySource:source,cards};
  card.abilityRank=3;grant.selection.abilityRank=3;grant.selection.choiceId=card.cardId+'@3';offer.abilityRanks=offer.options.map(id=>id===card.cardId?3:null);offer.choiceIds=offer.options.map((id,index)=>offer.abilityRanks[index]===null?id:id+'@3');
  run.attributes.intelligence+=10;
  const stored=structuredClone(offer),draft=createClassRespecDraft(fixture,run);
  assert.deepEqual(draft.slots.find(row=>row.receiptId===slotId).ranks,[3]);
  const selections=structuredClone(draft.selections);selections[slotId].abilityRank=5;
  assert.equal(previewClassRespec(fixture,run,draft,{selections}).ok,false);
  assert.deepEqual(run.classMilestoneOffers[slotId],stored);
  const preview=previewClassRespec(fixture,run,draft);assert.equal(preview.ok,true,preview.problems.join(' '));
  assert.equal(applyClassRespec(fixture,run,preview,{saveCandidate:()=>true}).ok,true);
  assert.equal(run.deck.find(row=>row.instanceId===card.instanceId).abilityRank,3);
  assert.deepEqual(run.classMilestoneOffers[slotId],stored);
});

test('host-owned respec persists a single seat atomically without changing another seat or shared RNG',()=>{
  const S=createSession({registries:root,seedString:'RESPEC'});
  for(const id of ['a','b'])S.addMember({id,name:id,classId:'reaver',classMastery:{}});
  S.start();
  const builtSeat=built(12);Object.assign(S.session.members.get('a').run,builtSeat.run);
  const before=structuredClone(S.serialize()),other=structuredClone(S.session.members.get('b').run);
  const opened=S.previewMemberClassRespec('a');assert.equal(opened.ok,true);
  const view=opened.view;assert.equal(view.draft.cost.label,'Free');assert.equal(view.draft.baseKey,undefined);assert.equal(view.candidate,undefined);
  assert.equal(S.applyMemberClassRespec('b',view.draftId,{saveSession:()=>true}).ok,false);
  assert.equal(S.applyMemberClassRespec('a',view.draftId,{saveSession:()=>false}).ok,false);
  assert.deepEqual(S.serialize(),before);
  let saved=null;
  assert.equal(S.applyMemberClassRespec('a',view.draftId,{saveSession:data=>{saved=structuredClone(data);return true;}}).ok,true);
  assert.deepEqual(S.session.members.get('b').run,other);assert.deepEqual(S.serialize().rng,before.rng);
  const restored=restoreSession(root,saved);assert.equal(restored.refusedMembers().length,0);assert.equal(restored.session.members.get('a').run.classRespecReceipts.length,1);
  assert.equal(S.applyMemberClassRespec('a',view.draftId,{saveSession:()=>true}).ok,false);
  const next=S.previewMemberClassRespec('a');assert.equal(S.cancelMemberClassRespec('a',next.view.draftId).ok,true);assert.equal(S.snapshot().party.find(row=>row.id==='a').classRespec,undefined);
});

test('attribute rebuild displaces unusable independent equipment without losing it or healing',()=>{
  const {run,reg}=built(12);
  const slot=Object.keys(run.loadout.sets).find(id=>id!=='armor'&&run.loadout.sets[id].some(Boolean));
  assert.ok(slot);const index=run.loadout.sets[slot].findIndex(Boolean),id=run.loadout.sets[slot][index];
  const equipment={...reg.masterySource.equipment,armaments:reg.masterySource.equipment.armaments.map(piece=>piece.id===id?{...piece,requirements:{attributes:{strength:run.attributes.strength+1}}}:piece)};
  const source={...reg.masterySource,equipment},fixture={...reg,masterySource:source,equipment};
  run.hp=1;run.mana=0;run.stamina=0;
  const draft=createClassRespecDraft(fixture,run),preview=previewClassRespec(fixture,run,draft);
  assert.equal(preview.ok,true,preview.problems.join(' '));assert.ok(preview.displaced.some(row=>row.ref==='armament/'+id));
  assert.equal(applyClassRespec(fixture,run,preview,{saveCandidate:()=>true}).ok,true);
  assert.equal(run.loadout.sets[slot][index],null);assert.ok(run.loadout.storage.includes(id));
  assert.equal(run.hp,1);assert.equal(run.mana,0);assert.equal(run.stamina,0);
});

test('earned offer snapshots and class provenance survive repeated rebuilds and a class swap',()=>{
  const {run,reg}=built(12),offers=structuredClone(run.classMilestoneOffers);
  for(let index=0;index<2;index++){
    const draft=createClassRespecDraft(reg,run),preview=previewClassRespec(reg,run,draft);
    assert.equal(preview.ok,true,preview.problems.join(' '));assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>true}).ok,true);
    assert.deepEqual(run.classMilestoneOffers,offers);assert.deepEqual(validateRunShape(deserializeRun(serializeRun(run))),[]);
  }
  run.class='herald';assert.deepEqual(validateRunShape(run),[],'respec provenance belongs to its earned class after equipping another class');
});

test('unchanged earned graded cards remain owned in the sideboard and remain visibly selected when the final build cannot use them',async()=>{
  const {run,reg}=built(12),grant=Object.values(run.classMilestones).flatMap(row=>Object.values(row.grants)).find(grant=>grant.selection?.instanceId);
  const card=run.deck.find(card=>card.instanceId===grant.selection.instanceId),independent=structuredClone(run.deck.filter(row=>row.instanceId!==card.instanceId));
  const replacement=reg.masterySource.classes.get(run.class).cardPool.find(id=>id!==card.cardId);
  const defs=new Map([card.cardId,replacement].map(id=>{const original=reg.masterySource.cards.get(id);return [id,{...original,abilityKind:'maneuver',tags:['source:unarmed'],gradeProfiles:Array.from({length:6},(_,rank)=>({rank,actionCost:1,manaCost:0,effects:original.effects})),requirements:{attributes:{strength:99}}}];}));
  const cards={...reg.masterySource.cards,get:id=>defs.get(id)||reg.masterySource.cards.get(id),all:()=>reg.masterySource.cards.all().map(row=>defs.get(row.id)||row)};
  const fixture={...reg,cards,masterySource:{...reg.masterySource,cards}};
  card.abilityRank=2;grant.selection.abilityRank=2;grant.selection.choiceId=card.cardId+'@2';
  const offer=run.classMilestoneOffers[grant.id];offer.abilityRanks=offer.options.map(id=>id===card.cardId?2:null);offer.choiceIds=offer.options.map((id,index)=>Number.isInteger(offer.abilityRanks[index])?id+'@'+offer.abilityRanks[index]:id);
  const draft=createClassRespecDraft(fixture,run),preview=previewClassRespec(fixture,run,draft);
  const view=classRespecView(fixture,run,draft),choices=view.options[grant.id],retained=choices.find(choice=>choice.id===card.cardId&&choice.abilityRank===2);
  assert.equal(retained.retainInSideboard,true);assert.ok(!classRespecOptions(fixture,run,draft,draft.slots.find(slot=>slot.receiptId===grant.id)).some(choice=>choice.id===card.cardId),'the display exception does not authorize a new grant');
  assert.equal(preview.ok,true,preview.problems.join(' '));assert.equal(preview.candidate.sideboard.find(row=>row.instanceId===card.instanceId).abilityRank,2);
  assert.equal(preview.candidate.deck.some(row=>row.instanceId===card.instanceId),false);
  const owned=[...preview.candidate.deck,...preview.candidate.sideboard];
  for(const original of independent)assert.ok(owned.some(row=>row.instanceId===original.instanceId&&row.cardId===original.cardId),'every independent card keeps its owned identity');
  const selections=structuredClone(draft.selections);selections[grant.id]={id:replacement,abilityRank:2};
  assert.equal(previewClassRespec(fixture,run,draft,{selections}).ok,false,'a replacement still needs the final build requirements');
  const {rewardDom}=await import('./helpers/reward-dom.mjs'),dom=rewardDom(),saved=Object.fromEntries(Object.keys(dom).map(key=>[key,globalThis[key]]));Object.assign(globalThis,dom);
  let closeClassRespec;
  try{
    document.addEventListener=(...args)=>window.addEventListener(...args);document.removeEventListener=(...args)=>window.removeEventListener(...args);
    document.getElementById=id=>document.querySelector('#'+id);
    Object.defineProperty(document.body.constructor.prototype,'childElementCount',{get(){return this.children.length;}});
    const component=await import('../src/ui/components/classRespec.js');closeClassRespec=component.closeClassRespec;
    const {mountClassRespec}=component;
    mountClassRespec({registries:fixture,view,onApply:()=>({ok:true})});
    const select=document.querySelector('#respec-'+grant.id.replace(/[^a-z0-9]/gi,'-'));
    assert.ok(select);assert.equal(select.value,card.cardId+'@2');
    assert.match(select.children.find(option=>option.getAttribute('value')===select.value).textContent,/Retain in sideboard/);
  }finally{closeClassRespec?.({silent:true});Object.assign(globalThis,saved);}
  assert.equal(applyClassRespec(fixture,run,preview,{saveCandidate:()=>true}).ok,true);assert.deepEqual(validateRunShape(run),[]);
});

test('resource-modifying relic exchanges use the saved birth rules and never restore drained pools',()=>{
  const {run,reg}=built(12),draft=createClassRespecDraft(reg,run),slot=draft.slots.find(row=>row.kind==='relic');
  const options=classRespecOptions(reg,run,draft,slot),replacement=options.find(option=>!run.relics.includes(option.id));
  assert.ok(replacement);
  const def={...root.relics.get(replacement.id),passives:{modifiers:[{tag:'resource.flat',resource:'hp',amount:7}]}},relics={...reg.masterySource.relics,get:id=>id===replacement.id?def:reg.masterySource.relics.get(id),all:()=>reg.masterySource.relics.all().map(row=>row.id===replacement.id?def:row)},fixture={...reg,relics,masterySource:{...reg.masterySource,relics}};
  run.hp=1;run.mana=0;run.stamina=0;const fresh=createClassRespecDraft(fixture,run),selections=structuredClone(fresh.selections);selections[slot.receiptId]=replacement;
  const preview=previewClassRespec(fixture,run,fresh,{selections});assert.equal(preview.ok,true,preview.problems.join(' '));
  assert.deepEqual(preview.candidate.derivedStatRuleSnapshot.baseRules,run.derivedStatRuleSnapshot.baseRules);
  assert.ok(preview.candidate.derivedStatRuleSnapshot.relicModifiers.sources.some(row=>row.relicId===replacement.id&&row.resource));
  assert.equal(applyClassRespec(fixture,run,preview,{saveCandidate:()=>true}).ok,true);assert.equal(run.hp,1);assert.equal(run.mana,0);assert.equal(run.stamina,0);
});

test('compatible equipment upgrades and mounted cards transfer once to the new item keys',()=>{
  const {run,reg}=built(12),draft=createClassRespecDraft(reg,run),slots=draft.slots.filter(row=>row.kind==='armory'&&row.before?.id.startsWith('armament/'));
  let pair;
  for(const slot of slots){const old=root.equipment.armaments.find(row=>'armament/'+row.id===slot.before.id),tier=itemUpgradeTiers(root,slot.before.id)[0];if(!tier)continue;
    const replacement=classRespecOptions(reg,run,draft,slot).find(option=>option.id!==slot.before.id&&option.id.startsWith('armament/')&&root.equipment.armaments.find(row=>'armament/'+row.id===option.id)?.kind===old.kind&&itemUpgradeTiers(root,option.id).includes(tier)&&!draft.slots.some(other=>other.before?.id===option.id));
    if(replacement){pair={slot,old,tier,replacement};break;}
  }
  assert.ok(pair,'an authored compatible item upgrade exists');
  const {slot,old,tier,replacement}=pair;run.itemUpgradeLevels[slot.before.id]=tier;
  const row=mountRows(root,run,{itemRef:slot.before.id,piece:old}).find(row=>!row.extra&&row.kind==='weaponArt');
  if(row){run.itemMounts ||= {};run.itemMounts[slot.before.id]={[row.mountKey]:{card:null,upgraded:false,extractions:1}};}
  const fresh=createClassRespecDraft(reg,run),selections=structuredClone(fresh.selections);selections[slot.receiptId]={...replacement,transfer:'retain'};
  const preview=previewClassRespec(reg,run,fresh,{selections});assert.equal(preview.ok,true,preview.problems.join(' '));assert.ok(preview.transfers.some(row=>row.from===slot.before.id&&row.to===replacement.id));
  assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:()=>true}).ok,true);assert.equal(run.itemUpgradeLevels[replacement.id],tier);assert.equal(run.itemUpgradeLevels[slot.before.id],undefined);
  if(row){assert.equal(run.itemMounts[slot.before.id],undefined);const entries=Object.entries(run.itemMounts[replacement.id]);assert.equal(entries.length,1);assert.notEqual(entries[0][0],row.mountKey);assert.equal(entries[0][1].extractions,1);}
});

test('the initial class tree can rebuild before the first mastery level without inventing milestone slots',()=>{
  const {run,reg}=built(0),draft=createClassRespecDraft(reg,run),preview=previewClassRespec(reg,run,draft);
  assert.deepEqual(draft.slots,[]);assert.equal(draft.treeBudget,1);assert.equal(preview.ok,true,preview.problems.join(' '));
  assert.equal(applyClassRespec(reg,run,preview,{saveCandidate:candidate=>{candidate.savedAt='2026-10-06T12:00:00.000Z';return true;}}).ok,true);
  assert.equal(run.savedAt,'2026-10-06T12:00:00.000Z');assert.deepEqual(validateRunShape(deserializeRun(serializeRun(run))),[]);
});
