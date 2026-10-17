import { uiConfig } from '../config/generated/ui.js';
import { alternativeCardAnimationFamily, cardSequenceTiming } from './cardAnimationFamily.js';
import { combatWeaponProfilesFor } from './combatWeaponPresentation.js';
import { selectedWeaponSequence } from './selectedWeaponSequences.js';
import { sampleSequence } from './alternativeCardAnimation.js';

export const COMBAT_SEQUENCE_REVIEW_SOURCE = 'content/config/ui/presentation/combatSequenceReview.json';
const review = () => uiConfig.presentation.combatSequenceReview.behavior;

/** Resolve the same class-default family combat paints. No review cadence or copied phase lists. */
export function combatSequenceReview(classId, actionId, speed) {
  const row = review().actions.find(action => action.id === actionId);
  if (!row || !review().classes.includes(classId)) return null;
  const assembled = alternativeCardAnimationFamily(classId, combatWeaponProfilesFor({ classId }));
  if (!assembled) return null;
  const sequence = row.reaction
    ? assembled.pilotFrames && selectedWeaponSequence(actionId)
    : assembled.family.sequences[actionId];
  const available = !!sequence && sequence.poses.every(pose => pose === 'origin' || assembled.frames[pose]);
  const timing = available ? cardSequenceTiming(sequence, speed) : { totalMs: 0, impactMs: 0 };
  const fallback = available && sequence.fallbackAction
    ? `No registered painted ${actionId} clip for this class; combat uses its ${sequence.fallbackAction} preparation.`
    : available ? '' : row.fallback || 'No registered painted sequence for this class.';
  return { id: `combat:${classId}:${actionId}`, classId, actionId, label: row.label,
    origin: row.origin, source: row.source || COMBAT_SEQUENCE_REVIEW_SOURCE,
    note: review().note, available, fallback, sequence: available ? sequence : null,
    frames: assembled.frames, originFrame: assembled.heldFrames[row.origin] || assembled.frames.ready,
    ...timing };
}

export function combatSequenceReviews(speed) {
  return review().classes.flatMap(classId => review().actions.map(row => combatSequenceReview(classId, row.id, speed)));
}

export function sampleCombatSequenceReview(entry, time) {
  if (!entry?.available) return null;
  const sample = sampleSequence(entry.sequence, time, entry.totalMs);
  const pose = entry.sequence.poses[sample.index];
  return { ...sample, pose, frame: pose === 'origin' ? entry.originFrame : entry.frames[pose] };
}
