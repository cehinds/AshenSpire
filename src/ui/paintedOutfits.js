import { paintedOutfit } from '../model/paintedOutfitArt.js';

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
  const warmed = Object.values(art.frames).map(frame => { const image = new Image(); image.src = assetUrl(frame.file); return image; });
  let current = 'idle';
  let timers = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const setPose = pose => {
    if (!art.frames[pose]) return false;
    current = pose;
    el.dataset.pose = pose;
    img.src = assetUrl(art.frames[pose].file);
    return true;
  };
  const settle = () => { clear(); setPose('idle'); };
  settle();
  return Object.freeze({ el, poses: Object.keys(art.frames), get pose() { return current; }, setPose, settle, warmed,
    play(pose, ms = 260) {
      if (reducedMotionRequested()) { settle(); return false; }
      if (pose !== 'attack' && !art.frames[pose]) return false;
      clear();
      const duration = Math.max(60, ms);
      if (pose === 'attack' || /^attack[1-4]$/.test(pose)) {
        const sequence = ['attack1', 'attack2', 'attack3', 'attack4'];
        setPose(sequence[0]);
        sequence.slice(1).forEach((p, i) => timers.push(setTimeout(() => setPose(p), duration * [0.28, 0.55, 0.8][i])));
      } else setPose(pose);
      timers.push(setTimeout(settle, duration));
      return true;
    },
  });
}
