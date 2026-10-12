import { alternativeCardAnimations } from '../content/alternativeCardAnimations.js';
import { playerCounterSweepSprites } from '../content/playerCounterSweepSprites.js';
import { playerAttackSprites } from '../content/playerAttackSprites.js';
import { alternativeSelectedStances } from '../content/alternativeSelectedStances.js';
import { durationFor, sampleSequence, hitFlashOpacity, hitRecoilX, HURT_CLIP_MIN_MS } from '../model/alternativeCardAnimation.js';
import { alternativeArtUrl } from './alternativeArt.js';
import { auraFilter } from './combatAura.js';
import { createAlternativeAuraRenderer } from './alternativeAuraRenderer.js';
import { reducedMotionRequested } from './motion.js';
import { DEFEATED_ART } from '../content/defeatedArt.js';
import { playerHurtFrames } from '../content/playerHurtFrames.js';
import { assetUrl } from './assetmap.js';
import { ANIM_SPEEDS, getAnimSpeed } from './animationPace.js';
import { builtInFor } from './highResArt.js';
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

/** Base armour actions with explicitly selected reviewed weapon attacks. */
export function createAlternativeCardStage(classId, { still = false, weaponProfile = null } = {}) {
  if (classicAppearance()) return null;
  const base = alternativeCardAnimations.classes[classId];
  if (!base) return null;
  const selected = playerCounterSweepSprites[classId];
  const pilot = alternativeSelectedStances.weaponProfiles?.[weaponProfile];
  const pilotFrames = pilot?.classId === classId ? pilot.frames : null;
  const attacks = Object.entries(playerAttackSprites[classId] || {});
  const family = { ...base,
    frames: { ...base.frames, ...selected.frames, ...Object.assign({}, ...attacks.map(([, entry]) => entry.frames)) },
    sequences: { ...base.sequences, ...selected.sequences,
      // Preserve the original forward sweep while fitting its four painted phases.
      sweep: { ...selected.sequences.sweep, travel: [0,
        base.sequences.sweep.travel[base.sequences.sweep.impact],
        base.sequences.sweep.travel[base.sequences.sweep.impact + 1], 0] },
      counterPrepare: { poses: [selected.stances.counter], durations: [260], impact: 0, travel: [0], hold: true },
      ...Object.fromEntries(attacks.flatMap(([name, entry]) =>
      ['attack', 'spell', 'ranged', 'rangedMagic'].map(action => [`weapon:${action}:${name}`, { ...entry.sequence, action }]))) },
  };
  if (pilotFrames) {
    for (const [action, frame] of Object.entries(pilotFrames)) family.frames['pilot-'+action] = frame;
    family.frames['smash-load'] = pilotFrames.smash;
    family.sequences.sweep = { ...family.sequences.sweep, poses: ['pilot-sweep', ...family.sequences.sweep.poses.slice(1)] };
    family.sequences.counterPrepare = { ...family.sequences.counterPrepare, poses: ['pilot-counter'] };
  }
  // Smash holds the first painted frame of its own swing (owner, 2026-10-12),
  // the way counter and sweep hold theirs.
  const heldFrames = { ...alternativeSelectedStances.classes[classId]?.frames,
    ...Object.fromEntries(Object.entries(selected.stances).map(([action, pose]) => [action, selected.frames[pose]])),
    ...(family.frames['smash-load'] ? { smash: family.frames['smash-load'] } : {}),
    ...(pilotFrames ? { sweep: pilotFrames.sweep, counter: pilotFrames.counter, smash: pilotFrames.smash, evade: pilotFrames.evade } : {}) };
  const frames = { ...family.frames, ...Object.fromEntries(Object.entries(heldFrames).map(([stance, frame]) => ['stance-'+stance, frame])) };
  const el = document.createElement('div');
  el.className = 'pose-stage painted-stage alternative-card-stage';
  // A still (Rendered-style) stage paints no canvas reaction; CSS tints it instead.
  if (still) el.dataset.still = '';
  el.dataset.animationSet = 'class-cards-'+classId;
  el.dataset.poseCoverage = 'card-actions';
  el.dataset.idleHeightRatio = '1';
  const height = 464-family.frames.ready.bounds[1], scale = 190/height;
  el.dataset.maximumHeightRatio = String((464-Math.min(...Object.values(frames).map(frame=>frame.bounds[1])))/height);
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
  const images = new Map();
  const auraRenderer = createAlternativeAuraRenderer();
  const placeholder=document.createElement('span');placeholder.textContent='⚔';placeholder.hidden=true;
  placeholder.setAttribute('role','img');placeholder.setAttribute('aria-label',classId+' character');
  placeholder.style.cssText='position:absolute;inset:0;text-align:center;font-size:64px;';el.append(placeholder);
  async function preload(){
    const results=await Promise.allSettled(Object.entries({ ...frames, ...selected.effects }).map(async([name,frame])=>{
      // Keep the foreground body sharp at its fixed display scale on phones too.
      const image = await load(alternativeArtUrl(frame.path)).ready;
      if (!disposed) images.set(name, image);
    }));
    if(disposed)return false;
    const failed=results.some(result=>result.status==='rejected');
    if(failed){el.dataset.artError='Character artwork could not load.';markArtPlaceholder(el,preload);}
    else{delete el.dataset.artError;el.removeAttribute(ART_PLACEHOLDER_ATTR);delete el.ashenRestoreArt;}
    placeholder.hidden=images.has('ready');paint();return !failed;
  }
  let down = null;
  // The hurt clip draws its own registered outfit art; until it loads the clip keeps the current pose.
  let hurt = null;
  const hurtPlacement = playerHurtFrames[classId] || null;
  // A detached loader must retry the built-in copy itself when a high-res file fails (highResArt.js).
  const hurtUrl = hurtPlacement ? assetUrl(hurtPlacement.file) : null;
  if (hurtUrl) load(hurtUrl).ready.catch(error => { const fallback=builtInFor(hurtUrl); if (!fallback) throw error; return load(fallback).ready; })
    .then(image => { if (!disposed) { hurt=image; paint(); } }).catch(()=>{});
  if (DEFEATED_ART[classId]?.file) load(assetUrl(DEFEATED_ART[classId].file)).ready.then(image => { if (!disposed) { down=image; paint(); } }).catch(()=>{});
  // A hit reaction (red tint + knock-back) has its own clock: flashElapsed ms of
  // flashMs, advanced only outside hold-stop. flashAt is non-null while it runs.
  let pose='ready', rest='idle', stance=null, playing=null, elapsed=0, last=0, request=null, holdUntil=0, flashAt=null, flashMs=220, flashElapsed=0, disposed=false;
  // A selected target reaction shares the RAF, but starts its own finite clock.
  // It overlays the body without replacing the action or last confirmed stance.
  let resources=[], reactionTimer=null, currentArt=null, bodyReaction=null;
  const restPose = () => rest === 'defeated' ? 'defeated' : stance ? 'stance-'+stance : rest === 'counter' ? (pilotFrames ? 'pilot-counter' : selected.stances.counter) : ['defend','guard'].includes(rest) ? 'guard-brace' : 'ready';
  const filterFor = (frame, action, paid = resources, active = !!action) =>
    auraFilter(action === 'spell' ? 'power2' : frame, ['defend','counter'].includes(rest) ? 'guard' : rest, paid, active);
  function paint(now=performance.now(), materialize=false) {
    if (disposed) return;
    ctx.clearRect(0,0,768,544);
    currentArt=null;
    let x=0, effect=null;
    el.dataset.effect='';
    if (playing) {
      const sampled=sampleSequence(playing.sequence,elapsed,playing.duration,{reduced:reducedMotionRequested()});
      pose=playing.sequence.poses[sampled.index];
      // A swing leaves from and returns to the held stance, not the neutral ready frame.
      if (pose==='ready' && stance) pose='stance-'+stance;
      effect=playing.sequence.effects?.[sampled.index];
      x=['attack','smash','sweep'].includes(playing.action)?sampled.x:0;
    }
    if (rest !== 'defeated' && bodyReaction) pose='pilot-'+bodyReaction.kind;
    el.dataset.pose=pose;
    if (pose==='defeated' && down) { currentArt={canvas,image:down,left:128,top:16,width:512,height:512};ctx.drawImage(down,128,16,512,512); return; }
    const image=images.get(pose) || images.get('ready');
    // The canvas owns the hit reaction: the body (and its red mask) knocks back
    // left while the reaction runs; the effects overlay stays on its own registration.
    const reduced=reducedMotionRequested();
    const reacting=flashAt!==null && !reduced;
    // The hurt clip replaces the pose while it runs, registered onto the ready figure.
    const clipping=!bodyReaction && reacting && hurt && hurtPlacement;
    const source=clipping?hurt:image;
    if (!source) return;
    const place=clipping?hurtPlacement:{dx:0,dy:0,scale:1};
    const bodyX=x+(reacting?hitRecoilX(flashElapsed/flashMs):0);
    const left=128+bodyX+place.dx, top=16+place.dy, size=512*place.scale;
    currentArt={canvas,image:source,left,top,width:size,height:size};
    ctx.save();
    auraRenderer.draw(ctx,source,filterFor(pose,playing?.sequence.action || playing?.action),left,top,size,size,{materialize});ctx.restore();
    // Trails share body registration, but never enter its aura or hit mask.
    if(effect && !still && !reducedMotionRequested() && !document.body.classList.contains('reduce-flashes')) {
      const overlay=images.get(effect);
      if(overlay){ctx.drawImage(overlay,128+x,16,512,512);el.dataset.effect=effect;}
    }
    // Reduce flashes suppresses the red tint (SPEC §7.4); the knock-back stays.
    const flash=flashAt===null||document.body.classList.contains('reduce-flashes')?0:hitFlashOpacity('hurt',flashElapsed,{reduced,duration:flashMs});
    if (flash) {
      maskCtx.clearRect(0,0,512,512);maskCtx.globalCompositeOperation='source-over';
      maskCtx.drawImage(source,0,0,512,512);maskCtx.globalCompositeOperation='source-in';
      maskCtx.fillStyle='#ff2424';maskCtx.fillRect(0,0,512,512);
      ctx.save();ctx.globalAlpha=flash;ctx.drawImage(mask,left,top,size,size);ctx.restore();
    }
  }
  function tick(now) {
    request=null;
    if (disposed) return;
    if (playing) {
      elapsed=Math.min(playing.duration,elapsed+Math.max(0,now-Math.max(last,holdUntil)));
      if (elapsed>=playing.duration || reducedMotionRequested()) { playing=null;resources=[];pose=restPose(); }
    }
    if (flashAt!==null) {
      // Hold-stop freezes the reaction at its start, exactly like the action clock.
      flashElapsed+=Math.max(0,now-Math.max(last,holdUntil));
      if (flashElapsed>=flashMs) flashAt=null;
    }
    if (bodyReaction) {
      bodyReaction.elapsed += Math.max(0,now-Math.max(bodyReaction.last,holdUntil));
      bodyReaction.last=Math.max(bodyReaction.last,now);
      if (bodyReaction.elapsed >= bodyReaction.duration) { bodyReaction=null; if (!playing) pose=restPose(); }
    }
    // A queued RAF can carry a timestamp from before synchronous first-paint
    // work. Never move the action clock backwards and count that work twice.
    last=Math.max(last,now);paint(now);
    if (playing || flashAt!==null || bodyReaction) request=requestAnimationFrame(tick);
  }
  const wake=()=>{ if (request===null && !disposed) {last=performance.now();request=requestAnimationFrame(tick);} };
  function settle() { playing=null;resources=[];elapsed=0;pose=restPose();paint(); }
  // Routine renders (setRestPose) settle the action only; a running hit reaction
  // keeps its own clock. A click-skip passes { reaction:true } to end it too.
  function endReaction() { if(flashAt===null&&!bodyReaction)return false;flashAt=null;bodyReaction=null;flashElapsed=0;holdUntil=0;if(!playing)pose=restPose();paint();return true; }
  function settleStage({reaction=false}={}) { if(reaction){flashAt=null;bodyReaction=null;flashElapsed=0;holdUntil=0;} settle(); }
  // Instant drops pacing and hit-stop but keeps fixed-duration effects, so the hurt clip still plays.
  function hit(ms=220) { if (reducedMotionRequested() || still) return false;flashAt=performance.now();flashMs=Math.max(HURT_CLIP_MIN_MS,ms>0?ms:220);flashElapsed=0;wake();return true; }
  const ready=preload();
  return Object.freeze({ el, ready, ownsMotion:true, animationSetId:'class-cards-'+classId,
    poses:[...Object.keys(family.frames),...Object.keys(family.sequences),'idle','guard','hit','defeated','cast','power'],
    get pose(){return pose;},
    get currentArt(){return currentArt;},
    get rest(){return rest;},
    get stance(){return stance;},
    get reactionPoses(){return pilotFrames ? ['evade','guard-break'].filter(kind=>images.has('pilot-'+kind)) : [];},
    reactPose(kind, ms=280){
      if(disposed || rest==='defeated' || !pilotFrames || !['evade','guard-break'].includes(kind) || !images.has('pilot-'+kind))return false;
      bodyReaction={kind,elapsed:0,last:performance.now(),duration:Math.max(180,Math.min(600,Number.isFinite(ms)&&ms>0?ms:280))};
      paint();bodyReaction.last=performance.now();wake();return true;
    },
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
      rest=next;el.dataset.rest=next;if(next==='defeated'){bodyReaction=null;flashAt=null;}
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
      return {totalMs,impactMs:sequence.durations.slice(0,sequence.impact).reduce((a,b)=>a+b,0)/sequence.durations.reduce((a,b)=>a+b,0)*totalMs};
    },
    play(action,ms,aura=[]){
      if(disposed || (rest==='defeated'&&action!=='defeated'))return false;
      if(action==='hit'||action==='hurt')return hit(ms);
      ms??=260;
      if(action==='defeated'){rest='defeated';bodyReaction=null;flashAt=null;settle();return true;}
      const key=aliases[action]||action;
      let sequence=family.sequences[key];
      if(!sequence)return false;
      if(pilotFrames&&key==='counterPrepare'&&stance==='evade')sequence={...sequence,poses:['pilot-evade']};
      bodyReaction=null;
      if(still||reducedMotionRequested()||ms<=0){settle();return true;}
      // Materialize the first independent aura before the unchanged action clock,
      // even when a preceding hurt effect already has a queued animation frame.
      resources=aura||[];elapsed=0;holdUntil=0;playing={action:key,sequence,duration:ms};
      paint(performance.now(),true);last=performance.now();wake();return true;
    },
    hold(ms){if(!(playing||flashAt!==null||bodyReaction)||!(ms>0))return false;holdUntil=Math.max(performance.now(),holdUntil)+ms;return true;},
    react(resource){clearTimeout(reactionTimer);el.dataset.poseReaction=resource;reactionTimer=setTimeout(()=>{el.dataset.poseReaction='';},180);},settle:settleStage,endReaction,
    dispose(){disposed=true;clearTimeout(reactionTimer);if(request!==null)cancelAnimationFrame(request);request=null;playing=null;bodyReaction=null;images.clear();down=null;hurt=null;auraRenderer.dispose();}
  });
}
