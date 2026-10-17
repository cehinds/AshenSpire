// Pure proposal contract. No gameplay selection or image fallback.
export const STANCES = ['neutral','smash','attack','sweep','counter','defend','evade','spell','preparing'];
export const VERSION_IDS = Array.from({length:10},(_,i)=>'v'+String(i+1).padStart(2,'0'));
export function safeAsset(value) {
 return typeof value==='string' && /^(?:assets(?:-alternative)?|art\/enemy-back-proposals)\/[a-zA-Z0-9_./-]+\.(?:png|webp)$/.test(value) && !value.split('/').includes('..') ? value : null;
}
export function proposalsOf(actor) { return VERSION_IDS.map(id=>actor.proposals?.find(p=>p.id===id)||{id,status:'missing',perspective:'rear',stances:{}}); }
export function framesOf(proposal,stance) { return proposal?.perspective==='rear' ? (proposal.stances?.[stance]?.frames||[]).filter(f=>safeAsset(f.asset)) : []; }
export function frameAt(frames,time) {
 const duration=frames.reduce((n,f)=>n+f.durationMs,0);
 if(!duration)return null;
 let t=((time%duration)+duration)%duration;
 for(const frame of frames){if(t<frame.durationMs)return frame;t-=frame.durationMs;}
 return frames.at(-1);
}
export function coverage(actor) {
 const proposals=proposalsOf(actor);
 return {designs:proposals.filter(p=>STANCES.some(s=>framesOf(p,s).length)).length,fullSets:proposals.filter(p=>STANCES.every(s=>framesOf(p,s).length)).length,total:10};
}
export function validateManifest(m) {
 const errors=[];const fail=s=>errors.push(s);
 if(m?.schemaVersion!==1)return ['Unsupported manifest schema'];
 if(!['pending','ten-designs','ten-full-sets'].includes(m.scope))fail('Unknown proposal scope');
 if(!Array.isArray(m.actors))return [...errors,'Actors must be an array'];
 const actors=new Set();
 for(const a of m.actors){
  if(!a.id||actors.has(a.id))fail('Actor IDs must be unique');actors.add(a.id);
  if(a.defaultStance!==null&&!STANCES.includes(a.defaultStance))fail(a.id+': invalid default stance');
  const ids=new Set();
  for(const p of a.proposals||[]){
   const at=a.id+'/'+p.id;
   if(!VERSION_IDS.includes(p.id)||ids.has(p.id))fail(at+': invalid or duplicate version');ids.add(p.id);
   if(p.perspective!=='rear')fail(at+': proposals must depict the rear');
   let painted=false;
   for(const [stance,sequence] of Object.entries(p.stances||{})){
    if(!STANCES.includes(stance))fail(at+': unknown stance');
    for(const f of sequence.frames||[]){
     painted=true;
     if(!safeAsset(f.asset))fail(at+': invalid asset path');
     if(!Number.isFinite(f.durationMs)||f.durationMs<=0)fail(at+': invalid frame duration');
     if(!Array.isArray(f.canvas)||f.canvas.length!==2||f.canvas.some(v=>!Number.isInteger(v)||v<=0))fail(at+': invalid canvas');
     if(!f.anchors?.feet)fail(at+': feet anchor required');
     for(const xy of Object.values(f.anchors||{}))if(!Array.isArray(xy)||xy.length!==2||xy.some(v=>!Number.isFinite(v)||v<0||v>1))fail(at+': anchors must be normalized');
    }
   }
   if(painted && (!p.provenance?.sourceSha256?.match(/^[a-f0-9]{64}$/)||!p.provenance?.prompt||!['draft-unpublished','released'].includes(p.provenance?.publicationStatus)||(p.provenance?.publicationStatus==='released'&&!p.provenance?.artRelease)))fail(at+': artwork requires hash, prompt and explicit publication status');
   if(p.status==='missing'&&painted)fail(at+': missing proposal has artwork');
  }
 }
 return errors;
}
