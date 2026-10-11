// The readability cap (docs/FINISH.md §5; the pace trims in ui/animationPace.js)
// lets a pace shorten an authored clip by at most 25%. Frame times are rounded
// down once a cap applies, so a clip whose frames are only a few ms long can lose
// more than its share. This test holds every authored clip — the Reaver attack
// and each equipment clip through model/equipmentAnimation.js animationTiming — to
// at least 75% of the duration the pre-trim pace values gave it.
import assert from 'node:assert/strict';
import { ANIM_SPEEDS } from '../src/ui/animationPace.js';
import { EQUIPMENT_ANIMATIONS, ANIMATION_ROLES, animationClip, animationTiming, resolvedAnimationSet } from '../src/model/equipmentAnimation.js';
import { reaverAttackTiming } from '../src/ui/reaverAttack.js';

// The pre-trim pace values, hard-coded: lunge and impact cap per pace.
const PRE_TRIM = Object.freeze({
  slow: { lungeMs: 340, impactCapMs: 420 },
  normal: { lungeMs: 260, impactCapMs: 240 },
  fast: { lungeMs: 160, impactCapMs: 140 },
});
const PACES = Object.keys(PRE_TRIM);

// Every distinct authored clip, each with the timing function that plays it.
const clips = [];
for (const [setId, raw] of Object.entries(EQUIPMENT_ANIMATIONS.sets)) {
  const set = resolvedAnimationSet(EQUIPMENT_ANIMATIONS, raw);
  for (const role of ANIMATION_ROLES) {
    const clip = animationClip(set, role);
    if (clip && !clips.some((c) => c.clip === clip)) {
      clips.push({ clip, name: `${setId}:${role}`, total: (speed) => animationTiming(set, role, speed).totalMs });
    }
  }
}
clips.push({ clip: null, name: 'REAVER_ATTACK', total: (speed) => reaverAttackTiming(speed).totalMs });
assert.ok(clips.length > 1, 'the equipment animations must yield clips to check');

for (const pace of PACES) {
  const before = PRE_TRIM[pace];
  const after = ANIM_SPEEDS[pace];
  for (const { name, total } of clips) {
    const was = total(before);
    const now = total(after);
    // 4·now >= 3·was is "at least 75%" in exact integer arithmetic.
    assert.ok(4 * now >= 3 * was,
      `${pace} ${name}: ${now} ms is less than 75% of the pre-trim ${was} ms (cut is ${(100 * (1 - now / was)).toFixed(1)}%)`);
  }
}

// Pace order holds for both trimmed values, and Normal keeps the click-impact budget.
for (const key of ['lungeMs', 'impactCapMs']) {
  assert.ok(ANIM_SPEEDS.slow[key] > ANIM_SPEEDS.normal[key] && ANIM_SPEEDS.normal[key] > ANIM_SPEEDS.fast[key],
    `${key} must order Slow > Normal > Fast`);
}
assert.ok(ANIM_SPEEDS.normal.impactCapMs <= 300, 'Normal impact cap stays within the click-to-impact budget');
