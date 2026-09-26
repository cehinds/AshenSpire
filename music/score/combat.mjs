// Combat — the ordinary fight. C phrygian at 110 BPM: a taiko and frame-drum
// march that never lets up, a low string ostinato that leans on the flat
// second (Db), a cello answering it from above, a dark "ah" choir holding the
// harmony and bowed metal scraping at each turn. Steady, tense, kept under the
// UI: no single hit rises out of the bed.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'combat';

const s = new Score({ bpm: 110, bars: 32, seed: 23, reverb: { room: 0.8, damp: 0.4 }, gain: 0.95 });

// Harmony, 8 bars: i – bII – i – bVI – bVII – V (the phrygian pull home).
const prog = [
  [chord('C3', 'm'), 2], [chord('Db3', 'M'), 1], [chord('C3', 'm'), 1],
  [chord('Ab2', 'M'), 2], [chord('Bb2', 'M'), 1], [chord('G2', 'sus4'), 0.5], [chord('G2', 'M'), 0.5],
];
// Bar roots for the ostinato (one entry per bar; the last bar splits G sus4/G).
const roots = ['C2', 'C2', 'Db2', 'C2', 'Ab1', 'Ab1', 'Bb1', 'G1'];

// Floor: a soft C pedal so the drums sit on something.
s.note('drone', 0, s.beats, 'C2', { vel: 0.35, rev: 0.15, cut: 320 });

// Low string ostinato: eighths, root–root–octave–root–b2–root–fifth–root.
for (let bar = 0; bar < s.bars; bar++) {
  const r = n(roots[bar % 8]);
  const fig = [0, 0, 12, 0, 1, 0, 7, 0];
  fig.forEach((iv, k) => s.note('strings', bar * 4 + k * 0.5, 0.32, r + 12 + iv,
    { vel: k % 4 === 0 ? 0.55 : 0.4, a: 0.012, r: 0.14, cut: 1100, rev: 0.15, pan: -0.15 }));
}

// Drums: taiko on 1, the "and" of 2, and 3; frame drum on the off-beats,
// with a short roll into every fourth bar.
s.hits('taiko', 'D2', [0, 1.5, 2], { accent: [0], note: { vel: 0.72, rev: 0.12, pan: -0.1 } });
s.hits('taiko', 'G1', [3.5], { every: 2, note: { vel: 0.5, rev: 0.12, pan: 0.1 } });
s.hits('frame', 'A2', [0.5, 1, 2.5, 3, 3.5], { accent: [1, 3], note: { vel: 0.5, rev: 0.1, pan: 0.35 } });
for (let bar = 3; bar < s.bars; bar += 4) {
  [3, 3.25, 3.5, 3.75].forEach((b, i) => s.note('frame', bar * 4 + b, 0.25, 'C3', { vel: 0.3 + i * 0.07, rev: 0.1, pan: -0.35 }));
}

// Choir "ah" pads, low and dark, through the whole loop.
s.pad('choir', prog, { overlap: 0.15, note: { vel: 0.22, rev: 0.5, vowel: 'ah', a: 0.8 } });

// Cello counter-line: it enters in the second and fourth passes.
const cello = [
  ['G3', 2], ['Ab3', 2], ['G3', 3], ['F3', 1], ['Eb3', 4],
  ['Eb3', 2], ['F3', 2], ['C4', 4], ['Eb3', 2], ['C3', 2], ['D3', 4], ['B2', 4],
];
for (const start of [8, 24]) s.line('cello', start * 4, cello, { note: { vel: 0.42, rev: 0.35, pan: 0.3 } });
// ...and a higher, shorter answer in the passes between, so the texture stays even.
const answer = [['C4', 3], ['Db4', 1], ['C4', 4], ['Bb3', 2], ['Ab3', 2], ['G3', 4], ['Ab3', 4], ['G3', 4], ['F3', 2], ['G3', 6]];
for (const start of [0, 16]) s.line('cello', start * 4, answer, { note: { vel: 0.34, rev: 0.4, pan: 0.3 } });

// Bowed-metal scrapes on the Db and the dominant.
for (let bar = 0; bar < s.bars; bar += 8) {
  s.note('metal', (bar + 2) * 4, 3, 'Db3', { vel: 0.14, rev: 0.5, pan: 0.6, a: 1.2 });
  s.note('metal', (bar + 7) * 4, 3, 'G2', { vel: 0.12, rev: 0.5, pan: -0.6, a: 1.2 });
}

export default s;
