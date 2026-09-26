// Elite — a champion of one of the orders (Wardens, Knights, Saints): the heat
// held longer, by someone who served the fire on purpose.
//
// Lore (docs/LORE.md §2–§3): "the Saints began writing the living"; the Burning
// was "the fire calling in the promise"; "the cities burned toward their
// towers"; the Blight is "ember without a hearth, burning inside things that
// were promised to it". An elite is that heat in a body the order built.
//
// So: EMBER, the starving fire, carried by the low strings and harmonised a
// tritone above in the organ — the order's own fire, sour at every step. The
// order's bell tolls every other bar, and tolls the tritone (Eb) where EMBER
// falls. NAMES is sung by one strained high choir voice, never finished.
//
// A minor (phrygian/locrian colour), 88 BPM, half-time, 24 bars (≈65 s):
//   bars  0–6   EMBER on A (A–Bb–E–A, stretch 2) in the strings' bass, the
//               organ doubling it a tritone up (Eb–E–Bb–Eb).
//   bars  6–12  Dm – Bb – E, held; NAMES on A enters at bar 7, one high voice,
//               E5–D5–C5–B4, and stops short of the A.
//   bars 12–18  EMBER again, strings and tritone organ; NAMES on D enters at
//               bar 13, higher and more strained, A5–G5–F5–E5, and stops.
//   bars 18–24  Bb/A – Eb/A – E over a held A that will not move; then the loop.
//   Taiko on 1 and 3 only.
import { Score, n } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'elite';

const s = new Score({ bpm: 88, bars: 24, seed: 41, reverb: { room: 0.9, damp: 0.38 }, gain: 0.95 });

const v = (...ns) => ns.map(n);
function hold(inst, beat, chords, { over = 0.8, spread = 0.6, ...note } = {}) {
  let b = beat;
  for (const [notes, len] of chords) {
    notes.forEach((m, i) => s.note(inst, b, len + over, m,
      { pan: notes.length > 1 ? (i / (notes.length - 1) - 0.5) * spread : 0, ...note }));
    b += len;
  }
  return b;
}

// EMBER on A, stretched: A1 (4) – Bb1 (6) – E1 (6) – A1 (8) = six bars.
const ember = motif('A1', 'ember', { stretch: 2 });
// Chords over each EMBER note (upper voices only; EMBER is the bass).
const overEmber = [[v('E2', 'A2', 'C3'), 4], [v('F2', 'Bb2', 'D3'), 6], [v('G2', 'Bb2', 'E3'), 6], [v('E2', 'A2', 'C3'), 8]];
const middle = [[v('D2', 'A2', 'D3', 'F3'), 8], [v('Bb1', 'F2', 'Bb2', 'D3'), 8], [v('E1', 'B1', 'E2', 'G#2'), 8]];
const close = [[v('A1', 'F2', 'Bb2', 'D3'), 8], [v('A1', 'Eb2', 'G2', 'Bb2'), 8], [v('E1', 'B1', 'E2', 'G#2'), 8]];

const bass = { vel: 0.5, rev: 0.3, cut: 750, a: 1.2, r: 2.4 };
const upper = { vel: 0.3, rev: 0.35, cut: 850, a: 1.5, r: 2.6 };
const organ = { stop: 'soft', vel: 0.22, rev: 0.45, a: 0.9, r: 1.8 };

for (const at of [0, 48]) {
  // Layer 1 — low strings: EMBER in the bass, doubled an octave up, chords over it.
  s.line('strings', at, ember, { legato: 1.05, note: bass });
  s.line('strings', at, ember.map(([m, b]) => [m + 12, b]), { legato: 1.05, note: { ...bass, vel: 0.24, cut: 900 } });
  hold('strings', at, overEmber, upper);
  // Layer 2 — organ: EMBER an octave up, with the tritone held above every note.
  s.line('organ', at, ember.map(([m, b]) => [m + 12, b]), { legato: 1.02, note: { ...organ, pan: -0.15 } });
  s.line('organ', at, ember.map(([m, b]) => [m + 18, b]), { legato: 1.02, note: { ...organ, vel: 0.17, pan: 0.15 } });
}
hold('strings', 24, middle, { ...upper, vel: 0.36 });
hold('strings', 72, close, { ...upper, vel: 0.36 });
// Organ pedal A under the closing chords: the note that will not move.
s.note('organ', 72, 16.5, 'A1', { ...organ, vel: 0.24 });

// Layer 3 — choir "ah" chords, low and quiet, under the whole loop.
const choirChords = [...overEmber, ...middle, ...overEmber, ...close];
hold('choir', 0, choirChords.map(([c, l]) => [c.slice(-3).map((m) => m + 12), l]),
  { over: 1, spread: 0.7, vowel: 'ah', vel: 0.14, rev: 0.6, a: 2.8, r: 3 });

// Layer 4 — NAMES, one strained high voice, left unfinished both times.
const voice = { legato: 1.02, note: { vowel: 'ah', vel: 0.28, rev: 0.55, a: 0.9, r: 1.2, pan: 0.18 } };
s.line('choir', 28, motif('A4', 'names', { stretch: 2, unfinished: true }), voice);                              // E5 D5 C5 B4
s.line('choir', 52, motif('D5', 'names', { stretch: 1.5, unfinished: true }), { ...voice, note: { ...voice.note, vel: 0.22 } }); // A5 G5 F5 E5

// Layer 5 — the order's bell, every other bar; it tolls the tritone where EMBER falls.
for (let bar = 0; bar < s.bars; bar += 2) {
  const tritone = bar === 2 || bar === 14 || bar === 20;
  s.note('bell', bar * 4, 1, tritone ? 'Eb3' : 'A2', { vel: tritone ? 0.22 : 0.19, rev: 0.6, pan: -0.4, ring: 7 });
}

// Layer 6 — taiko on 1 and 3 only.
s.hits('taiko', 'A1', [0], { note: { vel: 0.48, rev: 0.4, decay: 3.5, ring: 2, pan: -0.08 } });
s.hits('taiko', 'E2', [2], { note: { vel: 0.4, rev: 0.4, decay: 4, ring: 1.6, pan: 0.1 } });

export default s;
