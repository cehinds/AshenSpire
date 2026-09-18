import {uiConfig} from '../config/generated/ui.js';
import {thaw} from '../config/authored.js';

// Cues, anchors and the starter project live in
// content/config/ui/presentation/presentationSequence.json.
const SEQ=uiConfig.presentation.presentationSequence;
const LIM={...SEQ.behavior.limits,...SEQ.positioning},MSG=SEQ.components.messages,FR=SEQ.motion.frames;
const fill=(t,v)=>Object.entries(v).reduce((s,[k,x])=>s.split(`{${k}}`).join(String(x)),t);
export const VERSION=SEQ.behavior.schemaVersion;
export const CUES=thaw(SEQ.motion.cues);
export const ANCHORS=thaw(SEQ.positioning.anchors);
export const clone=value=>JSON.parse(JSON.stringify(value));
export const title=id=>id.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
export function starter(){return thaw(SEQ.components.starter);}
export function startTime(clip,project){return (CUES[clip.cue]??0)*project.duration+clip.offset;}
export function sample(project,time,{reducedMotion=false,reduceFlashes=false,direction='right'}={}){
 const t=Math.max(0,Math.min(project.duration,time)),poseIndex=Math.min(project.poses.length-1,Math.floor(t/project.duration*project.poses.length));
 const effects=reduceFlashes?[]:project.clips.filter(c=>!c.muted&&t>=startTime(c,project)&&t<startTime(c,project)+c.duration).map(c=>{
  const progress=(t-startTime(c,project))/c.duration,anchor=project.anchors[c.anchor]||ANCHORS.torso;
  let x=anchor[0]+c.x/LIM.referenceWidth,y=anchor[1]+c.y/LIM.referenceHeight;
  if(c.travel){const target=project.anchors.target; x+=(target[0]-x)*progress;y+=(target[1]-y)*progress;}
  if(direction==='left')x=1-x;
  return {...c,x,y,frame:reducedMotion?FR.reducedMotionIndex:Math.min(FR.lastIndex,Math.floor(progress*FR.count)),progress};
 });
 return {pose:project.poses[poseIndex],poseIndex,effects};
}
export function resolveBindings(project,context){
 const tags=new Set((context.tags||[]).map(t=>String(t).replace(/^fx:/,'')));
 const rows=project.bindings.map(b=>{
  const reasons=[];
  if(!b.enabled)reasons.push('disabled');
  if(b.provider!==context.provider)reasons.push('provider differs');
  if(b.kind!=='any'&&b.kind!==context.kind)reasons.push('object kind differs');
  if(b.objectId&&b.objectId!==context.objectId)reasons.push('object ID differs');
  if(b.event!==context.event)reasons.push('event differs');
  if(!b.all.every(t=>tags.has(t)))reasons.push('required tags missing');
  if(b.any.length&&!b.any.some(t=>tags.has(t)))reasons.push('no optional tag matched');
  if(b.none.some(t=>tags.has(t)))reasons.push('excluded tag present');
  const mana=Number(context.manaSpent)||0,stamina=Number(context.staminaSpent)||0,actions=Number(context.energySpent)||0;
  if(b.resource==='mana'&&mana<=0||b.resource==='stamina'&&stamina<=0||b.resource==='resource'&&mana+stamina<=0||b.resource==='mundane'&&mana+stamina>0||b.resource==='highAction'&&(mana+stamina>0||actions<SEQ.behavior.highActionMinimum))reasons.push('payment condition not met');
  return {id:b.id,name:b.name,match:!reasons.length,reasons,score:b.priority+(b.objectId?SEQ.behavior.bindingScore.objectMatch:0)};
 });
 const matches=rows.filter(r=>r.match).sort((a,b)=>b.score-a.score),conflict=matches.length>1&&matches[0].score===matches[1].score;
 return {rows,conflict,winner:conflict?null:matches[0]||null};
}
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const string=(v,max=SEQ.behavior.limits.defaultStringLength)=>typeof v==='string'&&v.length<=max;
const identifier=v=>string(v)&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
export function validate(project,catalog=null){
 const errors=[];
 if(!project||project.schemaVersion!==VERSION)return ['Unsupported project version'];
 if(!identifier(project.id)||!string(project.name)||!project.name)errors.push('Project needs a safe ID and name');
 if(!finite(project.duration,LIM.durationMs.min,LIM.durationMs.max))errors.push(fill(MSG.duration,LIM.durationMs));
 if(!Array.isArray(project.poses)||project.poses.length<LIM.poses.min||project.poses.length>LIM.poses.max||project.poses.some(p=>!string(p)))errors.push(fill(MSG.poses,LIM.poses));
 if(!string(project.actor)||catalog&&!catalog.actors.includes(project.actor))errors.push('Unknown character');
 if(!project.anchors||Object.keys(ANCHORS).some(key=>!Array.isArray(project.anchors[key])||project.anchors[key].length!==LIM.anchorPair||project.anchors[key].some(n=>!finite(n,0,1))))errors.push('Anchors must be normalized stage positions');
 if(!Array.isArray(project.clips)||project.clips.length>LIM.maxClips)return [...errors,fill(MSG.tooManyClips,{max:LIM.maxClips})];
 const ids=new Set();
 for(const c of project.clips){
  if(!c||!identifier(c.id)||ids.has(c.id)){errors.push('Effect IDs must be safe and unique');continue;}ids.add(c.id);
  if(!string(c.effect)||catalog&&!catalog.effects.includes(c.effect))errors.push(`Missing effect: ${c.effect}`);
  if(!Object.hasOwn(CUES,c.cue)||!Object.hasOwn(ANCHORS,c.anchor))errors.push(`Unknown cue or anchor: ${c.id}`);
  if(!finite(c.offset,LIM.clip.offsetMs.min,LIM.clip.offsetMs.max)||!finite(c.duration,LIM.clip.durationMs.min,LIM.clip.durationMs.max)||!finite(c.x,LIM.clip.x.min,LIM.clip.x.max)||!finite(c.y,LIM.clip.y.min,LIM.clip.y.max)||!finite(c.size,LIM.clip.size.min,LIM.clip.size.max)||!finite(c.opacity,0,1)||!finite(c.rotation,LIM.clip.rotationDeg.min,LIM.clip.rotationDeg.max))errors.push(`Invalid effect dimensions/timing: ${c.id}`);
  if(!['front','behind','aura'].includes(c.layer)||typeof c.muted!=='boolean'||typeof c.travel!=='boolean')errors.push(`Invalid effect layer/options: ${c.id}`);
 }
 if(!Array.isArray(project.bindings)||project.bindings.length>LIM.maxBindings)return [...errors,'Invalid bindings'];
 ids.clear();
 for(const b of project.bindings){
  if(!b||!identifier(b.id)||ids.has(b.id)){errors.push('Binding IDs must be safe and unique');continue;}ids.add(b.id);
  if(!['all','any','none'].every(k=>Array.isArray(b[k])&&b[k].length<=LIM.binding.maxTags&&b[k].every(t=>string(t,LIM.binding.maxTagLength))))errors.push(`Invalid tags: ${b.id}`);
  if(!['provider','kind','objectId','event','name'].every(k=>string(b[k]))||!b.provider||!b.kind||!b.event||typeof b.enabled!=='boolean'||!finite(b.priority,LIM.binding.priority.min,LIM.binding.priority.max))errors.push(`Invalid binding: ${b.id}`);
  if(!['any','mana','stamina','resource','mundane','highAction'].includes(b.resource))errors.push(`Invalid payment: ${b.id}`);
 }
 if(!project.assets||typeof project.assets!=='object'||Array.isArray(project.assets))errors.push('Invalid package assets');
 else for(const [key,src]of Object.entries(project.assets))if(!string(key,LIM.asset.maxKeyLength)||typeof src!=='string'||!/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)||src.length>LIM.asset.maxDataUrlLength)errors.push(`Invalid embedded image: ${key}`);
 if(!Array.isArray(project.dependencies)||project.dependencies.some(d=>!string(d)))errors.push('Invalid package dependencies');
 if(catalog&&Array.isArray(project.poses)&&project.poses.some(p=>!catalog.poses(project.actor).includes(p)&&!Object.hasOwn(project.assets||{},'pose:'+p)))errors.push('Missing character pose');
 return errors;
}
export function history(initial){let current=clone(initial),past=[],future=[];return {get value(){return clone(current);},get canUndo(){return !!past.length;},get canRedo(){return !!future.length;},set(next){past.push(clone(current));past=past.slice(-SEQ.behavior.historyDepth);current=clone(next);future=[];},undo(){if(past.length){future.push(current);current=past.pop();}},redo(){if(future.length){past.push(current);current=future.pop();}}};}
