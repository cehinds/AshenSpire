import { DEFAULT_COMBAT_WEAPONS } from './combatWeaponPresentation.js';
import { classSmashSequence } from './classSmashAnimations.js';
import { classSmashAnimations } from '../content/classSmashAnimations.js';
import { selectedWeaponSequence, selectedWeaponSequenceTiming } from './selectedWeaponSequences.js';
import { alternativeCardAnimations } from '../content/alternativeCardAnimations.js';
import { playerCounterSweepSprites } from '../content/playerCounterSweepSprites.js';
import { playerAttackSprites } from '../content/playerAttackSprites.js';
import { alternativeSelectedStances } from '../content/alternativeSelectedStances.js';
import { durationFor } from './alternativeCardAnimation.js';

export const CARD_ANIMATION_ALIASES = Object.freeze({ idle: 'ready', guard: 'defend', guardHit: 'defend', cast: 'spell', power: 'spell', buff: 'spell' });

/** Pure shared sprite family: combat and inspection use the same class and reviewed presentation. */
export function alternativeCardAnimationFamily(classId, { weaponProfile = null, smashProfile = null } = {}) {
  const base = alternativeCardAnimations.classes[classId];
  if (!base) return null;
  const selected = playerCounterSweepSprites[classId];
  const pilot = alternativeSelectedStances.weaponProfiles?.[weaponProfile];
  const pilotFrames = pilot?.classId === classId ? pilot.frames : null;
  const classSmash = smashProfile === classId ? classSmashAnimations.classes[classId] : null;
  const attacks = DEFAULT_COMBAT_WEAPONS ? [] : Object.entries(playerAttackSprites[classId] || {});
  const family = { ...base,
    frames: { ...base.frames, ...selected.frames, ...Object.assign({}, ...attacks.map(([, entry]) => entry.frames)) },
    sequences: { ...base.sequences, ...selected.sequences,
      // Preserve the original forward sweep while fitting its four painted phases.
      sweep: { ...selected.sequences.sweep, travel: [0,
        base.sequences.sweep.travel[base.sequences.sweep.impact],
        base.sequences.sweep.travel[base.sequences.sweep.impact + 1], 0] },
      counterPrepare: { poses: [selected.stances.counter], durations: [260], impact: 0, travel: [0], hold: true },
      ...Object.fromEntries(attacks.flatMap(([name, entry]) =>
      ['attack', 'spell', 'ranged', 'rangedMagic'].map(action => [`weapon:${action}:${name}`, { ...entry.sequence, action }]))) },
  };
  if (pilotFrames) {
    for (const [action, frame] of Object.entries(pilotFrames)) family.frames['pilot-'+action] = frame;
    family.frames['smash-load'] = pilotFrames.smash;
    family.sequences.sweep = { ...family.sequences.sweep, poses: ['pilot-sweep', ...family.sequences.sweep.poses.slice(1)] };
    family.sequences.counterPrepare = { ...family.sequences.counterPrepare, poses: ['pilot-counter'] };
    for (const kind of ['attack','smash','sweep','counter-guard','counter-evade']) {
      const clip=selectedWeaponSequence(kind);
      if(clip.poses.every(pose=>pose==='origin'||family.frames[pose])) family.sequences[kind]=clip;
    }
    for(const key of Object.keys(family.sequences)) if(key==='weapon:attack:greatsword'&&family.sequences.attack?.pilot)family.sequences[key]=family.sequences.attack;
  }
  if (classSmash) {
    for (const [key, frame] of Object.entries(classSmash.frames)) family.frames['class-smash-'+key] = frame;
    family.sequences.smash = classSmashSequence();
  }
  // Smash holds the first painted frame of its own swing (owner, 2026-10-12),
  // the way counter and sweep hold theirs.
  const heldFrames = { ...alternativeSelectedStances.classes[classId]?.frames,
    ...Object.fromEntries(Object.entries(selected.stances).map(([action, pose]) => [action, selected.frames[pose]])),
    ...(family.frames['smash-load'] ? { smash: family.frames['smash-load'] } : {}),
    ...(classSmash ? {smash:classSmash.frames.held} : {}),
    ...(pilotFrames ? { sweep: pilotFrames.sweep, counter: pilotFrames.counter, smash: pilotFrames.smash, evade: pilotFrames.evade, ...(pilotFrames.defend?{defend:pilotFrames.defend,defensive:pilotFrames.defend}:{}) } : {}) };
  family.sequences.evade = pilotFrames
    ? { ...selectedWeaponSequence('evade'), action: 'evade' }
    : { ...base.sequences.defend, action: 'evade', fallbackAction: 'defend' };
  const frames = { ...family.frames, ...Object.fromEntries(Object.entries(heldFrames).map(([stance, frame]) => ['stance-'+stance, frame])) };
  return { family, selected, pilotFrames, classSmash, heldFrames, frames };
}

export function cardSequenceTiming(sequence, speed) {
  if (!sequence) return null;
  if (sequence.pilot || sequence.timingUnits) return selectedWeaponSequenceTiming(sequence, speed);
  const totalMs = durationFor(sequence, speed);
  const base = sequence.durations.reduce((sum, ms) => sum + ms, 0);
  return { totalMs, impactMs: sequence.durations.slice(0, sequence.impact).reduce((sum, ms) => sum + ms, 0) / base * totalMs };
}
