// Independent acceptance policy: the current ordered presentation owes one gap at each stage boundary (owner, D11,
// 2026-10-18) and half-rate sprites. The gap (500 ms) and the lunge clock (550 ms) are AUTHORED at x1 and divided by the
// shipped combat speed (behavior.combatSpeed, x1.25 since 2026-10-26), exactly as actionPacing() does: scale = 1 / speed,
// gap = 500 * scale, intent = one gap, lunge = 550 * scale. The probe forbids settings changes, so it reads the shipped default.
// The first numeric readout is the HP damage number (owner's floater policy, 2026-11-07): protection and meter-only
// plays draw none and owe none; an HP-damaging beat owes one.
// Only declared waits/clip/receipt holds are excluded from the existing 400/750 ms responsiveness budgets.
import { AUTOMATION_DEFAULTS, ACTION_PACING } from '../src/model/autoCombatPolicy.js';
const SPEED = AUTOMATION_DEFAULTS.combatSpeed;
const SCALE = 1 / SPEED;
const GAP = ACTION_PACING.stageGapMs * SCALE;
const LUNGE = ACTION_PACING.animationStepDefaultMs * SCALE;
const near = (a, b) => Math.abs(a - b) < 0.5;
export function orderedImpactSample({ up, contact, number, timing, clip, holdMs = 0, stages, hpDamage = false, receipts = [] }) {
  const fail = message => { throw new Error(`ordered click-impact: ${message}`); };
  if (timing?.fixCore !== true) fail('the default fixture must resolve actual Core2 mechanics');
  if (!near(timing?.spriteSpeed?.lungeMs, LUNGE)) fail(`default Normal half-rate sprite must use the ${LUNGE} ms lunge clock (550 ms at x1, scaled by the x${SPEED} default speed)`);
  if (!near(timing?.intentMs, GAP)) fail(`intentMs must be ${GAP} ms at default Normal: the stance follows the intent word by one gap (owner, 2026-11-06)`);
  for (const key of ['wordMs', 'afterSpriteMs', 'resultMs', 'reactionMs', 'damageMs', 'resetMs']) if (!near(timing?.[key], GAP)) fail(`${key} must be ${GAP} ms at default Normal (500 ms at x1, scaled by x${SPEED})`);
  if (timing.playbackRate !== 0.5 || !near(timing.scale * 1000, SCALE * 1000)) fail(`default Normal requires the x${SPEED} default speed (scale ${SCALE}) and 0.5 sprite playback`);
  if (!(Number.isFinite(clip?.impactMs) && Number.isFinite(clip?.totalMs) && clip.totalMs >= clip.impactMs)) fail('missing declared authored clip timing');
  if (Number.isFinite(clip.activeMs) && Math.abs(clip.activeMs - clip.totalMs) > 1) fail('active clip differs from its declared duration');
  const order = ['intent', 'action', 'sprite', 'contact', 'result', 'reaction', 'damage', 'hud', 'resolution'];
  // Owner 2026-11-06: the beat opens with its cost (a 'cost' marker) and a stance change draws a 'stance-change' marker.
  // Both are presentation markers, not timeline stages: the nine stages keep their exact order, and each marker must sit
  // where the owner's order puts it (cost with the intent, before the action; the stance after the action, before the sprite).
  const MARKERS = ['cost', 'stance-change'];
  const marked = stages.filter(row => !MARKERS.includes(row[1]));
  const rows = marked.slice(0, order.length);
  const at = name => stages.find(row => row[1] === name)?.[0];
  const stageAt = name => rows.find(row => row[1] === name)?.[0];
  if (rows.length === order.length) {
    if (at('cost') !== undefined && !(at('cost') >= stageAt('intent') && at('cost') <= stageAt('action'))) fail('the cost must be paid with the intent, before the action');
    if (at('stance-change') !== undefined && !(at('stance-change') >= stageAt('action') && at('stance-change') <= stageAt('sprite'))) fail('the stance change must follow the action word and precede the sprite');
  }
  if (rows.length !== order.length || rows.some((row, index) => row[1] !== order[index])) fail(`incomplete or reordered stages: ${rows.map(row => row[1]).join(', ')}`);
  const times = Object.fromEntries(rows.map(([at, name]) => [name, at]));
  const minimum = (start, end, ms) => { if (times[end] - times[start] < ms - 4) fail(`${start} → ${end} did not retain ${ms} ms`); };
  minimum('intent', 'action', GAP);
  minimum('action', 'sprite', GAP);
  minimum('sprite', 'contact', clip.impactMs);
  minimum('sprite', 'result', clip.totalMs + holdMs + GAP);
  minimum('result', 'reaction', GAP);
  minimum('reaction', 'damage', GAP);
  const kinds = [...new Set(receipts.map(event => event.type))].join(', ') || 'none';
  if (hpDamage && number == null) fail(`missing HP damage readout (receipts: ${kinds})`);
  if (!hpDamage && number != null) fail(`a numeric readout drew without HP damage (floater policy, owner 2026-11-07; receipts: ${kinds})`);
  if (contact < times.contact - 4 || (number != null && number < times.damage - 4)) fail('readout precedes its declared stage');
  const expectedContact = 2 * GAP + clip.impactMs;
  const expectedNumber = 5 * GAP + clip.totalMs + holdMs;
  return { contact: Math.round(contact - up), number: number == null ? null : Math.round(number - up), expectedContact, expectedNumber,
    contactOverhead: Math.round(contact - up - expectedContact), numberOverhead: number == null ? null : Math.round(number - up - expectedNumber) };
}
