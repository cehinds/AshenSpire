// Combat — the ordinary fight, and still a grave one. C phrygian at 84 BPM,
// felt in half-time: a low string chord bowed every two bars, one taiko stroke
// on each downbeat, a choir "ah" swelling up under every chord change, and a
// single solo cello line above that sings two long phrases and leans on the
// flat second (Db). Nothing pulses between the downbeats; the reverb does it.
import { Score, n } from '../../tools/score/compose.mjs';

export const context = 'combat';

const s = new Score({ bpm: 84, bars: 24, seed: 23, reverb: { room: 0.9, damp: 0.4 }, gain: 0.95 });

// Harmony, 12 bars, two bars a chord: i – bII/C – i – bVI – bvii – Vsus4.
// Voiced low and close for weight; the Db chord keeps C in the bass.
const v = (...ns) => ns.map(n);
const prog = [
  [v('C2', 'G2', 'C3', 'Eb3'), 2],
  [v('C2', 'Ab2', 'Db3', 'F3'), 2],
  [v('C2', 'G2', 'C3', 'Eb3'), 2],
  [v('Ab1', 'Eb2', 'Ab2', 'C3'), 2],
  [v('Bb1', 'F2', 'Bb2', 'Db3'), 2],
  [v('G1', 'D2', 'G2', 'C3'), 2],
];

// Layer 1 — low strings: one bowed chord every two bars, slow attack, dark.
s.pad('strings', prog, { overlap: 0.2, spread: 0.6, note: { vel: 0.4, rev: 0.35, cut: 900, a: 1.6, r: 2.8 } });

// Layer 2 — choir "ah": the upper three notes an octave up, swelling in late.
s.pad('choir', prog.map(([c, l]) => [c.slice(1).map((m) => m + 12), l]),
  { overlap: 0.25, spread: 0.7, note: { vel: 0.2, rev: 0.6, vowel: 'ah', a: 3.2, r: 3 } });

// Layer 3 — taiko: beat 1 of every bar, heavier where the chord changes.
for (let bar = 0; bar < s.bars; bar++) {
  const head = bar % 2 === 0;
  s.note('taiko', bar * 4, 1, head ? 'C2' : 'G1', { vel: head ? 0.5 : 0.34, rev: 0.4, decay: 3.5, ring: 2, pan: head ? -0.08 : 0.08 });
}

// Layer 4 — the solo cello: two twelve-bar phrases, the second one higher.
const cello = { note: { vel: 0.46, rev: 0.5, pan: 0.2, a: 0.5, r: 1.8 } };
s.line('cello', 0, [
  [null, 4], ['G3', 3], ['Ab3', 1],       // i
  ['F3', 4], ['Ab3', 2], ['Db4', 2],      // bII
  ['C4', 6], ['Bb3', 2],                  // i
  ['Ab3', 4], ['C4', 2], ['Eb4', 2],      // bVI
  ['Db4', 3], ['C4', 1], ['Bb3', 4],      // bvii
  ['Ab3', 2], ['G3', 6],                  // Vsus4
], cello);
s.line('cello', 48, [
  ['Eb4', 3], ['F4', 1], ['G4', 4],       // i
  ['Ab4', 4], ['F4', 2], ['Db4', 2],      // bII
  ['C4', 8],                              // i
  ['Eb4', 4], ['C4', 2], ['Ab3', 2],      // bVI
  ['Bb3', 4], ['Db4', 4],                 // bvii
  ['C4', 4], ['G3', 3], [null, 1],        // Vsus4 — then the loop
], cello);

export default s;
