import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { CARD_ACTION_CLASSES, CARD_ACTIONS, cardActionFor, durationFor, sampleSequence, hitFlashOpacity, hitRecoilX, hurtClipFrame } from '../src/model/alternativeCardAnimation.js';
import { alternativeCardAnimations as catalog } from '../src/content/alternativeCardAnimations.js';
import { playerHurtFrames } from '../src/content/playerHurtFrames.js';
import { ANIM_SPEEDS } from '../src/ui/fx.js';
import { validate } from '../pose-studio/model.mjs';
import { webpDimensions } from '../tools/mobileart-policy.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const json=path=>JSON.parse(readFileSync(resolve(root,path)));
const card=(maneuver,camp='physical')=>({id:'test',cardTags:['camp:'+camp,'maneuver:'+maneuver]});

test('card identity preserves class defaults regardless of equipped weapons',()=>{
 for(const classId of CARD_ACTION_CLASSES){
  for(const maneuver of ['attack','smash','sweep','counter','defend','ranged']){
   for(const equipment of [[],[{id:'shortbow'}],[{id:'greatsword'}],[{id:'buckler',kind:'shield',geom:'round'}]]){
    const result=resolveCombatAnimation(card(maneuver),equipment,{classId});
    const specialized = maneuver === 'counter' ? 'counterPrepare' : maneuver;
    assert.equal(result.technique,specialized);
    assert.equal(result.alternative,true);
   }
  }
  assert.equal(cardActionFor(card('attack','spell'),classId),'spell');
  assert.equal(cardActionFor(card('ranged','spell'),classId),'rangedMagic');
  assert.equal(cardActionFor(card('defend','spell'),classId),'defend');
  assert.equal(cardActionFor(card('counter','spell'),classId),'counter');
 }
 assert.equal(cardActionFor(card('attack'),'unknown'),null);
});

test('resolved cardTags override original tags and magic damage does not imply a spell',()=>{
 const definition={...card('smash'),tags:['camp:spell','maneuver:ranged'],damageSchool:'fire'};
 assert.equal(cardActionFor(definition,'reaver'),'smash');
 assert.throws(()=>cardActionFor({cardTags:['maneuver:smash','maneuver:sweep']},'reaver'),/conflicting/);
});

test('all classes cover every requested action with self-contained portable projects',()=>{
 const registry=json('pose-studio/renewal/cards/registry.json');
 assert.deepEqual(registry.classes,CARD_ACTION_CLASSES);
 assert.deepEqual(registry.actions,CARD_ACTIONS);
 for(const classId of CARD_ACTION_CLASSES){
  const family=catalog.classes[classId];
  assert.equal(family.armour,'default');assert.equal(family.equipmentIndependent,true);
  assert.deepEqual(Object.keys(family.sequences),CARD_ACTIONS);
  const rig=json(`pose-studio/renewal/cards/${classId}/${classId}-cards.rig.json`);
  for(const action of CARD_ACTIONS){
   const seq=family.sequences[action];
   assert.equal(seq.poses.length,5);assert.equal(seq.durations.reduce((a,b)=>a+b,0),260);
   assert.ok(seq.poses.every(p=>family.frames[p]));
   assert.ok(rig.animations[action]);
   const project=json(`pose-studio/renewal/cards/${classId}/${action}.pose.json`);
   assert.deepEqual(validate(project),[]);
   assert.deepEqual(project.bindings,[]);
   assert.ok(project.poses.every(p=>project.assets['pose:'+p]?.startsWith('data:image/webp;base64,')));
  }
 }
});

test('every pace preserves impact, dash recovery, reduced motion and instant behavior',()=>{
 for(const family of Object.values(catalog.classes))for(const [action,seq] of Object.entries(family.sequences)){
  for(const speed of Object.values(ANIM_SPEEDS).filter(Boolean)){
   const duration=durationFor(seq,speed);
   const contact=seq.durations.slice(0,seq.impact).reduce((a,b)=>a+b,0)/260*duration;
   assert.equal(duration,speed.lungeMs);
   assert.ok(contact<=speed.impactCapMs);
   assert.equal(sampleSequence(seq,contact+.001,duration).index,seq.impact);
   assert.equal(sampleSequence(seq,duration,duration).x,0);
  }
  assert.equal(durationFor(seq,null),0);
  assert.equal(sampleSequence(seq,90,260,{reduced:true}).x,0);
  assert.equal(sampleSequence(seq,90,0).x,0);
  if(action.startsWith('ranged'))assert.ok(seq.travel.every(x=>Math.abs(x)<=4),'ranged must not lunge into melee');
 }
});

test('every runtime frame ships in both tiers with matching recorded hashes and clear edges',()=>{
 for(const family of Object.values(catalog.classes))for(const frame of Object.values(family.frames)){
  assert.deepEqual(frame.anchor,[256,464]);
  assert.ok(frame.bounds.every(n=>n>0&&n<512));
  for(const path of [frame.path,frame.lite]){
   const bytes=readFileSync(resolve(root,path));
   const {width,height}=webpDimensions(bytes);
   assert.deepEqual([width,height],frame.rasterSize);
   assert.ok(Math.max(width,height)<=256);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),catalog.hashes[path.split('/').at(-1)]);
  }
 }
});

test('hits strobe red on frames 2, 4 and 6 and suppress flashing for reduced motion',()=>{
 assert.equal(hitFlashOpacity('hurt',0),0,'frame 1 is untinted');
 assert.equal(hitFlashOpacity('hurt',1.5/7),.85);
 assert.equal(hitFlashOpacity('hurt',2.5/7),0);
 assert.equal(hitFlashOpacity('hurt',3.5/7),.85);
 assert.equal(hitFlashOpacity('hurt',5.5/7),.85);
 assert.equal(hitFlashOpacity('hurt',6.5/7),0);
 assert.equal(hitFlashOpacity('hurt',1),0);
 assert.equal(hitFlashOpacity('hurt',1.5/7,{reduced:true}),0);
 // Elapsed-milliseconds form over a 380 ms heavy reaction.
 assert.equal(hitFlashOpacity('hurt',1.5*380/7,{duration:380}),.85);
 assert.equal(hitFlashOpacity('hurt',380,{duration:380}),0);
});

test('the hurt clip strobes seven equal frames with red on frames 2, 4 and 6',()=>{
 assert.deepEqual(hurtClipFrame(0),{index:0,red:false});
 assert.deepEqual(hurtClipFrame(1.5/7),{index:1,red:true});
 assert.deepEqual(hurtClipFrame(2.5/7),{index:2,red:false});
 assert.deepEqual(hurtClipFrame(3.5/7),{index:3,red:true});
 assert.deepEqual(hurtClipFrame(5.5/7),{index:5,red:true});
 assert.deepEqual(hurtClipFrame(6.5/7),{index:6,red:false});
 assert.deepEqual(hurtClipFrame(1),{index:6,red:false},'the last frame is clamped');
 assert.deepEqual(hurtClipFrame(-1),{index:0,red:false});
 assert.deepEqual(hurtClipFrame(NaN),{index:0,red:false});
});

test('every class has a registered HURT clip backed by manifest art in both tiers',()=>{
 const manifest=json('art-manifest.json').assets;
 for(const classId of CARD_ACTION_CLASSES){
  const entry=playerHurtFrames[classId];
  assert.ok(entry,classId+' has a HURT registration');
  assert.ok(Number.isFinite(entry.scale)&&entry.scale>0,classId+' scale is finite');
  assert.ok(Number.isFinite(entry.dx)&&Number.isFinite(entry.dy),classId+' offset is finite');
  assert.match(entry.file,/^assets\/animations\/.+\/HURT\.webp$/);
  assert.ok(manifest[entry.file]?.light&&manifest[entry.file]?.high,classId+' HURT art is in art-manifest.json for both tiers');
 }
});

test('the knock-back eases left to -14px at 30% and back to rest',()=>{
 assert.equal(hitRecoilX(0),0);
 assert.ok(Math.abs(hitRecoilX(0.3)+14)<1e-9);
 assert.equal(hitRecoilX(1),0);
 assert.ok(hitRecoilX(0.1)<0 && hitRecoilX(0.1)>-14,'moves left on the way out');
 assert.ok(hitRecoilX(0.65)<0 && hitRecoilX(0.65)>-14,'returns on the way back');
});
