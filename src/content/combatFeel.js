// src/content/combatFeel.js — how hard a hit feels, as data (SPEC §7.4, D51).
//
// SHAKE_STEPS: every hit that costs its target HP shakes the screen, by the HP
// it cost after Block. A hit takes the largest step whose `minHp` it reaches;
// a hit under every step does not shake. The top step is SPEC's old rule (4 px
// from 15 HP), so a big hit shakes as it always did and a small one now shakes
// a little. Never over 4 px (SPEC §7.4).
//
// HIT_STOP: a hit that costs at least `minHp` holds the attacker's impact frame
// and the target's recoil for `ms` before the swing recovers. The damage
// number, sound and haptic fire at impact; only the two figures pause. `ms` 0
// turns it off. Instant speed and Reduced motion never reach it: they play the
// fast path, which has no swing to hold (ui/fx.js animateEvents).
//
// The Screen shake setting and Reduced motion drop the shake (ui/fx.js shake).
export const SHAKE_MAX_PX = 4;

export const SHAKE_STEPS = Object.freeze([
  Object.freeze({ minHp: 1, px: 1 }),
  Object.freeze({ minHp: 6, px: 2 }),
  Object.freeze({ minHp: 10, px: 3 }),
  Object.freeze({ minHp: 15, px: 4 }),
]);

export const HIT_STOP = Object.freeze({ minHp: 6, ms: 60 });

/** shakePxFor(hpLost, steps?) → the shake amplitude in px for one hit; 0 means none. */
export function shakePxFor(hpLost, steps = SHAKE_STEPS) {
  let px = 0;
  for (const step of steps) if (hpLost >= step.minHp) px = Math.max(px, step.px);
  return Math.min(SHAKE_MAX_PX, px);
}

/** hitStopMsFor(hpLost, row?) → how long the figures hold at impact; 0 means none. */
export function hitStopMsFor(hpLost, row = HIT_STOP) {
  return row.ms > 0 && hpLost >= row.minHp ? row.ms : 0;
}

/** combatFeelIssues(steps?, row?) → a list of problems, each naming its row; [] is valid. */
export function combatFeelIssues(steps = SHAKE_STEPS, row = HIT_STOP) {
  const issues = [];
  let last = 0;
  steps.forEach((step, i) => {
    if (!Number.isFinite(step.minHp) || step.minHp < 1) issues.push(`SHAKE_STEPS[${i}].minHp must be a number ≥ 1`);
    if (!Number.isFinite(step.px) || step.px <= 0 || step.px > SHAKE_MAX_PX) issues.push(`SHAKE_STEPS[${i}].px must be in (0, ${SHAKE_MAX_PX}]`);
    if (step.minHp <= last) issues.push(`SHAKE_STEPS[${i}].minHp must rise above the step before it`);
    last = step.minHp;
  });
  if (!Number.isFinite(row.minHp) || row.minHp < 1) issues.push('HIT_STOP.minHp must be a number ≥ 1');
  if (!Number.isFinite(row.ms) || row.ms < 0) issues.push('HIT_STOP.ms must be a number ≥ 0');
  return issues;
}
