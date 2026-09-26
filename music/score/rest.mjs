// Rest — the shrine of grace, the one warm place on the road, and still a
// mourning one. D dorian: the raised B of the G major chord is the warmth, the
// minor tonic is the grief. A soft organ holds D and A under everything, a
// choir "oo" breathes the chords, the harp turns slowly, and a solo cello sings
// two long phrases that come to rest on D just before the loop begins again.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'rest';

const s = new Score({ bpm: 58, bars: 20, seed: 17, reverb: { room: 0.92, damp: 0.35 }, gain: 0.85 });

// i – IV – i – bVII – bIII – IV – v – bVII – i – IV (D dorian, two bars each).
const prog = [
  [chord('D3', 'madd9'), 2], [chord('G2', 'M', 1), 2], [chord('D3', 'm'), 2], [chord('C3', 'M'), 2], [chord('F2', 'M', 1), 2],
  [chord('G2', 'M', 1), 2], [chord('A2', 'm'), 2], [chord('C3', 'M'), 2], [chord('D3', 'm'), 2], [chord('G2', 'sus2', 1), 1], [chord('G2', 'M', 1), 1],
];
s.note('organ', 0, s.beats, 'D2', { vel: 0.3, rev: 0.35, stop: 'soft' });
s.note('organ', 0, s.beats, 'A2', { vel: 0.18, rev: 0.35, stop: 'soft' });
s.pad('organ', prog, { overlap: 0.15, note: { vel: 0.2, rev: 0.45, stop: 'soft', a: 1.2, r: 2 } });
s.pad('choir', prog.map(([c, l]) => [c.map((m) => m + 12), l]), { note: { vel: 0.22, rev: 0.7, vowel: 'oo' } });

// Harp: slow quarter-note turns, very soft.
s.arp('harp', prog.map(([c, l]) => [c.map((m) => m + 12), l]), 1,
  { pattern: [0, 1, 2, 1], note: { vel: 0.22, rev: 0.6, pan: 0.35, ring: 4 } });

// The cello's two phrases; the harp answers alone in the bars between.
const cello = { note: { vel: 0.52, rev: 0.5, pan: -0.2, a: 0.6 } };
s.line('cello', 8, [
  ['D4', 3], ['B3', 1], ['C4', 2], ['B3', 1], ['A3', 1],
  ['A3', 4], ['F3', 2], ['G3', 1], ['A3', 1],
  ['E3', 2], ['G3', 2], ['C4', 4],
], cello);
s.line('cello', 40, [
  ['B3', 2], ['D4', 2], ['E4', 3], ['D4', 1],
  ['C4', 3], ['B3', 1], ['A3', 4],
  ['G3', 2], ['E3', 2], ['G3', 2], ['A3', 2],
  ['F3', 3], ['E3', 1], ['D3', 4],
], cello);

// Harp answers in the cello's rests, a little higher.
const harp = { note: { vel: 0.3, rev: 0.6, pan: 0.45, ring: 4 } };
s.line('harp', 32, [['A4', 1], ['C5', 1], ['F5', 2], ['E5', 1], ['C5', 1], ['A4', 2]], harp);
s.line('harp', 72, [['B4', 1], ['D5', 1], ['G5', 2], ['F#5', 1], ['D5', 1], ['B4', 2]], harp);

// Two quiet bells: one as the shrine is reached, one at the high point.
s.note('bell', 0, 1, 'D5', { vel: 0.1, rev: 0.85, pan: 0.5, ring: 9 });
s.note('bell', 40, 1, 'A4', { vel: 0.08, rev: 0.85, pan: -0.5, ring: 9 });

export default s;
