// Victory — a great enemy felled, and nothing given back. D minor at 56 BPM:
// a choir "ah" chord swells slowly, low strings hold the harmony, a bell tolls
// every two bars, and a solo cello speaks one short solemn phrase. Only at its
// very end does the harmony lift to D major, for a bar and a half, and then the
// loop falls back to the minor chord it opened on. No fanfare, no drums.
// Four layers: choir "ah" pad, low strings, bell, cello (lead).
import { Score, chord } from '../../tools/score/compose.mjs';

export const context = 'victory';

const s = new Score({ bpm: 56, bars: 9, seed: 89, reverb: { room: 0.92, damp: 0.35 }, gain: 0.9 });

// i – VI – iv – V(sus4) – I (the one brief lift), then back to i.
const prog = [
  [chord('D2', 'm'), 3], [chord('Bb1', 'M', 1), 2], [chord('G1', 'm', 1), 1.5],
  [chord('A1', 'sus4'), 1], [chord('D2', 'M'), 1.5],
];

s.pad('strings', prog, { overlap: 0.25, note: { vel: 0.3, rev: 0.5, cut: 700, a: 2, r: 3 } });
s.pad('choir', prog.map(([c, l]) => [c.map((m) => m + 24), l]), { overlap: 0.3, note: { vowel: 'ah', vel: 0.2, rev: 0.65, a: 3, r: 3.5 } });

// The bell tolls, low and slow; the last toll sounds on the major chord.
for (const [beat, m] of [[0, 'D4'], [8, 'D4'], [16, 'D4'], [24, 'A3'], [30, 'D4']])
  s.note('bell', beat, 1, m, { vel: 0.14, rev: 0.75, pan: 0.35, ring: 9 });

// One solemn phrase, ending on the major third.
s.line('cello', 4, [['A3', 4], ['D4', 2], ['C4', 2], ['Bb3', 6], ['A3', 2], ['G3', 6], ['A3', 4], ['F#3', 5]],
  { note: { vel: 0.55, rev: 0.45, pan: -0.15, a: 0.6, r: 2.5 } });

export default s;
