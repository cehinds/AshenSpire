// The readability cap (docs/FINISH.md §5; the pace trims in ui/animationPace.js)
// lets a pace shorten an authored clip by at most 25%. Frame times are rounded
// down once a cap applies, so a clip whose frames are only a few ms long can lose
// more than its share. This test holds every clip the combat resolver can play to
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

// Every clip the resolver can select, derived from the data rather than a list:
//  - each set's own reference keys (pose-specific clips such as bowAttack, bladeAttack),
//  - the standard ANIMATION_ROLES and each set's poseRoles keys,
//  - a bowAttack borrowed into a non-bow set, exactly as equipmentAnimationForLoadout
//    composes it (the bow set's clip, timed against the host set's normalLungeMs).
const sets = Object.entries(EQUIPMENT_ANIMATIONS.sets).map(([setId, raw]) => ({ setId, set: resolvedAnimationSet(EQUIPMENT_ANIMATIONS, raw) }));
const clips = [];
const seen = new Set();
const add = (name, component, role) => {
  const clip = animationClip(component, role);
  if (!clip || seen.has(clip)) return;
  seen.add(clip);
  clips.push({ name, total: (speed) => animationTiming(component, role, speed).totalMs });
};
const borrowable = sets.filter(({ set }) => set.references?.bowAttack && set.clips?.[set.references.bowAttack]);
for (const { setId, set } of sets) {
  const roles = new Set([...ANIMATION_ROLES, ...Object.keys(set.references || {}), ...Object.keys(set.poseRoles || {})]);
  for (const role of roles) add(`${setId}:${role}`, set, role);
  for (const { setId: bowSetId, set: bowSet } of borrowable) {
    if (bowSetId === setId) continue;
    const borrowed = {
      ...set,
      clips: { ...set.clips, bowAttack: bowSet.clips[bowSet.references.bowAttack] },
      references: { ...set.references, bowAttack: 'bowAttack' },
    };
    clips.push({ name: `${setId}:bowAttack<-${bowSetId}`, total: (speed) => animationTiming(borrowed, 'bowAttack', speed).totalMs });
  }
}
clips.push({ name: 'REAVER_ATTACK', total: (speed) => reaverAttackTiming(speed).totalMs });
assert.ok(clips.length > ANIMATION_ROLES.length, 'the equipment animations must yield clips to check');
assert.ok(clips.some(c => c.name.includes('bowAttack')), 'pose-specific bowAttack clips must be covered');

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
