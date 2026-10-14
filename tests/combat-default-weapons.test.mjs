import test from 'node:test';
import assert from 'node:assert/strict';
import {combatWeaponProfilesFor,DEFAULT_COMBAT_WEAPONS} from '../src/model/combatWeaponPresentation.js';
import {resolveCombatAnimation} from '../src/model/combatAnimation.js';
import {combatEquipmentAnimationForLoadout} from '../src/model/equipmentAnimation.js';
import {selectedWeaponReactionFor,selectedWeaponCounterFor,REAVER_GREATSWORD_PILOT} from '../src/model/selectedWeaponStances.js';
import {selectedWeaponSequence} from '../src/model/selectedWeaponSequences.js';
import {classSmashSequence} from '../src/model/classSmashAnimations.js';

const grips=[{mode:'one',right:null,left:null},{mode:'one',right:'shortbow',left:'buckler'},
  {mode:'dual',right:'straightSword',left:'katana'},{mode:'one',right:'boneSceptre',left:'dagger'},
  {mode:'two',right:null,left:'warhammer'}];
const classes=['reaver','rogue','starseer','herald'];
const card=action=>({type:'attack',kindIds:['classification.attack'],cardTags:['maneuver:'+action,'camp:physical'],sourceArmamentId:'shortbow'});

test('all classes keep canonical held/Smash profiles with alternate, empty and mixed grips',()=>{
  assert.equal(DEFAULT_COMBAT_WEAPONS,true);
  for(const classId of classes)for(const armourId of ['default','heavy'])for(const grip of grips){
    const input={classId,armourId,grip},before=structuredClone(input);
    assert.deepEqual(combatWeaponProfilesFor(input),{weaponProfile:classId==='reaver'?REAVER_GREATSWORD_PILOT:null,smashProfile:classId==='reaver'?null:classId});
    assert.deepEqual(input,before,'presentation must not change authoritative equipment');
    assert.equal(combatEquipmentAnimationForLoadout(null,input,classId),null,'Classic combat borrows no equipped-family component');
  }
  assert.deepEqual(combatWeaponProfilesFor({classId:'reaver',appearance:'classic'}),{weaponProfile:null,smashProfile:null});
  assert.deepEqual(combatWeaponProfilesFor({classId:'unknown'}),{weaponProfile:null,smashProfile:null});
});

test('melee, ranged, magic, guard and counter semantics survive equipment-independent routing',()=>{
  for(const classId of classes)for(const grip of grips){
    const equipment=[grip.right,grip.left].filter(Boolean).map(id=>({id,kind:id==='buckler'?'shield':'weapon',geom:'round'}));
    for(const action of ['attack','smash','sweep','ranged','defend','counter']){
      const c=card(action),before=structuredClone(c),plan=resolveCombatAnimation(c,equipment,{classId});
      assert.equal(plan.technique,action==='counter'?'counterPrepare':action);
      assert.equal(plan.family,action==='ranged'?'projectile':['counter','defend'].includes(action)?'guard':'strike');
      assert.deepEqual(c,before);
    }
    for(const maneuver of ['attack','casting','ranged']){
      const c={...card(maneuver),cardTags:['maneuver:'+maneuver,'camp:spell','source:spell','blade']};
      const plan=resolveCombatAnimation(c,equipment,{classId});
      assert.equal(plan.technique,maneuver==='ranged'?'rangedMagic':'spell');
      assert.equal(plan.family,maneuver==='ranged'?'projectile':'spell');
    }
    const classic=resolveCombatAnimation({...card('attack'),cardTags:['blade','bow','ranged']},equipment,{classId,appearance:'classic',animation:{references:{bowAttack:'bow',bladeAttack:'blade'}}});
    assert.equal(classic.technique,'attack');assert.equal(classic.family,'projectile');
    assert.equal(resolveCombatAnimation({...card('defend'),type:'skill',kindIds:['classification.skill'],cardTags:['guard']},equipment,{classId,appearance:'classic'}).technique,'guard');
  }
});

test('real stages expose canonical sequences and avoid loading dormant alternate families',async()=>{
  const {rewardDom}=await import('./helpers/reward-dom.mjs');
  const {createAlternativeCardStage}=await import('../src/ui/alternativeCardStage.js');
  const {applyDisplayAppearance}=await import('../src/ui/displayAppearance.js');
  const dom=rewardDom(),loaded=[],stages=[];
  const create=dom.document.createElement.bind(dom.document);
  dom.document.createElement=tag=>{const el=create(tag);if(tag==='canvas')el.getContext=()=>({clearRect(){},save(){},restore(){},drawImage(){},fillRect(){},getImageData(){return {data:new Uint8ClampedArray(4)};}});return el;};
  const globals={...dom,performance:{now:()=>1000},Image:class{set src(url){loaded.push(url);queueMicrotask(()=>this.onload?.());}},
    matchMedia:()=>({matches:false}),requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
  const before=Object.fromEntries(Object.keys(globals).map(k=>[k,globalThis[k]]));Object.assign(globalThis,globals);
  try{
    applyDisplayAppearance({});
    for(const classId of classes){
      const profiles=combatWeaponProfilesFor({classId,armourId:'heavy',grip:grips[1]});
      const stage=createAlternativeCardStage(classId,profiles);stages.push(stage);await stage.ready;
      assert.equal(stage.poses.some(p=>p.startsWith('weapon:')),false);
      assert.equal(stage.setStance('smash'),true);
      assert.equal(stage.seek('smash',118,195),true);
      assert.equal(stage.pose,classId==='reaver'?selectedWeaponSequence('smash').poses[3]:classSmashSequence().poses[3]);
      if(classId==='reaver'){
        assert.ok(stage.poses.includes('counter-guard'));assert.ok(stage.poses.includes('counter-evade'));
        assert.equal(selectedWeaponReactionFor({type:'attackEvaded',targetId:'player'},profiles.weaponProfile),'evade');
        assert.equal(selectedWeaponCounterFor({cardTags:['camp:physical','maneuver:counter','guard']},profiles.weaponProfile),'counter-guard');
      }else assert.deepEqual(stage.reactionPoses,[]);
    }
    assert.equal(loaded.some(url=>url.includes('player-attacks')),false,'no alternate family preload');
    applyDisplayAppearance({classicAppearance:true});
    assert.equal(createAlternativeCardStage('reaver',combatWeaponProfilesFor({classId:'reaver'})),null);
  }finally{for(const s of stages)s.dispose();Object.assign(globalThis,before);applyDisplayAppearance({});}
});
