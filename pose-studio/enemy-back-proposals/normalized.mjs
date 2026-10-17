import {VERSION_IDS,validateManifest,safeAsset,coverage} from './model.mjs';
/** Converts verified normalization metadata to drafts, never attack animations. */
export function normalizedProposals(actorId,report,provenance,footReview=null,cropApproval=null) {
 if(!/^[a-zA-Z0-9_-]+$/.test(actorId)||(provenance.actorId||provenance.enemyId)!==actorId)throw Error('Canonical actor mismatch');
 if(report.qa?.errors?.length)throw Error('Normalization reports errors');
 if(!/^[a-f0-9]{64}$/.test(report.source?.sha256||''))throw Error('Missing source hash');
 if(!provenance.prompt&&!provenance.promptSummary)throw Error('Missing generation prompt');
 if(report.variants?.length!==10||new Set(report.variants.map(v=>v.id)).size!==10)throw Error('Expected ten distinct variants');
 if(cropApproval){
  const rows=report.cropPlan?.rows?.map(row=>row.gutters.map(g=>g.cut));
  if(cropApproval.status!=='approved-for-draft-proposals'||cropApproval.sourceSha256!==report.source.sha256||cropApproval.horizontalCut!==report.cropPlan?.horizontal?.cut||JSON.stringify(cropApproval.rowCuts)!==JSON.stringify(rows))throw Error('Crop approval source or cut mismatch');
 }
 if(footReview&&(footReview.actorId!==actorId||footReview.sourceSha256!==report.source.sha256))throw Error('Foot review source mismatch');
 const references=provenance.sourceReferences||[provenance.source,provenance.cameraReference].filter(Boolean).map(ref=>({repository:ref.repository||ref.repo,ref:ref.ref,path:ref.path,blob:ref.blob||ref.sha}));
 return report.variants.map(v=>{
  if(!VERSION_IDS.includes(v.id)||v.sourceBoundaryClipped)throw Error('Invalid or clipped variant '+v.id);
  if(!/^[a-f0-9]{64}$/.test(v.sha256||''))throw Error('Missing output hash');
  const override=footReview?.overrides?.[v.id];
  if(override&&(override.imageSha256!==v.sha256||!Array.isArray(override.feetPixels)||override.feetPixels.length!==2||override.feetPixels.some((n,i)=>!Number.isFinite(n)||n<0||n>v.size[i])))throw Error('Foot override image or coordinates mismatch: '+v.id);
  const feet=override?.feetPixels||v.boundsAnchor||v.anchor;
  if(!Array.isArray(feet))throw Error('Missing frame registration: '+v.id);
  const asset='art/enemy-back-proposals/'+actorId+'/'+v.id+'.png';
  if(!safeAsset(asset))throw Error('Invalid draft asset');
  return {id:v.id,status:'draft',perspective:'rear',provenance:{sourceSha256:report.source.sha256,prompt:provenance.prompt||provenance.promptSummary,promptKind:provenance.prompt?'exact':'summary',sourceReferences:references,publicationStatus:'draft-unpublished',artRelease:null,normalization:'art/enemy-back-proposals/'+actorId+'/normalized.json',cropReview:cropApproval?.status||report.cropPlan?.status||'pending',...(cropApproval?{cropApproval}:{})},stances:{neutral:{frames:[{asset,sha256:v.sha256,durationMs:1000,canvas:v.size,anchors:{feet:feet.map((n,i)=>n/v.size[i])},registration:{boundsAnchorPixels:v.boundsAnchor||v.anchor,feetSource:override?'manual-visible-foot-draft':'bounds-floor-reference',footReviewStatus:footReview?.status||'not-independently-reviewed'}}]}}};
 });
}
export function integrateNormalized(manifest,actorId,report,provenance,footReview=null){
 const next=structuredClone(manifest),actor=next.actors.find(a=>a.id===actorId);
 if(!actor)throw Error('Actor is not in the audited roster');
 const incoming=normalizedProposals(actorId,report,provenance,footReview,cropApproval);
 actor.proposals=incoming.map(nextProposal=>{
  const previous=actor.proposals.find(p=>p.id===nextProposal.id);if(!previous)return nextProposal;
  const hasMotion=Object.keys(previous.animations||{}).length>0||Object.keys(previous.reactions||{}).length>0||Object.keys(previous.stances||{}).some(s=>s!=='neutral')||['reviewed','selected'].includes(previous.status);
  const same=previous.provenance?.sourceSha256===nextProposal.provenance.sourceSha256&&(previous.provenance?.designSha256||previous.designFrame?.sha256||previous.stances?.neutral?.frames?.[0]?.sha256)===nextProposal.stances.neutral.frames[0].sha256;
  if(hasMotion&&!same)throw Error('Source change would discard authored motion or review: '+nextProposal.id);
  if(same)return {...previous,...nextProposal,status:previous.status,provenance:{...nextProposal.provenance,...(previous.provenance.designSha256?{designSha256:previous.provenance.designSha256}:{})},stances:previous.motionProvenance?{...nextProposal.stances,...previous.stances}:{...previous.stances,...nextProposal.stances},...(previous.animations?{animations:previous.animations}:{})};
  return nextProposal;
 });
 actor.provisionalDefaultVersion??='v01';actor.defaultStance??='neutral';
 // A provisional design is review-only; no delivered full-set claim.
 next.targetScope=manifest.targetScope||'ten-designs';
 next.scope=next.actors.every(a=>next.targetScope==='ten-full-sets'?coverage(a).fullSets===10:coverage(a).designs===10)?next.targetScope:'pending';
 const errors=validateManifest(next);if(errors.length)throw Error(errors.join('; '));
 return next;
}
