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

export function hitFlashOpacity(action, progress, { reduced = false } = {}) {
  if (reduced || action !== 'hurt' || progress < 0 || progress >= .55) return 0;
  return .72 * (1 - progress / .55);
}
