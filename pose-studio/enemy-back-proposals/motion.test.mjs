import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STANCES,coverage,animationCoverage,reactionFramesOf} from './model.mjs';
import {integrateMotion,CLIP_TIMINGS} from './motion.mjs';
import {integrateNormalized} from './normalized.mjs';
const prefix='art/enemy-back-motion/elite/v01/';
const original={asset:'art/enemy-back-proposals/elite/v01.png',sha256:'a'.repeat(64),durationMs:1000,canvas:[512,512],anchors:{feet:[.5,.90625]}};
const manifest={schemaVersion:1,scope:'pending',targetScope:'ten-designs',actors:[{id:'elite',defaultStance:'neutral',provisionalDefaultVersion:'v01',proposals:[{id:'v01',status:'draft',perspective:'rear',provenance:{sourceSha256:'b'.repeat(64),prompt:'Unit fixture',publicationStatus:'draft-unpublished'},stances:{neutral:{frames:[original]}}}]}]};
const provenance={clips:{attack:{durations:CLIP_TIMINGS.attack},evade:{durations:CLIP_TIMINGS.evade}},seed:{path:original.asset,sha256:original.sha256},prompts:{stances:'Unit fixture',motion:'Unit fixture',damage:'Unit fixture'}};
const frame=(kind,label)=>({kind,label,path:prefix+'normalized/'+kind+'/'+label+'.png',sha256:'c'.repeat(64),outputAnchor:[256,464],anchor:[100,200],reviewedAnchor:true,omittedMeaningfulPixels:0});
const report={seedReference:{path:original.asset,sha256:original.sha256},errors:[],output:{size:[512,512]},masters:Object.fromEntries(['stances','motion','damage'].map(kind=>[kind,{path:prefix+kind+'-master.png',sha256:'d'.repeat(64)}])),frames:[...STANCES.map(s=>frame('stances',s)),...['attack','evade'].flatMap(action=>[1,2,3,4].map(n=>frame('motion',action+'-0'+n))),frame('damage','hurt'),frame('damage','defeated')],manualReview:{status:'draft-estimates-pending-normalized-preview'}};
const review={actorId:'elite',numeric:{allAnchorsManuallyReviewed:true,meaningfulOutputPixelsOmitted:0},status:'draft-approved-for-preview',runtimeVerified:false,report:{path:prefix+'normalized/normalized.json'},sourceMasters:report.masters,frames:report.frames.map(frame=>({...frame,anchor:frame.outputAnchor}))};
test('actual held poses, real motion clips and static reactions stay separate',()=>{
 const next=integrateMotion(manifest,'elite',report,provenance,review),actor=next.actors[0],proposal=actor.proposals[0];
 assert.equal(coverage(actor).fullSets,1);assert.deepEqual(animationCoverage(actor),{clips:2,completeSets:0});
 assert.deepEqual(proposal.animations.attack.frames.map(f=>f.durationMs),CLIP_TIMINGS.attack);
 assert.equal(reactionFramesOf(proposal,'hurt').length,1);assert.equal(reactionFramesOf(proposal,'defeated').length,1);
 assert.equal(proposal.designFrame.asset,original.asset);assert.equal(proposal.designFrame.sha256,original.sha256);
 assert.equal(proposal.motionProvenance.manualReview.status,'draft-estimates-pending-normalized-preview');
 assert.equal(proposal.animations.smash,undefined);
});
test('missing motion frames and incompatible source seeds cannot enter gallery',()=>{
 const missing=structuredClone(report);missing.frames=missing.frames.filter(f=>f.label!=='attack-04');
 assert.throws(()=>integrateMotion(manifest,'elite',missing,provenance,{...review,frames:review.frames.filter(f=>f.label!=='attack-04')}),/Missing actual frame/);
 assert.throws(()=>integrateMotion(manifest,'elite',report,{...provenance,seed:{path:'art/enemy-back-proposals/wrong/v01.png'}},review),/original design seed/);
 assert.throws(()=>integrateMotion(manifest,'elite',{...report,errors:['meaningful clip']},provenance,review),/reports errors/);
});
test('design normalization reimport preserves the newly drawn neutral and real clips',()=>{
 const animated=integrateMotion(manifest,'elite',report,provenance,review);
 const normalized={source:{sha256:'b'.repeat(64)},qa:{errors:[]},variants:Array.from({length:10},(_,i)=>({id:'v'+String(i+1).padStart(2,'0'),sha256:'a'.repeat(64),size:[512,512],boundsAnchor:[256,464],sourceBoundaryClipped:false}))};
 const again=integrateNormalized(animated,'elite',normalized,{actorId:'elite',prompt:'Unit fixture'});
 assert.equal(again.actors[0].proposals[0].stances.neutral.frames[0].asset,prefix+'normalized/stances/neutral.png');
 assert.deepEqual(again.actors[0].proposals[0].animations,animated.actors[0].proposals[0].animations);
 assert.deepEqual(again.actors[0].proposals[0].reactions,animated.actors[0].proposals[0].reactions);
});

test('motion preview approval binds every source and output frame',()=>{const stale=structuredClone(review);stale.frames[0].sha256='e'.repeat(64);assert.throws(()=>integrateMotion(manifest,'elite',report,provenance,stale),/review frame mismatch/);});

test('wrong seed hashes, unreviewed anchors and meaningful clipping are rejected',()=>{
 assert.throws(()=>integrateMotion(manifest,'elite',report,{...provenance,seed:{...provenance.seed,sha256:'f'.repeat(64)}},review),/original design seed/);
 const unreviewed=structuredClone(report);unreviewed.frames[0].reviewedAnchor=false;assert.throws(()=>integrateMotion(manifest,'elite',unreviewed,provenance,review),/Unreviewed anchor/);
 const clipped=structuredClone(report);clipped.frames[0].omittedMeaningfulPixels=1;assert.throws(()=>integrateMotion(manifest,'elite',clipped,provenance,review),/meaningful clipped/);
});
