export const VERSION=1;
export const CUES={anticipation:0,release:.3,contact:.5,recovery:.78};
export const ANCHORS={hand:[.40,.48],weapon:[.49,.39],shield:[.38,.55],torso:[.30,.55],feet:[.30,.85],target:[.76,.55],ground:[.52,.85]};
export const clone=value=>JSON.parse(JSON.stringify(value));
export const title=id=>id.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
export function starter(){return {schemaVersion:VERSION,id:'local.shield-bash',name:'Shield bash · contact study',actor:'reaver',duration:1200,poses:['idle','shieldBash1','shieldBash2','shieldBash3','guard','idle'],anchors:clone(ANCHORS),clips:[{id:'clip.contact',effect:'shieldBash',cue:'contact',offset:0,duration:430,anchor:'shield',x:0,y:0,size:180,rotation:0,opacity:.9,layer:'front',travel:false,muted:false}],bindings:[{id:'binding.shield',name:'Shield attack',provider:'ashenspire',kind:'card',objectId:'',event:'actionResolved',all:['shield'],any:[],none:[],resource:'any',priority:10,enabled:true}],dependencies:[],assets:{}};}
export function startTime(clip,project){return (CUES[clip.cue]??0)*project.duration+clip.offset;}
export function sample(project,time,{reducedMotion=false,reduceFlashes=false,direction='right'}={}){
 const t=Math.max(0,Math.min(project.duration,time)),poseIndex=Math.min(project.poses.length-1,Math.floor(t/project.duration*project.poses.length));
 const effects=reduceFlashes?[]:project.clips.filter(c=>!c.muted&&t>=startTime(c,project)&&t<startTime(c,project)+c.duration).map(c=>{
  const progress=(t-startTime(c,project))/c.duration,anchor=project.anchors[c.anchor]||ANCHORS.torso;
  let x=anchor[0]+c.x/1000,y=anchor[1]+c.y/600;
  if(c.travel){const target=project.anchors.target; x+=(target[0]-x)*progress;y+=(target[1]-y)*progress;}
  if(direction==='left')x=1-x;
  return {...c,x,y,frame:reducedMotion?2:Math.min(5,Math.floor(progress*6)),progress};
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
  if(b.resource==='mana'&&mana<=0||b.resource==='stamina'&&stamina<=0||b.resource==='resource'&&mana+stamina<=0||b.resource==='mundane'&&mana+stamina>0||b.resource==='highAction'&&(mana+stamina>0||actions<2))reasons.push('payment condition not met');
  return {id:b.id,name:b.name,match:!reasons.length,reasons,score:b.priority+(b.objectId?10000:0)};
 });
 const matches=rows.filter(r=>r.match).sort((a,b)=>b.score-a.score),conflict=matches.length>1&&matches[0].score===matches[1].score;
 return {rows,conflict,winner:conflict?null:matches[0]||null};
}
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const string=(v,max=160)=>typeof v==='string'&&v.length<=max;
const identifier=v=>string(v)&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
export function validate(project,catalog=null){
 const errors=[];
 if(!project||project.schemaVersion!==VERSION)return ['Unsupported project version'];
 if(!identifier(project.id)||!string(project.name)||!project.name)errors.push('Project needs a safe ID and name');
 if(!finite(project.duration,100,30000))errors.push('Sequence duration must be 100–30000 ms');
 if(!Array.isArray(project.poses)||project.poses.length<5||project.poses.length>7||project.poses.some(p=>!string(p)))errors.push('Choose five to seven pose frames');
 if(!string(project.actor)||catalog&&!catalog.actors.includes(project.actor))errors.push('Unknown character');
 if(!project.anchors||Object.keys(ANCHORS).some(key=>!Array.isArray(project.anchors[key])||project.anchors[key].length!==2||project.anchors[key].some(n=>!finite(n,0,1))))errors.push('Anchors must be normalized stage positions');
 if(!Array.isArray(project.clips)||project.clips.length>100)return [...errors,'Too many effects (maximum 100)'];
 const ids=new Set();
 for(const c of project.clips){
  if(!c||!identifier(c.id)||ids.has(c.id)){errors.push('Effect IDs must be safe and unique');continue;}ids.add(c.id);
  if(!string(c.effect)||catalog&&!catalog.effects.includes(c.effect))errors.push(`Missing effect: ${c.effect}`);
  if(!Object.hasOwn(CUES,c.cue)||!Object.hasOwn(ANCHORS,c.anchor))errors.push(`Unknown cue or anchor: ${c.id}`);
  if(!finite(c.offset,-30000,30000)||!finite(c.duration,60,30000)||!finite(c.x,-1000,1000)||!finite(c.y,-600,600)||!finite(c.size,20,800)||!finite(c.opacity,0,1)||!finite(c.rotation,-360,360))errors.push(`Invalid effect dimensions/timing: ${c.id}`);
  if(!['front','behind','aura'].includes(c.layer)||typeof c.muted!=='boolean'||typeof c.travel!=='boolean')errors.push(`Invalid effect layer/options: ${c.id}`);
 }
 if(!Array.isArray(project.bindings)||project.bindings.length>100)return [...errors,'Invalid bindings'];
 ids.clear();
 for(const b of project.bindings){
  if(!b||!identifier(b.id)||ids.has(b.id)){errors.push('Binding IDs must be safe and unique');continue;}ids.add(b.id);
  if(!['all','any','none'].every(k=>Array.isArray(b[k])&&b[k].length<=40&&b[k].every(t=>string(t,80))))errors.push(`Invalid tags: ${b.id}`);
  if(!['provider','kind','objectId','event','name'].every(k=>string(b[k]))||!b.provider||!b.kind||!b.event||typeof b.enabled!=='boolean'||!finite(b.priority,-999,999))errors.push(`Invalid binding: ${b.id}`);
  if(!['any','mana','stamina','resource','mundane','highAction'].includes(b.resource))errors.push(`Invalid payment: ${b.id}`);
 }
 if(!project.assets||typeof project.assets!=='object'||Array.isArray(project.assets))errors.push('Invalid package assets');
 else for(const [key,src]of Object.entries(project.assets))if(!string(key,300)||typeof src!=='string'||!/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)||src.length>12000000)errors.push(`Invalid embedded image: ${key}`);
 if(!Array.isArray(project.dependencies)||project.dependencies.some(d=>!string(d)))errors.push('Invalid package dependencies');
 if(catalog&&Array.isArray(project.poses)&&project.poses.some(p=>!catalog.poses(project.actor).includes(p)&&!Object.hasOwn(project.assets||{},'pose:'+p)))errors.push('Missing character pose');
 return errors;
}
export function history(initial){let current=clone(initial),past=[],future=[];return {get value(){return clone(current);},get canUndo(){return !!past.length;},get canRedo(){return !!future.length;},set(next){past.push(clone(current));past=past.slice(-60);current=clone(next);future=[];},undo(){if(past.length){future.push(current);current=past.pop();}},redo(){if(future.length){past.push(current);current=future.pop();}}};}
