import { combatProfileFor } from './combatCardProfile.js';
import { cardKind } from './tree.js';

export const CARD_ACTION_CLASSES = Object.freeze(['reaver', 'rogue', 'starseer', 'herald']);
export const CARD_ACTIONS = Object.freeze(['attack', 'smash', 'sweep', 'counter', 'defend', 'spell', 'ranged', 'rangedMagic']);

/** Class defaults: equipment and damage colour do not select choreography. */
export function cardActionFor(card = {}, classId) {
  if (!CARD_ACTION_CLASSES.includes(classId)) return null;
  const resolved = card.cardTags ?? card.tags;
  const ids = resolved?.map(t => typeof t === 'string' ? t : t.id);
  const profile = combatProfileFor(ids ? { ...card, cardTags: ids } : card);
  const tags = new Set(ids || []);
  if (profile.maneuver === 'ranged') return profile.camp === 'spell' || tags.has('source:spell') ? 'rangedMagic' : 'ranged';
  if (profile.maneuver === 'counter' || profile.maneuver === 'defend') return profile.maneuver;
  if (profile.camp === 'spell' || tags.has('source:spell')) return 'spell';
  if (['attack', 'smash', 'sweep'].includes(profile.maneuver)) return profile.maneuver;
  // Old/custom content without a maneuver keeps a meaningful base action.
  if (tags.has('ranged') || tags.has('bow')) return 'ranged';
  if (tags.has('guard') || tags.has('block')) return 'defend';
  return cardKind(card) === 'attack' ? 'attack' : 'spell';
}

export function cardActionPlan(card, classId) {
  const technique = cardActionFor(card, classId);
  if (!technique) return null;
  const ranged = technique.startsWith('ranged');
  const guard = technique === 'defend' || technique === 'counter';
  const cast = technique === 'spell';
  return { technique, group: guard ? 'defend' : cast ? 'cast' : 'attack',
    family: ranged ? 'projectile' : guard ? 'guard' : cast ? 'spell' : 'strike',
    motion: ranged ? 'release' : guard ? 'brace' : cast ? 'cast' : 'impact',
    rest: guard ? technique : null, alternative: true };
}

export function durationFor(sequence, speed) {
  if (!speed) return 0;
  const base = sequence.durations.reduce((sum, ms) => sum + ms, 0);
  const contact = sequence.durations.slice(0, sequence.impact).reduce((sum, ms) => sum + ms, 0);
  const scale = Math.min(speed.lungeMs / 260, contact ? speed.impactCapMs / contact : Infinity);
  return base * scale;
}

export function sampleSequence(sequence, elapsed, duration, { reduced = false } = {}) {
  const base = sequence.durations.reduce((sum, ms) => sum + ms, 0);
  if (reduced || duration <= 0) return { index: sequence.hold ? sequence.poses.length-1 : 0, x: 0, progress: 1, finished: true };
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  let index = 0, boundary = sequence.durations[0];
  while (index < sequence.poses.length-1 && progress * base >= boundary) boundary += sequence.durations[++index];
  const phase = (progress * base - boundary + sequence.durations[index]) / sequence.durations[index];
  const x = sequence.travel[index] + ((sequence.travel[index+1] ?? 0)-sequence.travel[index]) * Math.max(0,Math.min(1,phase));
  return { index, x: progress === 1 ? 0 : x, progress, finished: progress === 1 };
}

/**
 * Red hit tint for a hurt reaction: held at .75 for the first 40% of the
 * reaction, then fading to 0 at its end. `progress` is a 0..1 fraction; pass
 * `{ duration }` (ms) to give `progress` as elapsed milliseconds instead.
 */
export function hitFlashOpacity(action, progress, { reduced = false, duration } = {}) {
  if (reduced || action !== 'hurt') return 0;
  const t = duration > 0 ? progress / duration : progress;
  if (!(t >= 0) || t >= 1) return 0;
  return t < .4 ? .75 : .75 * (1 - (t - .4) / .6);
}

/** The hurt clip is seven equal frames; frames 2, 4 and 6 (indices 1, 3, 5) are red. */
export const HURT_CLIP_FRAMES = 7;

/**
 * Which hurt-clip frame a 0..1 reaction progress falls in. Pure: the stage
 * draws the hurt pose and, on `red` frames only, the red mask over it.
 */
export function hurtClipFrame(progress) {
  const p = progress > 0 ? Math.min(1, progress) : 0;
  const index = Math.min(HURT_CLIP_FRAMES - 1, Math.floor(HURT_CLIP_FRAMES * p));
  return { index, red: index % 2 === 1 };
}

export const HIT_RECOIL_PX = -14;
export const HIT_RECOIL_PEAK = .3;

/**
 * Horizontal knock-back (px, negative = left, away from enemies) for a 0..1
 * hit reaction: ease-out to HIT_RECOIL_PX at 30%, ease-out back to 0 at 100%.
 */
export function hitRecoilX(progress) {
  if (!(progress > 0) || progress >= 1) return 0;
  if (progress <= HIT_RECOIL_PEAK) {
    const s = progress / HIT_RECOIL_PEAK;
    return HIT_RECOIL_PX * (1 - (1 - s) ** 2);
  }
  const s = (progress - HIT_RECOIL_PEAK) / (1 - HIT_RECOIL_PEAK);
  return HIT_RECOIL_PX * (1 - s) ** 2;
}
