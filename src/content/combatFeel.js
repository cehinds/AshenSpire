// src/content/combatFeel.js — how hard a hit feels, as data (SPEC §7.4, D51).
//
// SHAKE_STEPS: every hit that costs its target HP shakes the screen, scaled by
// the SHARE of the target's max HP it cost after Block (owner, 2026-10-18,
// Fix A). A hit takes the largest step whose `minShare` it reaches; a hit under
// the first step shakes SHAKE_FLOOR_PX, so every hit that costs HP still
// shakes. Never over SHAKE_MAX_PX (10 px, from 35% of max HP).
// SHAKE_STEPS_HP is the 2026-10-05 rule (1-4 px by absolute HP, 1/6/10/15); a
// hit whose target's max HP is unknown falls back to it.
//
// HIT_STOP: a hit that costs at least `minHp` holds the attacker's impact frame
// and the target's recoil for `ms` before the swing recovers; a hit that costs
// `hugeShare` of the target's max HP or more holds `hugeMs` instead. The damage
// number, sound and haptic fire at impact; only the two figures pause. `ms` 0
// turns it off. Instant speed and Reduced motion never reach it: they play the
// fast path, which has no swing to hold (ui/fx.js animateEvents).
//
// BIG_HIT_SHARE and HUGE_HIT_SHARE also size the damage number (ui/fx.js
// dmgClass: pct20, pct35) and fire the bigHit haptic.
//
// The Screen shake setting and Reduced motion drop the shake (ui/fx.js shake).
export const BIG_HIT_SHARE = 0.20; // a hit this share of the target's max HP is a big hit (pct20, and the bigHit haptic)
export const HUGE_HIT_SHARE = 0.35; // and this share is a huge hit (pct35, and the long hit-stop)

export const SHAKE_MAX_PX = 10;
export const SHAKE_FLOOR_PX = 1;

export const SHAKE_STEPS = Object.freeze([
  Object.freeze({ minShare: 0.02, px: 2 }),
  Object.freeze({ minShare: 0.08, px: 4 }),
  Object.freeze({ minShare: BIG_HIT_SHARE, px: 7 }),
  Object.freeze({ minShare: HUGE_HIT_SHARE, px: 10 }),
]);

export const SHAKE_STEPS_HP = Object.freeze([
  Object.freeze({ minHp: 1, px: 1 }),
  Object.freeze({ minHp: 6, px: 2 }),
  Object.freeze({ minHp: 10, px: 3 }),
  Object.freeze({ minHp: 15, px: 4 }),
]);

export const HIT_STOP = Object.freeze({ minHp: 6, ms: 60, hugeShare: HUGE_HIT_SHARE, hugeMs: 120 });

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

/** hitStopMsFor(hpLost, targetMaxHp?, row?) → how long the figures hold at impact; 0 means none. */
export function hitStopMsFor(hpLost, targetMaxHp = 0, row = HIT_STOP) {
  if (!(row.ms > 0) || hpLost < row.minHp) return 0;
  if (targetMaxHp > 0 && row.hugeMs > 0 && hpLost / targetMaxHp >= row.hugeShare) return row.hugeMs;
  return row.ms;
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
