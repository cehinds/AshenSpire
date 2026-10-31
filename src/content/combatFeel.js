// src/content/combatFeel.js — how hard a hit feels, as data (SPEC §7.4, D51).
// The numbers are authored in content/source/combatFeel.json (what each step
// and the hit-stop row mean, and which figures must agree, are in
// content/source/CONTENT-NOTES.md, "Combat feel"); content-build compiles it to
// src/content/generated/combatFeel.js. Edit the JSON; this file freezes the
// tables and keeps the functions.
import { combatFeel } from './generated/combatFeel.js';

export const BIG_HIT_SHARE = combatFeel.bigHitShare;
export const HUGE_HIT_SHARE = combatFeel.hugeHitShare;

export const SHAKE_MAX_PX = combatFeel.shakeMaxPx;
export const SHAKE_FLOOR_PX = combatFeel.shakeFloorPx;

export const SHAKE_STEPS = Object.freeze(combatFeel.shakeSteps.map((step) => Object.freeze(step)));

export const SHAKE_STEPS_HP = Object.freeze(combatFeel.shakeStepsHp.map((step) => Object.freeze(step)));

export const HIT_STOP = Object.freeze(combatFeel.hitStop);

/**
 * shakePxFor(hpLost, targetMaxHp?, steps?, hpSteps?) → the shake amplitude in px for one hit; 0 means none.
 * With the target's max HP, the share of it the hit cost picks the step; without, the absolute-HP steps do.
 */
export function shakePxFor(hpLost, targetMaxHp = 0, steps = SHAKE_STEPS, hpSteps = SHAKE_STEPS_HP) {
  if (!(hpLost > 0)) return 0;
  let px = 0;
  if (targetMaxHp > 0) {
    const share = hpLost / targetMaxHp;
    px = SHAKE_FLOOR_PX;
    for (const step of steps) if (share >= step.minShare) px = Math.max(px, step.px);
  } else {
    for (const step of hpSteps) if (hpLost >= step.minHp) px = Math.max(px, step.px);
  }
  return Math.min(SHAKE_MAX_PX, px);
}

/**
 * hitStopMsFor(hpLost, targetMaxHp?, row?) → how long the figures hold at impact; 0 means none.
 * The huge share (of the target's max HP) is judged first and needs no HP floor; below it, the minHp floor gates ms.
 */
export function hitStopMsFor(hpLost, targetMaxHp = 0, row = HIT_STOP) {
  if (!(row.ms > 0) || !(hpLost > 0)) return 0;
  if (targetMaxHp > 0 && row.hugeMs > 0 && hpLost / targetMaxHp >= row.hugeShare) return row.hugeMs;
  return hpLost >= row.minHp ? row.ms : 0;
}

/** combatFeelIssues(steps?, row?, hpSteps?) → a list of problems, each naming its row; [] is valid. */
export function combatFeelIssues(steps = SHAKE_STEPS, row = HIT_STOP, hpSteps = SHAKE_STEPS_HP) {
  const issues = [];
  const pxIssue = (name, i, step) => {
    if (!Number.isFinite(step.px) || step.px <= 0 || step.px > SHAKE_MAX_PX) issues.push(`${name}[${i}].px must be in (0, ${SHAKE_MAX_PX}]`);
  };
  let last = 0, lastPx = 0;
  steps.forEach((step, i) => {
    if (!Number.isFinite(step.minShare) || step.minShare <= 0 || step.minShare > 1) issues.push(`SHAKE_STEPS[${i}].minShare must be a share in (0, 1]`);
    pxIssue('SHAKE_STEPS', i, step);
    if (step.minShare <= last) issues.push(`SHAKE_STEPS[${i}].minShare must rise above the step before it`);
    if (step.px <= lastPx) issues.push(`SHAKE_STEPS[${i}].px must rise above the step before it`);
    last = step.minShare; lastPx = step.px;
  });
  last = 0;
  hpSteps.forEach((step, i) => {
    if (!Number.isFinite(step.minHp) || step.minHp < 1) issues.push(`SHAKE_STEPS_HP[${i}].minHp must be a number ≥ 1`);
    pxIssue('SHAKE_STEPS_HP', i, step);
    if (step.minHp <= last) issues.push(`SHAKE_STEPS_HP[${i}].minHp must rise above the step before it`);
    last = step.minHp;
  });
  if (!Number.isFinite(row.minHp) || row.minHp < 1) issues.push('HIT_STOP.minHp must be a number ≥ 1');
  if (!Number.isFinite(row.ms) || row.ms < 0) issues.push('HIT_STOP.ms must be a number ≥ 0');
  if (!Number.isFinite(row.hugeShare) || row.hugeShare <= 0 || row.hugeShare > 1) issues.push('HIT_STOP.hugeShare must be a share in (0, 1]');
  if (!Number.isFinite(row.hugeMs) || row.hugeMs < row.ms) issues.push('HIT_STOP.hugeMs must be a number ≥ HIT_STOP.ms');
  return issues;
}
