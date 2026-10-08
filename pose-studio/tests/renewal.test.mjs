import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {durationFor,sampleSequence,hitFlashOpacity} from '../renewal/model.mjs';
import {ANIM_SPEEDS} from '../../src/ui/fx.js';
import {validate} from '../model.mjs';
const manifest=JSON.parse(readFileSync(new URL('../renewal/manifest.json',import.meta.url)));
test('a hit flashes red immediately, fades before recovery, and respects reduced motion',()=>{
 assert.ok(hitFlashOpacity('hurt',0)>.5);
 assert.ok(hitFlashOpacity('hurt',.2)<hitFlashOpacity('hurt',0));
 assert.equal(hitFlashOpacity('hurt',.55),0);
 assert.equal(hitFlashOpacity('hurt',0,{reduced:true}),0);
 assert.equal(hitFlashOpacity('attack',0),0);
});
test('attack follows current game speeds, returns to origin, and lands within the impact cap',()=>{
 for(const speed of Object.values(ANIM_SPEEDS).filter(Boolean)){
  const seq=manifest.sequences.attack,d=durationFor(seq,speed);
  assert.equal(d,speed.lungeMs);
  const impact=seq.durations.slice(0,seq.impact).reduce((a,b)=>a+b,0)/260*d;
  assert.ok(impact<=speed.impactCapMs);
  assert.equal(sampleSequence(seq,impact+.01,d).index,seq.impact);
  assert.equal(sampleSequence(seq,d,d).x,0);
  assert.equal(sampleSequence(seq,d,d).finished,true);
 }
});
test('down retains its final frame and reduced/instant sampling has no displacement',()=>{
 for(const seq of Object.values(manifest.sequences)){
  assert.equal(sampleSequence(seq,100,260,{reduced:true}).x,0);
  assert.equal(sampleSequence(seq,100,0).x,0);
 }
 assert.equal(manifest.sequences.down.hold,true);
 assert.equal(manifest.sequences.down.poses[sampleSequence(manifest.sequences.down,500,260).index],'down');
});
test('coverage is explicit and Pose Studio packages keep runtime bindings empty',()=>{
 assert.equal(manifest.coverage.length,40);
 assert.equal(manifest.coverage.filter(r=>r.status==='draft').length,4);
 for(const name of ['attack','power','spell']){
  const p=JSON.parse(readFileSync(new URL('../renewal/'+name+'.pose.json',import.meta.url)));
  assert.deepEqual(validate(p),[]);
  assert.deepEqual(p.bindings,[]);
  assert.equal(p.poses.length,5);
  for(const pose of p.poses)assert.ok(p.assets['pose:'+pose]);
 }
});

test('additional families retain their own actions, assets and portable imports',()=>{
 for(const [actor,loadout] of [['rogue','twinDaggers'],['starseer','staff'],['herald','swordShield']]){
 const rogue=JSON.parse(readFileSync(new URL('../renewal/'+actor+'/manifest.json',import.meta.url)));
 assert.equal(rogue.classId,actor);assert.equal(rogue.loadout,loadout);
 assert.equal(Object.keys(rogue.frames).length,12);
 assert.equal(rogue.sequences.down.hold,true);
 assert.equal(rogue.sequences.down.poses[sampleSequence(rogue.sequences.down,500,260).index],'down');
 for(const [action,seq] of Object.entries(rogue.sequences)){
  assert.ok(seq.poses.every(p=>rogue.frames[p]));
  assert.equal(seq.durations.reduce((a,b)=>a+b,0),260);
  assert.equal(sampleSequence(seq,260,260).x,0);
 }
 for(const action of ['attack','power','spell']){
  const p=JSON.parse(readFileSync(new URL('../renewal/'+actor+'/'+action+'.pose.json',import.meta.url)));
  assert.deepEqual(validate(p),[]);assert.equal(p.actor,actor);assert.deepEqual(p.bindings,[]);
 }
 }
});
