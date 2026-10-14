// Stance coverage ledger. Reference-gallery rows prove registered/mounted art;
// actual paid dispatch evidence is ingested separately from browser-combat.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {alternativeCardAnimations} from '../../src/content/alternativeCardAnimations.js';
import {alternativeSelectedStances} from '../../src/content/alternativeSelectedStances.js';
import {selectedWeaponSequence} from '../../src/model/selectedWeaponSequences.js';
import {selectedWeaponReactionFor,REAVER_GREATSWORD_PILOT as pilot} from '../../src/model/selectedWeaponStances.js';
import {loadAuditRuntime} from './runtime.mjs';
import {auditInventory} from './inventory.mjs';
import {makeAuditCombat} from './fixtures.mjs';

const classes=['reaver','rogue','starseer','herald'];
const args=process.argv.slice(2),arg=(name)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]};
const approvedBuild={ordinal:arg('--build-ordinal')||'1527',digest:arg('--build-source')||'d93ee7b6bf',runtimeSource:arg('--runtime-source')||'0962c5ecc6467be75ffc1a4cbccc39d583e44dac',sourceKind:arg('--build-source-kind')||'compiled-content-digest',htmlSha256:arg('--html-sha256')||null};
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
 const actors=gallery.actors||Object.fromEntries((gallery.classRows||[]).map(row=>[row.classId,row]));
 assert.equal(gallery.build?.ordinal,approvedBuild.ordinal,'approved build ordinal');
 assert.equal(gallery.build?.digest,approvedBuild.digest,'approved compiled content digest');
 assert.equal(gallery.build?.runtimeSource,approvedBuild.runtimeSource,'approved runtime source commit');
 assert.deepEqual(gallery.errors||[],[],'no browser/runtime/HTTP/encoding errors');
 const rows=Object.fromEntries(classes.map(id=>{
  const actor=actors[id];assert.ok(actor,`gallery contains ${id}`);
  // The compact capture manifest has no browser `mounted.ready` field. Its
  // asset existence and rendered screenshots are reviewed separately; only
  // assert decode readiness when the producer actually publishes it.
  if(actor.mounted?.ready!==undefined)assert.equal(actor.mounted.ready,true,`${id} frame images preloaded and decoded`);
  const held=actor.held||[],clips=actor.clips||[];
  assert.equal(held.length,expectedHeld[id],`${id} held count comes from manifest rows`);
  assert.equal(clips.length,expectedClipGroups[id],`${id} clip count comes from manifest rows`);
  for(const action of core)assert.ok(clips.some(c=>c.action===action),`${id} gallery maps ${action}`);
  const reactions=actor.unavailable?.filter(row=>row.kind==='painted reaction')||[];
  const playedReactions=clips.filter(row=>row.action.startsWith('reaction:')).map(row=>row.action.slice(9));
  return [id,{held:held.map(row=>row.stance),heldCount:held.length,clipCount:clips.length,
   clipActions:clips.map(row=>row.action),mountedReactionPoses:actor.mounted?.reactionPoses||[],
   capturedReactions:playedReactions,decodeReadiness:actor.mounted?.ready===true?'browser-mounted-and-decoded':'not recorded in compact manifest; captured frames visually reviewed',
   unavailablePaintedReactions:reactions.map(row=>({reaction:row.reaction,fallback:row.fallback}))}];
 }));
 const heldTotal=Object.values(rows).reduce((n,row)=>n+row.heldCount,0),clipTotal=Object.values(rows).reduce((n,row)=>n+row.clipCount,0);
 assert.equal(heldTotal,29);assert.equal(clipTotal,46);
 return {build:gallery.build,viewport:gallery.viewport,captureType:gallery.captureType,classes:rows,totals:{held:heldTotal,clipGroups:clipTotal},errors:gallery.errors||[]};
}

async function resolvedProfileFamilyCandidates(){
 const api=await loadAuditRuntime('bundled'),inventory=auditInventory(api.registries),result=Object.fromEntries(classes.map(id=>[id,Object.fromEntries(['spell','ranged','rangedMagic'].map(family=>[family,[]]))])),fixtureGaps=[],fixtureRows=[];
 for(const variant of inventory.variants.filter(v=>v.instance.profileId&&!v.instance.upgraded&&v.upcastTier===undefined&&(v.instance.abilityRank===undefined||v.instance.abilityRank===0))){
  const carrierId=variant.carrierIds[0];if(!carrierId)continue;
  try{
   const {combat,fixtureKind}=makeAuditCombat(api,{classId:variant.classId,instance:variant.instance,relicIds:[],carrierId});
   const def=api.resolveCombatCard(combat,combat.piles.hand[0]),tags=def.cardTags||def.tags||[];
   fixtureRows.push({classId:variant.classId,cardId:variant.instance.cardId,profileId:variant.instance.profileId,carrierId,fixtureKind,cardTags:tags});
   const isRanged=tags.includes('ranged')||tags.includes('maneuver:ranged'),isSpell=tags.includes('camp:spell')||tags.includes('maneuver:casting');
   const families=[...(isSpell?['spell']:[]),...(isRanged?['ranged']:[]),...(isSpell&&isRanged?['rangedMagic']:[])];
   for(const family of families)result[variant.classId][family].push({cardId:variant.instance.cardId,profileId:variant.instance.profileId,carrierId,fixtureKind,cardTags:tags});
  }catch(error){fixtureGaps.push({classId:variant.classId,cardId:variant.instance.cardId,profileId:variant.instance.profileId,carrierId,reason:error.message});}
 }
 for(const classId of classes)for(const family of Object.keys(result[classId]))result[classId][family]=[...new Map(result[classId][family].map(row=>[`${row.cardId}/${row.profileId}`,row])).values()];
 return {runtime:'bundled source adapter',classes:result,fixtureRows,fixtureGaps};
}

function readPlayedEvidence(path,resolvedCandidates,contractPath,profilePlayback,originPath,extraPaths){
 const data=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(data.build?.ordinal,approvedBuild.ordinal,'paid-dispatch build ordinal');assert.equal(data.build?.source,approvedBuild.digest,'paid-dispatch compiled content digest');
 assert.deepEqual(data.errors||[],[],'paid-dispatch report has no browser/runtime errors');
 // browser-combat evidence must be explicitly paid card dispatch, not a stage
 // seek or direct stage.play. The producer can contain other scenarios; only
 // rows with `animationDispatch` claim this dimension.
 const contract=contractPath?readNormalActionContract(resolve(contractPath)):null;
 const origins=originPath?readOriginRecaptures(resolve(originPath)):null;
 const rowKey=(row,index)=>`${row.classId}/${row.device}/${row.cardId}/${row.receiptId||row.runId||index}`;
 const rowByClassDeviceCard=new Map((data.animationDispatch||[]).map((row,index)=>[rowKey(row,index),row]));
 for(const [index,row] of (contract?.rows||[]).entries())rowByClassDeviceCard.set(rowKey(row,index),row);
 for(const [index,row] of (origins?.rows||[]).entries())rowByClassDeviceCard.set(rowKey(row,index),row);
 const extraReports=[];
 for(const extraPath of extraPaths?extraPaths.split(','):[]){
  const extra=JSON.parse(readFileSync(resolve(extraPath),'utf8'));
  assert.equal(extra.build?.ordinal,approvedBuild.ordinal,`additional paid-dispatch build ordinal: ${extraPath}`);
  assert.equal(extra.build?.source,approvedBuild.digest,`additional paid-dispatch content digest: ${extraPath}`);
  assert.deepEqual(extra.errors||[],[],`additional paid-dispatch report has no browser/runtime errors: ${extraPath}`);
  const receipts=new Map((extra.cases||[]).map(row=>[row.instanceId,row]));
  for(const row of extra.animationDispatch||[]){
   assert.equal(row.dispatchType,'paid-card',`${extraPath}: additional row is paid card dispatch`);
   assert.equal(row.cardPlayed,true,`${extraPath}: additional row has played receipt`);
   const receipt=receipts.get(row.receiptId);
   assert.ok(receipt&&receipt.status==='passed'&&(receipt.after?.events||[]).some(event=>event.type==='cardPlayed'),`${extraPath}: additional row links to real paid case`);
   row.auditOutcome={successfulEvade:(receipt.after?.events||[]).some(event=>event.type==='attackMissed'&&event.targetId==='player'&&event.evadeAttempted===true),counterTriggered:(receipt.after?.events||[]).some(event=>event.type==='combatCounterTriggered'&&event.cardId===row.cardId)};
   rowByClassDeviceCard.set(rowKey(row,extraReports.length),row);
  }
  extraReports.push({path:resolve(extraPath),fixture:extra.fixture,passed:extra.counts?.passed,dispatchRows:extra.animationDispatch?.length||0,runtimeErrors:extra.errors?.length||0,rows:(extra.animationDispatch||[]).map(row=>{
   const receipt=receipts.get(row.receiptId),events=receipt?.after?.events||[],evadeFrames=[...new Set((row.frames||[]).map(frame=>frame.pose).filter(pose=>/^pilot-evade-[123]$/.test(pose||'')))],reactionCapabilities=[...new Set((row.frames||[]).flatMap(frame=>frame.reactionPoses||[]))];
   return {classId:row.classId,device:row.device,cardId:row.cardId,actions:(row.actions||[]).map(action=>({action:action.action,origin:action.origin,returnPose:action.after?.pose,returnedToOrigin:action.returnedToOrigin,frameChanged:action.frameChanged})),origin:row.origin?.pose||row.selectedOrigin?.pose,scenarioFinalPose:row.after?.pose,evadeFrames,reactionCapabilities,presentation:evadeFrames.length===3?'authored-evade-clip-observed':'no-authored-evade-reaction-pose-observed',successfulEvade:events.some(event=>event.type==='attackMissed'&&event.targetId==='player'&&event.evadeAttempted===true&&event.hit===false),counterTriggered:events.some(event=>event.type==='combatCounterTriggered'&&event.cardId===row.cardId)};
  })});
 }
 const rows=[...rowByClassDeviceCard.values()];
 const actual=rows.filter(row=>row.dispatchType==='paid-card'&&row.cardPlayed===true);
 const classSummary=Object.fromEntries(classes.map(id=>[id,{rows:0,finitePlayback:0,heldPreparation:0,frameChanged:0,completed:0,measuredReturn:0,originSampleGaps:[],actions:[]} ]));
 const actionTags={attack:['maneuver:attack'],smash:['maneuver:smash'],sweep:['maneuver:sweep'],counter:['maneuver:counter'],defend:['maneuver:defend'],spell:['camp:spell'],ranged:['ranged'],rangedMagic:['ranged+camp:spell']};
 const inventoryRows=data.inventory?.cards||[];
 const familyCandidates=Object.fromEntries(classes.map(classId=>[classId,Object.fromEntries(Object.entries(actionTags).map(([family,tags])=>{
  const cardIds=inventoryRows.filter(card=>(card.classes||[card.class]).includes(classId)&&
   (family==='rangedMagic'?card.tags?.includes('ranged')&&card.tags?.includes('camp:spell'):card.tags?.includes(tags[0]))).map(card=>card.id);
  return [family,[...new Set(cardIds)].sort()];
 }))]));
 const actualFamilies=Object.fromEntries(classes.map(id=>[id,new Set()]));
 for(const row of actual){
  assert.ok(classes.includes(row.classId),`animation dispatch class ${row.classId}`);
  assert.ok(row.receiptId||row.cardId,`${row.classId} has receipt/card identity`);
  if(row.presentationKind==='held-preparation')assert.ok(row.after?.pose,`${row.classId}/${row.cardId} presents its held preparation pose`);
  else assert.ok(row.frameChanged===true,`${row.classId}/${row.cardId} changed a rendered frame`);
  assert.ok(row.actionStarted===true,`${row.classId}/${row.cardId} began an action`);
  assert.ok(row.actionCompleted===true,`${row.classId}/${row.cardId} reached finite completion`);
  assert.ok(row.after && row.after.missing===false,`${row.classId}/${row.cardId} ends with decoded, mounted art`);
  const summary=classSummary[row.classId];summary.rows++;if(row.frameChanged===true)summary.frameChanged++;summary.completed++;
  if(row.presentationKind==='held-preparation')summary.heldPreparation++;else summary.finitePlayback++;
  const actionNames=[...new Set([...(row.actions||[]).map(action=>action.action),...(row.frames||[]).map(frame=>frame.action)].filter(Boolean))];summary.actions.push(...actionNames);
  const frames=(row.frames||[]).filter(frame=>frame.action);
  for(const family of Object.keys(actionTags))if(frames.some(frame=>family==='counter'&&/^counter-(guard|evade)$/.test(frame.action)||frame.action===family))actualFamilies[row.classId].add(family);
  for(const action of row.actions||[])for(const family of Object.keys(actionTags))if(family==='counter'?/^counter(?:-(guard|evade))?$/.test(action.action):action.action===family)actualFamilies[row.classId].add(family);
  for(const profile of profilePlayback?.rows||[])if(profile.classId===row.classId){
   if(profile.action==='ranged')actualFamilies[row.classId].add('ranged');
   if(profile.action==='spell')actualFamilies[row.classId].add('spell');
  }
  const actionReturns=(row.actions||[]).filter(action=>action.action!=='counterPrepare'&&action.completed===true&&action.returnedToOrigin===true).length;
  summary.measuredActionReturns=(summary.measuredActionReturns||0)+actionReturns;
  if(row.presentationKind==='held-preparation'){
   // A counter card intentionally leaves the actor in its new prepared pose;
   // the prior stance is not the return target for this presentation kind.
  } else if(row.presentationKind==='counter-return'){
   // Counter cards remain prepared through the enemy phase. Each independently
   // completed reaction/counter/next-card clip is validated from `actions`.
   if(!actionReturns)summary.originSampleGaps.push({device:row.device,cardId:row.cardId,reason:'counter return row has no completed action group with an observed origin return'});
  } else if(row.actions?.length){
   const finiteActions=row.actions.filter(action=>action.action!=='counterPrepare'&&action.completed===true);
   if(finiteActions.length&&finiteActions.every(action=>action.returnedToOrigin===true))summary.measuredReturn++;
   else summary.originSampleGaps.push({device:row.device,cardId:row.cardId,reason:'one or more completed action groups did not return to their sampled action origin'});
  } else if(row.origin?.pose||row.actionOrigin?.pose){
   const origin=row.origin||row.actionOrigin;
   if(row.returnedToOrigin===true){
    assert.equal(row.after?.pose,origin.pose,`${row.classId}/${row.cardId} ends at its captured action origin`);
    summary.measuredReturn++;
   } else summary.originSampleGaps.push({device:row.device,cardId:row.cardId,originPose:origin.pose,afterPose:row.after.pose,reason:'captured origin did not match the final held pose'});
  } else summary.originSampleGaps.push({device:row.device,cardId:row.cardId,afterPose:row.after.pose,reason:'post-selection action origin was not published; return remains unproven'});
 }
 for(const id of classes){assert.ok(classSummary[id].rows>0,`${id} has actual paid card animation evidence`);classSummary[id].actions=[...new Set(classSummary[id].actions)].sort();}
 const profileCandidates=resolvedCandidates.classes;
 const familyCoverage=Object.fromEntries(classes.map(id=>[id,Object.fromEntries(Object.keys(actionTags).map(family=>{
  const authored=familyCandidates[id][family],profiles=profileCandidates[id][family]||[],candidates=[...new Set([...authored,...profiles.map(row=>`${row.cardId}@${row.profileId}`)])];
  return [family,{played:actualFamilies[id].has(family),candidateCards:candidates,authoredCardCandidates:authored,resolvedProfileCandidates:profiles,status:actualFamilies[id].has(family)?'actual-frame-action-observed':candidates.length?'candidate-exists-but-no-paid-frame-observed':'no-authored-or-resolved-profile-candidate'}];
 }))]));
 const networkFailures=data.networkFailures||[],knownOptionalSfx=[...new Set(networkFailures.filter(row=>row.classification==='optional-cue-with-observed-synthesis').map(row=>{try{return new URL(row.url).pathname}catch{return row.url}}))].sort();
 return {dispatchRows:actual.length,classes:classSummary,familyCandidates,familyCoverage,resolvedProfileCandidates:profileCandidates,resolvedProfileFixtureRows:resolvedCandidates.fixtureRows,resolvedProfileFixtureGaps:resolvedCandidates.fixtureGaps,rows:actual,sourceSummary:{path:resolve(path),stateFixture:data.fixture,build:data.build,passedCases:data.counts?.passed,runtimeErrors:data.errors?.length||0,networkFailures:networkFailures.length,knownOptionalSfxFallbacks:knownOptionalSfx,unexpectedNetworkFailureCount:networkFailures.filter(row=>row.classification!=='optional-cue-with-observed-synthesis').length,platformWarningCount:data.platformWarnings?.length||0},additionalPaidReports:extraReports,provenance:'real paid card dispatch; event/render samples supplied by browser-combat',limits:'Frames are sampled during real playback, not frame-perfect timing. Rows without a measured action group or explicit matching action origin are not counted as return-stance passes. Resolved equipment-profile candidates indicate card availability under that profile, not default-class-weapon playback.',normalActionContract:contract?.summary||null,originRecaptures:origins?.summary||null};
}

function readNormalActionContract(path){
 const data=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(data.build?.ordinal,approvedBuild.ordinal,'normal action contract build ordinal');
 assert.equal(data.build?.source,approvedBuild.digest,'normal action contract compiled content digest');
 assert.deepEqual(data.errors||[],[],'normal action contract has no browser/runtime errors');
 assert.equal(data.counts?.failed,0,'normal action contract has no failed cases');
 const rows=data.animationDispatch||[];
 assert.equal(rows.length,26,'normal action contract includes the complete desktop/phone class matrix');
 const classDevices=new Set(), actionRows=[], counterReactions=[];
 for(const row of rows){
  assert.equal(row.dispatchType,'paid-card',`${row.classId}/${row.cardId} is a paid card dispatch`);
  assert.equal(row.cardPlayed,true,`${row.classId}/${row.cardId} has a played receipt`);
  const receipt=data.cases?.find(item=>item.instanceId===row.receiptId);
  assert.ok(receipt&&receipt.status==='passed',`${row.classId}/${row.cardId} links to a passed real-card case`);
  const events=receipt.after?.events||[];
  assert.ok(events.some(event=>event.type==='cardPlayed'),`${row.classId}/${row.cardId} has a paid card event`);
  classDevices.add(`${row.classId}/${row.device}`);
  const actions=row.actions||[];
  assert.ok(actions.length,`${row.classId}/${row.cardId} includes sampled action groups`);
  for(const action of actions){
   assert.equal(action.completed,true,`${row.classId}/${row.cardId}/${action.action} completed`);
   assert.ok(action.first?.missing===false&&action.after?.missing===false,`${row.classId}/${row.cardId}/${action.action} uses decoded frames`);
   assert.equal(action.returnedToOrigin,true,`${row.classId}/${row.cardId}/${action.action} returns to its supported held origin`);
   assert.equal(action.after.pose,action.origin,`${row.classId}/${row.cardId}/${action.action} ends on its captured supported held origin`);
   actionRows.push({classId:row.classId,device:row.device,cardId:row.cardId,action:action.action,origin:action.origin,firstPose:action.first.pose,returnPose:action.after.pose});
  }
  if(row.presentationKind==='counter-return'){
   assert.ok(events.some(event=>event.type==='combatCounterTriggered'),`${row.classId}/${row.cardId} has a real enemy-turn counter trigger`);
   const incomingHits=events.filter(event=>['attackHit','attackMissed'].includes(event.type)&&event.targetId==='player');
   const evadeAttempt=incomingHits.some(event=>event.evadeAttempted===true);
   const evasion=incomingHits.some(event=>event.evadeAttempted===true&&(event.type==='attackMissed'||event.hit===false))
    ||events.some(event=>event.type==='combatCounterAccuracyResolved'&&event.accuracyKind==='evasion');
   const guard=events.some(event=>event.type==='combatCounterstrikeApplied');
   assert.ok(evasion||guard||evadeAttempt,`${row.classId}/${row.cardId} records guard or evasion resolution/attempt semantics`);
   const specificAction=actions.some(a=>a.action==='counter-guard'||a.action==='counter-evade');
   const reactionKind=guard?'guard':evasion?'successful-evasion':evadeAttempt?'evade-attempt-failed':'unclassified';
   counterReactions.push({classId:row.classId,device:row.device,cardId:row.cardId,kind:reactionKind,
    evadeAttempt,successfulEvade:evasion,presentation:actions.map(a=>a.action),returnStance:actions.find(a=>a.action==='counter'||a.action==='counter-guard'||a.action==='counter-evade')?.origin,
    artMapping:specificAction?'approved selected-weapon reaction sequence':'generic class counter fallback; no painted reaction clip'});
  }
 }
 assert.equal(classDevices.size,8,'normal action contract covers all four classes on desktop and phone');
 assert.equal(counterReactions.length,16,'guard and evasion reactions are exercised for all four classes on desktop and phone');
 const counts={};for(const row of actionRows)counts[row.action]=(counts[row.action]||0)+1;
 assert.equal(actionRows.length,58,'all recorded normal/counter action groups are covered');
 const networkFailures=data.networkFailures||[],knownOptionalSfx=[...new Set(networkFailures.filter(row=>row.classification==='optional-cue-with-observed-synthesis').map(row=>{try{return new URL(row.url).pathname}catch{return row.url}}))].sort();
 return {rows,summary:{contractPath:path,source:data.derivation?.source||path,harnessCommit:data.derivation?.harnessCommit,stateFixture:data.fixture,caseCount:data.counts.passed,dispatchRows:rows.length,actionGroupCount:actionRows.length,actionGroupCounts:counts,returnedActionGroups:actionRows.length,counterReactions,successfulEvasionCount:counterReactions.filter(row=>row.successfulEvade).length,failedEvasionAttempts:counterReactions.filter(row=>row.evadeAttempt&&!row.successfulEvade).length,errors:data.errors.length,networkFailureCount:networkFailures.length,knownOptionalSfxFallbacks:knownOptionalSfx,unexpectedNetworkFailureCount:networkFailures.filter(row=>row.classification!=='optional-cue-with-observed-synthesis').length,coverageMethod:data.derivation?.method}};
}

function readOriginRecaptures(path){
 const data=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(data.build?.ordinal,approvedBuild.ordinal,'origin recapture build ordinal');assert.equal(data.build?.source,approvedBuild.digest,'origin recapture compiled content digest');
 assert.deepEqual(data.errors||[],[],'origin recaptures have no browser/runtime errors');assert.equal(data.counts?.failed,0,'origin recaptures have no failed cases');
 const expected=[['reaver','defend'],['rogue','defend'],['starseer','defend'],['herald','defend'],['herald','bloodPact']],rows=data.animationDispatch||[];
 assert.equal(rows.length,expected.length,'fresh origin recaptures cover all requested rows');
 for(const [classId,cardId] of expected){
  const row=rows.find(candidate=>candidate.classId===classId&&candidate.cardId===cardId);
  assert.ok(row,`${classId}/${cardId} origin recapture exists`);assert.equal(row.dispatchType,'paid-card');assert.equal(row.cardPlayed,true);assert.equal(row.actionCompleted,true);
  assert.equal(row.originMethod,'expected-held-pose-from-live-stage-contract',`${classId}/${cardId} origin derived from actual sampled live stance`);
  assert.ok(row.origin?.pose,`${classId}/${cardId} has a supported live stage origin`);
  const receipt=data.cases?.find(candidate=>candidate.instanceId===row.receiptId);
  assert.ok(receipt&&receipt.status==='passed'&&(receipt.after?.events||[]).some(event=>event.type==='cardPlayed'),`${classId}/${cardId} links its samples to a paid card receipt`);
  assert.ok(row.actions?.length&&row.actions.every(action=>action.completed&&action.returnedToOrigin&&action.first?.missing===false&&action.after?.missing===false&&action.after.pose===action.origin),`${classId}/${cardId} actions decode and return to origin`);
 }
 return {rows,summary:{source:path,stateFixture:data.fixture,caseCount:rows.length,method:'post-selection origin mapped from sampled live stage.stance through restPose/setStance contract; action playback/return frames independently observed',allActionGroupsReturned:true,errors:data.errors.length}};
}

function readEquipmentProfilePlayback(paths){
 if(!paths)return null;
 const allowed={shortbow:{profileId:'bowPierceAttack',carrier:'shortbow',action:'ranged'},ashStaff:{profileId:'staffMagicAttack',carrier:'ashStaff',action:'spell'},boneSceptre:{profileId:'sceptreArcaneAttack',carrier:'boneSceptre',action:'spell'}};
 const evidence=[];
 for(const path of paths.split(',')){
  const data=JSON.parse(readFileSync(resolve(path),'utf8')),kind=Object.keys(allowed).find(name=>path.includes(name));
  assert.ok(kind,`equipment profile report path identifies known carrier: ${path}`);const expected=allowed[kind];
  assert.equal(data.build?.ordinal,approvedBuild.ordinal,`${kind} profile build ordinal`);assert.equal(data.build?.source,approvedBuild.digest,`${kind} profile compiled content digest`);
  assert.deepEqual(data.errors||[],[],`${kind} profile run has no uncaught runtime errors`);assert.equal(data.counts?.failed,0,`${kind} profile run has no failed paid cases`);
  assert.equal(data.cases?.length,8,`${kind} profile has 4 classes × 2 devices`);
  const cases=new Map(data.cases.map(row=>[row.instanceId,row]));
  for(const row of data.animationDispatch||[]){
   const testCase=cases.get(row.receiptId);assert.ok(testCase&&testCase.status==='passed',`${kind}/${row.classId}/${row.device} is a passed paid case`);
   assert.equal(testCase.before.instance.profileId,expected.profileId,`${kind} selected registered profile`);assert.equal(testCase.before.instance.weaponId,expected.carrier,`${kind} used expected carrier`);
   assert.equal(row.dispatchType,'paid-card');assert.equal(row.cardPlayed,true);assert.equal(row.actionCompleted,true);assert.equal(row.frameChanged,true);assert.equal(row.returnedToOrigin,true);
   assert.ok(row.actions.some(action=>action.action===expected.action&&action.completed&&action.returnedToOrigin&&action.after?.pose===action.origin),`${kind}/${row.classId}/${row.device} played ${expected.action} and returned`);
   assert.equal(row.after?.missing,false);assert.ok(row.actions.every(action=>action.first?.missing===false&&action.after?.missing===false&&action.after?.pose===action.origin));
   const poses=new Set((row.frames||[]).map(frame=>frame.pose));
   assert.ok(![...poses].some(pose=>/^(?:weapon|bow|staff|sceptre|sword)-/.test(pose)),`${kind}/${row.classId}/${row.device} leaves alternate weapon art disabled`);
   evidence.push({carrier:kind,profileId:expected.profileId,classId:row.classId,device:row.device,action:expected.action,origin:row.origin?.pose||row.selectedOrigin?.pose,returnPose:row.after?.pose,alternateWeaponArt:'not played'});
  }
 }
 assert.equal(evidence.length,24,'equipment profile animation matrix includes 3 carriers × 4 classes × 2 devices');
 return {caseCount:evidence.length,profileRuns:paths.split(',').length,classes:classes.slice(),devices:['desktop','phone'],rows:evidence,fixtures:paths.split(',').map(path=>{const data=JSON.parse(readFileSync(resolve(path),'utf8'));return {path:resolve(path),stateFixture:data.fixture,passed:data.counts?.passed,runtimeErrors:data.errors?.length||0,networkFailures:data.networkFailures?.length||0,knownOptionalCueFailures:[...new Set((data.networkFailures||[]).filter(row=>row.classification==='optional-cue-with-observed-synthesis').map(row=>row.url))],platformWarningCount:data.platformWarnings?.length||0};}),provenance:'actual paid profile-card dispatches with registered equipment instances; default animation mapping remains class art and alternate weapon animation is disabled'};
}

function readCounterScenarioEvidence(path){
 const data=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(data.build?.ordinal,approvedBuild.ordinal,'counter scenario approved build ordinal');
 assert.equal(data.build?.source,approvedBuild.digest,'counter scenario approved compiled content digest');
 assert.deepEqual(data.errors||[],[],'counter scenario has no browser/runtime errors');
 const required=['guard-counter-return','evasion-counter-return'];
 const rows=Object.fromEntries(required.map(category=>{
  const row=data.cases?.find(item=>item.category===category&&item.classId==='reaver'&&item.status==='passed');
  assert.ok(row,`real enemy-turn scenario ${category} passed`);
  const frames=row.after?.frames||[],events=row.after?.events||[];
  const counterKind=category==='guard-counter-return'?'guard':'evade';
  const action=`counter-${counterKind}`,trigger=events.find(event=>event.type==='combatCounterTriggered'&&event.cardId===row.cardId);
  assert.ok(trigger,`${row.cardId}: actual enemy move triggers its armed counter`);
  const sequence=frames.filter(frame=>frame.action===action);
  assert.ok(sequence.length,`${row.cardId}: real action frames contain ${action}`);
  assert.ok(sequence.every(frame=>frame.missing===false),`${row.cardId}: counter frames use decoded art`);
  const poses=new Set(sequence.map(frame=>frame.pose));
  if(counterKind==='guard'){
   assert.ok(trigger.poiseDamage>0,'guard counter dispatch has a positive Poise receipt');
   for(const pose of ['pilot-impact-v','pilot-impact-g','pilot-impact-h','pilot-counter','pilot-smash'])assert.ok(poses.has(pose),`guard counter includes ${pose}`);
  } else {
   for(const pose of ['pilot-evade-1','pilot-evade-2','pilot-evade-3'])assert.ok(poses.has(pose),`evasion counter includes ${pose}`);
   assert.ok([...poses].some(pose=>pose.startsWith('pilot-attack-')),'evasion counter follows with its attack');
  }
  const lastIndex=frames.map((frame,index)=>frame.action===action?index:-1).filter(index=>index>=0).at(-1);
  const returnFrame=frames.slice(lastIndex+1).find(frame=>!frame.action);
  const expectedOrigin=counterKind==='guard'?'stance-counter':'stance-evade';
  assert.equal(returnFrame?.pose,expectedOrigin,`${row.cardId}: finite counter sequence returns to its prepared origin pose`);
  return [category,{cardId:row.cardId,paidCardInstanceId:row.instanceId,status:row.status,trigger:{type:trigger.type,amount:trigger.amount,poiseDamage:trigger.poiseDamage},action,frameCount:sequence.length,poses:[...poses],returnPose:returnFrame.pose}];
 }));
 return {url:data.url,source:data.source,build:{ordinal:data.build.ordinal,digest:data.build.source,runtimeSource:approvedBuild.runtimeSource},scenarios:rows,provenance:'real paid counter card followed by live enemy turn; stage frames sampled from the production render path'};
}

const profileCandidates=await resolvedProfileFamilyCandidates();
const profilePlayback=readEquipmentProfilePlayback(arg('--profile-evidence'));
const report={schema:'stances-coverage-v1',buildIdentity:{url:arg('--build-url')||'http://127.0.0.1:4413/AshenSpire.html',ordinal:approvedBuild.ordinal,compiledContentDigest:approvedBuild.digest,sourceKind:approvedBuild.sourceKind,htmlSha256:approvedBuild.htmlSha256,runtimeSourceCommit:approvedBuild.runtimeSource},sourceReports:{gallery:arg('--gallery')?resolve(arg('--gallery')):null,paidDispatch:arg('--played')?resolve(arg('--played')):null,additionalPaidDispatch:arg('--extra-played')?arg('--extra-played').split(',').map(path=>resolve(path)):[],normalActionContract:arg('--normal-contract')?resolve(arg('--normal-contract')):null,originRecaptures:arg('--origin-evidence')?resolve(arg('--origin-evidence')):null,equipmentProfiles:arg('--profile-evidence')?arg('--profile-evidence').split(',').map(path=>resolve(path)):[],counterScenarios:arg('--counter-scenarios')?resolve(arg('--counter-scenarios')):null},staticContracts:assertStaticContracts(),gallery:arg('--gallery')?readGallery(resolve(arg('--gallery'))):null,paidDispatch:arg('--played')?readPlayedEvidence(resolve(arg('--played')),profileCandidates,arg('--normal-contract'),profilePlayback,arg('--origin-evidence'),arg('--extra-played')):{dispatchRows:0,rows:[],status:'not supplied; reference gallery alone does not prove dispatch animation playback'},equipmentProfilePlayback:profilePlayback,counterScenarios:arg('--counter-scenarios')?readCounterScenarioEvidence(resolve(arg('--counter-scenarios'))):null};
function conciseSummary(report){
 const classRows=Object.fromEntries(Object.entries(report.paidDispatch.classes||{}).map(([id,row])=>[id,{paidDispatchRows:row.rows,finitePlayback:row.finitePlayback,heldPreparation:row.heldPreparation,measuredRowReturns:row.measuredReturn,measuredActionReturns:row.measuredActionReturns,originGaps:row.originSampleGaps.length}]));
 const families=Object.fromEntries(Object.entries(report.paidDispatch.familyCoverage||{}).map(([id,rows])=>[id,Object.fromEntries(Object.entries(rows).map(([family,row])=>[family,{status:row.status,played:row.played,candidateCount:row.candidateCards.length}]))]));
 const fixtures=report.paidDispatch.resolvedProfileFixtureRows||[],fixtureKinds=fixtures.reduce((count,row)=>(count[row.fixtureKind]=(count[row.fixtureKind]||0)+1,count),{});
 const profileRows=report.equipmentProfilePlayback?.caseCount||0;
 const extraRows=(report.paidDispatch.additionalPaidReports||[]).flatMap(row=>row.rows||[]),successfulEvadeRows=extraRows.filter(row=>row.successfulEvade);
 return {schema:'stances-summary-v1',buildIdentity:report.buildIdentity,sourceReports:report.sourceReports,referenceAvailability:report.gallery?{heldPoses:report.gallery.totals.held,clipGroups:report.gallery.totals.clipGroups,perClass:Object.fromEntries(Object.entries(report.gallery.classes).map(([id,row])=>[id,{held:row.heldCount,clipGroups:row.clipCount}]))}:null,paidAnimation:{dispatchRows:report.paidDispatch.dispatchRows,perClass:classRows,familyCoverage:families,originSamplingGaps:Object.values(report.paidDispatch.classes||{}).flatMap(row=>row.originSampleGaps),additionalPaidReports:report.paidDispatch.additionalPaidReports,sourceRuntimeErrors:report.paidDispatch.sourceSummary?.runtimeErrors,sourceNetworkFailures:report.paidDispatch.sourceSummary?.networkFailures},resolvedEquipmentProfiles:{resolvedVariantRows:fixtures.length,fixtureKinds,gaps:report.paidDispatch.resolvedProfileFixtureGaps?.length||0,profilePlaybackRows:profileRows,profileRuns:report.equipmentProfilePlayback?.fixtures||[]},totals:{distinctBrowserPaidCases:report.paidDispatch.dispatchRows+profileRows,paidCardActionGroups:report.paidDispatch.normalActionContract?.actionGroupCount||0,successfulEvasionRows:successfulEvadeRows.length},successfulEvasionRows:successfulEvadeRows,normalActionContract:report.paidDispatch.normalActionContract?{...report.paidDispatch.normalActionContract,counterReactions:report.paidDispatch.normalActionContract.counterReactions.map(({classId,device,cardId,kind,returnStance,artMapping})=>({classId,device,cardId,kind,returnStance,artMapping}))}:null,originRecaptures:report.paidDispatch.originRecaptures||null,actualCounterScenarios:report.counterScenarios?Object.fromEntries(Object.entries(report.counterScenarios.scenarios).map(([name,row])=>[name,{cardId:row.cardId,frameCount:row.frameCount,returnPose:row.returnPose}])):null};
}
const out=arg('--out'),summaryOut=arg('--summary-out'),summary=conciseSummary(report);
if(out){const path=resolve(out);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');}
if(summaryOut){const path=resolve(summaryOut);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(summary,null,2)+'\n');}
console.log(JSON.stringify({totals:report.gallery?.totals||null,staticClasses:Object.keys(report.staticContracts.classRows),paidDispatchRows:report.paidDispatch.dispatchRows,reportPath:out?resolve(out):undefined,summaryPath:summaryOut?resolve(summaryOut):undefined},null,2));
