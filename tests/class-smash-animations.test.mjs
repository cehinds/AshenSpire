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
