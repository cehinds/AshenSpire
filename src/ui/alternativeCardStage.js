import { alternativeCardAnimations } from '../content/alternativeCardAnimations.js';
import { alternativeSelectedStances } from '../content/alternativeSelectedStances.js';
import { durationFor, sampleSequence, hitFlashOpacity } from '../model/alternativeCardAnimation.js';
import { alternativeArtUrl } from './alternativeArt.js';
import { auraFilter } from './combatAura.js';
import { createAlternativeAuraRenderer } from './alternativeAuraRenderer.js';
import { reducedMotionRequested } from './motion.js';
import { DEFEATED_ART } from '../content/defeatedArt.js';
import { assetUrl } from './assetmap.js';
import { ANIM_SPEEDS, getAnimSpeed } from './animationPace.js';
import { classicAppearance } from './displayAppearance.js';
import { markArtPlaceholder, ART_PLACEHOLDER_ATTR } from './artFallback.js';

const aliases = { idle: 'ready', guard: 'defend', guardHit: 'defend', cast: 'spell', power: 'spell', buff: 'spell' };
const cached = new Map();
function load(url) {
  if (!cached.has(url)) {
    const image = new Image();
    const ready = new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => { cached.delete(url); reject(new Error('Character artwork could not load.')); };
    });
    image.src = url;
    cached.set(url, { image, ready });
  }
  return cached.get(url);
}

/** Branch-owned base armour animation. Equipment never changes its choreography. */
export function createAlternativeCardStage(classId, { still = false } = {}) {
  if (classicAppearance()) return null;
  const family = alternativeCardAnimations.classes[classId];
  if (!family) return null;
  const heldFrames = alternativeSelectedStances.classes[classId]?.frames || {};
  const frames = { ...family.frames, ...Object.fromEntries(Object.entries(heldFrames).map(([stance, frame]) => ['stance-'+stance, frame])) };
  const el = document.createElement('div');
  el.className = 'pose-stage painted-stage alternative-card-stage';
  el.dataset.animationSet = 'class-cards-'+classId;
  el.dataset.poseCoverage = 'card-actions';
  el.dataset.idleHeightRatio = '1';
  const height = 464-family.frames.ready.bounds[1], scale = 190/height;
  const width = Math.max(256-family.frames.ready.bounds[0], family.frames.ready.bounds[2]-256)*2*scale;
  el.dataset.idleWidthRatio = String(width/190);
  el.style.cssText = `position:relative;width:${width}px;height:190px;flex:none;overflow:visible;`;
  // Room to either side keeps the authored dash and aura inside the canvas.
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 544;
  canvas.setAttribute('aria-label', classId+' base armour character');
  canvas.style.cssText = `position:absolute;max-width:none;width:${768*scale}px;height:${544*scale}px;left:calc(50% - ${384*scale}px);top:${190-480*scale}px;pointer-events:none;`;
  el.append(canvas);
  if (typeof canvas.getContext !== 'function') return null;
  // Action preparation deliberately materializes visible pixels before its clock.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const mask = document.createElement('canvas'); mask.width = mask.height = 512;
  const maskCtx = mask.getContext('2d');
  const lite = typeof matchMedia === 'function' && matchMedia('(max-width: 599px)').matches;
  const images = new Map();
  const auraRenderer = createAlternativeAuraRenderer();
  const placeholder=document.createElement('span');placeholder.textContent='⚔';placeholder.hidden=true;
  placeholder.setAttribute('role','img');placeholder.setAttribute('aria-label',classId+' character');
  placeholder.style.cssText='position:absolute;inset:0;text-align:center;font-size:64px;';el.append(placeholder);
  async function preload(){
    const results=await Promise.allSettled(Object.entries(frames).map(async([name,frame])=>{
      const image = await load(alternativeArtUrl(frame[lite?'lite':'path'])).ready;
      if (!disposed) images.set(name, image);
    }));
    if(disposed)return false;
    const failed=results.some(result=>result.status==='rejected');
    if(failed){el.dataset.artError='Character artwork could not load.';markArtPlaceholder(el,preload);}
    else{delete el.dataset.artError;el.removeAttribute(ART_PLACEHOLDER_ATTR);delete el.ashenRestoreArt;}
    placeholder.hidden=images.has('ready');paint();return !failed;
  }
  let down = null;
  if (DEFEATED_ART[classId]?.file) load(assetUrl(DEFEATED_ART[classId].file)).ready.then(image => { if (!disposed) { down=image; paint(); } }).catch(()=>{});
  let pose='ready', rest='idle', stance=null, playing=null, elapsed=0, last=0, request=null, holdUntil=0, flashAt=null, disposed=false;
  let resources=[], reactionTimer=null;
  const restPose = () => rest === 'defeated' ? 'defeated' : stance ? 'stance-'+stance : ['defend','guard','counter'].includes(rest) ? 'guard-brace' : 'ready';
  const filterFor = (frame, action, paid = resources, active = !!action) =>
    auraFilter(action === 'spell' ? 'power2' : frame, ['defend','counter'].includes(rest) ? 'guard' : rest, paid, active);
  function paint(now=performance.now(), materialize=false) {
    if (disposed) return;
    ctx.clearRect(0,0,768,544);
    let x=0;
    if (playing) {
      const sampled=sampleSequence(playing.sequence,elapsed,playing.duration,{reduced:reducedMotionRequested()});
      pose=playing.sequence.poses[sampled.index]; x=sampled.x;
    }
    el.dataset.pose=pose;
    if (pose==='defeated' && down) { ctx.drawImage(down,128,16,512,512); return; }
    const image=images.get(pose) || images.get('ready');
    if (!image) return;
    ctx.save();
    auraRenderer.draw(ctx,image,filterFor(pose,playing?.action),128+x,16,512,512,{materialize});ctx.restore();
    const flash=hitFlashOpacity('hurt',flashAt===null?1:(now-flashAt)/260,{reduced:reducedMotionRequested()});
    if (flash) {
      maskCtx.clearRect(0,0,512,512);maskCtx.globalCompositeOperation='source-over';
      maskCtx.drawImage(image,0,0,512,512);maskCtx.globalCompositeOperation='source-in';
      maskCtx.fillStyle='#ff2424';maskCtx.fillRect(0,0,512,512);
      ctx.save();ctx.globalAlpha=flash;ctx.drawImage(mask,128+x,16);ctx.restore();
    }
  }
  function tick(now) {
    request=null;
    if (disposed) return;
    if (playing) {
      elapsed=Math.min(playing.duration,elapsed+Math.max(0,now-Math.max(last,holdUntil)));
      if (elapsed>=playing.duration || reducedMotionRequested()) { playing=null;resources=[];pose=restPose(); }
    }
    if (flashAt!==null && now-flashAt>=143) flashAt=null;
    // A queued RAF can carry a timestamp from before synchronous first-paint
    // work. Never move the action clock backwards and count that work twice.
    last=Math.max(last,now);paint(now);
    if (playing || flashAt!==null) request=requestAnimationFrame(tick);
  }
  const wake=()=>{ if (request===null && !disposed) {last=performance.now();request=requestAnimationFrame(tick);} };
  function settle() { playing=null;resources=[];elapsed=0;pose=restPose();paint(); }
  function hit() { if (reducedMotionRequested() || still || getAnimSpeed()==='instant') return false;flashAt=performance.now();wake();return true; }
  const ready=preload();
  return Object.freeze({ el, ready, ownsMotion:true, animationSetId:'class-cards-'+classId,
    poses:[...Object.keys(family.frames),...Object.keys(family.sequences),'idle','guard','hit','defeated','cast','power'],
    get pose(){return pose;},
    get rest(){return rest;},
    get stance(){return stance;},
    get presentation(){return {rest,pose,stance,action:playing?.action,elapsed,duration:playing?.duration,resources,savedAt:Date.now()};},
    setStance(next){
      stance=Object.hasOwn(heldFrames,next)?next:null;
      el.dataset.stance=stance||'neutral';
      if(!playing){pose=restPose();paint();}
      return !!stance;
    },
    setPose(next){if(family.frames[next]){playing=null;pose=next;paint();return true;}return false;},
    seek(action, time, duration=260){
      const sequence=family.sequences[action];if(!sequence||disposed)return false;
      if(request!==null)cancelAnimationFrame(request);request=null;
      playing={action,sequence,duration};elapsed=time;paint();return true;
    },
    setRestPose(next='idle',{resume,immediate=false}={}){
      if(next===rest&&playing&&!resume)return;
      rest=next;el.dataset.rest=next;
      if(resume?.action&&resume.rest===next&&!immediate&&!still&&!reducedMotionRequested()){
        const sequence=family.sequences[resume.action];
        // A saved action remains wall-clock based: render work may legitimately
        // expire an already stale presentation, and never extends its lifetime.
        elapsed=resume.elapsed+Math.max(0,Date.now()-resume.savedAt);
        if(sequence&&elapsed<resume.duration){
          playing={action:resume.action,sequence,duration:resume.duration};resources=resume.resources||[];
          paint(performance.now(),true);
          elapsed=resume.elapsed+Math.max(0,Date.now()-resume.savedAt);
          if(elapsed<resume.duration){last=performance.now();wake();return;}
        }
      }
      settle();
    },
    actionTiming(action,speed=ANIM_SPEEDS.normal){
      const sequence=family.sequences[aliases[action]||action];if(!sequence)return null;
      const totalMs=durationFor(sequence,speed);
      return {totalMs,impactMs:sequence.durations.slice(0,sequence.impact).reduce((a,b)=>a+b,0)/260*totalMs};
    },
    play(action,ms=260,aura=[]){
      if(disposed || (rest==='defeated'&&action!=='defeated'))return false;
      if(action==='hit'||action==='hurt')return hit();
      if(action==='defeated'){rest='defeated';settle();return true;}
      const key=aliases[action]||action, sequence=family.sequences[key];
      if(!sequence)return false;
      if(still||reducedMotionRequested()||ms<=0){settle();return true;}
      // Materialize the first independent aura before the unchanged action clock,
      // even when a preceding hurt effect already has a queued animation frame.
      resources=aura||[];elapsed=0;holdUntil=0;playing={action:key,sequence,duration:ms};
      paint(performance.now(),true);last=performance.now();wake();return true;
    },
    hold(ms){if(!playing||!(ms>0))return false;holdUntil=Math.max(performance.now(),holdUntil)+ms;return true;},
    react(resource){clearTimeout(reactionTimer);el.dataset.poseReaction=resource;reactionTimer=setTimeout(()=>{el.dataset.poseReaction='';},180);},settle,
    dispose(){disposed=true;clearTimeout(reactionTimer);if(request!==null)cancelAnimationFrame(request);request=null;playing=null;images.clear();down=null;auraRenderer.dispose();}
  });
}
