import { combatEffectFrames } from './assets.js';
import { reducedMotionRequested } from './motion.js';
import { combatEffectAngle, combatEffectOrientation } from './combatEffectDirection.js';
import { combatEffectPresentation } from '../content/combatEffectPresentation.js';
import {playPresentationSequence} from './presentationSequence.js';
import {combatEffectAttachment} from '../content/combatEffectAnchors.js';
import {playCombatantEffectLayers,combatantEmissionBox} from './combatantEffectLayers.js';
import { hintImage } from './imageHints.js';
const active=new WeakMap();
// Each effect kind's frames are warmed once per page, not once per play.
const warmedKinds=new Set();
function warmEffectFrames(kind,frames){
 if(warmedKinds.has(kind))return;
 warmedKinds.add(kind);
 frames.forEach(src=>{const warm=new Image();warm.src=src;});
}
// Shared solo/co-op sequence: one cast, then one release per actual recipient.
export function playCombatEffectPlan(layer,from,plan,{targets=[],authoredTargets=[],duration=260,size=160,actor=null,localBox=null}={}){
 if(!plan||!layer||!from)return ()=>{};
 size*=plan.sizeScale??1;
 const set=active.get(layer)||new Set();active.set(layer,set);
 const studioStop=playPresentationSequence(layer,from,plan.bindingContext,{targets:authoredTargets,duration,onStop:()=>set.delete(studioStop)});
 if(studioStop)set.add(studioStop);
 const stops=studioStop?[studioStop]:[];
 const targetLocal=plan.at==='target';
 const anchor=combatEffectAttachment(plan);
 const emission=()=>actor&&localBox?combatantEmissionBox(actor,'hand',localBox,layer)||from:from;
 const attached=(kind,options)=>{
  const stop=playCombatantEffectLayers(actor,kind,{...options,onStop:()=>set.delete(stop)});
  if(stop){set.add(stop);stops.push(stop);}return stop;
 };
 // Painted attacks extend the casting point after 28% of their pose sequence.
 // Resolve the moving source at release, rather than firing from the wind-up.
 const delay=plan.projectile?Math.round(duration*.3):plan.cast?65:targetLocal?Math.round(duration*.25):0;
 const castDuration=plan.projectile?Math.max(110,delay):110;
 if(plan.cast&&!attached(plan.cast,{anchor:anchor||'hand',duration:castDuration,scale:plan.sizeScale??1}))stops.push(playCombatEffect(layer,emission,plan.cast,{duration:castDuration,size:size*.7}));
 const recipients=targetLocal?targets:[from];
 const wrapped=anchor&&recipients.length&&attached(plan.kind,{anchor,delay,duration:Math.max(96,duration-delay),scale:plan.sizeScale??1});
 for(const target of recipients){
  // Weapon trails belong to the caster; confirmed recipients keep a small hit
  // response. Debuffs and other target-local effects retain their own placement.
  if(wrapped){stops.push(playCombatEffect(layer,target,plan.impactKind||'impact',{delay:Math.round(duration*.55),duration:120,size:size*.55}));continue;}
  stops.push(playCombatEffect(layer,plan.projectile?emission:target,plan.kind,{to:plan.projectile?target:null,direction:targetLocal&&!plan.projectile?combatEffectAngle(from,target):'auto',delay,duration:Math.max(96,duration-delay),size,impactKind:plan.impactKind}));
 }
 return ()=>stops.forEach(stop=>stop());
}
export function clearCombatEffects(layer){for(const stop of [...(active.get(layer)||[])])stop();}
// Caller supplies boxes in layer-local coordinates, using the shared geometry
// helper. All six frames retain one center anchor and common canvas scale.
export function playCombatEffect(layer,from,kind,{to=null,direction='auto',duration=260,size=140,delay=0,impactKind='impact'}={}){
 if(!layer||!from||reducedMotionRequested()||document.body.classList.contains('reduce-flashes'))return ()=>{};
 if(delay>0){
   const set=active.get(layer)||new Set();active.set(layer,set);let child=()=>{};
   const stop=()=>{clearTimeout(ticket);child();set.delete(stop);};
   const ticket=setTimeout(()=>{set.delete(stop);child=playCombatEffect(layer,from,kind,{to,direction,duration,size,impactKind});},delay);
   set.add(stop);return stop;
 }
 if(typeof from==='function')from=from();
 if(!from)return ()=>{};
 const frames=combatEffectFrames(kind);if(!frames.length)return ()=>{};
 const presentation=combatEffectPresentation(kind);size*=presentation.sizeScale;
 warmEffectFrames(kind,frames);
 const el=hintImage(document.createElement('img'));el.className='painted-combat-effect';el.alt='';el.setAttribute('aria-hidden','true');el.dataset.effect=kind;
 const x=from.left+from.width/2-size/2,y=from.top+from.height/2-size/2;
 el.style.cssText=`position:absolute;pointer-events:none;width:${size}px;height:${size}px;left:${x}px;top:${y}px;object-fit:contain;z-index:4;`;
 const show=i=>{el.src=frames[i];el.dataset.frame=String(i+1);};show(0);layer.appendChild(el);
 let tickets=[],animation=null,impactStop=null,stopped=false;
 const set=active.get(layer)||new Set();active.set(layer,set);
 const stop=()=>{if(stopped)return;stopped=true;tickets.forEach(clearTimeout);animation?.cancel();impactStop?.();el.remove();set.delete(stop);};set.add(stop);
 const ms=Math.max(frames.length*16,duration);for(let i=1;i<frames.length;i++)tickets.push(setTimeout(()=>show(i),ms*i/frames.length));
 const dx=to?to.left+to.width/2-(x+size/2):0,dy=to?to.top+to.height/2-(y+size/2):0;
 const angle=direction==='auto'?combatEffectAngle(from,to):direction;
 const orientation=combatEffectOrientation(angle);el.dataset.direction=String(angle);
 animation=el.animate([{transform:`translate(0,0) scale(${presentation.startScale}) ${orientation}`,opacity:.3*presentation.opacity},{transform:`translate(${dx*.7}px,${dy*.7}px) scale(1) ${orientation}`,opacity:presentation.opacity,offset:.6},{transform:`translate(${dx}px,${dy}px) scale(${presentation.endScale}) ${orientation}`,opacity:0}],{duration:ms,easing:'ease-out',fill:'forwards'});
 tickets.push(setTimeout(()=>{el.remove();if(to){impactStop=playCombatEffect(layer,to,impactKind,{direction:angle,duration:160,size:110});tickets.push(setTimeout(stop,170));}else stop();},ms));
 return stop;
}
