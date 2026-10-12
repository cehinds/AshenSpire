import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';
import { selectedWeaponProfileFor, selectedWeaponStanceFor, selectedWeaponReactionFor, REAVER_GREATSWORD_PILOT as pilot } from '../src/model/selectedWeaponStances.js';
import { createAlternativeCardStage } from '../src/ui/alternativeCardStage.js';
import { alternativeSelectedStances } from '../src/content/alternativeSelectedStances.js';
import { applyDisplayAppearance } from '../src/ui/displayAppearance.js';
import { setAnimSpeed } from '../src/ui/animationPace.js';

const card = (maneuver, extra = {}) => ({ cardTags: ['camp:physical', 'maneuver:'+maneuver], ...extra });

test('the pilot requires the actual sole greatsword in either hand and its reviewed default wearer', () => {
  const base = { classId:'reaver', armourId:'default', grip:{mode:'two',right:'greatsword',left:null} };
  assert.equal(selectedWeaponProfileFor(base), pilot);
  assert.equal(selectedWeaponProfileFor({...base,grip:{mode:'two',right:null,left:'greatsword'}}), pilot);
  for (const other of [{classId:'rogue'},{armourId:'vigil'},{grip:{mode:'one',right:'greatsword',left:null}},
    {grip:{mode:'two',right:'greatsword',left:'shortbow'}},{grip:{mode:'two',right:'straightSword',left:null}}]) {
    assert.equal(selectedWeaponProfileFor({...base,...other}),null);
  }
});

test('evade art uses authored preparation/readiness, without changing other typed actions', () => {
  const resolve = (stance, action, entity) => selectedWeaponStanceFor({profile:pilot,stance,card:action,entity});
  assert.equal(resolve('defensive',card('defend',{weightClassPriced:true})),'evade');
  assert.equal(resolve('defensive',card('defend',{effects:[{op:'dodgeRoll'}]})),'evade');
  assert.equal(resolve('defensive',card('defend',{evade:{charges:1}})),'evade');
  assert.equal(resolve('offensive',card('ranged',{evade:{charges:1,whileStatus:'prone'}}),{combatEvade:{charges:1}}),'offensive');
  assert.equal(resolve('smash',card('smash'),{evade:1}),'smash','a newer confirmed/armed Smash wins over leftover charges');
  assert.equal(resolve('counter',card('counter'),{combatEvade:{charges:1}}),'counter');
  assert.equal(resolve(null,null,{evade:1}),'evade');
  assert.equal(resolve(null,null,{combatEvade:{charges:1,whileStatus:'prone'},statuses:{}}),null);
  assert.equal(resolve(null,null,{combatEvade:{charges:1,whileStatus:'prone'},statuses:{prone:{stacks:1,duration:1}}}),'evade');
  assert.equal(resolve(null,null,{combatOwnerCycle:2,combatEvade:{charges:1,expiresOnOwnerCycle:2}}),null);
  assert.equal(resolve('defensive',card('defend',{name:'Evade',effects:[]}),{}),'defensive','names do not choose presentation');
  assert.equal(selectedWeaponStanceFor({profile:null,stance:'defensive',card:card('defend',{weightClassPriced:true})}),'defensive');
});

test('finite reactions accept only confirmed player guard breaks and genuine evade successes', () => {
  assert.equal(selectedWeaponReactionFor({type:'combatGuardBroken',targetId:'player'},pilot),'guard-break');
  assert.equal(selectedWeaponReactionFor({type:'attackEvaded',targetId:'player'},pilot),'evade');
  assert.equal(selectedWeaponReactionFor({type:'combatAvoidanceResolved',targetId:'player',avoided:true,evade:{success:true}},pilot),'evade');
  for (const event of [{type:'combatAvoidanceResolved',avoided:true,distance:{success:true}},
    {type:'combatAvoidanceResolved',avoided:true,prevention:'decoy'},
    {type:'combatAvoidanceResolved',avoided:false,evade:{success:false}}, {type:'evadeGained'},{type:'dodgeRolled',success:true}]) {
    assert.equal(selectedWeaponReactionFor({...event,targetId:'player'},pilot),null);
  }
  assert.equal(selectedWeaponReactionFor({type:'combatGuardBroken',targetId:'e1'},pilot),null);
  assert.equal(selectedWeaponReactionFor({type:'attackEvaded',targetId:'player'},null),null);
});

test('selected holds preserve existing returns and finite reactions restore the live action or newest hold', async () => {
  const dom=rewardDom(), raf=new Map(), stages=[];
  let time=1000, serial=0, reduced=false;
  const create=dom.document.createElement.bind(dom.document);
  dom.document.createElement=tag=>{
    const element=create(tag);
    if(tag==='canvas')element.getContext=()=>({clearRect(){},save(){},restore(){},drawImage(){},fillRect(){},getImageData(){return {data:new Uint8ClampedArray(4)};}});
    return element;
  };
  const globals={...dom,performance:{now:()=>time},Image:class{set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}},
    matchMedia:query=>({matches:query.includes('reduced-motion')&&reduced}),requestAnimationFrame:fn=>{raf.set(++serial,fn);return serial;},cancelAnimationFrame:id=>raf.delete(id)};
  const before=Object.fromEntries(Object.keys(globals).map(key=>[key,globalThis[key]]));Object.assign(globalThis,globals);
  const advance=ms=>{time+=ms;const pending=[...raf.values()];raf.clear();for(const fn of pending)fn(time);};
  const make=async options=>{const stage=createAlternativeCardStage('reaver',options);stages.push(stage);await stage.ready;return stage;};
  try {
    applyDisplayAppearance({});
    assert.ok(alternativeSelectedStances.weaponProfiles?.[pilot]?.frames,'the actual selected catalog must be present');
    const stage=await make({weaponProfile:pilot});
    for(const stance of ['smash','sweep','counter','evade']){
      assert.equal(stage.setStance(stance),true);
      assert.match(stage.currentArt.image.url,new RegExp('reaver-greatsword-pilot-'+stance+'\\.webp$'));
    }
    stage.setStance(null);stage.setRestPose('counter');
    assert.equal(stage.pose,'pilot-counter','counter rest without a ledger already uses the selected art');
    stage.setStance('counter');stage.play('counterPrepare',260);advance(100);
    assert.equal(stage.pose,'pilot-counter','payment uses the selected held preparation');
    stage.play('counter',260);advance(60);
    assert.equal(stage.pose,'reaver.counter.contact','actual retaliation retains its existing contact painting');
    stage.settle();stage.setStance('smash');stage.play('smash',500);advance(150);
    assert.equal(stage.pose,'smash-load');assert.match(stage.currentArt.image.url,/pilot-smash\.webp$/);
    assert.equal(stage.reactPose('guard-break',180),true);assert.equal(stage.pose,'pilot-guard-break');
    assert.equal(stage.presentation.action,'smash','a reaction never replaces the live action');
    stage.setRestPose(stage.rest);assert.equal(stage.pose,'pilot-guard-break','routine renders retain the reaction');
    advance(190);assert.equal(stage.presentation.action,'smash');assert.notEqual(stage.pose,'pilot-guard-break');
    stage.settle();stage.play('hit',380);time+=70;stage.reactPose('evade',180);advance(120);
    assert.equal(stage.pose,'pilot-evade','an existing hurt RAF cannot charge the reaction for time before it started');
    advance(70);stage.endReaction();
    stage.settle();stage.reactPose('evade',180);stage.setStance('sweep');advance(190);
    assert.equal(stage.pose,'stance-sweep','the finite reaction returns to the newest hold');
    stage.reactPose('guard-break',280);assert.equal(stage.endReaction(),true);assert.equal(stage.pose,'stance-sweep');
    stage.reactPose('evade',280);stage.settle({reaction:true});assert.equal(stage.pose,'stance-sweep');
    stage.reactPose('guard-break',280);stage.setRestPose('defeated');assert.equal(stage.pose,'defeated');
    assert.equal(stage.reactPose('evade',280),false,'defeat wins over a later reaction');
    const fallback=await make({});assert.equal(fallback.reactPose('evade'),false);fallback.setStance('counter');
    assert.equal(fallback.pose,'stance-counter');assert.doesNotMatch(fallback.currentArt.image.url,/pilot/);
    for(const mode of ['reduced','still','instant']){
      reduced=mode==='reduced';setAnimSpeed(mode==='instant'?'instant':'normal');
      const staticStage=await make({weaponProfile:pilot,still:mode==='still'});staticStage.setStance('smash');
      assert.equal(staticStage.reactPose('evade',180),true,mode+' displays the chosen static pose');
      assert.equal(staticStage.pose,'pilot-evade');advance(190);assert.equal(staticStage.pose,'stance-smash',mode+' restores the hold within its bounded lifetime');
    }
  } finally {
    for(const stage of stages)stage?.dispose();setAnimSpeed('normal');applyDisplayAppearance({});
    for(const [key,value]of Object.entries(before))value===undefined?delete globalThis[key]:globalThis[key]=value;
  }
});
