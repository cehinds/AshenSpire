import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { stanceForCard, stanceForPublicIntent, createStanceLedger, stanceArtFor } from '../src/model/alternativeStance.js';
import { concealIntent } from '../src/model/combatIntentVisibility.js';
import { coopEnemyIntent } from '../src/ui/models/CoopIntentModel.js';
import { stanceInventory } from '../tools/alternative-stances-inventory.mjs';
import { validate } from '../src/model/presentationSequence.js';

const card = (maneuver, camp='physical') => ({cardTags:[`camp:${camp}`,`maneuver:${maneuver}`]});
test('Attack, Smash and Sweep share offensive; Defend uses defensive; Counter keeps its existing pose',()=>{
  for(const maneuver of ['attack','smash','sweep','ranged'])assert.equal(stanceForCard(card(maneuver)),'offensive');
  assert.equal(stanceForCard(card('defend')),'defensive');
  assert.equal(stanceForCard(card('counter')),null);
  assert.equal(stanceForCard(card('ranged','spell')),'casting');
  assert.equal(stanceForCard({cardTags:['camp:spell','school:fire']}),'casting');
});
test('resolved card tags own identity; damage colour and equipped weapons cannot select stance',()=>{
  assert.equal(stanceForCard({type:'attack',cardTags:[{id:'camp:spell'},{id:'maneuver:ranged'}]}),'casting');
  assert.equal(stanceForCard({id:'attack',type:'attack',cardTags:['camp:spell','maneuver:ranged'],damageSchool:'fire'}),'casting');
  assert.equal(stanceForCard({type:'attack',cardTags:['camp:physical','maneuver:smash'],damageSchool:'frost',weaponId:'staff'}),'offensive');
  assert.equal(stanceForCard({type:'skill',cardTags:[],tags:['camp:spell']}),null);
});
test('only confirmed plays replace the latest stance; new turn clears the same actor',()=>{
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
  ledger.accept({type:'playerTurnStart'});assert.equal(ledger.get(),null);
});
test('co-op seats are independent and a new combat clears both',()=>{
  const ledger=createStanceLedger();
  ledger.accept({type:'cardPlayed',playerId:'a'},card('defend'));
  ledger.accept({type:'cardPlayed',playerId:'b'},card('smash'));
  ledger.accept({type:'playerTurnStart',playerId:'a'});
  assert.equal(ledger.get('a'),null);assert.equal(ledger.get('b'),'offensive');
  ledger.accept({type:'combatStarted'});assert.deepEqual(ledger.snapshot(),{});
});
test('an unclassified latest card clears a previous defensive stance',()=>{
  const ledger=createStanceLedger();ledger.accept({type:'cardPlayed'},card('defend'));
  ledger.accept({type:'cardPlayed'},{type:'skill',cardTags:[]});assert.equal(ledger.get(),null);
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
test('co-op observers reuse their host visibility roll without revealing a move',()=>{
  const enemy={intent:{kind:'attack',moveId:'secret',damage:777,combatProfile:{camp:'spell',maneuver:'ranged'}},intentReads:{a:true,b:false}};
  const a=coopEnemyIntent(enemy,'a'),b=coopEnemyIntent(enemy,'b');
  assert.equal(a.hidden,false);assert.equal(b.hidden,true);assert.equal(b.moveId,null);assert.equal('damage' in b,false);
  assert.equal(stanceForPublicIntent(a),'casting');assert.equal(stanceForPublicIntent(b),'casting');
});
test('unpainted canonical armour never aliases another class or the default outfit',()=>{
  const catalog={actors:{'reaver-default':{frames:{offensive:{path:'base.webp'}}}}};
  assert.equal(stanceArtFor(catalog,'reaver-default','offensive').path,'base.webp');
  assert.equal(stanceArtFor(catalog,'reaver-nightweave','offensive'),null);
  assert.equal(stanceArtFor(catalog,'starseer-default','casting'),null);
});
test('coverage enumerates current canonical armour and enemies, with every export traceable',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../pose-studio/stances/registry.json',import.meta.url)));
  const inventory=stanceInventory();
  assert.deepEqual(new Set(catalog.coverage.map(r=>r.id)),new Set([...inventory.players,...inventory.enemies].map(r=>r.id)));
  assert.equal(catalog.coverage.length,catalog.counts.canonicalPlayers+catalog.counts.canonicalEnemies);
  let count=0;
  for(const r of catalog.coverage)for(const s of catalog.stances){
    const frame=stanceArtFor(catalog,r.id,s);assert.equal(!!frame,r.stances[s]);
    if(frame){count++;assert.ok(existsSync(new URL('../'+frame.path,import.meta.url)));assert.ok(existsSync(new URL('../'+frame.lite,import.meta.url)));assert.deepEqual(frame.anchor,[256,464]);}
  }
  assert.equal(count,catalog.counts.availableStanceCells);
});
test('all portable Pose Studio projects validate with empty gameplay bindings',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../pose-studio/stances/registry.json',import.meta.url)));
  for(const [id,actor] of Object.entries(catalog.actors)){
    if(actor.equivalentTo || !actor.poseStudioSupported)continue;
    for(const stance of Object.keys(actor.frames)){
      const project=JSON.parse(readFileSync(new URL(`../pose-studio/stances/projects/${id}/${stance}.pose.json`,import.meta.url)));
      assert.deepEqual(project.bindings,[]);assert.deepEqual(project.clips,[]);
      assert.deepEqual(validate(project,{actors:['reaver','rogue','starseer','herald'],effects:[],poses:()=>[]}),[],`${id}/${stance}`);
    }
  }
});
