// src/ui/services/PoseAnimator.js — plays pose frames for a combat figure.
//
// The combat figure used to be one image that CSS slid sideways for an attack.
// This swaps the image for a frame of the same figure in another pose — a lunge,
// a guard, a recoil — while the existing lunge transform still runs underneath.
//
// REGISTRATION IS THE WHOLE PROBLEM. The frames are cropped tight, so they differ
// in size: swapping by size alone makes the figure jump, grow and slide. Every
// frame carries where its crop sat on a shared canvas, plus that canvas's floor
// line (src/content/poseSprites.js, generated). This positions a canvas-shaped
// layer inside the figure box so the floor line lands on the box's bottom and the
// idle pelvis on its centre, then places each frame at its own canvas offset. The
// feet stay planted; a lunge reaches out past the box, which is the point.
//
// Everything is a percentage of the layer, and the layer takes its width from an
// aspect-ratio, so the whole thing resizes with the box and needs no measuring —
// no getBoundingClientRect, no resize listener, nothing to go stale.
//
// SPEC §7.4 holds: this never blocks input, reduced motion keeps the idle frame,
// and the animation-speed setting scales how long a pose is held (the pose IS the
// actor animation, so it rides the same lunge window rather than adding time).
import { POSE_CANVAS, POSE_DIR, POSE_FRAMES, POSE_STRIP } from '../../content/poseSprites.js';
import { assetUrl } from '../assetmap.js';

const key = (classId, pose, tint) => `${classId}_${pose}_${tint}`;

// Ask for 'attack' and the figure throws its next swing. The rotation belongs to
// the figure: a module-wide counter advanced on every attack in the fight — enemy
// swings included, and those have no frames at all — so a player skipped frames
// and the drift carried into later fights.
const ATTACK_SEQUENCE = ['attack1', 'attack2', 'attack3'];

// Where a figure is up to in its swings. NOT on the stage: combat rebuilds the
// player zone before every timeline, so a stage-local counter was new — and back
// at attack1 — for every single attack. Keyed by who the figure is, it outlives
// the DOM the figure is drawn into.
const swings = new Map();

/** The frame row for one pose, or null when this build does not ship it. */
export function poseFrame(classId, pose, tint) {
  return POSE_FRAMES.get(key(classId, pose, tint)) || null;
}

/** True when a class/tint has the idle frame every stage is anchored on. */
export function hasPoses(classId, tint) {
  return Boolean(poseFrame(classId, 'idle', tint));
}

/** The poses this build carries for a class/tint, in strip order. */
export function posesFor(classId, tint) {
  return POSE_STRIP.filter((p) => poseFrame(classId, p, tint));
}

function place(img, frame) {
  const { width: cw, height: ch } = POSE_CANVAS;
  img.style.left = `${(frame.x / cw) * 100}%`;
  img.style.top = `${(frame.y / ch) * 100}%`;
  img.style.width = `${(frame.w / cw) * 100}%`;
  img.style.height = `${(frame.h / ch) * 100}%`;
}

/**
 * createPoseStage(classId, tint) → { el, setPose, play, poses } or null.
 *
 * `el` fills its parent and draws the idle frame. `play(pose, ms)` holds another
 * frame for ms, then settles back to idle; a second call replaces the first.
 */
export function createPoseStage(classId, tint, id = `${classId}_${tint}`) {
  const idle = poseFrame(classId, 'idle', tint);
  if (!idle) return null;
  const { width: cw, height: ch } = POSE_CANVAS;

  const el = document.createElement('div');
  el.className = 'pose-stage';
  el.dataset.poseClass = classId;

  // The canvas layer: tall enough that the idle figure (its top down to the floor
  // line) fills the box, positioned so that floor line sits on the box's bottom
  // and the idle pelvis on the box's centre. A frame reaching past the box — a
  // raised weapon, a step forward — overflows, which is wanted.
  const figureH = Math.max(1, idle.g - idle.y);
  const layer = document.createElement('div');
  layer.className = 'pose-layer';
  layer.style.height = `${(ch / figureH) * 100}%`;
  layer.style.aspectRatio = `${cw} / ${ch}`;
  layer.style.top = `${100 - (idle.g / figureH) * 100}%`;
  layer.style.transform = `translateX(${-(idle.rx / cw) * 100}%)`;

  const img = document.createElement('img');
  img.className = 'pose-frame';
  img.alt = classId;
  img.draggable = false;
  img.src = assetUrl(POSE_DIR + idle.f);
  place(img, idle);
  layer.appendChild(img);
  el.appendChild(layer);

  // Warm the other frames now: a pose fetched at the moment of the attack would
  // land after the beat it belongs to.
  const warmed = [];
  for (const p of posesFor(classId, tint)) {
    if (p === 'idle') continue;
    const pre = new Image();
    pre.src = assetUrl(POSE_DIR + poseFrame(classId, p, tint).f);
    warmed.push(pre);
  }

  let timer = null;
  let current = 'idle';
  const throwable = ATTACK_SEQUENCE.filter((p) => poseFrame(classId, p, tint));
  const resolve = (pose) => {
    if (pose !== 'attack' || !throwable.length) return pose;
    const n = swings.get(id) || 0;
    swings.set(id, n + 1);
    return throwable[n % throwable.length];
  };
  const settle = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (current === 'idle') return;
    current = 'idle';
    img.src = assetUrl(POSE_DIR + idle.f);
    place(img, idle);
  };
  const setPose = (pose) => {
    const frame = poseFrame(classId, pose, tint);
    if (!frame || pose === current) return Boolean(frame);
    current = pose;
    img.src = assetUrl(POSE_DIR + frame.f);
    place(img, frame);
    return true;
  };

  return Object.freeze({
    el,
    poses: posesFor(classId, tint),
    /** The pose showing right now — 'idle' unless one is being held. */
    get pose() { return current; },
    setPose,
    /** Hold `pose` for ms, then return to idle. Reduced motion holds nothing. */
    play(pose, ms = 260) {
      if (document.body.classList.contains('reduced-motion')) return false;
      if (timer) { clearTimeout(timer); timer = null; }
      if (!setPose(resolve(pose))) return false;
      timer = setTimeout(settle, Math.max(60, ms));
      return true;
    },
    settle,
    /** Who this figure is, for the swing rotation that outlives its DOM. */
    id,
    /** Keep the preloaded frames reachable for as long as the stage lives. */
    warmed,
  });
}

// The stage a combatant is showing, reachable from the anchor element the effects
// layer already looks up for floats and flashes.
//
// That anchor is the combatant's `.sprite` box and the stage lives BELOW it —
// .sprite > .class-sprite > .pose-stage — so a lookup that only walked up from
// the anchor found nothing and every pose call quietly did nothing. It searches
// down from the anchor, and up as well for a caller that hands over the stage
// element itself.
const STAGE_KEY = '__poseStage';

/** Remember the stage drawn inside an element. */
export function registerStage(hostEl, stage) {
  if (hostEl && stage) hostEl[STAGE_KEY] = stage;
}

/** The stage at or under an element, else the nearest one above it. */
export function stageFor(anchorEl) {
  if (!anchorEl) return null;
  if (anchorEl[STAGE_KEY]) return anchorEl[STAGE_KEY];
  const below = anchorEl.querySelector?.('.class-sprite.animated, .pose-stage');
  if (below?.[STAGE_KEY]) return below[STAGE_KEY];
  for (let el = anchorEl.parentElement; el; el = el.parentElement) {
    if (el[STAGE_KEY]) return el[STAGE_KEY];
  }
  return null;
}

/**
 * playPoseOn(anchorEl, pose, ms) — play a pose on whatever stage that element
 * carries. A figure drawn in any other style has no stage, and this does
 * nothing, so callers need no capability check of their own.
 */
export function playPoseOn(anchorEl, pose, ms) {
  const stage = stageFor(anchorEl);
  return stage ? stage.play(pose, ms) : false;
}
