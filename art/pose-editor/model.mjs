export const SCHEMA='ashenspire.pose-sequence/v1';
export const uuid=()=>crypto.randomUUID();
export const clone=value=>structuredClone(value);
export const placement=()=>({x:0,y:0,scale:1,pivotX:0,pivotY:0});
export const entry=poseId=>({entryId:uuid(),poseId,durationMs:140,placement:placement()});
export function validPlacement(p){return p&&['x','y','pivotX','pivotY'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=8192)&&Number.isFinite(p.scale)&&p.scale>=0.1&&p.scale<=5}
export function validateProject(value,knownPoses){
 if(!value||value.schema!==SCHEMA)throw Error('Unsupported sequence file. Choose an exported pose-sequence JSON file.');
 const s=value.sequence;if(!s||typeof s.id!=='string'||typeof s.name!=='string'||s.name.length>120||!Array.isArray(s.entries)||s.entries.length>500)throw Error('Invalid sequence or more than 500 entries.');
 if(!Array.isArray(value.poses)||value.poses.length>1000)throw Error('Invalid pose catalog.');
 const uploads=[],ids=new Set(knownPoses.keys());
 for(const p of value.poses){
  if(knownPoses.has(p.id)&&!p.id.startsWith('upload:'))continue;
  if(typeof p.id!=='string'||!p.id.startsWith('upload:')||typeof p.label!=='string'||p.label.length>200||!/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(p.src)||p.src.length>28e6)throw Error('Invalid uploaded pose image. Only embedded PNG, JPEG or WebP is accepted.');
  if(!Number.isFinite(p.width)||!Number.isFinite(p.height)||p.width<1||p.height<1||p.width*p.height>16e6||!p.pivot||!Number.isFinite(p.pivot.x)||!Number.isFinite(p.pivot.y)||!Number.isFinite(p.scale)||p.scale<=0||p.scale>100)throw Error('Invalid pose dimensions or placement.');
  uploads.push({id:p.id,label:p.label,classId:String(p.classId||'uploaded').slice(0,60),outfit:'uploaded',kind:'uploaded',src:p.src,width:p.width,height:p.height,pivot:p.pivot,scale:p.scale});ids.add(p.id);
 }
 const seen=new Set();for(const e of s.entries){if(!e||typeof e.entryId!=='string'||seen.has(e.entryId)||!ids.has(e.poseId)||!Number.isFinite(e.durationMs)||e.durationMs<20||e.durationMs>5000||!validPlacement(e.placement))throw Error('Invalid entry, missing pose, timing or placement.');seen.add(e.entryId)}
 return {sequence:{id:s.id,name:s.name,revision:Number.isInteger(s.revision)?s.revision:0,entries:clone(s.entries)},uploads};
}
export function moveEntry(entries,from,to){const out=clone(entries),[item]=out.splice(from,1);out.splice(to>from?to-1:to,0,item);return out}
export function gapMatches(sequence,request){if(sequence.id!==request.sequenceId)return false;const i=sequence.entries.findIndex(e=>e.entryId===request.left.entryId);return i>=0&&sequence.entries[i+1]?.entryId===request.right.entryId&&sequence.entries[i].poseId===request.left.poseId&&sequence.entries[i+1].poseId===request.right.poseId&&JSON.stringify(sequence.entries[i].placement)===JSON.stringify(request.left.placement)&&JSON.stringify(sequence.entries[i+1].placement)===JSON.stringify(request.right.placement)}
