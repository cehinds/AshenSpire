import test from 'node:test';
import assert from 'node:assert/strict';
import { stanceForCard, stanceForPublicIntent, createStanceLedger, stanceArtFor } from '../src/model/alternativeStance.js';
import { concealIntent } from '../src/model/combatIntentVisibility.js';

const card = (maneuver, camp='physical') => ({cardTags:[`camp:${camp}`,`maneuver:${maneuver}`]});
// Owner (2026-10-12): physical Smash holds its own painted wind-up stance.
test('Attack retains offensive; Counter, physical Sweep and physical Smash use their reviewed stances',()=>{
  for(const maneuver of ['attack','ranged'])assert.equal(stanceForCard(card(maneuver)),'offensive');
  assert.equal(stanceForCard(card('smash')),'smash');
  assert.equal(stanceForCard(card('smash','spell')),'casting');
  assert.equal(stanceForCard(card('defend')),'defensive');
  assert.equal(stanceForCard(card('counter')),'counter');
  assert.equal(stanceForCard(card('sweep')),'sweep');
  assert.equal(stanceForCard(card('sweep','spell')),'casting');
  assert.equal(stanceForCard(card('ranged','spell')),'casting');
  assert.equal(stanceForCard({cardTags:['camp:spell','school:fire']}),'casting');
});
test('resolved card tags own identity; damage colour and equipped weapons cannot select stance',()=>{
  assert.equal(stanceForCard({type:'attack',cardTags:[{id:'camp:spell'},{id:'maneuver:ranged'}]}),'casting');
  assert.equal(stanceForCard({id:'attack',type:'attack',cardTags:['camp:spell','maneuver:ranged'],damageSchool:'fire'}),'casting');
  assert.equal(stanceForCard({type:'attack',cardTags:['camp:physical','maneuver:smash'],damageSchool:'frost',weaponId:'staff'}),'smash');
  assert.equal(stanceForCard({type:'skill',cardTags:[],tags:['camp:spell']}),'casting');
});
test('only confirmed plays replace the latest stance; a new turn keeps it until the next play',()=>{
  const ledger=createStanceLedger();
  ledger.accept({type:'cardPlayed',sourceId:'player'},card('attack'));
  ledger.accept({type:'cardPlayed',sourceId:'player'},card('defend'));
  ledger.accept({type:'cardPreparing',sourceId:'player'},card('ranged','spell'));
  assert.equal(ledger.get(),'defensive');
  ledger.accept({type:'cardPlayFailed',sourceId:'player'},card('attack'));
  assert.equal(ledger.get(),'defensive');
  ledger.accept({type:'cardPlayed',sourceId:'player'},card('ranged','spell'));
  assert.equal(ledger.get(),'casting');
  ledger.accept({type:'enemyTurnStart'});
  assert.equal(ledger.get(),'casting');
  ledger.accept({type:'playerTurnStart'});assert.equal(ledger.get(),'casting');
});
test('an untyped latest card is prepare (casting) and replaces a previous defensive stance',()=>{
  const ledger=createStanceLedger();ledger.accept({type:'cardPlayed'},card('defend'));
  ledger.accept({type:'cardPlayed'},{type:'skill',cardTags:[]});assert.equal(ledger.get(),'casting');
});
test('hidden and revealed public committed projections choose the same broad family',()=>{
  for(const maneuver of ['attack','smash','sweep','ranged','counter','defend']){
    const profile={camp:'physical',maneuver}, raw={kind:'attack',moveId:'private',damage:900,profile};
    const hidden=concealIntent(raw,profile),read={...raw,stance:hidden.stance,hidden:false};
    assert.equal(stanceForPublicIntent(hidden),stanceForPublicIntent(read));
  }
  assert.equal(stanceForPublicIntent(concealIntent({kind:'attack'},{camp:'spell'})),'casting');
});
test('stance selection never reads private identity, effects, school, damage or pending moves',()=>{
  const publicIntent={stance:'casting',hidden:true};
  for(const key of ['moveId','damage','effects','tags','profile','combatProfile','pendingMove','targetId'])Object.defineProperty(publicIntent,key,{get(){throw Error('private field read: '+key);}});
  assert.equal(stanceForPublicIntent(publicIntent),'casting');
  assert.equal(stanceForPublicIntent({kind:'attack',combatProfile:{camp:'spell'}}),null);
  assert.equal(stanceForPublicIntent({stance:'staggered'}),null);
  assert.equal(stanceForPublicIntent(null),null);
});
test('unpainted canonical armour never aliases another class or the default outfit',()=>{
  const catalog={actors:{'reaver-default':{frames:{offensive:{path:'base.webp'}}}}};
  assert.equal(stanceArtFor(catalog,'reaver-default','offensive').path,'base.webp');
  assert.equal(stanceArtFor(catalog,'reaver-nightweave','offensive'),null);
  assert.equal(stanceArtFor(catalog,'starseer-default','casting'),null);
});
