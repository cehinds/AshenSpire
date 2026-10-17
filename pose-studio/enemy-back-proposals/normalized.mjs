import {VERSION_IDS,validateManifest,safeAsset} from './model.mjs';
/** Converts verified normalization metadata to drafts, never attack animations. */
export function normalizedProposals(actorId,report,provenance) {
 if(!/^[a-zA-Z0-9_-]+$/.test(actorId)||(provenance.actorId||provenance.enemyId)!==actorId)throw Error('Canonical actor mismatch');
 if(report.qa?.errors?.length)throw Error('Normalization reports errors');
 if(!/^[a-f0-9]{64}$/.test(report.source?.sha256||''))throw Error('Missing source hash');
 if(!provenance.prompt&&!provenance.promptSummary)throw Error('Missing generation prompt');
 if(report.variants?.length!==10||new Set(report.variants.map(v=>v.id)).size!==10)throw Error('Expected ten distinct variants');
 return report.variants.map(v=>{
  if(!VERSION_IDS.includes(v.id)||v.sourceBoundaryClipped)throw Error('Invalid or clipped variant '+v.id);
  if(!/^[a-f0-9]{64}$/.test(v.sha256||''))throw Error('Missing output hash');
  const asset='art/enemy-back-proposals/'+actorId+'/'+v.id+'.png';
  if(!safeAsset(asset))throw Error('Invalid draft asset');
  return {id:v.id,status:'draft',perspective:'rear',provenance:{sourceSha256:report.source.sha256,prompt:provenance.prompt||provenance.promptSummary,promptKind:provenance.prompt?'exact':'summary',sourceReferences:provenance.sourceReferences||[],publicationStatus:'draft-unpublished',artRelease:null,normalization:'art/enemy-back-proposals/'+actorId+'/normalized.json',cropReview:report.cropPlan?.status||'pending'},stances:{neutral:{frames:[{asset,sha256:v.sha256,durationMs:1000,canvas:v.size,anchors:{feet:v.anchor.map((n,i)=>n/v.size[i])}}]}}};
 });
}
export function integrateNormalized(manifest,actorId,report,provenance){
 const next=structuredClone(manifest),actor=next.actors.find(a=>a.id===actorId);
 if(!actor)throw Error('Actor is not in the audited roster');
 const incoming=normalizedProposals(actorId,report,provenance);
 actor.proposals=incoming.map(nextProposal=>{
  const previous=actor.proposals.find(p=>p.id===nextProposal.id);if(!previous)return nextProposal;
  const hasMotion=Object.keys(previous.animations||{}).length>0||Object.keys(previous.stances||{}).some(s=>s!=='neutral')||['reviewed','selected'].includes(previous.status);
  const same=previous.provenance?.sourceSha256===nextProposal.provenance.sourceSha256&&previous.stances?.neutral?.frames?.[0]?.sha256===nextProposal.stances.neutral.frames[0].sha256;
  if(hasMotion&&!same)throw Error('Source change would discard authored motion or review: '+nextProposal.id);
  if(same)return {...previous,...nextProposal,status:previous.status,stances:{...previous.stances,...nextProposal.stances},...(previous.animations?{animations:previous.animations}:{})};
  return nextProposal;
 });
 actor.provisionalDefaultVersion??='v01';actor.defaultStance??='neutral';
 // A provisional design is review-only; no delivered full-set claim.
 next.scope='pending';next.targetScope=manifest.targetScope||'ten-designs';
 const errors=validateManifest(next);if(errors.length)throw Error(errors.join('; '));
 return next;
}
