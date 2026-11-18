import {combatPoseAttachment,COMBATANT_EFFECT_PLANES,ATTACHMENT_SIZE} from '../content/combatEffectAnchors.js';
import {combatEffectFrames} from './assets.js';
import {combatEffectOpacity} from '../content/combatEffectPresentation.js';
import {reducedMotionRequested} from './motion.js';
import { CreateEffectPlanes } from './effectPlanes.js';
import {uiConfig} from '../config/generated/ui.js';

// Canvas size, default duration and frame count live in
// content/config/ui/presentation/combatEffectPlayback.json.
const PLAY=uiConfig.presentation.combatEffectPlayback;
const CANVAS=PLAY.sizing.poseCanvas, PCT=PLAY.sizing.percent;
const COMBATANT_PLANE_LAYERS = PLAY.layering.effectPlanes.combatant;
const visiblePose=stage=>stage.querySelector('.studio-pose-frame')?.dataset.pose||stage.dataset.pose;

const COMBATANT_PLANE_LOOK = Object.freeze({
 className: 'combatant-effect-layer',
 imageHintOptions: { swapped: true },
 behindZIndex: String(COMBATANT_PLANE_LAYERS.behindZIndex),
 frontZIndex: String(COMBATANT_PLANE_LAYERS.frontZIndex),
 styleOf: () => ({ maxHeight: 'none' }),
});

function placeCombatantPlanes(nodes, settings) {
 const point = combatPoseAttachment(settings.actor, settings.pose, settings.anchor);
 for (const { el, part } of nodes) {
  el.hidden = !point || !settings[part.plane];
  if (!point) continue;
  el.dataset.anchor = settings.anchor;
  el.dataset.pose = settings.pose;
  Object.assign(el.style, {
   left: point.x / CANVAS * PCT + '%',
   top: point.y / CANVAS * PCT + '%',
   width: (ATTACHMENT_SIZE[settings.anchor] || PLAY.sizing.defaultAttachment) * settings.scale / CANVAS * PCT + '%',
   height: 'auto',
   opacity: String(Math.max(0, Math.min(1, settings.opacity)) * part.opacity),
   transform: `translate(-50%,-50%) rotate(${point.rotation}deg)`,
  });
 }
}

// Mount inside the pose's 640px canvas: character transforms, zoom and facing
// apply to these siblings together. The isolated rear plane stays under the art.
export function mountCombatantEffectLayers(host,kind,{actor,pose='idle',anchor='weapon',frames=combatEffectFrames(kind),opacity=combatEffectOpacity(kind),scale=1}={}) {
 if(!host||!frames.length||!combatPoseAttachment(actor,pose,anchor))return null;
 return CreateEffectPlanes({
  host,
  kind,
  frames,
  planes: COMBATANT_EFFECT_PLANES,
  planeLook: COMBATANT_PLANE_LOOK,
  settings: {
   actor,
   pose,
   anchor,
   opacity,
   scale,
   behind: true,
   front: true,
  },
  placePlanes: placeCombatantPlanes,
  shouldSkipRepeatedFrame: true,
 });
}

export function playCombatantEffectLayers(actor,kind,{anchor='weapon',duration=PLAY.motion.layerDurationMs,delay=0,scale=1,onStop=()=>{}}={}) {
 const stage=actor?.matches?.('.painted-stage')?actor:actor?.querySelector?.('.painted-stage');
 if(!stage||reducedMotionRequested()||document.body.classList.contains('reduce-flashes'))return null;
 if(!combatPoseAttachment(stage.dataset.poseClass,visiblePose(stage),anchor))return null;
 const host=stage.querySelector('.pose-layer');if(!host)return null;
 let layers=null,lastPose=null,raf=0,stopped=false;const start=performance.now()+delay;
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(raf);layers?.stop();onStop();};
 const tick=now=>{
  if(stopped)return;if(!stage.isConnected||now>=start+duration){stop();return;}
  if(now>=start){
   const pose=visiblePose(stage);
   if(!layers){layers=mountCombatantEffectLayers(host,kind,{actor:stage.dataset.poseClass,pose,anchor,scale});lastPose=pose;}
   // Re-place the layers only when the pose changes; six style writes per tick
   // repainted both masked images every frame for nothing.
   else if(pose!==lastPose){lastPose=pose;layers.update({pose});}
   layers?.show(Math.floor((now-start)/duration*PLAY.motion.layerFrameCount));
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
 const marker=document.createElement('i');marker.style.cssText=`position:absolute;pointer-events:none;width:0;height:0;left:${point.x/CANVAS*PCT}%;top:${point.y/CANVAS*PCT}%;`;
 host.append(marker);const box=localBox(layer,marker);marker.remove();return box;
}
