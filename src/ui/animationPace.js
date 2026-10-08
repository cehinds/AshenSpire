// Shared presentation pace without effect, audio or DOM initialization.
export const ANIM_SPEEDS = {
  slow: { beatMs: 700, stepMs: 140, lungeMs: 340, impactCapMs: 420 },
  normal: { beatMs: 400, stepMs: 90, lungeMs: 260, impactCapMs: 240 },
  fast: { beatMs: 180, stepMs: 45, lungeMs: 160, impactCapMs: 140 },
  instant: null,
};

let animSpeed = 'normal';
export function setAnimSpeed(v) {
  animSpeed = ANIM_SPEEDS[v] === undefined ? 'normal' : v;
}
export function getAnimSpeed() {
  return animSpeed;
}
