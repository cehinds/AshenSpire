// Stance coverage ledger. Reference-gallery rows prove registered/mounted art;
// actual paid dispatch evidence is ingested separately from browser-combat.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {alternativeCardAnimations} from '../../src/content/alternativeCardAnimations.js';
import {alternativeSelectedStances} from '../../src/content/alternativeSelectedStances.js';
import {selectedWeaponSequence} from '../../src/model/selectedWeaponSequences.js';
import {selectedWeaponReactionFor,REAVER_GREATSWORD_PILOT as pilot} from '../../src/model/selectedWeaponStances.js';

const classes=['reaver','rogue','starseer','herald'];
const core=['attack','smash','sweep','counter','defend','spell','ranged','rangedMagic'];
const origin={attack:'offensive',smash:'smash',sweep:'sweep',counter:'counter',defend:'defensive',spell:'casting',ranged:'offensive',rangedMagic:'casting'};
const expectedHeld={reaver:8,rogue:7,starseer:7,herald:7};
const expectedClipGroups={reaver:16,rogue:10,starseer:10,herald:10};
const clone=value=>JSON.parse(JSON.stringify(value));

function assertStaticContracts(){
 const classRows={};
 for(const id of classes){
  const book=alternativeCardAnimations.classes[id];
  assert.ok(book,`${id} has registered class animations`);
  const sequenceRows={};
  for(const action of core){
   const seq=book.sequences[action];
   assert.ok(seq,`${id} maps ${action}`);
   assert.equal(seq.poses.length,seq.durations.length,`${id}/${action} frame weights align`);
   assert.ok(seq.poses.length>=2,`${id}/${action} has animated phases`);
   sequenceRows[action]={frames:seq.poses.length,poses:seq.poses,expectedHeldOrigin:origin[action],registeredLastFrame:seq.poses.at(-1),
    runtimeReturnStatus:'pending paid-dispatch browser evidence; source phase list is not a played return'};
  }
  classRows[id]={coreSequences:sequenceRows,registeredPilotReactionArt:id==='reaver'&&!!alternativeSelectedStances.weaponProfiles?.[pilot]};
 }
 // These are the approved selected-weapon sequences. Keep artwork availability
 // separate from the generic reaction fallback used by the other three classes.
 const full=selectedWeaponSequence('fully-defended'),evade=selectedWeaponSequence('evade'),guardBreak=selectedWeaponSequence('guard-break');
 const guardCounter=selectedWeaponSequence('counter-guard'),evadeCounter=selectedWeaponSequence('counter-evade');
 assert.deepEqual(full.poses,['pilot-defend','pilot-impact-v','pilot-impact-g','pilot-impact-h','pilot-counter','pilot-defend']);
 assert.deepEqual(evade.poses,['pilot-evade-1','pilot-evade-2','pilot-evade-3']);
 assert.deepEqual(guardBreak.poses,['pilot-guard-break'],'guard-break remains its separately authored one-pose outcome');
 assert.deepEqual(guardCounter.poses.slice(0,6),full.poses,'Guard Counter begins with the authored impact / parry sequence');
 assert.equal(guardCounter.poses[6],'pilot-smash');
 assert.deepEqual(guardCounter.poses.slice(7),Array.from({length:6},(_,i)=>`pilot-attack-${i+1}`));
 assert.deepEqual(evadeCounter.poses.slice(0,3),evade.poses,'Evasion Counter begins with the distinct evade sequence');
 assert.deepEqual(evadeCounter.poses.slice(3),Array.from({length:6},(_,i)=>`pilot-attack-${i+1}`));
 assert.equal(selectedWeaponSequence('smash').poses[0],'origin');
 assert.equal(selectedWeaponSequence('smash').poses.at(-1),'origin');
 assert.equal(selectedWeaponSequence('sweep').poses[0],'origin');
 assert.equal(selectedWeaponSequence('sweep').poses.at(-1),'origin');
 const approved=alternativeSelectedStances.weaponProfiles?.[pilot]?.approvedSequences;
 assert.ok(approved,'approved Reaver greatsword sequence contract is present');
 assert.deepEqual(approved.impact.previewIds,['D','V','G','H','C','D']);
 assert.deepEqual(approved.evade.previewIds,['EV1','EV2','EV3']);
 assert.deepEqual(approved.counterGuard,{prelude:'impact',then:['S','attack','C']});
 assert.deepEqual(approved.counterEvasion,{prelude:'evade',then:['attack','C'],intermediateStanceReturn:false});
 const approvedSmash=alternativeSelectedStances.weaponProfiles[pilot].selectedSmash;
 const approvedSweep=alternativeSelectedStances.weaponProfiles[pilot].selectedSweep;
 assert.equal(approvedSmash.option,'SM03');
 assert.deepEqual(approvedSmash.slots,['origin','smash-takeoff','smash-airborne','smash-impact','origin']);
 assert.equal(approvedSweep.option,'SW09');
 assert.deepEqual(approvedSweep.slots,['origin','sweep-windup','sweep-contact','sweep-finish','origin']);
 // Impact/recoil is available by selected art only to the approved Reaver
 // greatsword profile. Other classes route through the common UI hurt/guard FX.
 const examples={
  guardBreak:{type:'combatGuardBroken',targetId:'player'},
  evade:{type:'attackEvaded',targetId:'player'},
  invulnerableGuard:{type:'combatAvoidanceResolved',targetId:'player',avoided:true,prevention:'invulnerability'},
  resistedOrBlocked:{type:'damageDealt',targetId:'player',sourceId:'enemy',isAttack:true,amount:5,blocked:5,resisted:2}
 };
 const reactionRows=Object.fromEntries(Object.entries(examples).map(([name,event])=>[name,{
  mappedProfile: selectedWeaponReactionFor(event,pilot),
  otherClassFallback:'general hurt/guard presentation; no registered painted reaction clip',
  genericProfile: selectedWeaponReactionFor(event,null)
 }]));
 assert.deepEqual(Object.fromEntries(Object.entries(reactionRows).map(([k,v])=>[k,v.mappedProfile])),{
  guardBreak:'guard-break',evade:'evade',invulnerableGuard:'defend',resistedOrBlocked:'fully-defended'
 });
 assert.ok(Object.values(reactionRows).every(row=>row.genericProfile===null));
 return {classRows,reactionRows,selectedWeapon:{fullyDefended:{poses:full.poses,durations:full.durations},guardBreak:{poses:guardBreak.poses,durations:guardBreak.durations},evade:{poses:evade.poses,durations:evade.durations},guardCounter:{poses:guardCounter.poses,durations:guardCounter.durations},evasionCounter:{poses:evadeCounter.poses,durations:evadeCounter.durations},smash:clone(selectedWeaponSequence('smash')),sweep:clone(selectedWeaponSequence('sweep')),approvedSequences:clone(approved),approvedSmash:clone(approvedSmash),approvedSweep:clone(approvedSweep)}};
}

function readGallery(path){
 const gallery=JSON.parse(readFileSync(path,'utf8'));
 const rows=Object.fromEntries(classes.map(id=>{
  const actor=gallery.actors?.[id];assert.ok(actor,`gallery contains ${id}`);
  const held=actor.held||[],clips=actor.clips||[];
  assert.equal(held.length,expectedHeld[id],`${id} held count comes from manifest rows`);
  assert.equal(clips.length,expectedClipGroups[id],`${id} clip count comes from manifest rows`);
  for(const action of core)assert.ok(clips.some(c=>c.action===action),`${id} gallery maps ${action}`);
  const reactions=actor.unavailable?.filter(row=>row.kind==='painted reaction')||[];
  const playedReactions=clips.filter(row=>row.action.startsWith('reaction:')).map(row=>row.action.slice(9));
  return [id,{held:held.map(row=>row.stance),heldCount:held.length,clipCount:clips.length,
   clipActions:clips.map(row=>row.action),mountedReactionPoses:actor.mounted?.reactionPoses||[],
   capturedReactions:playedReactions,unavailablePaintedReactions:reactions.map(row=>({reaction:row.reaction,fallback:row.fallback}))}];
 }));
 const heldTotal=Object.values(rows).reduce((n,row)=>n+row.heldCount,0),clipTotal=Object.values(rows).reduce((n,row)=>n+row.clipCount,0);
 assert.equal(heldTotal,29);assert.equal(clipTotal,46);
 return {build:gallery.build,viewport:gallery.viewport,captureType:gallery.captureType,classes:rows,totals:{held:heldTotal,clipGroups:clipTotal},errors:gallery.errors||[]};
}

function readPlayedEvidence(path){
 const data=JSON.parse(readFileSync(path,'utf8'));
 // browser-combat evidence must be explicitly paid card dispatch, not a stage
 // seek or direct stage.play. The producer can contain other scenarios; only
 // rows with `animationDispatch` claim this dimension.
 const rows=data.animationDispatch||[];
 const actual=rows.filter(row=>row.dispatchType==='paid-card'&&row.cardPlayed===true);
 for(const row of actual){
  assert.ok(classes.includes(row.classId),`animation dispatch class ${row.classId}`);
  assert.ok(row.receiptId||row.cardId,`${row.classId} has receipt/card identity`);
  assert.ok(row.frameChanged===true,`${row.classId}/${row.cardId} changed a rendered frame`);
  assert.ok(row.actionStarted===true,`${row.classId}/${row.cardId} began an action`);
  assert.ok(row.actionCompleted===true,`${row.classId}/${row.cardId} reached finite completion`);
  assert.ok(row.returnedToOrigin===true,`${row.classId}/${row.cardId} returned to its held origin`);
 }
 return {dispatchRows:actual.length,rows:actual,provenance:'real paid card dispatch; event/render samples supplied by browser-combat'};
}

const args=process.argv.slice(2),arg=(name)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]};
const report={schema:'stances-coverage-v1',staticContracts:assertStaticContracts(),gallery:arg('--gallery')?readGallery(resolve(arg('--gallery'))):null,paidDispatch:arg('--played')?readPlayedEvidence(resolve(arg('--played'))):{dispatchRows:0,rows:[],status:'not supplied; reference gallery alone does not prove dispatch animation playback'}};
const out=arg('--out');if(out){const path=resolve(out);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({totals:report.gallery?.totals||null,staticClasses:Object.keys(report.staticContracts.classRows),paidDispatchRows:report.paidDispatch.dispatchRows,reportPath:out?resolve(out):undefined},null,2));
