import { DEFEATED_ART } from '../content/defeatedArt.js';
import { paintedOutfit } from '../model/paintedOutfitArt.js';
import { auraFilter, POWER_FRAMES } from './combatAura.js';
import { COMBAT_SEQUENCES } from '../model/combatAnimation.js';

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
// Fit the idle body to the stage; every other pose keeps that exact scale.
export function createPaintedStage(classId, armourId = 'default') {
  const art = paintedOutfit(classId, armourId);
  if (!art) return null;
  const el = document.createElement('div');
  el.className = 'pose-stage painted-stage';
  el.dataset.poseClass = !armourId || armourId === 'default' ? classId : `${classId}-${armourId}`;
  const height = 600 - art.frames.idle.box.y0;
  const layer = document.createElement('div');
  layer.className = 'pose-layer';
  layer.style.cssText = `height:${640 / height * 100}%;aspect-ratio:1;top:${100 - 600 / height * 100}%;transform:translateX(-50%);`;
  const img = document.createElement('img');
  img.className = 'pose-frame';
  img.alt = classId;
  img.style.cssText = 'inset:0;width:100%;height:100%;';
  layer.appendChild(img);
  el.appendChild(layer);
  const downArt = DEFEATED_ART[el.dataset.poseClass] || DEFEATED_ART[classId];
  const down = document.createElement('img');
  down.className = 'defeated-frame'; down.alt = '';
  down.style.cssText = `position:absolute;left:50%;bottom:0;height:${100 * (downArt?.scale || 1)}%;width:auto;max-width:none;transform:translate(-50%,5.208333%);visibility:hidden;pointer-events:none;`;
  if (downArt) down.src = assetUrl(downArt.file);
  el.appendChild(down);
  const warmed = Object.values(art.frames).map(frame => { const image = new Image(); image.src = assetUrl(frame.file); return image; });
  let current = 'idle';
  let resting = 'idle';
  let timers = [];
  let resources = [], active = false;
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const setPose = pose => {
    if (pose === 'defeated' && downArt) {
      current = pose; el.dataset.pose = pose; el.dataset.aura = '';
      layer.style.visibility = 'hidden'; down.style.visibility = 'visible'; return true;
    }
    layer.style.visibility = ''; down.style.visibility = 'hidden';
    const frame = art.frames[pose] || (Object.hasOwn(POWER_FRAMES, pose) ? art.frames.idle : null);
    if (!frame) return false;
    current = pose;
    el.dataset.pose = pose;
    img.src = assetUrl(frame.file);
    img.style.filter = auraFilter(pose, resting, resources, active);
    el.dataset.aura = active ? resources.join(' ') : ['guard','shieldGuard','parry'].includes(resting) ? 'guard' : '';
    return true;
  };
  const sequenceFor = pose => (Object.hasOwn(COMBAT_SEQUENCES, pose) ? COMBAT_SEQUENCES[pose] : [pose]).filter(p => Object.hasOwn(art.frames, p) || Object.hasOwn(POWER_FRAMES, p));
  const restingPose = () => resting === 'defeated' ? 'defeated' : sequenceFor(resting).at(-1) || (resting === 'shieldGuard' || resting === 'parry' ? 'guard' : 'idle');
  const settle = () => { clear(); active = false; resources = []; setPose(restingPose()); };
  const setRestPose = pose => { resting = pose || 'idle'; el.dataset.rest = resting; settle(); };
  settle();
  return Object.freeze({ el, poses: ['defeated', ...Object.keys(art.frames), ...Object.keys(POWER_FRAMES)], get pose() { return current; }, get rest() { return resting; }, setPose, setRestPose, settle, warmed, dispose: clear,
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
