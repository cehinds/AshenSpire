// workbench/modules/motion/render.mjs — Motion Studio's render page. Served by the GAME
// server, so it can import the game's own presentation model (src/model/presentationSequence.js:
// sample(), the cues and the anchors) and the painted outfit art. The Motion module
// (index.mjs) talks to it over postMessage, origin-checked both ways: the parent origin
// comes from ?po=, and only messages from window.parent at that origin are obeyed.
//
// Parent -> page:  { source:'ashen-motion-module', type:'load', project, outfit } sends a project once (it carries
//                   embedded images), then { type:'set', state:{ time, facing, background, onion:{prev,next} } } as the
//                   playhead moves.
// Page -> parent:  { source:'ashen-motion', type:'ready' | 'index' | 'shown' | 'error', ... }
//
// The figure is the project's own pose image (assets['pose:<name>']) when it has one, else the
// painted outfit frame for that pose, as the game's painted stage draws it. Effects are the
// clips active at the playhead, placed by the game's sample() rule (anchor + offset, mirrored
// for facing left).

import { sample, CUES, ANCHORS, VERSION } from '../../../src/model/presentationSequence.js';
import { PRESENTATION_POSES } from '../../../src/model/presentationPoseCatalog.js';
import { effectFrames, labels } from '../../../pose-studio/catalog.mjs';

const SOURCE = 'ashen-motion';
const MODULE_SOURCE = 'ashen-motion-module';
const REF_W = 1000, REF_H = 600;
// A painted frame is a 640px canvas whose floor sits at 600px (the reviewed frames' convention).
const FRAME_FLOOR = 600 / 640;
const params = new URLSearchParams(location.search);
const parentOrigin = params.get('po') || '';
const stage = document.getElementById('stage');
const note = stage.querySelector('.mo-note');

const post = (type, data = {}) => {
  if (window.parent === window || !parentOrigin) return;
  window.parent.postMessage({ source: SOURCE, type, ...data }, parentOrigin);
};

/** The painted outfit a project draws with: the chosen outfit, else the project's actor. */
function artFor(project, outfit) {
  return PRESENTATION_POSES[outfit] || PRESENTATION_POSES[project.actor] || null;
}

/** The image source for one pose frame, or null when neither the file nor the art has it. */
function poseSrc(project, outfit, pose) {
  const embedded = project.assets?.[`pose:${pose}`];
  if (typeof embedded === 'string') return embedded;
  const art = artFor(project, outfit);
  const frame = art?.frames?.[pose] || art?.frames?.idle;
  return frame ? new URL(frame.file, document.baseURI).href : null;
}

function effectSrc(id, frame) {
  const frames = effectFrames[id];
  if (!frames || !frames.length) return null;
  const file = frames[Math.min(frames.length - 1, Math.max(0, frame | 0))];
  return file ? new URL(file, document.baseURI).href : null;
}

function figure(src, { cls, side, left, top, opacity = 1, flip = false }) {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = '';
  img.decoding = 'async';
  img.src = src;
  img.style.cssText = `position:absolute;width:${side}px;height:${side}px;left:${left}px;top:${top}px;opacity:${opacity};${flip ? 'transform:scaleX(-1);' : ''}`;
  return img;
}

function draw(state) {
  const { project, outfit = null, time = 0, facing = 'right', background = 'checker', onion = {} } = state;
  stage.dataset.bg = background;
  stage.dataset.facing = facing === 'left' ? 'left' : 'right';
  stage.replaceChildren();
  note.hidden = true;
  if (!project || project.schemaVersion !== VERSION) {
    note.textContent = 'Open a pose file to see it here.';
    note.hidden = false;
    stage.append(note);
    return;
  }
  const W = stage.clientWidth || REF_W, H = stage.clientHeight || REF_H;
  const scale = Math.min(W / REF_W, H / REF_H);
  const sw = REF_W * scale, sh = REF_H * scale, ox = (W - sw) / 2, oy = (H - sh) / 2;
  const box = document.createElement('div');
  box.className = 'mo-box';
  box.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${sw}px;height:${sh}px;`;
  stage.append(box);

  const { pose, poseIndex, effects } = sample(project, time, { direction: facing });
  const side = Math.round(sh * 0.9);
  const feetY = (project.anchors.feet?.[1] ?? ANCHORS.feet[1]) * sh;
  // Facing left mirrors the figure and the effects alike, as sample() mirrors the effects.
  const mirror = facing === 'left';
  const torsoX = (mirror ? 1 - (project.anchors.torso?.[0] ?? ANCHORS.torso[0]) : (project.anchors.torso?.[0] ?? ANCHORS.torso[0])) * sw;
  const place = (x, y) => ({ left: Math.round(x - side / 2), top: Math.round(y - side * FRAME_FLOOR) });
  let p = place(torsoX, feetY);
  // The previous and next pose ghost for onion skin, drawn under the figure.
  for (const [key, index] of [['prev', onion.prev], ['next', onion.next]]) {
    if (!Number.isInteger(index) || index < 0 || index >= project.poses.length) continue;
    const src = poseSrc(project, outfit, project.poses[index]);
    if (src) box.append(figure(src, { cls: `mo-onion mo-onion-${key}`, side, ...p, opacity: 0.3, flip: mirror }));
  }
  const figSrc = poseSrc(project, outfit, pose);
  if (figSrc) box.append(figure(figSrc, { cls: 'mo-fig', side, ...p, flip: mirror }));
  else {
    note.textContent = `No art for pose ${pose}.`;
    note.hidden = false;
    stage.append(note);
  }
  for (const fx of effects) {
    const src = effectSrc(fx.effect, fx.frame);
    if (!src) continue;
    const size = Math.max(8, Math.round((fx.size / REF_W) * sw));
    const x = fx.x * sw, y = fx.y * sh;
    const img = figure(src, { cls: `mo-fx mo-fx-${fx.layer}`, side: size, left: Math.round(x - size / 2), top: Math.round(y - size / 2), opacity: fx.opacity });
    img.dataset.effect = fx.id;
    img.title = labels[fx.effect] || fx.effect;
    if (fx.rotation) img.style.transform = `rotate(${fx.rotation}deg)`;
    box.append(img);
  }
  stage.dataset.pose = pose;
  stage.dataset.poseIndex = String(poseIndex);
}

let loaded = { project: null, outfit: null };
let view = { time: 0, facing: 'right', background: 'checker', onion: {} };
function redraw() {
  try { draw({ ...loaded, ...view }); } catch (err) {
    post('error', { message: String(err && err.message || err) });
    return;
  }
  post('shown', { time: view.time, pose: stage.dataset.pose || null, poseIndex: Number(stage.dataset.poseIndex) || 0 });
}
window.addEventListener('message', (ev) => {
  if (ev.origin !== parentOrigin || ev.source !== window.parent) return;
  const data = ev.data;
  if (!data || data.source !== MODULE_SOURCE) return;
  if (data.type === 'load') {
    loaded = { project: data.project || null, outfit: data.outfit || null };
    redraw();
  } else if (data.type === 'set' && data.state) {
    view = { ...view, ...data.state };
    redraw();
  }
});

window.addEventListener('resize', () => redraw());

post('index', {
  cues: CUES,
  anchors: Object.keys(ANCHORS),
  effects: Object.keys(effectFrames),
  effectLabels: labels,
  outfits: Object.keys(PRESENTATION_POSES),
  frames: Object.fromEntries(Object.entries(PRESENTATION_POSES).map(([key, art]) => [key, Object.fromEntries(Object.entries(art.frames || {}).map(([pose, frame]) => [pose, frame.file]))])),
  version: VERSION,
});
post('ready');
