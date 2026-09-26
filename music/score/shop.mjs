// Shop — a merchant's corner in the ash. A minor at 54 BPM in 3/4, with the
// phrygian Bb and the harmonic-minor G# making it faintly wrong. The harp plays
// one note at a time, far apart; a low cello answers under it with long notes
// and longer rests; a quiet drone holds A so the room never falls silent; one
// faint bell sounds once, at the second phrase. No pulse, no pattern.
// Four layers: harp (lead), cello, drone, one bell.
import { Score } from '../../tools/score/compose.mjs';

export const context = 'shop';

const s = new Score({ bpm: 54, meter: 3, bars: 18, seed: 41, reverb: { room: 0.9, damp: 0.45 }, gain: 0.85 });

// Drone: A and E, low and still, the whole loop.
s.note('drone', 0, s.beats, 'A1', { vel: 0.4, rev: 0.4, a: 3, r: 4, cut: 320 });
s.note('drone', 0, s.beats, 'E2', { vel: 0.18, rev: 0.5, a: 3, r: 4, cut: 320, pan: 0.2 });

// Harp: three short phrases of single notes, three beats apart, then air.
const harp = { note: { vel: 0.5, rev: 0.6, pan: 0.3, ring: 5 } };
s.line('harp', 0, [['E4', 3], ['C4', 3], ['Bb3', 3], ['A3', 6], [null, 3]], harp);
s.line('harp', 18, [['E4', 3], ['F4', 3], ['D4', 3], ['G#3', 6], [null, 3]], harp);
s.line('harp', 36, [['C4', 3], ['Bb3', 3], ['A3', 9], [null, 3]], harp);

// Low cello: long notes with rests between, leaning on E at the loop point.
s.line('cello', 0, [['A2', 9], [null, 3], ['F2', 9], ['E2', 9], [null, 6], ['D2', 6], [null, 6], ['E2', 6]],
  { note: { vel: 0.4, rev: 0.45, pan: -0.25, a: 1, r: 2.5, cut: 800 } });

// One faint bell.
s.note('bell', 18, 1, 'D5', { vel: 0.08, rev: 0.8, pan: -0.4, ring: 8 });

export default s;
