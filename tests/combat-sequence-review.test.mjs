import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { combatSequenceReview, combatSequenceReviews, sampleCombatSequenceReview, COMBAT_SEQUENCE_REVIEW_SOURCE } from '../src/model/combatSequenceReview.js';
import { alternativeCardAnimationFamily } from '../src/model/cardAnimationFamily.js';
import { combatWeaponProfilesFor } from '../src/model/combatWeaponPresentation.js';
import { selectedWeaponSequence, selectedWeaponSequenceTiming } from '../src/model/selectedWeaponSequences.js';
import { sampleSequence } from '../src/model/alternativeCardAnimation.js';
import { ANIM_SPEEDS } from '../src/ui/animationPace.js';
import { poseIndexAt, poseTicks, stepPose, isGenerated, isDirtyFile } from '../workbench/modules/motion/model.mjs';

test('review resolves current default class weapons and keeps the canonical SM03/SW09 source references', () => {
  const entries = combatSequenceReviews(ANIM_SPEEDS.normal);
  assert.equal(entries.length, 40);
  for (const entry of entries) {
    assert.ok(existsSync(new URL('../' + entry.source, import.meta.url)), entry.source);
    assert.ok(entry.note.includes('Co-op continuation remains paused'));
    assert.equal(isGenerated(entry.id), true);
    const base = alternativeCardAnimationFamily(entry.classId, combatWeaponProfilesFor({ classId: entry.classId }));
    if (entry.available && !['fully-defended', 'guard-break'].includes(entry.actionId)) {
      assert.deepEqual(entry.sequence, base.family.sequences[entry.actionId]);
    }
  }
  assert.ok(existsSync(new URL('../' + COMBAT_SEQUENCE_REVIEW_SOURCE, import.meta.url)));
  for (const action of ['smash', 'sweep']) {
    const entry = combatSequenceReview('reaver', action, ANIM_SPEEDS.normal);
    assert.deepEqual(entry.sequence, selectedWeaponSequence(action));
    assert.equal(entry.totalMs, 195);
    assert.equal(entry.impactMs, action === 'smash' ? 117 : 78);
    assert.deepEqual(sampleCombatSequenceReview(entry, 0).frame, entry.originFrame);
    assert.deepEqual(sampleCombatSequenceReview(entry, entry.totalMs).frame, entry.originFrame);
  }
});

test('Guard, Parry and Resisted share runtime impact weights; both Counter flavors retain every phase', () => {
  for (const action of ['fully-defended', 'guard-break', 'counter-guard', 'counter-evade']) {
    const entry = combatSequenceReview('reaver', action, ANIM_SPEEDS.normal);
    assert.deepEqual(entry.sequence, selectedWeaponSequence(action));
    assert.deepEqual({ totalMs: entry.totalMs, impactMs: entry.impactMs }, selectedWeaponSequenceTiming(entry.sequence, ANIM_SPEEDS.normal));
    for (const fraction of [0, .1, .2, .3, .4, .6, .8, 1]) {
      const time = entry.totalMs * fraction;
      const expected = sampleSequence(entry.sequence, time, entry.totalMs);
      assert.equal(sampleCombatSequenceReview(entry, time).index, expected.index);
      assert.equal(poseIndexAt(entry.sequence.poses.length, entry.totalMs, time, entry.sequence.durations), expected.index);
    }
  }
  assert.equal(combatSequenceReview('reaver', 'counter-guard', ANIM_SPEEDS.normal).sequence.poses.length, 13);
  assert.equal(combatSequenceReview('reaver', 'counter-evade', ANIM_SPEEDS.normal).sequence.poses.length, 9);
  const entry = combatSequenceReview('reaver', 'fully-defended', ANIM_SPEEDS.normal);
  const ticks = poseTicks(6, entry.totalMs, entry.sequence.durations);
  assert.equal(ticks[1].at, 2 / 13);
  assert.equal(stepPose(6, entry.totalMs, 0, 1, entry.sequence.durations), entry.totalMs * 2 / 13);
});

test('unavailable class reactions and Evade fallbacks stay explicit instead of borrowing Reaver art', () => {
  for (const classId of ['rogue', 'starseer', 'herald']) {
    for (const action of ['fully-defended', 'guard-break', 'counter-guard', 'counter-evade']) {
      const entry = combatSequenceReview(classId, action, ANIM_SPEEDS.normal);
      assert.equal(entry.available, false);
      assert.ok(entry.fallback);
      assert.equal(sampleCombatSequenceReview(entry, 30), null);
    }
    const evade = combatSequenceReview(classId, 'evade', ANIM_SPEEDS.normal);
    assert.equal(evade.available, true);
    assert.equal(evade.sequence.fallbackAction, 'defend');
    assert.match(evade.fallback, /No registered painted evade/);
  }
  assert.equal(combatSequenceReview('unknown', 'attack', ANIM_SPEEDS.normal), null);
  assert.equal(combatSequenceReview('reaver', 'unknown', ANIM_SPEEDS.normal), null);
  assert.equal(isDirtyFile({ path: 'combat:reaver:smash', original: '{}', project: { changed: true } }), false);
});
