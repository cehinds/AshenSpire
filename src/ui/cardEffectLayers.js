import {CARD_EFFECT_LAYERS,LAYERED_CARD_EFFECTS,combatEffectOpacity} from '../content/combatEffectPresentation.js';
import {combatEffectFrames} from './assets.js';
import {combatEffectOrientation} from './combatEffectDirection.js';
import {reducedMotionRequested} from './motion.js';
import { hintImage } from './imageHints.js';

// The caller owns a stacking context with its card face at z=1. These are real
// sibling planes: the rear image is occluded by the face, not painted over it.
export function mountCardEffectLayers(host,kind,{opacity=combatEffectOpacity(kind),direction='right',frames=combatEffectFrames(kind)}={}){
 if(!host||!LAYERED_CARD_EFFECTS.includes(kind)||!frames.length)return null;
 const nodes=CARD_EFFECT_LAYERS.map(part=>{
  const el=hintImage(document.createElement('img'));el.className='card-effect-layer';el.dataset.effect=kind;el.dataset.plane=part.plane;el.alt='';el.setAttribute('aria-hidden','true');
  Object.assign(el.style,{position:'absolute',pointerEvents:'none',maxWidth:'none',width:part.scale*100+'%',height:'auto',aspectRatio:'1',objectFit:'contain',left:part.x*100+'%',top:part.y*100+'%',zIndex:part.plane==='behind'?'0':'2',maskImage:part.mask,webkitMaskImage:part.mask});
  host.append(el);return {el,part};
 });
 let stopped=false;
 const settings={opacity,direction,behind:true,front:true};
 const update=options=>{Object.assign(settings,options);for(const {el,part}of nodes){el.style.opacity=String(Math.max(0,Math.min(1,settings.opacity))*part.opacity);el.style.transform=`translate(-50%,-50%) ${combatEffectOrientation(settings.direction)}`;el.hidden=!settings[part.plane];}};
 const show=frame=>{if(stopped)return;const i=Math.max(0,Math.min(frames.length-1,Math.floor(frame)));for(const {el}of nodes){el.src=frames[i];el.dataset.frame=String(i+1);}};
 update({});show(0);
 return {show,update,stop:()=>{stopped=true;for(const {el}of nodes)el.remove();}};
}

export function playCardEffectLayers(host,kind,{duration=220,...options}={}){
 if(reducedMotionRequested()||document.body.classList.contains('reduce-flashes'))return ()=>{};
 const layers=mountCardEffectLayers(host,kind,options);if(!layers)return ()=>{};
 const timers=[];let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;timers.forEach(clearTimeout);layers.stop();};
 for(let i=1;i<6;i++)timers.push(setTimeout(()=>layers.show(i),duration*i/6));
 timers.push(setTimeout(stop,duration));return stop;
}
