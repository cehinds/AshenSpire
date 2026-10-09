import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultFamily, durationFor, sampleSequence} from '../renewal/model.mjs';
import {ANIM_SPEEDS} from '../../src/ui/fx.js';
import {validate} from '../model.mjs';

const root=new URL('../renewal/',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root)));
const registry=read('base-action-registry.json');

test('base study has one class default and only the three requested actions',()=>{
 assert.deepEqual(registry.classes,['reaver','rogue','starseer','herald']);
 assert.deepEqual(registry.actions,['attack','defense','power']);
 assert.equal(registry.equipmentIndependent,true);
 assert.equal(defaultFamily(registry,'missing'),null);
 for(const actor of registry.classes){
  const entry=defaultFamily(registry,actor),family=read(entry.manifest);
  assert.equal(family.classId,actor);
  assert.equal(family.armour,'default');
  assert.equal(family.equipmentIndependent,true);
  assert.deepEqual(Object.keys(family.sequences),registry.actions);
  assert.equal(Object.keys(family.frames).length,12);
  // Supplying equipment has no influence on the selected default.
  for(const gear of ['unarmed','staff','blade+shield','blade+blade'])
   assert.equal(defaultFamily(registry,actor,gear),entry);
 }
});

test('every class dashes at current speed, contacts within the cap and returns',()=>{
 for(const actor of registry.classes){
  const family=read(defaultFamily(registry,actor).manifest),strike=family.sequences.attack;
  for(const speed of Object.values(ANIM_SPEEDS).filter(Boolean)){
   const duration=durationFor(strike,speed),contact=115/260*duration;
   assert.equal(duration,speed.lungeMs);
   assert.ok(contact<=speed.impactCapMs);
   assert.equal(sampleSequence(strike,60/260*duration,duration).x,0);
   assert.equal(sampleSequence(strike,contact,duration).x,96);
   assert.equal(sampleSequence(strike,contact+1,duration).index,2);
   assert.equal(sampleSequence(strike,duration,duration).x,0);
  }
  for(const seq of Object.values(family.sequences)){
   assert.equal(seq.durations.reduce((sum,x)=>sum+x,0),260);
   assert.equal(sampleSequence(seq,100,260,{reduced:true}).x,0);
   assert.equal(sampleSequence(seq,100,0).x,0);
   assert.equal(sampleSequence(seq,260,260).x,0);
  }
 }
});

test('all portable actions are self-contained and remain unbound to gameplay',()=>{
 for(const actor of registry.classes){
  const entry=defaultFamily(registry,actor),family=read(entry.manifest),rig=read(entry.rig);
  assert.deepEqual(Object.keys(rig.animations),registry.actions);
  assert.equal(Object.keys(rig.poses).length,12);
  for(const frame of Object.values(family.frames)){
   assert.ok(readFileSync(new URL(frame.path,root)).length>0);
   assert.ok(readFileSync(new URL(frame.lite,root)).length>0);
   assert.deepEqual(frame.anchor,[256,464]);
   assert.ok(frame.bounds.every(x=>x>0&&x<512));
  }
  for(const action of registry.actions){
   const project=read(entry.folder+'base-'+action+'.pose.json');
   assert.deepEqual(validate(project),[]);
   assert.deepEqual(project.bindings,[]);
   assert.equal(project.actor,actor);
   assert.equal(project.poses.length,5);
   assert.ok(project.poses.every(p=>project.assets['pose:'+p]?.startsWith('data:image/webp;base64,')));
  }
 }
});
