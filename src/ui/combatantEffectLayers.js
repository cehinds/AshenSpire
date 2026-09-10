import {combatPoseAttachment,COMBATANT_EFFECT_PLANES,ATTACHMENT_SIZE} from '../content/combatEffectAnchors.js';
import {combatEffectFrames} from './assets.js';
import {combatEffectOpacity} from '../content/combatEffectPresentation.js';
import {reducedMotionRequested} from './motion.js';
import { hintImage } from './imageHints.js';
const visiblePose=stage=>stage.querySelector('.studio-pose-frame')?.dataset.pose||stage.dataset.pose;

// Mount inside the pose's 640px canvas: character transforms, zoom and facing
// apply to these siblings together. The isolated rear plane stays under the art.
export function mountCombatantEffectLayers(host,kind,{actor,pose='idle',anchor='weapon',frames=combatEffectFrames(kind),opacity=combatEffectOpacity(kind),scale=1}={}) {
 if(!host||!frames.length||!combatPoseAttachment(actor,pose,anchor))return null;
 const state={actor,pose,anchor,opacity,scale,behind:true,front:true};
 const nodes=COMBATANT_EFFECT_PLANES.map(part=>{
  const el=hintImage(document.createElement('img'));el.className='combatant-effect-layer';el.alt='';el.setAttribute('aria-hidden','true');el.dataset.effect=kind;el.dataset.plane=part.plane;
  Object.assign(el.style,{position:'absolute',pointerEvents:'none',maxWidth:'none',maxHeight:'none',aspectRatio:'1',objectFit:'contain',zIndex:part.plane==='behind'?'-1':'2',maskImage:part.mask,webkitMaskImage:part.mask});host.append(el);return {el,part};
 });
 let stopped=false;
 const update=options=>{if(stopped)return;Object.assign(state,options);const point=combatPoseAttachment(state.actor,state.pose,state.anchor);for(const {el,part} of nodes){el.hidden=!point||!state[part.plane];if(!point)continue;el.dataset.anchor=state.anchor;el.dataset.pose=state.pose;Object.assign(el.style,{left:point.x/640*100+'%',top:point.y/640*100+'%',width:(ATTACHMENT_SIZE[state.anchor]||260)*state.scale/640*100+'%',height:'auto',opacity:String(Math.max(0,Math.min(1,state.opacity))*part.opacity),transform:`translate(-50%,-50%) rotate(${point.rotation}deg)`});}};
 const show=frame=>{if(stopped)return;const i=Math.max(0,Math.min(frames.length-1,Math.floor(frame)));for(const {el}of nodes){el.src=frames[i];el.dataset.frame=String(i+1);}};
 update({});show(0);
 return {show,update,stop(){stopped=true;for(const {el}of nodes)el.remove();}};
}

export function playCombatantEffectLayers(actor,kind,{anchor='weapon',duration=260,delay=0,scale=1,onStop=()=>{}}={}) {
 const stage=actor?.matches?.('.painted-stage')?actor:actor?.querySelector?.('.painted-stage');
 if(!stage||reducedMotionRequested()||document.body.classList.contains('reduce-flashes'))return null;
 if(!combatPoseAttachment(stage.dataset.poseClass,visiblePose(stage),anchor))return null;
 const host=stage.querySelector('.pose-layer');if(!host)return null;
 let layers=null,raf=0,stopped=false;const start=performance.now()+delay;
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(raf);layers?.stop();onStop();};
 const tick=now=>{
  if(stopped)return;if(!stage.isConnected||now>=start+duration){stop();return;}
  if(now>=start){
   layers ||= mountCombatantEffectLayers(host,kind,{actor:stage.dataset.poseClass,pose:visiblePose(stage),anchor,scale});
   layers?.update({pose:visiblePose(stage)});layers?.show(Math.floor((now-start)/duration*6));
  }
  raf=requestAnimationFrame(tick);
 };
 raf=requestAnimationFrame(tick);return stop;
}

// A temporary zero-size marker lets the browser apply every ancestor transform
// before the shared geometry helper converts the cast point into overlay space.
export function combatantEmissionBox(actor,anchor,localBox,layer) {
 const stage=actor?.querySelector?.('.painted-stage'),host=stage?.querySelector('.pose-layer');
 const point=stage&&combatPoseAttachment(stage.dataset.poseClass,visiblePose(stage),anchor);if(!host||!point)return null;
 const marker=document.createElement('i');marker.style.cssText=`position:absolute;pointer-events:none;width:0;height:0;left:${point.x/640*100}%;top:${point.y/640*100}%;`;
 host.append(marker);const box=localBox(layer,marker);marker.remove();return box;
}
