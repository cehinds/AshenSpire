// Boss — the tower's keeper. G minor at 92 BPM, in half-time: big through
// sustain, not speed. A full-stop organ pedal and low strings hold each chord
// for two bars, the full choir swells "ah" chords over them, and above it all
// the choir chants one slow line — alone the first time, doubled a fifth below
// the second. Taiko strikes on 1 and 3; bells toll every phrase head. The Ab
// chord over the G pedal is the wound; the D major at the end never resolves.
import { Score, n } from '../../tools/score/compose.mjs';

export const context = 'boss';

const s = new Score({ bpm: 92, bars: 28, seed: 67, reverb: { room: 0.92, damp: 0.4 }, gain: 0.95 });

// Harmony, 14 bars, two bars a chord, played twice:
// i – bVI/G – iv/G – bII/G – bVI – iv – V.
const v = (...ns) => ns.map(n);
const prog = [
  [v('G1', 'G2'), v('G2', 'D3', 'Bb3')],
  [v('G1', 'G2'), v('G2', 'Eb3', 'Bb3')],
  [v('G1', 'G2'), v('G2', 'C3', 'Eb3')],
  [v('G1', 'G2'), v('Ab2', 'C3', 'Eb3')],
  [v('Eb1', 'Eb2'), v('Eb2', 'Bb2', 'G3')],
  [v('C1', 'C2'), v('C2', 'G2', 'Eb3')],
  [v('D1', 'D2'), v('D2', 'A2', 'F#3')],
];
const bars = 2;

// Layer 1 — the floor: full-organ pedal (root in octaves) under low strings.
s.pad('organ', prog.map(([ped]) => [ped, bars]), { overlap: 0.05, spread: 0, note: { stop: 'full', vel: 0.3, rev: 0.45, a: 0.8, r: 1.6 } });
s.pad('strings', prog.map(([, c]) => [c, bars]), { overlap: 0.2, spread: 0.6, note: { vel: 0.34, rev: 0.35, cut: 950, a: 1.5, r: 2.8 } });

// Layer 2 — full choir "ah" chords, an octave above the strings, long swells.
s.pad('choir', prog.map(([, c]) => [c.map((m) => m + 12), bars]),
  { overlap: 0.25, spread: 0.8, note: { vel: 0.18, rev: 0.6, vowel: 'ah', a: 3, r: 3 } });

// ...and the chant above them: fourteen bars, one note to two beats at most.
const chant = [
  ['G4', 4], ['A4', 2], ['Bb4', 2],       // i
  ['Bb4', 6], ['G4', 2],                  // bVI/G
  ['Eb5', 4], ['D5', 2], ['C5', 2],       // iv/G
  ['C5', 4], ['Ab4', 4],                  // bII/G
  ['G4', 4], ['Bb4', 4],                  // bVI
  ['Eb5', 2], ['D5', 2], ['C5', 4],       // iv
  ['Bb4', 2], ['A4', 5], [null, 1],       // V — held, unresolved
];
const chantNote = { vel: 0.27, vowel: 'ah', a: 0.7, r: 1.8, rev: 0.5 };
s.line('choir', 0, chant, { legato: 1.05, note: chantNote });
s.line('choir', 56, chant, { legato: 1.05, note: { ...chantNote, pan: 0.1 } });
s.line('choir', 56, chant.map(([m, l]) => [m && n(m) - 7, l]), { legato: 1.05, note: { ...chantNote, vel: 0.17, pan: -0.15 } });

// Layer 3 — taiko on 1 and 3: a deep stroke and a lighter answer.
s.hits('taiko', 'G1', [0], { accent: [0], note: { vel: 0.5, rev: 0.4, decay: 3.2, ring: 2, pan: -0.08 } });
s.hits('taiko', 'D2', [2], { note: { vel: 0.45, rev: 0.4, decay: 4, ring: 1.6, pan: 0.1 } });

// Layer 4 — bells at every four-bar phrase head, low; a high one on the Ab bar.
for (let bar = 0; bar < s.bars; bar += 4) s.note('bell', bar * 4, 1, 'G2', { vel: 0.2, rev: 0.6, pan: -0.4, ring: 8 });
for (const bar of [6, 20]) s.note('bell', bar * 4, 1, 'Ab3', { vel: 0.12, rev: 0.65, pan: 0.45, ring: 7 });

export default s;
