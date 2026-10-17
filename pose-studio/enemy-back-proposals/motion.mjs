import {STANCES,REACTIONS,VERSION_IDS,safeAsset,validateManifest} from './model.mjs';
export const CLIP_TIMINGS={attack:[180,90,150,200],evade:[140,90,130,200]};
export function integrateMotion(manifest,actorId,report,provenance){
 const next=structuredClone(manifest),actor=next.actors.find(a=>a.id===actorId),proposal=actor?.proposals.find(p=>p.id==='v01');
 if(!proposal)throw Error('Actual v01 rear design is required');
 const original=proposal.designFrame||proposal.stances.neutral.frames[0];
 if(!provenance?.prompts||provenance.seed?.path!==original.asset)throw Error('Motion provenance must identify the original design seed');
 if(report.errors?.length||report.qa?.errors?.length)throw Error('Motion normalization reports errors');
 const prefix='art/enemy-back-motion/'+actorId+'/v01/';
 for(const master of Object.values(report.masters||{}))if(!safeAsset(master.path)||!master.path.startsWith(prefix)||!/^[a-f0-9]{64}$/.test(master.sha256))throw Error('Invalid motion master provenance');
 if(Object.keys(report.masters||{}).length!==3)throw Error('Three source masters are required');
 const byKey=new Map();
 for(const frame of report.frames||[]){
  const key=frame.kind+'/'+frame.label;
  if(byKey.has(key)||!safeAsset(frame.path)||!frame.path.startsWith(prefix+'normalized/')||!/^[a-f0-9]{64}$/.test(frame.sha256))throw Error('Invalid motion frame '+key);
  byKey.set(key,frame);
 }
 const make=(kind,label,durationMs)=>{
  const source=byKey.get(kind+'/'+label);if(!source)throw Error('Missing actual frame '+kind+'/'+label);
  const canvas=report.output?.size,anchor=source.outputAnchor;
  if(!Array.isArray(canvas)||canvas.length!==2||canvas.some(n=>!Number.isInteger(n)||n<=0)||!Array.isArray(anchor)||anchor.length!==2)throw Error('Missing frame geometry');
  return {asset:source.path,sha256:source.sha256,durationMs,canvas,anchors:{feet:anchor.map((n,i)=>n/canvas[i])},registration:{feetSource:source.reviewedAnchor?'manual-visible-contact-estimate':'unreviewed',reviewStatus:report.manualReview?.status||'pending',sourceAnchor:source.anchor,calibratedScale:source.calibratedScale}};
 };
 proposal.designFrame??=structuredClone(proposal.stances.neutral.frames[0]);
 proposal.provenance.designSha256??=proposal.designFrame.sha256;
 for(const stance of STANCES)proposal.stances[stance]={frames:[make('stances',stance,1000)]};
 proposal.animations??={};
 for(const [action,timings] of Object.entries(CLIP_TIMINGS))proposal.animations[action]={frames:timings.map((duration,i)=>make('motion',action+'-'+String(i+1).padStart(2,'0'),duration))};
 proposal.reactions??={};
 for(const reaction of REACTIONS)proposal.reactions[reaction]={frames:[make('damage',reaction,600)]};
 proposal.motionProvenance={status:'draft-unpublished',report:prefix+'normalized/normalized.json',sourceMasters:report.masters,provenancePath:prefix+'provenance.json',sourceProvenance:provenance,manualReview:report.manualReview||null,previewPolicy:report.previewPolicy||null,masterScaleCalibration:report.masterScaleCalibration||null};
 const errors=validateManifest(next);if(errors.length)throw Error(errors.join('; '));
 return next;
}
