import { DEFEATED_ART } from '../content/defeatedArt.js';
import { paintedOutfit } from '../model/paintedOutfitArt.js';
import { auraFilter, POWER_FRAMES } from './combatAura.js';
import { COMBAT_SEQUENCES } from '../model/combatAnimation.js';
import { COMBAT_POSE_STATES } from '../content/combatPoseStates.js';
import { READINESS_POSE_ART } from '../content/readinessPoseArt.js';

import { assetUrl } from './assetmap.js';
import { reducedMotionRequested } from './motion.js';

export function paintedPortraitUrl(classId, armourId = 'default') {
  const art = paintedOutfit(classId, armourId);
  return art ? assetUrl(art.menu.portrait) : null;
}

export function paintedPresentation(classId, armourId = 'default', pose = 'stand') {
  const art = paintedOutfit(classId, armourId);
  if (!art || !art.menu[pose]) return null;
  const img = document.createElement('img');
  img.src = assetUrl(art.menu[pose]);
  img.alt = `${classId} ${armourId || 'default'}`;
  img.className = 'painted-presentation';
  img.style.cssText = `display:block;width:100%;height:100%;object-fit:contain;object-position:center ${pose === 'portrait' ? 'bottom' : 'center'};`;
  return img;
}

// The reviewed frames share a 640px canvas, center 320 and floor 600.
// Fit the tallest resting body to the stage; every action keeps that scale.
export function createPaintedStage(classId, armourId = 'default', { still = false } = {}) {
  if (still) {
    const presentation = paintedPresentation(classId, armourId);
    const defeated = createPaintedStage(classId, armourId);
    if (!presentation || !defeated) return null;
    const el = document.createElement('div');
    el.className = 'pose-stage rendered-stage';
    defeated.el.style.position = 'absolute'; defeated.el.style.inset = '0';
    el.append(presentation, defeated.el);
    let resting = 'idle';
    const settle = () => {
      const down = resting === 'defeated' || Object.hasOwn(COMBAT_POSE_STATES, resting);
      presentation.style.visibility = down ? 'hidden' : 'visible';
      defeated.el.style.visibility = down ? 'visible' : 'hidden';
      defeated.setRestPose(down ? resting : 'idle');
      // Child frames set their own visibility, so hide the whole inactive stage.
      defeated.el.hidden = !down;
      el.dataset.pose = resting;
    };
    const setRestPose = pose => { resting = pose === 'defeated' || Object.hasOwn(COMBAT_POSE_STATES, pose) ? pose : 'idle'; el.dataset.rest = resting; settle(); };
    settle();
    return Object.freeze({ el, poses: ['idle', 'defeated'], get pose() { return resting; },
      setRestPose, settle, react: defeated.react, dispose: defeated.dispose,
      play(pose) { if (pose !== 'defeated') return false; setRestPose(pose); return true; },
    });
  }
  const art = paintedOutfit(classId, armourId);
  if (!art) return null;
  const el = document.createElement('div');
  el.className = 'pose-stage painted-stage';
  el.dataset.poseClass = !armourId || armourId === 'default' ? classId : `${classId}-${armourId}`;
  const frames = { ...art.frames, ...(READINESS_POSE_ART[el.dataset.poseClass] || READINESS_POSE_ART[classId]) };
  if (READINESS_POSE_ART[classId]) el.classList.add('readiness-outfit');
  const readyFrames = READINESS_POSE_ART[el.dataset.poseClass] || READINESS_POSE_ART[classId] || {};
  const height = Math.max(600 - art.frames.idle.box.y0, ...Object.values(readyFrames).map(frame => 600 - frame.box.y0));
  const layer = document.createElement('div');
  layer.className = 'pose-layer';
  layer.style.cssText = `height:${640 / height * 100}%;aspect-ratio:1;top:${100 - 600 / height * 100}%;transform:translateX(-50%);`;
  const img = document.createElement('img');
  img.className = 'pose-frame';
  img.alt = classId;
  img.style.cssText = 'inset:0;width:100%;height:100%;';
  layer.appendChild(img);
  el.appendChild(layer);
  const aura = document.createElement('div');
  aura.className = 'combat-pose-aura';
  aura.setAttribute('aria-hidden', 'true');
  aura.innerHTML = '<svg viewBox="0 0 120 140"><g class="pose-diamond"><path d="M60 8 78 28 60 48 42 28Z"/><path d="M60 18 68 28 60 38 52 28Z"/></g><g class="pose-constellation"><path d="m25 38 30-23 30 20 16 33-40-11-34 27 7-46"/><circle cx="25" cy="38" r="3"/><circle cx="55" cy="15" r="4"/><circle cx="85" cy="35" r="3"/><circle cx="101" cy="68" r="3"/><circle cx="61" cy="57" r="4"/><circle cx="27" cy="84" r="3"/></g><g class="pose-halo"><circle cx="60" cy="38" r="30" stroke-dasharray="35 11 20 12"/><circle class="pose-halo-gold" cx="60" cy="38" r="36" stroke-dasharray="24 18 42 30"/></g><ellipse class="pose-floor" cx="60" cy="128" rx="42" ry="8"/></svg>';
  el.appendChild(aura);
  const downArt = DEFEATED_ART[el.dataset.poseClass] || DEFEATED_ART[classId];
  const down = document.createElement('img');
  down.className = 'defeated-frame'; down.alt = '';
  down.style.cssText = `position:absolute;left:50%;bottom:0;height:${100 * (downArt?.scale || 1)}%;width:auto;max-width:none;transform:translate(-50%,5.208333%);visibility:hidden;pointer-events:none;`;
  if (downArt) down.src = assetUrl(downArt.file);
  el.appendChild(down);
  const warmed = Object.values(frames).map(frame => { const image = new Image(); image.src = assetUrl(frame.file); return image; });
  let current = 'idle';
  let resting = 'idle';
  let timers = [];
  let resources = [], active = false;
  let reactionTimer, reactionQueue = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const setPose = pose => {
    if (pose === 'defeated' && downArt) {
      current = pose; el.dataset.pose = pose; el.dataset.aura = '';
      layer.style.visibility = 'hidden'; down.style.visibility = 'visible'; return true;
    }
    layer.style.visibility = ''; down.style.visibility = 'hidden';
    const state = COMBAT_POSE_STATES[pose];
    const frame = frames[pose] || (state ? frames[state.frame] || frames[state.fallback] : null) || (Object.hasOwn(POWER_FRAMES, pose) ? frames.idle : null);
    if (!frame) return false;
    current = pose;
    el.dataset.pose = pose;
    img.src = assetUrl(frame.file);
    img.style.filter = auraFilter(pose, resting, resources, active);
    const restingState = COMBAT_POSE_STATES[resting];
    el.dataset.poseState = restingState && resting !== 'defeated' ? resting : '';
    aura.dataset.motif = restingState?.motif || '';
    aura.style.setProperty('--pose-color', restingState?.color || 'transparent');
    el.dataset.aura = active ? resources.join(' ') : ['guard','shieldGuard','parry'].includes(resting) ? 'guard' : '';
    return true;
  };
  const sequenceFor = pose => (Object.hasOwn(COMBAT_SEQUENCES, pose) ? COMBAT_SEQUENCES[pose] : [pose]).filter(p => Object.hasOwn(frames, p) || Object.hasOwn(POWER_FRAMES, p) || Object.hasOwn(COMBAT_POSE_STATES, p));
  const restingPose = () => resting === 'defeated' ? 'defeated' : sequenceFor(resting).at(-1) || (resting === 'shieldGuard' || resting === 'parry' ? 'guard' : 'idle');
  const settle = () => { clear(); active = false; resources = []; setPose(restingPose()); };
  const setRestPose = pose => { const next = pose || 'idle'; if (next === resting && active) return; resting = next; el.dataset.rest = resting; settle(); };
  const react = resource => {
    if (!['hp', 'heal'].includes(resource)) return;
    reactionQueue.push(resource);
    const next = () => {
      el.dataset.poseReaction = reactionQueue.shift() || '';
      reactionTimer = el.dataset.poseReaction ? setTimeout(next, 260) : null;
    };
    if (!reactionTimer) next();
  };
  settle();
  return Object.freeze({ el, poses: ['defeated', ...Object.keys(frames), ...Object.keys(POWER_FRAMES), ...Object.keys(COMBAT_POSE_STATES)], get pose() { return current; }, get rest() { return resting; }, setPose, setRestPose, settle, react, warmed, dispose() { clear(); clearTimeout(reactionTimer); reactionQueue = []; },
    play(pose, ms = 260, aura = []) {
      if (pose === 'defeated') { setRestPose('defeated'); return true; }
      if (resting === 'defeated') return false;
      if (reducedMotionRequested()) { settle(); return false; }
      const sequence = sequenceFor(/^attack[1-4]$/.test(pose) ? 'attack' : pose);
      if (!sequence.length) return false;
      clear();
      active = true;
      resources = aura;
      const duration = Math.max(60, ms);
      setPose(sequence[0]);
      sequence.slice(1).forEach((p, i) => timers.push(setTimeout(() => setPose(p), duration * (sequence.length === 4 ? [0.28, 0.55, 0.8][i] : (i + 1) / sequence.length))));
      timers.push(setTimeout(settle, duration));
      return true;
    },
  });
}
