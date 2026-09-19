import { uiConfig } from '../config/generated/ui.js';
import { figureSpec, gripOf } from './loadout.js';

// A derived presentation component: never persisted alongside authoritative equipment.
export const EQUIPMENT_ANIMATIONS = uiConfig.presentation.equipmentAnimations.components;
export const ANIMATION_ROLES = Object.freeze(['idle', 'attack', 'defend', 'buff', 'hurt', 'cast', 'stanceActivate', 'stanceDeactivate', 'aggressiveStance', 'defensiveStance', 'conversation', 'portrait', 'menu', 'detail', 'dodge', 'victory', 'defeat', 'revive']);

export function validateEquipmentAnimations(data) {
  const fail = message => { throw new Error('equipmentAnimations: ' + message); };
  const groups = new Set(['empty']);
  const items = new Set();
  for (const [id, members] of Object.entries(data.weaponGroups)) {
    if (id === 'empty' || !Array.isArray(members) || !members.length) fail('invalid weapon group ' + id);
    groups.add(id);
    for (const item of members) { if (typeof item !== 'string' || items.has(item)) fail('duplicate/invalid weapon ' + item); items.add(item); }
  }
  for (const [id, set] of Object.entries(data.sets)) {
    if (!set.frames || !set.clips || !set.references || !Number.isFinite(set.normalLungeMs) || set.normalLungeMs <= 0) fail('incomplete set ' + id);
    for (const [name, frame] of Object.entries(set.frames)) {
      if (!/^assets\/[a-zA-Z0-9_./-]+\.webp$/.test(frame.file) || frame.file.includes('..')) fail(id + ': invalid asset ' + name);
      if (!frame.box || ['x0', 'y0', 'x1', 'y1'].some(k => !Number.isFinite(frame.box[k])) || frame.box.x1 < frame.box.x0 || frame.box.y1 < frame.box.y0) fail(id + ': invalid bounds ' + name);
    }
    for (const [name, clip] of Object.entries(set.clips)) {
      if (!Array.isArray(clip.frames) || !clip.frames.length || clip.frames.some(f => !Object.hasOwn(set.frames, f))) fail(id + ': invalid clip frames ' + name);
      if (!Number.isFinite(clip.frameMs) || clip.frameMs <= 0 || !Number.isInteger(clip.impactIndex) || clip.impactIndex < 0 || clip.impactIndex >= clip.frames.length) fail(id + ': invalid clip timing ' + name);
    }
    for (const role of ANIMATION_ROLES) {
      if (!Object.hasOwn(set.references, role)) fail(id + ': missing reference slot ' + role);
      const ref = set.references[role];
      if (ref !== null && !Object.hasOwn(set.clips, ref)) fail(id + ': unknown clip for ' + role);
    }
    if (!set.references.idle) fail(id + ': idle reference required');
    for (const [pose, role] of Object.entries(set.poseRoles || {})) if (!ANIMATION_ROLES.includes(role)) fail(id + ': unknown role for ' + pose);
  }
  const selectors = new Set();
  for (const binding of data.bindings) {
    const key = JSON.stringify([binding.classId, binding.armourId, binding.rightGroup, binding.leftGroup, binding.grip || '*']);
    if (selectors.has(key)) fail('duplicate selector ' + key);
    selectors.add(key);
    if (!binding.classId || !binding.armourId || !groups.has(binding.rightGroup) || !groups.has(binding.leftGroup) || !Object.hasOwn(data.sets, binding.setId) || (binding.grip && !['one', 'two', 'dual'].includes(binding.grip))) fail('invalid binding ' + key);
  }
  return true;
}
validateEquipmentAnimations(EQUIPMENT_ANIMATIONS);

export function selectEquipmentAnimation({ classId, armourId = 'default', rightId = null, leftId = null, grip = 'one' }, data = EQUIPMENT_ANIMATIONS) {
  const group = id => id == null ? 'empty' : Object.entries(data.weaponGroups).find(([, members]) => members.includes(id))?.[0];
  const rightGroup = group(rightId), leftGroup = group(leftId);
  // Unknown items must not silently become empty hands or inherit an unrelated set.
  if (!rightGroup || !leftGroup) return null;
  const matches = data.bindings.filter(b => b.classId === classId && b.armourId === armourId && b.rightGroup === rightGroup && b.leftGroup === leftGroup && (!b.grip || b.grip === grip));
  const binding = matches.find(b => b.grip === grip) || matches[0];
  if (!binding) return null;
  return { setId: binding.setId, classId, armourId, rightGroup, leftGroup, grip, ...data.sets[binding.setId] };
}

export function equipmentAnimationForLoadout(registries, loadout, classId) {
  const held = gripOf(registries, loadout, classId);
  return selectEquipmentAnimation({ classId, armourId: figureSpec(registries, loadout, classId).armourId, rightId: held.right, leftId: held.left, grip: held.mode });
}

export function animationClip(component, roleOrPose) {
  if (!component) return null;
  const role = component.poseRoles?.[roleOrPose] || roleOrPose;
  const ref = component.references[role];
  return ref ? component.clips[ref] || null : null;
}

export function animationView(component, role) {
  const clip = animationClip(component, role);
  return clip ? component.frames[clip.frames[0]]?.file || null : null;
}

export function animationTiming(component, roleOrPose, speed) {
  const clip = animationClip(component, roleOrPose);
  if (!clip) return null;
  const scale = Math.max(0.1, Number(speed?.lungeMs || component.normalLungeMs) / component.normalLungeMs);
  const frameMs = Math.max(1, Math.round(clip.frameMs * scale));
  return { totalMs: frameMs * clip.frames.length, impactMs: frameMs * clip.impactIndex };
}

export function animationArt(component, fallback) {
  if (!component || !fallback) return fallback;
  const frames = { ...fallback.frames, ...component.frames };
  for (const [pose, role] of Object.entries(component.poseRoles || {})) {
    const clip = animationClip(component, role);
    if (clip) frames[pose] = component.frames[clip.frames.at(-1)];
  }
  const menu = { ...fallback.menu };
  for (const [view, role] of [['stand', 'menu'], ['portrait', 'portrait'], ['detail', 'detail'], ['conversation', 'conversation']]) {
    const file = animationView(component, role);
    if (file) menu[view] = file;
  }
  return { ...fallback, frames, menu };
}
