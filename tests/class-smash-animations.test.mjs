import test from 'node:test';
import assert from 'node:assert/strict';
import {classSmashProfileFor as profile,classSmashSequence} from '../src/model/classSmashAnimations.js';
import {selectedWeaponSequenceTiming} from '../src/model/selectedWeaponSequences.js';
import {ANIM_SPEEDS} from '../src/ui/animationPace.js';

test('only the authored default armour and starter handedness opt into class Smash',()=>{
  for(const [classId,right,left] of [['rogue','dagger','buckler'],['starseer','ashStaff',null],['herald','boneSceptre',null]]) {
    const input={classId,armourId:'default',grip:{mode:'one',right,left}};
    assert.equal(profile(input),classId);
    assert.equal(profile({...input,armourId:'heavy'}),null);
    assert.equal(profile({...input,grip:{...input.grip,right:left,left:right}}),null);
    assert.equal(profile({...input,grip:{...input.grip,right:'greatsword'}}),null);
    if(!left)assert.equal(profile({...input,grip:{...input.grip,left:'buckler'}}),null);
  }
  assert.equal(profile({classId:'reaver',armourId:'default',grip:{mode:'two',right:'greatsword'}}),null);
  assert.equal(profile(),null);
});

test('five-slot Smash preserves origin, airborne placement and actual impact timing without Reaver reactions',()=>{
  const clip=classSmashSequence();
  assert.deepEqual(clip.poses,['origin','class-smash-takeoff','class-smash-airborne','class-smash-impact','origin']);
  assert.deepEqual(clip.travel,[0,0,0,0,0]);
  assert.equal(clip.contactCue,true);assert.equal(clip.pilot,undefined);assert.equal(clip.reaction,undefined);
  assert.deepEqual(selectedWeaponSequenceTiming(clip,ANIM_SPEEDS.normal),{totalMs:195,impactMs:117});
  assert.deepEqual(selectedWeaponSequenceTiming(clip,null),{totalMs:0,impactMs:0});
});

test('real canonical starter loadouts opt in with their derived grip mode',async()=>{
  const {contentBundle}=await import('../src/content/index.js');
  const {createRegistries}=await import('../src/model/registries.js');
  const {createRunState}=await import('../src/model/state.js');
  const {figureSpec,gripOf}=await import('../src/model/loadout.js');
  const registries=createRegistries(contentBundle);
  for(const [classId,rightHand,leftHand] of [['rogue','dagger','buckler'],['starseer','ashStaff',null],['herald','boneSceptre',null]]) {
    const run=createRunState({registries,classId,seed:11,startingHands:{rightHand,leftHand}});
    assert.equal(profile({classId,armourId:figureSpec(registries,run.loadout,classId).armourId,grip:gripOf(registries,run.loadout,classId)}),classId);
  }
});

test('class stage contact waits for the actual cue and restores current holds without gaining Reaver reactions',async()=>{
  const {rewardDom}=await import('./helpers/reward-dom.mjs');
  const {createAlternativeCardStage}=await import('../src/ui/alternativeCardStage.js');
  const {classSmashAnimations}=await import('../src/content/classSmashAnimations.js');
  const {alternativeCardAnimations}=await import('../src/content/alternativeCardAnimations.js');
  const {applyDisplayAppearance}=await import('../src/ui/displayAppearance.js');
  const dom=rewardDom(),raf=new Map(),stages=[];
  let time=1000,serial=0,reduced=false;
  const create=dom.document.createElement.bind(dom.document);
  dom.document.createElement=tag=>{
    const element=create(tag);
    if(tag==='canvas')element.getContext=()=>({clearRect(){},save(){},restore(){},drawImage(){},fillRect(){},getImageData(){return {data:new Uint8ClampedArray(4)};}});
    return element;
  };
  const globals={...dom,performance:{now:()=>time},Image:class{set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}},
    matchMedia:query=>({matches:query.includes('reduced-motion')&&reduced}),requestAnimationFrame:fn=>{raf.set(++serial,fn);return serial;},cancelAnimationFrame:id=>raf.delete(id)};
  const before=Object.fromEntries(Object.keys(globals).map(key=>[key,globalThis[key]]));Object.assign(globalThis,globals);
  const original=structuredClone(classSmashAnimations.classes);
  const advance=ms=>{time+=ms;const pending=[...raf.values()];raf.clear();for(const fn of pending)fn(time);};
  try{
    applyDisplayAppearance({});
    for(const actor of ['rogue','starseer','herald']){
      const frame=alternativeCardAnimations.classes[actor].frames.ready;
      classSmashAnimations.classes[actor]={frames:Object.fromEntries(['held','takeoff','airborne','impact'].map(key=>[key,{...frame}]))};
      const stage=createAlternativeCardStage(actor,{smashProfile:actor});stages.push(stage);await stage.ready;
      assert.deepEqual(stage.reactionPoses,[],'other classes never gain selected Reaver body reactions');
      stage.setStance('smash');assert.deepEqual(stage.actionTiming('smash'),{totalMs:195,impactMs:117});
      stage.play('smash',195);const cue=stage.contactCue();assert.ok(cue);
      advance(90);assert.equal(stage.pose,'class-smash-airborne');
      advance(250);assert.equal(stage.presentation.action,'smash','a cold cue cannot recover before impact paints');
      assert.equal(cue.contact(),true);assert.equal(stage.pose,'class-smash-impact');
      stage.setStance('counter');advance(200);assert.equal(stage.pose,'stance-counter');
      stage.play('smash',195);const stale=stage.contactCue();stage.play('smash',195);const current=stage.contactCue();
      assert.equal(stale.contact(),false,'stale action acknowledgement cannot settle a newer Smash');
      assert.equal(current.contact(),true);advance(200);assert.equal(stage.pose,'stance-counter');
      const fallback=createAlternativeCardStage(actor);stages.push(fallback);await fallback.ready;
      assert.notEqual(fallback.actionTiming('smash').impactMs,117,'noneligible fallback keeps prior timing');
      for(const options of [{still:true},{}]){
        reduced=!options.still;
        const staticStage=createAlternativeCardStage(actor,{smashProfile:actor,...options});stages.push(staticStage);await staticStage.ready;
        staticStage.setStance('smash');staticStage.play('smash',195);assert.equal(staticStage.pose,'stance-smash');assert.equal(staticStage.contactCue(),null);
      }
      reduced=false;
    }
  }finally{
    for(const stage of stages)stage.dispose();classSmashAnimations.classes=original;applyDisplayAppearance({});
    for(const [key,value]of Object.entries(before))value===undefined?delete globalThis[key]:globalThis[key]=value;
  }
});
