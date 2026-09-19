import { DEFEATED_ART } from '../content/defeatedArt.js';
import { paintedOutfit, armourArtClass, armourArtKey } from '../model/paintedOutfitArt.js';
import { auraFilter, POWER_FRAMES } from './combatAura.js';
import { COMBAT_SEQUENCES } from '../model/combatAnimation.js';
import { COMBAT_POSE_STATES } from '../content/combatPoseStates.js';
import { READINESS_POSE_ART } from '../content/readinessPoseArt.js';

import { assetUrl } from './assetmap.js';
import { reducedMotionRequested } from './motion.js';
import { hintImage } from './imageHints.js';
import { preloadPoses } from './services/posePreloads.js';
import { liteRendering } from './performance.js';
import { uiConfig } from '../config/generated/ui.js';

// The stage's geometry, its timings and the aura artwork live in
// content/config/ui/presentation/paintedOutfits.json. This module builds the
// DOM; it no longer decides how big, how long, or what shape.
const OUTFIT = uiConfig.presentation.paintedOutfits;
const STAGE = OUTFIT.sizing.stage;
const TIME = OUTFIT.motion;
const POSE = OUTFIT.behavior;

export function paintedPortraitUrl(classId, armourId = POSE.defaultArmourId) {
  const art = paintedOutfit(classId, armourId);
  return art ? assetUrl(art.menu.portrait) : null;
}

export function paintedPresentation(classId, armourId = POSE.defaultArmourId, pose = 'stand') {
  const art = paintedOutfit(classId, armourId);
  if (!art || !art.menu[pose]) return null;
  const img = hintImage(document.createElement('img'));
  img.src = assetUrl(art.menu[pose]);
  img.alt = `${classId} ${armourId || POSE.defaultArmourId}`;
  img.className = 'painted-presentation';
  img.style.cssText = `display:block;width:100%;height:100%;object-fit:contain;object-position:center ${pose === 'portrait' ? 'bottom' : 'center'};`;
  return img;
}

// The reviewed frames share a 640px canvas, center 320 and floor 600.
// Fit the tallest resting body to the stage; every action keeps that scale.
// Frame warm-up happens once per stage for the life of the page, through the
// bounded pose-preload cache shared with PoseAnimator (posePreloads.js). The
// stage is rebuilt on every combat render, and each rebuild used to allocate
// a fresh Image per outfit frame — nineteen per render for a painted class.

export function createPaintedStage(classId, armourId = POSE.defaultArmourId, { still = false } = {}) {
  // Resolve the complete visual identity before choosing readiness/attack frames.
  const visualClass = armourArtClass(classId, armourId);
  const visualArmour = armourArtKey(classId, armourId);
  if (visualClass !== classId || visualArmour !== armourId) {
    return createPaintedStage(visualClass, visualArmour, { still });
  }
  if (still) {
    const presentation = paintedPresentation(classId, armourId);
    const defeated = createPaintedStage(classId, armourId);
    if (!presentation || !defeated) return null;
    const el = document.createElement('div');
    el.className = 'pose-stage rendered-stage';
    defeated.el.style.position = 'absolute'; defeated.el.style.inset = '0';
    el.append(presentation, defeated.el);
    let resting = POSE.restPose;
    const settle = () => {
      const down = resting === POSE.defeatedPose || Object.hasOwn(COMBAT_POSE_STATES, resting);
      presentation.style.visibility = down ? 'hidden' : 'visible';
      defeated.el.style.visibility = down ? 'visible' : 'hidden';
      defeated.setRestPose(down ? resting : POSE.restPose, { immediate: true });
      // Child frames set their own visibility, so hide the whole inactive stage.
      defeated.el.hidden = !down;
      el.dataset.pose = resting;
    };
    const setRestPose = pose => { resting = pose === POSE.defeatedPose || Object.hasOwn(COMBAT_POSE_STATES, pose) ? pose : POSE.restPose; el.dataset.rest = resting; settle(); };
    settle();
    return Object.freeze({ el, poses: [POSE.restPose, POSE.defeatedPose], get pose() { return resting; },
      setRestPose, settle, react: defeated.react, dispose: defeated.dispose,
      play(pose) { if (pose !== POSE.defeatedPose) return false; setRestPose(pose); return true; },
    });
  }
  const art = paintedOutfit(classId, armourId);
  if (!art) return null;
  const el = document.createElement('div');
  el.className = 'pose-stage painted-stage';
  el.dataset.poseClass = !armourId || armourId === POSE.defaultArmourId ? classId : `${classId}-${armourId}`;
  const frames = { ...art.frames, ...(READINESS_POSE_ART[el.dataset.poseClass] || READINESS_POSE_ART[classId]) };
  if (READINESS_POSE_ART[classId]) el.classList.add('readiness-outfit');
  const readyFrames = READINESS_POSE_ART[el.dataset.poseClass] || READINESS_POSE_ART[classId] || {};
  const idleBox = art.frames.idle.box;
  const height = Math.max(STAGE.floorY - idleBox.y0, ...Object.values(readyFrames).map(frame => STAGE.floorY - frame.box.y0));
  el.dataset.idleHeightRatio = String((STAGE.floorY - idleBox.y0) / height);
  // Twice the wider half-width, because the figure is centred on the canvas.
  const halfWidth = Math.max(STAGE.centerX - idleBox.x0, idleBox.x1 + 1 - STAGE.centerX);
  el.dataset.idleWidthRatio = String((halfWidth + halfWidth) / height);
  const layer = document.createElement('div');
  layer.className = 'pose-layer';
  layer.style.cssText = `height:${STAGE.canvas / height * STAGE.percent}%;aspect-ratio:1;top:${STAGE.percent - STAGE.floorY / height * STAGE.percent}%;transform:translateX(-50%);`;
  layer.style.isolation = 'isolate';
  const img = hintImage(document.createElement('img'));
  img.className = 'pose-frame';
  img.alt = classId;
  img.style.cssText = 'inset:0;width:100%;height:100%;';
  layer.appendChild(img);
  el.appendChild(layer);
  const aura = document.createElement('div');
  aura.className = 'combat-pose-aura';
  aura.setAttribute('aria-hidden', 'true');
  aura.innerHTML = OUTFIT.components.aura.svg;
  el.appendChild(aura);
  const downArt = DEFEATED_ART[el.dataset.poseClass] || DEFEATED_ART[classId];
  const down = hintImage(document.createElement('img'));
  down.className = 'defeated-frame'; down.alt = '';
  down.style.cssText = `position:absolute;left:50%;bottom:0;height:${STAGE.percent * (downArt?.scale || OUTFIT.sizing.defeated.defaultScale)}%;width:auto;max-width:none;transform:${OUTFIT.sizing.defeated.transform};visibility:hidden;pointer-events:none;`;
  if (downArt) down.src = assetUrl(downArt.file);
  el.appendChild(down);
  preloadPoses(`painted:${classId}:${armourId}`, Object.values(frames).map(frame => assetUrl(frame.file)));
  const previous = img.cloneNode();
  previous.alt = ''; previous.setAttribute('aria-hidden', 'true');
  previous.classList.add('pose-previous'); previous.style.opacity = '0'; previous.style.display = 'none';
  layer.appendChild(previous);
  aura.style.setProperty('--pulse-delay', `${-(Date.now() % TIME.pulseCycleMs)}ms`);
  let current = POSE.restPose;
  let resting = POSE.restPose;
  let timers = [];
  let transition = null, auraState = '';
  let resources = [], active = false;
  let reactionTimer, reactionQueue = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const syncAura = (stateId, fade = false, initialOpacity) => {
    const state = COMBAT_POSE_STATES[stateId];
    const opacity = initialOpacity ?? (Number.parseFloat(getComputedStyle(aura).opacity) || 0);
    aura.getAnimations().forEach(a => a.cancel());
    if (state) {
      auraState = stateId;
      aura.dataset.motif = state.motif;
      aura.style.setProperty('--pose-color', state.color);
    }
    aura.style.opacity = state ? '1' : '0';
    if (fade && !reducedMotionRequested()) aura.animate([{ opacity }, { opacity: state ? 1 : 0 }], { duration: TIME.auraFadeMs, easing: TIME.auraEasing });
    if (!state && !fade) { auraState = ''; aura.dataset.motif = ''; }
  };
  const setPose = (pose, blend = false) => {
    if (pose === POSE.defeatedPose && downArt) {
      current = pose; el.dataset.pose = pose; el.dataset.aura = '';
      layer.style.visibility = 'hidden'; down.style.visibility = 'visible'; return true;
    }
    layer.style.visibility = ''; down.style.visibility = 'hidden';
    const state = COMBAT_POSE_STATES[pose];
    const frame = frames[pose] || (state ? frames[state.frame] || frames[state.fallback] : null) || (Object.hasOwn(POWER_FRAMES, pose) ? frames.idle : null);
    if (!frame) return false;
    previous.getAnimations().forEach(a => a.cancel());
    img.getAnimations().forEach(a => a.cancel());
    if (blend && current !== pose && img.getAttribute('src') && !reducedMotionRequested()) {
      previous.src = img.src; previous.style.filter = img.style.filter;
      previous.style.display = '';
      previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TIME.blendMs, easing: TIME.auraEasing });
      img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TIME.blendMs, easing: TIME.auraEasing });
    }
    current = pose;
    el.dataset.pose = pose;
    img.src = assetUrl(frame.file);
    const auraCss = auraFilter(pose, resting, resources, active);
    img.style.filter = `var(--combatant-edge, blur(0px))${auraCss === 'none' ? '' : ` ${auraCss}`}`;
    const restingState = COMBAT_POSE_STATES[resting];
    el.dataset.poseState = restingState && resting !== POSE.defeatedPose ? resting : '';
    el.dataset.aura = active ? resources.join(' ') : POSE.guardedRestPoses.includes(resting) ? POSE.guardAura : '';
    return true;
  };
  const sequenceFor = pose => (Object.hasOwn(COMBAT_SEQUENCES, pose) ? COMBAT_SEQUENCES[pose] : [pose]).filter(p => Object.hasOwn(frames, p) || Object.hasOwn(POWER_FRAMES, p) || Object.hasOwn(COMBAT_POSE_STATES, p));
  const restingPose = () => resting === POSE.defeatedPose ? POSE.defeatedPose : sequenceFor(resting).at(-1) || (POSE.guardedRestPoses.includes(resting) && resting !== POSE.guardAura ? POSE.guardAura : POSE.restPose);
  const settle = () => { clear(); transition = null; el.dataset.poseTransition = ''; active = false; resources = []; syncAura(resting); setPose(restingPose()); };
  const changeRest = (from, startedAt = Date.now()) => {
    clear(); active = false; resources = [];
    const middle = frames[`${resting}Transition`] ? `${resting}Transition` : frames[`${from}Transition`] ? `${from}Transition` : null;
    const elapsed = Date.now() - startedAt;
    if (!middle || resting === POSE.defeatedPose || reducedMotionRequested() || elapsed >= TIME.transitionMs) { settle(); return; }
    transition = { from, to: resting, startedAt };
    el.dataset.poseTransition = COMBAT_POSE_STATES[resting] ? 'enter' : 'leave';
    if (elapsed < TIME.transitionMidpointMs) {
      setPose(middle, elapsed < TIME.immediateBlendThresholdMs);
      timers.push(setTimeout(() => setPose(restingPose(), true), TIME.transitionMidpointMs - elapsed));
    } else setPose(restingPose());
    timers.push(setTimeout(() => { transition = null; el.dataset.poseTransition = ''; if (!COMBAT_POSE_STATES[resting]) { auraState = ''; aura.dataset.motif = ''; } }, TIME.transitionMs - elapsed));
  };
  // A combat screen replaces its DOM between receipts. Carry presentation time
  // across that replacement so an unchanged status neither restarts nor cuts a fade.
  const setRestPose = (pose, { resume, immediate = false } = {}) => {
    const next = pose || POSE.restPose;
    if (resume) {
      resting = resume.rest;
      setPose(resume.pose);
      syncAura(resume.auraState, false);
      aura.style.opacity = String(resume.auraOpacity);
    }
    if (!resume && next === resting && (active || transition)) return;
    const from = resting;
    resting = next; el.dataset.rest = resting;
    if (immediate || reducedMotionRequested() || next === POSE.defeatedPose) { settle(); return; }
    if (resume?.transition && next === from) {
      const remaining = Math.max(0, TIME.transitionMs - (Date.now() - resume.transition.startedAt));
      syncAura(next, true, resume.auraOpacity);
      aura.getAnimations().forEach(a => a.cancel());
      if (remaining) aura.animate([{ opacity: resume.auraOpacity }, { opacity: COMBAT_POSE_STATES[next] ? 1 : 0 }], { duration: remaining, easing: TIME.auraResumeEasing });
      changeRest(resume.transition.from, resume.transition.startedAt);
    } else if (next !== from) {
      syncAura(next, true, COMBAT_POSE_STATES[from] ? undefined : 0);
      changeRest(from);
    } else settle();
  };
  const react = resource => {
    if (!POSE.reactionResources.includes(resource)) return;
    reactionQueue.push(resource);
    const next = () => {
      el.dataset.poseReaction = reactionQueue.shift() || '';
      reactionTimer = el.dataset.poseReaction ? setTimeout(next, TIME.reactionMs) : null;
    };
    if (!reactionTimer) next();
  };
  settle();
  return Object.freeze({ el, poses: [POSE.defeatedPose, ...Object.keys(frames), ...Object.keys(POWER_FRAMES), ...Object.keys(COMBAT_POSE_STATES)], get pose() { return current; }, get rest() { return resting; }, get presentation() { return { rest: resting, pose: current, transition, auraState, auraOpacity: Number.parseFloat(getComputedStyle(aura).opacity) || 0 }; }, setPose, setRestPose, settle, react, dispose() { clear(); clearTimeout(reactionTimer); reactionQueue = []; [aura, img, previous].forEach(el => el.getAnimations().forEach(a => a.cancel())); },
    play(pose, ms = TIME.defaultPlayMs, aura = []) {
      if (pose === POSE.defeatedPose) { setRestPose(POSE.defeatedPose); return true; }
      if (resting === POSE.defeatedPose) return false;
      if (reducedMotionRequested() || liteRendering()) { settle(); return false; }
      const sequence = sequenceFor(POSE.attackPoses.includes(pose) ? POSE.attackSequenceKey : pose);
      if (!sequence.length) return false;
      clear();
      transition = null; el.dataset.poseTransition = '';
      active = true;
      resources = aura;
      const duration = Math.max(TIME.minPlayMs, ms);
      setPose(sequence[0]);
      sequence.slice(1).forEach((p, i) => timers.push(setTimeout(() => setPose(p), duration * (sequence.length === TIME.fourStepSequenceLength ? TIME.fourStepOffsets[i] : (i + 1) / sequence.length))));
      timers.push(setTimeout(() => changeRest(current), duration));
      return true;
    },
  });
}
