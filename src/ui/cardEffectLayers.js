import {CARD_EFFECT_LAYERS,LAYERED_CARD_EFFECTS,combatEffectOpacity} from '../content/combatEffectPresentation.js';
import {combatEffectFrames} from './assets.js';
import {combatEffectOrientation} from './combatEffectDirection.js';
import {reducedMotionRequested} from './motion.js';
import { CreateEffectPlanes } from './effectPlanes.js';
import { uiConfig } from '../config/generated/ui.js';

const CARD_PLANE_LAYERS = uiConfig.presentation.combatEffectPlayback.layering.effectPlanes.card;

const CARD_PLANE_LOOK = Object.freeze({
 className: 'card-effect-layer',
 behindZIndex: String(CARD_PLANE_LAYERS.behindZIndex),
 frontZIndex: String(CARD_PLANE_LAYERS.frontZIndex),
 styleOf: part => ({
  width: part.scale * 100 + '%',
  height: 'auto',
  left: part.x * 100 + '%',
  top: part.y * 100 + '%',
 }),
});

function placeCardPlanes(nodes, settings) {
 for (const { el, part } of nodes) {
  el.style.opacity = String(Math.max(0, Math.min(1, settings.opacity)) * part.opacity);
  el.style.transform = `translate(-50%,-50%) ${combatEffectOrientation(settings.direction)}`;
  el.hidden = !settings[part.plane];
 }
}

// The caller owns a stacking context with its card face at z=1. These are real
// sibling planes: the rear image is occluded by the face, not painted over it.
export function mountCardEffectLayers(host,kind,{opacity=combatEffectOpacity(kind),direction='right',frames=combatEffectFrames(kind)}={}){
 if(!host||!LAYERED_CARD_EFFECTS.includes(kind)||!frames.length)return null;
 return CreateEffectPlanes({
  host,
  kind,
  frames,
  planes: CARD_EFFECT_LAYERS,
  planeLook: CARD_PLANE_LOOK,
  settings: {
   opacity,
   direction,
   behind: true,
   front: true,
  },
  placePlanes: placeCardPlanes,
 });
}

export function playCardEffectLayers(host,kind,{duration=220,...options}={}){
 if(reducedMotionRequested()||document.body.classList.contains('reduce-flashes'))return ()=>{};
 const layers=mountCardEffectLayers(host,kind,options);if(!layers)return ()=>{};
 const timers=[];let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;timers.forEach(clearTimeout);layers.stop();};
 for(let i=1;i<6;i++)timers.push(setTimeout(()=>layers.show(i),duration*i/6));
 timers.push(setTimeout(stop,duration));return stop;
}
