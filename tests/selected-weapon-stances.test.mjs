import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';
import {selectedWeaponCounterOrigins,selectedWeaponSequence,selectedWeaponSequenceTiming} from '../src/model/selectedWeaponSequences.js';
import { selectedWeaponProfileFor, selectedWeaponStanceFor, selectedWeaponReactionFor, REAVER_GREATSWORD_PILOT as pilot } from '../src/model/selectedWeaponStances.js';
import { createAlternativeCardStage } from '../src/ui/alternativeCardStage.js';
import { alternativeSelectedStances } from '../src/content/alternativeSelectedStances.js';
import { applyDisplayAppearance } from '../src/ui/displayAppearance.js';
import { setAnimSpeed } from '../src/ui/animationPace.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { figureSpec, gripOf } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { dispatch } from '../src/engine/combat.js';
import { resolvePlayedCombatCard } from '../src/ui/models/PlayedCombatCard.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { kindForCard, stanceForCard } from '../src/model/alternativeStance.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { isPureDodge } from '../src/framework/importer.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as animationPace from '../src/ui/animationPace.js';

const card = (maneuver, extra = {}) => ({ cardTags: ['camp:physical', 'maneuver:'+maneuver], ...extra });

function resolvedDodgeCards() {
  const registries=createRegistries(contentBundle);
  const run=createRunState({registries,classId:'reaver',seed:11,combatExpansionVersion:2,
    startingHands:{rightHand:'greatsword',leftHand:null}});
  const dodge=run.deck.find(entry=>entry.cardId==='dodgeRoll');
  assert.ok(dodge,'the actual empty-offhand starter grants Dodge');
  // Evasive Guard is a production card, resolved in the same real startup kit.
  const evasive={instanceId:'regression:evasiveGuard',cardId:'evasiveGuard'};
  run.deck=[dodge,evasive,...run.deck.filter(entry=>entry!==dodge)];
  const combat=createRunCombat({registries,run,rng:createRng(11),enemyIds:['wanderingSoldier'],settings:{playInDeckOrder:true}});
  return {combat,instances:[dodge,evasive],definitions:[dodge,evasive].map(instance=>resolveCombatCard(combat,instance))};
}

test('resolved starter Dodge chooses Evade preparation while mixed Evasive Guard keeps its authored Counter', () => {
  const {combat,instances,definitions}=resolvedDodgeCards();
  for(const [index,definition] of definitions.entries()) {
    const expected=index===0?'evade':'counter';
    assert.equal(combatProfileFor(definition).maneuver,'counter');
    assert.equal(kindForCard(definition).maneuver,'counter','the intent glyph retains authored identity');
    assert.equal(isPureDodge(definition),index===0);
    const before=structuredClone(definition);
    const stance=selectedWeaponStanceFor({profile:pilot,stance:stanceForCard(definition),card:definition,entity:combat.player});
    assert.equal(stance,expected);
    assert.deepEqual(definition,before,'selecting a painting does not mutate mechanics or payloads');
    const plan=resolveCombatAnimation(definition,[],{classId:'reaver',appearance:'alternative',combatExpansionVersion:2});
    assert.deepEqual([plan.technique,plan.rest],['counterPrepare','counter']);
    assert.equal(resolveCombatAnimation(definition,[],{classId:'reaver',appearance:'alternative',combatExpansionVersion:2,counterTriggered:true}).technique,'counter');
    combat.player.energy=combat.player.stamina=combat.player.mana=20;
    const out=dispatch(combat,{type:'playCard',cardInstanceId:instances[index].instanceId,targetId:combat.player.id});
    const receipt=out.events.find(event=>event.type==='cardPlayed');
    assert.ok(receipt,'use a real paid card receipt');
    const snapshot=resolvePlayedCombatCard(combat,receipt);
    assert.deepEqual(snapshot.cardTags,receipt.cardTags);
    assert.deepEqual(snapshot.effects,definition.effects);
    assert.deepEqual(snapshot.counterPayload,definition.counterPayload);
    assert.equal(kindForCard(snapshot).maneuver,'counter');
    assert.equal(selectedWeaponStanceFor({profile:pilot,stance:stanceForCard(snapshot),card:snapshot,entity:combat.player}),expected);
  }
});

test('the pilot requires the actual sole greatsword in either hand and its reviewed default wearer', () => {
  const base = { classId:'reaver', armourId:'default', grip:{mode:'two',right:'greatsword',left:null} };
  assert.equal(selectedWeaponProfileFor(base), pilot);
  assert.equal(selectedWeaponProfileFor({...base,grip:{mode:'two',right:null,left:'greatsword'}}), pilot);
  for (const other of [{classId:'rogue'},{armourId:'vigil'},{grip:{mode:'dual',right:'greatsword',left:null}},
    {grip:{mode:'two',right:'greatsword',left:'shortbow'}},{grip:{mode:'two',right:'straightSword',left:null}}]) {
    assert.equal(selectedWeaponProfileFor({...base,...other}),null);
  }
});

test('real starting-kit projection enables the sole greatsword without inventing a two-handed package', () => {
  const registries=createRegistries(contentBundle);
  const start=startingHands=>createRunState({registries,classId:'reaver',seed:11,...(startingHands?{startingHands}:{})});
  const profile=run=>selectedWeaponProfileFor({classId:run.class,
    armourId:figureSpec(registries,run.loadout,run.class).armourId,grip:gripOf(registries,run.loadout,run.class)});
  for(const hands of [{rightHand:'greatsword',leftHand:null},{rightHand:null,leftHand:'greatsword'}]){
    const run=start(hands);
    assert.equal(figureSpec(registries,run.loadout,run.class).armourId,'default','the real starter Wayfarer Plate is the default body id');
    assert.equal(profile(run),pilot);
  }
  assert.equal(profile(start()),null,'the real baseline sword and shield is not a greatsword');
  assert.equal(profile(start({rightHand:'straightSword',leftHand:null})),null);
  assert.equal(profile(start({rightHand:'greatsword',leftHand:'roundShield'})),null,'an actual occupied offhand excludes the selected painting');
});

test('evade art uses authored preparation/readiness, without changing other typed actions', () => {
  const resolve = (stance, action, entity) => selectedWeaponStanceFor({profile:pilot,stance,card:action,entity});
  assert.equal(resolve('defensive',card('defend',{weightClassPriced:true})),'evade');
  assert.equal(resolve('defensive',card('defend',{effects:[{op:'dodgeRoll'}]})),'evade');
  assert.equal(resolve('defensive',card('defend',{evade:{charges:1}})),'evade');
  assert.equal(resolve('offensive',card('ranged',{evade:{charges:1,whileStatus:'prone'}}),{combatEvade:{charges:1}}),'offensive');
  assert.equal(resolve('smash',card('smash'),{evade:1}),'smash','a newer confirmed/armed Smash wins over leftover charges');
  assert.equal(resolve('counter',card('counter'),{combatEvade:{charges:1}}),'counter');
  assert.equal(resolve('casting',{cardTags:['camp:spell','maneuver:counter'],weightClassPriced:true}),'casting','the pure-dodge override remains physical');
  assert.equal(resolve(null,null,{evade:1}),'evade');
  assert.equal(resolve(null,null,{combatEvade:{charges:1,whileStatus:'prone'},statuses:{}}),null);
  assert.equal(resolve(null,null,{combatEvade:{charges:1,whileStatus:'prone'},statuses:{prone:{stacks:1,duration:1}}}),'evade');
  assert.equal(resolve(null,null,{combatOwnerCycle:2,combatEvade:{charges:1,expiresOnOwnerCycle:2}}),null);
  assert.equal(resolve('defensive',card('defend',{name:'Evade',effects:[]}),{}),'defend','names do not choose presentation');
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

test('the solo screen reaction hook imports its timing helpers and calls the current target stage', () => {
  const source=readFileSync(new URL('../src/ui/screens/combat.js',import.meta.url),'utf8');
  const imports=source.match(/import \{([^}]+)\} from '\.\.\/animationPace\.js';/);
  assert.ok(imports,'the screen imports its animation timing dependencies');
  const bindings=Object.fromEntries(imports[1].split(',').map(name=>name.trim()).map(name=>[name,animationPace[name]]));
  const begin=source.indexOf('    reactionForReceipt: event => {'),end=source.indexOf('\n    combatEl,',begin);
  assert.ok(begin>0&&end>begin);
  const calls=[],anchor={};
  let current={reactionPoses:['guard-break','evade'],reactionTiming:(kind,speed)=>selectedWeaponSequenceTiming(selectedWeaponSequence(kind),speed),reactPose:(...args)=>calls.push(args)};
  const fxCtx={anchorFor:id=>{assert.equal(id,'player');return anchor;}};
  const combat={player:{alive:true},eventLog:[]};
  const factory=runInNewContext('({'+source.slice(begin,end)+'}).reactionForReceipt',{
    ...bindings,selectedWeaponReactionFor,playbackCounterOrigins:new Set(),selectedProfile:()=>pilot,combat,playbackEvents:combat.eventLog,fxCtx,stageFor:element=>{assert.equal(element,anchor);return current;},
  });
  try {
    for(const speed of ['normal','slow','instant']) {
      animationPace.setAnimSpeed(speed);
      for(const event of [{type:'combatGuardBroken',targetId:'player'},
        {type:'combatAvoidanceResolved',targetId:'player',avoided:true,evade:{success:true}}]) {
        const callback=factory(event);assert.equal(typeof callback,'function');
        callback();assert.deepEqual(calls.at(-1),[event.type==='combatGuardBroken'?'guard-break':'evade',selectedWeaponSequenceTiming(selectedWeaponSequence(event.type==='combatGuardBroken'?'guard-break':'evade'),animationPace.ANIM_SPEEDS[speed]).totalMs||280]);
      }
    }
    const callback=factory({type:'combatGuardBroken',targetId:'player'});
    current={reactionPoses:['guard-break'],reactPose:()=>calls.push(['replacement'])};callback();
    assert.deepEqual(calls.at(-1),['replacement'],'a repaint routes to the replacement stage');
    current={reactionPoses:['guard-break','evade'],reactPose:(...args)=>calls.push(args)};
    const earlyEvade={type:'attackEvaded',targetId:'player'};
    const earlyBreak={type:'combatGuardBroken',targetId:'player'};
    const lethalLoss={type:'hpLost',targetId:'player',amount:5};
    const lethalBreak={type:'combatGuardBroken',targetId:'player'};
    combat.eventLog.push(earlyEvade,earlyBreak,lethalLoss,lethalBreak);combat.player.alive=false;
    assert.equal(typeof factory(earlyEvade),'function','final defeat does not hide an earlier evade');
    assert.equal(typeof factory(earlyBreak),'function','final defeat does not hide an earlier guard break');
    assert.equal(factory(lethalBreak),null,'the guard break after the lethal loss yields to defeat');
    assert.equal(factory({type:'combatAvoidanceResolved',targetId:'player',avoided:false,evade:{success:false}}),null);
  } finally { animationPace.setAnimSpeed('normal'); }
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
    const loading=createAlternativeCardStage('reaver',{weaponProfile:pilot});stages.push(loading);
    assert.deepEqual(loading.reactionPoses,['evade','guard-break','fully-defended','defend'],'reaction capability is known before bitmaps load');
    await loading.ready;
    const stage=await make({weaponProfile:pilot});
    const edgeWidthRatio = stage.el.dataset.maximumWidthRatio;
    assert.ok(Number(edgeWidthRatio) > Number(stage.el.dataset.idleWidthRatio), 'the selected wide blade has its own viewport envelope');
    for(const stance of ['smash','sweep','counter','evade']){
      assert.equal(stage.setStance(stance),true);
      assert.match(stage.currentArt.image.url,new RegExp('reaver-greatsword-pilot-'+stance+'\\.webp$'));
      assert.equal(stage.el.dataset.maximumWidthRatio, edgeWidthRatio, 'all selected poses share one stable edge envelope');
    }
    stage.setStance(null);stage.setRestPose('counter');
    assert.equal(stage.pose,'pilot-counter','counter rest without a ledger already uses the selected art');
    stage.setStance('counter');stage.play('counterPrepare',260);advance(100);
    assert.equal(stage.pose,'pilot-counter','payment uses the selected held preparation');
    stage.play('counter',260);advance(60);
    assert.equal(stage.pose,'reaver.counter.contact','actual retaliation retains its existing contact painting');
    for(const [index,definition] of resolvedDodgeCards().definitions.entries()) {
      stage.settle();
      stage.setStance(selectedWeaponStanceFor({profile:pilot,stance:stanceForCard(definition),card:definition}));
      const timing=stage.actionTiming('counterPrepare');
      stage.play('counterPrepare',260);advance(100);
      assert.equal(stage.pose,index===0?'pilot-evade':'pilot-counter','resolved preparation uses the selected held painting');
      assert.deepEqual(stage.actionTiming('counterPrepare'),timing,'painting does not change pacing');
      stage.play('counter',260);advance(60);
      assert.equal(stage.pose,'reaver.counter.contact','both cards retain the full Counter retaliation');
      advance(210);
      assert.equal(stage.pose,index===0?'stance-evade':'stance-counter','retaliation restores the current selected hold');
    }
    for(const origin of ['offensive','defend','counter','smash','sweep','evade']) {
      stage.settle();stage.setStance(origin);
      for(const action of ['attack','smash','counter-guard','counter-evade']) {
        const {totalMs,impactMs}=stage.actionTiming(action);
        assert.ok(impactMs<totalMs);
        stage.play(action,totalMs);
        if(action==='smash'){assert.equal(stage.pose,'stance-'+origin);advance(impactMs+1);assert.equal(stage.pose,'pilot-smash-impact');}
        else if(action==='counter-guard'){assert.equal(stage.pose,'pilot-defend');advance(impactMs+1);assert.equal(stage.pose,'pilot-attack-4');}
        else if(action==='counter-evade'){assert.equal(stage.pose,'pilot-evade-1');advance(impactMs+1);assert.equal(stage.pose,'pilot-attack-4');}
        else {assert.equal(stage.pose,'pilot-attack-1');advance(impactMs+1);assert.equal(stage.pose,'pilot-attack-4');}
        advance(totalMs);
        assert.equal(stage.pose,'stance-'+origin,'the actual active '+origin+' survives '+action);
      }
    }
    stage.settle();stage.setStance('smash');
    const smashTiming=stage.actionTiming('smash'),originalHold=stage.currentArt;
    stage.play('smash',smashTiming.totalMs);
    assert.equal(stage.currentArt.image,originalHold.image,'SM03 starts with the byte-exact active held stance');
    assert.deepEqual([stage.currentArt.left,stage.currentArt.top],[originalHold.left,originalHold.top],'the first bookend never shifts the body');
    advance(79);assert.equal(stage.pose,'pilot-smash-airborne');
    assert.equal(stage.currentArt.canvas.height,625,'airborne blade has the required 81 pixel top margin');
    const css=stage.currentArt.canvas.style.cssText,cssTop=Number(css.match(/top:([-\d.]+)px/)[1]),cssWidth=Number(css.match(/width:([\d.]+)px/)[1]),scale=cssWidth/768;
    assert.ok(Math.abs(cssTop+(originalHold.top+464)*scale-190)<1e-8,'expanded canvas compensation preserves the original held floor in CSS pixels');
    assert.equal(stage.currentArt.top,-95,'source S padding maps to the original unchanged stance registration');
    stage.hold(60);assert.equal(stage.pose,'pilot-smash-impact','timer contact freezes the ground-impact painting');
    advance(160);assert.equal(stage.pose,'stance-smash');
    assert.deepEqual([stage.currentArt.left,stage.currentArt.top],[originalHold.left,originalHold.top],'the final bookend returns without a body jump');
    stage.settle();stage.setStance('counter');
    const attackTiming=stage.actionTiming('attack');
    stage.play('attack',attackTiming.totalMs);advance(75);
    assert.equal(stage.pose,'pilot-attack-3','a lagging RAF is still in wind-up before timer contact');
    assert.equal(stage.hold(60),true);
    assert.equal(stage.pose,'pilot-attack-4','the contact timer paints the reviewed strike before hit-stop');
    assert.equal(stage.presentation.elapsed,attackTiming.impactMs);
    assert.equal(stage.presentation.duration,attackTiming.totalMs,'contact synchronization preserves the authored clip duration');
    advance(30);assert.equal(stage.pose,'pilot-attack-4');
    advance(31);assert.ok(stage.presentation.elapsed>attackTiming.impactMs,'the action clock resumes after the unchanged hold');
    advance(100);assert.equal(stage.pose,'stance-counter');
    stage.play('attack',attackTiming.totalMs);advance(140);
    const laterElapsed=stage.presentation.elapsed,laterPose=stage.pose;
    stage.hold(60);assert.equal(stage.pose,laterPose);assert.equal(stage.presentation.elapsed,laterElapsed,'a later phase never rewinds to contact');
    stage.settle({reaction:true});
    stage.settle();stage.setStance('counter');
    const full=stage.reactionTiming('fully-defended');
    stage.reactPose('fully-defended',full.totalMs);assert.equal(stage.pose,'pilot-defend');
    advance(66);assert.equal(stage.pose,'pilot-impact-v');
    advance(100);assert.equal(stage.pose,'pilot-impact-g');
    advance(260);assert.equal(stage.pose,'stance-counter');
    stage.settle();stage.setStance('smash');stage.play('smash',500);advance(150);
    assert.equal(stage.pose,'pilot-smash-takeoff');
    assert.equal(stage.reactPose('guard-break',180),true);assert.equal(stage.pose,'pilot-guard-break');
    assert.equal(stage.presentation.action,'smash','a reaction never replaces the live action');
    stage.setRestPose(stage.rest);assert.equal(stage.pose,'pilot-guard-break','routine renders retain the reaction');
    advance(190);assert.equal(stage.presentation.action,'smash');assert.notEqual(stage.pose,'pilot-guard-break');
    stage.settle();stage.play('hit',380);time+=70;stage.reactPose('evade',180);advance(120);
    assert.equal(stage.pose,'pilot-evade-3','an existing hurt RAF cannot charge the reaction for time before it started');
    advance(70);stage.endReaction();
    stage.settle();stage.reactPose('evade',180);stage.setStance('sweep');advance(190);
    assert.equal(stage.pose,'stance-sweep','the finite reaction returns to the newest hold');
    stage.reactPose('guard-break',280);assert.equal(stage.endReaction(),true);assert.equal(stage.pose,'stance-sweep');
    stage.reactPose('evade',animationPace.ANIM_SPEEDS.fast.reactionMs);advance(animationPace.ANIM_SPEEDS.fast.reactionMs-1);
    assert.equal(stage.pose,'pilot-evade-3','Fast keeps the reaction for its requested timeline duration');
    advance(2);assert.equal(stage.pose,'stance-sweep','Fast restores the hold when its 81 ms beat ends');
    stage.reactPose('evade',280);stage.settle({reaction:true});assert.equal(stage.pose,'stance-sweep');
    stage.reactPose('guard-break',280);stage.setRestPose('defeated');assert.equal(stage.pose,'defeated');
    assert.equal(stage.reactPose('evade',280),false,'defeat wins over a later reaction');
    const fallback=await make({});assert.equal(fallback.reactPose('evade'),false);fallback.setStance('counter');
    assert.equal(fallback.el.dataset.maximumWidthRatio,undefined,'the edge envelope is scoped to the selected weapon profile');
    assert.equal(fallback.pose,'stance-counter');assert.doesNotMatch(fallback.currentArt.image.url,/pilot/);
    for(const mode of ['reduced','still','instant']){
      reduced=mode==='reduced';setAnimSpeed(mode==='instant'?'instant':'normal');
      const staticStage=await make({weaponProfile:pilot,still:mode==='still'});
      staticStage.setStance('evade');staticStage.play('counterPrepare',mode==='instant'?0:260);
      assert.equal(staticStage.pose,'stance-evade',mode+' preparation keeps the selected static Evade hold');
      staticStage.setStance('smash');
      staticStage.play('smash',mode==='instant'?0:195);
      assert.equal(staticStage.pose,'stance-smash',mode+' Smash immediately retains its origin');
      assert.equal(staticStage.presentation.action,undefined,mode+' Smash leaves no action clock');
      assert.equal(staticStage.reactPose('evade',180),true,mode+' displays the chosen static pose');
      assert.equal(staticStage.pose,'pilot-evade-1');advance(190);assert.equal(staticStage.pose,'stance-smash',mode+' restores the hold within its bounded lifetime');
    }
  } finally {
    for(const stage of stages)stage?.dispose();setAnimSpeed('normal');applyDisplayAppearance({});
    for(const [key,value]of Object.entries(before))value===undefined?delete globalThis[key]:globalThis[key]=value;
  }
});
