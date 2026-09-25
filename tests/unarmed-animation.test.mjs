import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { validateUnarmedFragmentCoverage, mergeUnarmedAnimationFragment as merge } from '../tools/unarmed-animation-import.mjs';
import { EQUIPMENT_ANIMATIONS, validateEquipmentAnimations, selectEquipmentAnimation, animationClip, animationTiming } from '../src/model/equipmentAnimation.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { tagService } from '../src/model/tagService.js';
import { resolveActionAnimation } from '../src/model/actionAnimation.js';

const physical=JSON.parse(readFileSync(new URL('../art/unarmed-reference-2026-09-19/runtime-fragment.json',import.meta.url)));
// The magic task's public fragment contract, exercising all physical skins.
// File existence/real generated frames are checked by each pack's CLI and export.
const magic={schemaVersion:1,motionProfile:'unarmed',ownedRoles:['cast','buff'],
  clips:{magicChannel:{frames:['MAGIC-STANCE-READY',...Array.from({length:7},(_,i)=>`MAGIC-ATK-0${i+1}`),'MAGIC-STANCE-READY'],frameMs:160,impactIndex:5},magicBuff:{frames:['MAGIC-BUFF'],frameMs:260,impactIndex:0}},
  references:{cast:'magicChannel',buff:'magicBuff'},bindings:structuredClone(physical.bindings),
  sets:Object.fromEntries(Object.entries(physical.sets).map(([id,set])=>[id,{frames:Object.fromEntries(Object.entries(set.frames).map(([pose,frame])=>['MAGIC-'+pose,{...frame,file:frame.file.replace('/unarmed/','/unarmed-magic/')}]))}]))};
const base=structuredClone(EQUIPMENT_ANIMATIONS);
delete base.motionProfiles.unarmed;
base.bindings=base.bindings.filter(b=>!(b.rightGroup==='empty'&&b.leftGroup==='empty'));
for(const id of Object.keys(base.sets))if(base.sets[id].motionProfile==='unarmed')delete base.sets[id];
const both=merge(merge(base,physical),magic);
const selected=data=>selectEquipmentAnimation({classId:'reaver',armourId:'default',rightId:null,leftId:null},data);

test('physical and magic import in either order, idempotently, without changing other profiles',()=>{
  assert.deepEqual(both,merge(merge(base,magic),physical));
  assert.deepEqual(both,merge(merge(both,physical),magic));
  assert.equal(validateEquipmentAnimations(both),true);
  for(const [id,profile] of Object.entries(base.motionProfiles))assert.deepEqual(both.motionProfiles[id],profile);
  assert.deepEqual(both.weaponGroups,base.weaponGroups);
  assert.equal(both.bindings.filter(b=>b.rightGroup==='empty'&&b.leftGroup==='empty').length,physical.bindings.length);
  const set=selected(both);
  assert.equal(animationClip(set,'attack'),set.clips.physicalAttack);
  assert.equal(animationClip(set,'cast'),set.clips.magicChannel);
  assert.equal(animationClip(set,'power'),set.clips.magicBuff);
  assert.deepEqual(animationTiming(set,'cast'),{totalMs:1440,impactMs:800});
  assert.deepEqual(animationTiming(set,'cast',{lungeMs:130}),{totalMs:720,impactMs:400});
});

test('missing magic safely uses physical empty-palm fallback; one profile controls every skin',()=>{
  const only=merge(base,physical);
  assert.equal(validateEquipmentAnimations(only),true);
  assert.deepEqual(animationClip(selected(only),'cast').frames,['CAST']);
  for(const binding of physical.bindings){
    const set=selectEquipmentAnimation({...binding,rightId:null,leftId:null},both);
    assert.equal(set.setId,binding.setId);
    assert.deepEqual(animationClip(set,'attack').frames,physical.clips.physicalAttack.frames);
    assert.deepEqual(animationClip(set,'cast').frames,magic.clips.magicChannel.frames);
  }
});

test('unarmed spell attacks and ranged spells cast; ordinary attacks punch; powers buff; weapons unchanged',()=>{
  const animation=selected(both);
  const attack={id:'test',kindIds:['classification.attack']};
  for(const tags of [['starstone'],['ranged','starstone']]){
    const action=resolveActionAnimation({actionId:'test',tags,type:'attack'});
    const plan=resolveCombatAnimation({...attack,tags},[],{animation,action});
    assert.equal(plan.technique,'cast');
    assert.equal(animationClip(animation,plan.technique),animation.clips.magicChannel);
    assert.equal(plan.family,action.family);
    assert.equal(resolveCombatAnimation({...attack,tags},[],{action}).technique,'attack','no selected skin retains backward-compatible routing');
    assert.equal(resolveCombatAnimation({...attack,tags},[],{animation:{...animation,rightGroup:'staff'},action}).technique,'attack');
    assert.equal(resolveCombatAnimation({...attack,tags},[],{animation:{...animation,motionProfile:'greatswordTwoHand'},action}).technique,'attack');
  }
  for(const tags of [[],['blade'],['ranged','blade']]){
    const plan=resolveCombatAnimation({...attack,tags},[],{animation,action:resolveActionAnimation({tags,type:'attack'})});
    assert.equal(plan.technique,'attack');
  }
  const override=resolveActionAnimation({actorId:'reaver',actionId:'strike',tags:['starstone'],type:'attack'});
  assert.equal(override.casting,false,'explicit physical action override wins spell tags');
  assert.equal(resolveCombatAnimation({kindIds:['classification.power']},[],{animation}).technique,'power');
});

test('importer rejects ownership and selector collisions rather than overwriting unrelated data',()=>{
  assert.throws(()=>merge(base,{...magic,references:{attack:'magicChannel'}}),/outside owned roles/);
  assert.throws(()=>merge(base,{...magic,clips:{physicalAttack:magic.clips.magicChannel}}),/namespace/);
  const collision=structuredClone(base);collision.bindings.push({...physical.bindings[0],setId:'otherSet'});
  assert.throws(()=>merge(collision,physical),/selector already belongs/);
  const bad=structuredClone(magic);bad.bindings[0].rightGroup='staff';
  assert.throws(()=>merge(base,bad),/empty-hand binding/);
});

test('all live armor entries have complete shipped physical frames',()=>{
  validateUnarmedFragmentCoverage(physical,fileURLToPath(new URL('../',import.meta.url)));
  assert.equal(Object.keys(physical.sets).length,32);
  for(const set of Object.values(physical.sets))assert.equal(Object.keys(set.frames).length,16);
  for(const b of physical.bindings){
    const s=selectEquipmentAnimation({classId:b.classId,armourId:b.armourId,rightId:null,leftId:null});
    assert.equal(s.setId,b.setId);
    assert.equal(animationClip(s,'attack').frames.length,10);
  }
});


test('Starblade Phalanx, Star Spark and Blightward Lash use casting across classes',()=>{
  const registries=createRegistries(contentBundle);
  for(const id of ['starbladePhalanx','starSpark','blightwardLash']){
    const card=registries.cards.get(id);
    const tags=card.cardTags?.length ? card.cardTags : tagService(registries).tagsOf('card',card);
    for(const actorId of ['reaver','starseer','herald','rogue']){
      const action=resolveActionAnimation({actorId,actionId:id,tags,type:card.type});
      assert.equal(action.casting,true,id+'/'+actorId);
      const plan=resolveCombatAnimation({...card,cardTags:tags},[],{animation:selected(both),action});
      assert.equal(plan.technique,'cast',id+'/'+actorId);
      assert.equal(animationClip(selected(both),plan.technique),selected(both).clips.magicChannel);
      assert.equal(resolveCombatAnimation({...card,cardTags:tags},[],{action}).group,'attack','equipped/default route remains physical');
    }
  }
});
