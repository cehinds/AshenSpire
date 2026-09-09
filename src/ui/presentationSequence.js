import {sample,validate,resolveBindings,ANCHORS} from '../model/presentationSequence.js';
import {COMBAT_EFFECT_ART} from '../content/combatEffectArt.js';
import {POSE_EFFECT_ART} from '../content/poseEffectArt.js';
import {PRESENTATION_POSES as PAINTED_OUTFITS} from '../model/presentationPoseCatalog.js';
import {assetUrl} from './assetmap.js';
import {reducedMotionRequested} from './motion.js';
const frames={...COMBAT_EFFECT_ART,...POSE_EFFECT_ART},actors=new WeakMap();
const catalog={effects:Object.keys(frames),actors:Object.keys(PAINTED_OUTFITS),poses:id=>Object.keys(PAINTED_OUTFITS[id]?.frames||{})};
let cachedText,cachedProject;
function activeProject(){try{const text=localStorage.getItem('ashenspire.pose-studio.active.v1');if(text!==cachedText){cachedText=text;cachedProject=null;if(text&&text.length<40000000){const p=JSON.parse(text);if(!validate(p,catalog).length)cachedProject=p;}}return cachedProject;}catch{return null;}}
// Opt-in authoring preview only. Receipts/callers still own damage and targets.
// Adapters for other providers can pass the same typed context to this API.
export function playPresentationSequence(layer,from,context,{targets=[],duration=600,project=activeProject(),onStop=()=>{}}={}){
 if(!project||!layer||!from||reducedMotionRequested()||document.body.classList.contains('reduce-flashes')||validate(project,catalog).length)return null;
 const resolved=resolveBindings(project,context||{});if(!resolved.winner||resolved.conflict)return null;
 const layerBox=layer.getBoundingClientRect(),center={x:layerBox.left+from.left+from.width/2,y:layerBox.top+from.top+from.height/2};
 const stages=[...(layer.parentElement||layer).querySelectorAll('.painted-stage')];
 const stage=stages.sort((a,b)=>{const distance=el=>{const r=el.getBoundingClientRect();return Math.hypot(r.left+r.width/2-center.x,r.top+r.height/2-center.y);};return distance(a)-distance(b);})[0];
 const original=stage?.querySelector('.pose-frame'),sameActor=stage?.dataset.poseClass===project.actor;
 let poseOverlay=null,oldVisibility='',raf=0,stopped=false;
 if(original&&sameActor){actors.get(original)?.();oldVisibility=original.style.visibility;poseOverlay=original.cloneNode();poseOverlay.classList.add('studio-pose-frame');original.parentElement.append(poseOverlay);original.style.visibility='hidden';}
 const nodes=new Map(),started=performance.now(),ms=Math.max(96,Math.min(5000,duration));
 const url=path=>project.assets[path]||assetUrl(path);
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(raf);for(const img of nodes.values())img.remove();poseOverlay?.remove();if(original&&actors.get(original)===stop){original.style.visibility=oldVisibility;actors.delete(original);}onStop();};
 if(poseOverlay)actors.set(original,stop);
 const render=now=>{
  if(stopped)return;const time=(now-started)/ms*project.duration;if(time>=project.duration){stop();return;}
  const view=sample(project,time),live=new Set();
  if(poseOverlay){const pose=view.pose,src=project.assets['pose:'+pose]||url(PAINTED_OUTFITS[project.actor].frames[pose]?.file||PAINTED_OUTFITS[project.actor].frames.idle.file);if(poseOverlay.getAttribute('src')!==src)poseOverlay.src=src;}
  for(const clip of view.effects){
   // Target anchors/travel only appear for actual recipients from the caller.
   const recipients=clip.anchor==='target'||clip.travel?targets:[null];
   for(let i=0;i<recipients.length;i++){
    const key=clip.id+':'+i;live.add(key);let img=nodes.get(key);if(!img){img=document.createElement('img');img.className='studio-combat-effect';img.alt='';img.setAttribute('aria-hidden','true');img.style.cssText='position:absolute;pointer-events:none;object-fit:contain;';nodes.set(key,img);layer.append(img);}
    img.src=url(frames[clip.effect][clip.frame]);img.dataset.effect=clip.effect;
    const target=recipients[i],sx=from.width/230,sy=from.height/350;
    let x=from.left+from.width/2+(clip.x-ANCHORS.torso[0])*1000*sx,y=from.top+from.height*.5+(clip.y-ANCHORS.torso[1])*600*sy;
    if(target){const tx=target.left+target.width/2,ty=target.top+target.height/2;if(clip.travel){const anchor=project.anchors[clip.anchor]||ANCHORS.hand,authored=project.clips.find(c=>c.id===clip.id);const ox=from.left+from.width/2+(anchor[0]-.3)*1000*sx+authored.x*sx,oy=from.top+from.height/2+(anchor[1]-.55)*600*sy+authored.y*sy;const ex=tx+(project.anchors.target[0]-ANCHORS.target[0])*1000*sx,ey=ty+(project.anchors.target[1]-ANCHORS.target[1])*600*sy;x=ox+(ex-ox)*clip.progress;y=oy+(ey-oy)*clip.progress;}else{x=tx+(clip.x-ANCHORS.target[0])*1000*sx;y=ty+(clip.y-ANCHORS.target[1])*600*sy;}}
    const size=clip.size*sx;Object.assign(img.style,{left:x-size/2+'px',top:y-size/2+'px',width:size+'px',height:size+'px',opacity:String(clip.opacity),transform:`rotate(${clip.rotation}deg)`,zIndex:clip.layer==='behind'?'0':'5'});
   }
  }
  for(const [key,img]of nodes)if(!live.has(key)){img.remove();nodes.delete(key);}raf=requestAnimationFrame(render);
 };raf=requestAnimationFrame(render);return stop;
}
