// Independent acceptance policy: the current ordered presentation owes one gap at each stage boundary (owner, D11,
// 2026-10-18) and half-rate sprites. The gap (500 ms) and the lunge clock (390 ms) are AUTHORED at x1 and divided by the
// shipped combat speed (behavior.combatSpeed, x1.25 since 2026-10-26), exactly as actionPacing() does: scale = 1 / speed,
// gap = 500 * scale, lunge = 390 * scale. The probe forbids settings changes, so it reads the shipped default.
// Only declared waits/clip/receipt holds are excluded from the existing 400/750 ms responsiveness budgets.
import { AUTOMATION_DEFAULTS, ACTION_PACING } from '../src/model/autoCombatPolicy.js';
const SPEED = AUTOMATION_DEFAULTS.combatSpeed;
const SCALE = 1 / SPEED;
const GAP = ACTION_PACING.stageGapMs * SCALE;
const LUNGE = ACTION_PACING.animationStepDurationMs * SCALE;
const near = (a, b) => Math.abs(a - b) < 0.5;
export function orderedImpactSample({ up, contact, number, timing, clip, holdMs = 0, stages, receipts = [] }) {
  const fail = message => { throw new Error(`ordered click-impact: ${message}`); };
  if (timing?.fixCore !== true) fail('the default fixture must resolve actual Core2 mechanics');
  if (!near(timing?.spriteSpeed?.lungeMs, LUNGE)) fail(`default Normal half-rate sprite must use the ${LUNGE} ms lunge clock (390 ms at x1, scaled by the x${SPEED} default speed)`);
  if (timing?.intentMs !== 0) fail('intentMs must remain 0 at default Normal: the action word fires with the action');
  for (const key of ['wordMs', 'afterSpriteMs', 'resultMs', 'reactionMs', 'damageMs', 'resetMs']) if (!near(timing?.[key], GAP)) fail(`${key} must be ${GAP} ms at default Normal (500 ms at x1, scaled by x${SPEED})`);
  if (timing.playbackRate !== 0.5 || !near(timing.scale * 1000, SCALE * 1000)) fail(`default Normal requires the x${SPEED} default speed (scale ${SCALE}) and 0.5 sprite playback`);
  if (!(Number.isFinite(clip?.impactMs) && Number.isFinite(clip?.totalMs) && clip.totalMs >= clip.impactMs)) fail('missing declared authored clip timing');
  if (Number.isFinite(clip.activeMs) && Math.abs(clip.activeMs - clip.totalMs) > 1) fail('active clip differs from its declared duration');
  const order = ['intent', 'action', 'sprite', 'contact', 'result', 'reaction', 'damage', 'hud', 'resolution'];
  const rows = stages.slice(0, order.length);
  if (rows.length !== order.length || rows.some((row, index) => row[1] !== order[index])) fail(`incomplete or reordered stages: ${rows.map(row => row[1]).join(', ')}`);
  const times = Object.fromEntries(rows.map(([at, name]) => [name, at]));
  const minimum = (start, end, ms) => { if (times[end] - times[start] < ms - 4) fail(`${start} → ${end} did not retain ${ms} ms`); };
  minimum('action', 'sprite', GAP);
  minimum('sprite', 'contact', clip.impactMs);
  minimum('sprite', 'result', clip.totalMs + holdMs + GAP);
  minimum('result', 'reaction', GAP);
  minimum('reaction', 'damage', GAP);
  const whollyMissed = receipts.some(event => event.type === 'attackMissed') && !receipts.some(event =>
    ['attackHit', 'damageDealt', 'blockGained', 'meterGuardGained', 'ratingImpact', 'hpLost', 'healed', 'barrierGained'].includes(event.type));
  if (number == null && !whollyMissed) fail('missing numeric readout without a wholly missed action');
  if (contact < times.contact - 4 || (number != null && number < times.damage - 4)) fail('readout precedes its declared stage');
  const expectedContact = GAP + clip.impactMs;
  const expectedNumber = 4 * GAP + clip.totalMs + holdMs;
  return { contact: Math.round(contact - up), number: number == null ? null : Math.round(number - up), expectedContact, expectedNumber,
    contactOverhead: Math.round(contact - up - expectedContact), numberOverhead: number == null ? null : Math.round(number - up - expectedNumber) };
}
