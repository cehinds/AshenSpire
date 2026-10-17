import {STANCES,REACTIONS,VERSION_IDS,safeAsset,validateManifest} from './model.mjs';
export const CLIP_TIMINGS={attack:[180,90,150,200],evade:[140,90,130,200]};
export function integrateMotion(manifest,actorId,report,provenance,review){
 const next=structuredClone(manifest),actor=next.actors.find(a=>a.id===actorId),proposal=actor?.proposals.find(p=>p.id==='v01');
 if(!proposal)throw Error('Actual v01 rear design is required');
 const original=proposal.designFrame||proposal.stances.neutral.frames[0];
 if(!provenance?.prompts||provenance.seed?.path!==original.asset||provenance.seed?.sha256!==original.sha256||report.seedReference?.path!==original.asset||report.seedReference?.sha256!==original.sha256)throw Error('Motion provenance must identify the original design seed');
 if(report.errors?.length||report.qa?.errors?.length)throw Error('Motion normalization reports errors');
 const prefix='art/enemy-back-motion/'+actorId+'/v01/';
 for(const master of Object.values(report.masters||{}))if(!safeAsset(master.path)||!master.path.startsWith(prefix)||!/^[a-f0-9]{64}$/.test(master.sha256))throw Error('Invalid motion master provenance');
 if(Object.keys(report.masters||{}).length!==3)throw Error('Three source masters are required');
 if(review?.actorId!==actorId||review?.status!=='draft-approved-for-preview'||review.runtimeVerified!==false||review.report?.path!==prefix+'normalized/normalized.json'||review.frames?.length!==report.frames?.length)throw Error('Matching draft motion review is required');
 for(const [kind,master] of Object.entries(report.masters||{}))if(review.sourceMasters?.[kind]?.path!==master.path||review.sourceMasters?.[kind]?.sha256!==master.sha256)throw Error('Motion review source mismatch');
 for(const source of report.frames||[]){
  const approved=review.frames.find(f=>f.kind===source.kind&&f.label===source.label);
  if(!approved||approved.path!==source.path||approved.sha256!==source.sha256||JSON.stringify(approved.anchor)!==JSON.stringify(source.outputAnchor)||approved.calibratedScale!==source.calibratedScale)throw Error('Motion review frame mismatch: '+source.label);
 }
 if(review.numeric?.allAnchorsManuallyReviewed!==true||review.numeric?.meaningfulOutputPixelsOmitted!==0)throw Error('Motion review must confirm anchors and zero meaningful clipping');
 const byKey=new Map();
 for(const frame of report.frames||[]){
  if(frame.reviewedAnchor!==true||frame.omittedMeaningfulPixels!==0)throw Error('Unreviewed anchor or meaningful clipped frame: '+frame.label);
  const key=frame.kind+'/'+frame.label;
  if(byKey.has(key)||!safeAsset(frame.path)||!frame.path.startsWith(prefix+'normalized/')||!/^[a-f0-9]{64}$/.test(frame.sha256))throw Error('Invalid motion frame '+key);
  byKey.set(key,frame);
 }
 const make=(kind,label,durationMs)=>{
  const source=byKey.get(kind+'/'+label);if(!source)throw Error('Missing actual frame '+kind+'/'+label);
  const canvas=report.output?.size,anchor=source.outputAnchor;
  if(!Array.isArray(canvas)||canvas.length!==2||canvas.some(n=>!Number.isInteger(n)||n<=0)||!Array.isArray(anchor)||anchor.length!==2)throw Error('Missing frame geometry');
  return {asset:source.path,sha256:source.sha256,durationMs,canvas,anchors:{feet:anchor.map((n,i)=>n/canvas[i])},registration:{feetSource:source.reviewedAnchor?'manual-visible-contact-estimate':'unreviewed',reviewStatus:review.status,sourceAnchor:source.anchor,calibratedScale:source.calibratedScale}};
 };
 proposal.designFrame??=structuredClone(proposal.stances.neutral.frames[0]);
 proposal.provenance.designSha256??=proposal.designFrame.sha256;
 for(const stance of STANCES)proposal.stances[stance]={frames:[make('stances',stance,1000)]};
 proposal.animations??={};
 for(const action of Object.keys(CLIP_TIMINGS)){
  const timings=provenance.clips?.[action]?.durations;
  if(!Array.isArray(timings)||timings.length!==4||timings.some(n=>!Number.isFinite(n)||n<=0))throw Error('Four positive metadata durations are required: '+action);
  proposal.animations[action]={frames:timings.map((duration,i)=>make('motion',action+'-'+String(i+1).padStart(2,'0'),duration))};
 }
 proposal.reactions??={};
 for(const reaction of REACTIONS)proposal.reactions[reaction]={frames:[make('damage',reaction,600)]};
 proposal.motionProvenance={status:'draft-unpublished',report:prefix+'normalized/normalized.json',sourceMasters:report.masters,provenancePath:prefix+'provenance.json',sourceProvenance:provenance,reviewPath:prefix+'motion-review.json',review,manualReview:report.manualReview||null,previewPolicy:report.previewPolicy||null,masterScaleCalibration:report.bodyScaleRelation?.perMasterCalibration||report.masterScaleCalibration||null,bodyScaleRelation:report.bodyScaleRelation||null,runtimeAlignment:report.runtimeAlignment||provenance.runtimeAlignment||provenance.normalization?.runtimeAlignment||null,runtimeVerified:review.runtimeVerified};
 const errors=validateManifest(next);if(errors.length)throw Error(errors.join('; '));
 return next;
}
