// Victory — a flame relit. D minor at 56 BPM, 9 bars (~39 s).
//
// Lore it carries (docs/LORE.md §4): "Relighting a hearth *finishes the
// reading*: the cinders you feed it are names the fire completes, and the
// things that carried them stop." Whether that is mercy or the old crime again
// the game will not say (Restore: "The marked burn on, finished one by one").
//
// So this is the one place in the score where NAMES is sung COMPLETE, the only
// time it resolves; then the warmth it bought — a brief major chord — and a
// bell. Solemn and uneasy, not a fanfare; the loop falls back to the minor.
//   beat 2  NAMES — complete, choir in octaves: A–G–F–E–D, the last D landing
//           on the tonic at beat 18 and held (the reading finished).
//   beat 26 strings sink to VI (Bb), the heat being paid for.
//   beat 30 the brief D major chord, choir and strings, and one low bell;
//           at beat 36 the loop returns to the D minor it opened on.
// Three layers: low strings, choir (NAMES, then the chord), one bell.
import { Score, chord } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'victory';

const s = new Score({ bpm: 56, bars: 9, seed: 89, reverb: { room: 0.92, damp: 0.35 }, gain: 0.9 });

// i – iv – VI – V – i (under the resolving D) – VI – I (the one brief lift).
s.pad('strings', [
  [chord('D2', 'm'), 1.5], [chord('G1', 'm', 1), 1], [chord('Bb1', 'M', 1), 1], [chord('A1', 'M'), 1],
  [chord('D2', 'm'), 2], [chord('Bb1', 'M', 1), 1], [chord('D2', 'M'), 1.5],
], { overlap: 0.25, note: { vel: 0.3, rev: 0.5, cut: 700, a: 2, r: 3 } });

// NAMES, complete — the only time in the score. Two octaves of the same line.
const names = motif('D4', 'names', { stretch: 2 });
names[names.length - 1][1] = 6; // hold the finished D through the tonic bars
const choir = { vowel: 'ah', rev: 0.65, a: 1.6, r: 3.5 };
s.line('choir', 2, names, { legato: 1.05, note: { ...choir, vel: 0.3, pan: 0.15 } });
s.line('choir', 2, names.map(([m, b]) => [m - 12, b]), { legato: 1.05, note: { ...choir, vel: 0.22, pan: -0.15 } });

// The warmth it bought: a choir "ah" on D major, briefly, as the strings lift.
for (const [m, pan] of [['D4', -0.2], ['F#4', 0.05], ['A4', 0.2]])
  s.note('choir', 29.5, 6.5, m, { ...choir, vel: 0.2, pan, a: 2 });

// And a bell: one low toll on the major chord, ringing over the turn of the loop.
s.note('bell', 30, 1, 'D4', { vel: 0.15, rev: 0.75, pan: 0.35, ring: 9 });

export default s;
