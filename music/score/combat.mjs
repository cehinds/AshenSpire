// Combat — the ordinary fight, against a citizen still burning.
//
// Lore (docs/LORE.md §2–§3): "A cinder in a corrupted thing's chest is a name
// the fire has not quite finished reading." "There is a cinder where his heart
// was. Some of them still know it. One in a patrol will lower his blade and
// ask you to finish reading his name."
//
// So: the choir is the names inside the corrupted — "ah" chords that swell and
// break off before they bloom, and NAMES sung by one voice and always left
// unfinished. EMBER, the starving fire, is the bass line of the low strings.
// The taiko is a failing heart: one stroke on beat 1, and now and then none.
//
// C phrygian, 84 BPM, half-time, 24 bars (≈69 s). Four six-bar spans:
//   bars  0–6   EMBER in the low strings (C–Db–G–C, stretch 2) as the bass;
//               NAMES on C enters at beat 2, one choir voice, G–F–Eb–D and stops.
//   bars  6–12  bVI – bvii – V(sus4), held; choir chords swell and cut off.
//   bars 12–18  EMBER again in the low strings; NAMES a fourth up (on F),
//               C–Bb–Ab–G, and stops.
//   bars 18–24  bVI – bvii – V(sus4); at bar 20 NAMES is begun once more and
//               gets only two notes (G–F) before it gives out — the one who asks.
//   Taiko skips bars 3, 8, 13, 14, 19 and 23: the heart missing.
import { Score, n } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'combat';

const s = new Score({ bpm: 84, bars: 24, seed: 23, reverb: { room: 0.9, damp: 0.4 }, gain: 0.95 });

const v = (...ns) => ns.map(n);
// Hold each chord for its beats from `beat`, spread gently across the field.
function hold(inst, beat, chords, { over = 0.8, spread = 0.6, ...note } = {}) {
  let b = beat;
  for (const [notes, len] of chords) {
    notes.forEach((m, i) => s.note(inst, b, len + over, m,
      { pan: notes.length > 1 ? (i / (notes.length - 1) - 0.5) * spread : 0, ...note }));
    b += len;
  }
  return b;
}

// EMBER on C, twice as slow: C2 (4) – Db2 (6) – G1 (6) – C2 (8) = six bars.
const ember = motif('C2', 'ember', { stretch: 2 });
// The chords that sit on it: i – bII – V(sus4) – i, voiced above the bass.
const overEmber = [[v('Eb3', 'G3', 'C4'), 4], [v('F3', 'Ab3', 'Db4'), 6], [v('D3', 'G3', 'C4'), 6], [v('Eb3', 'G3', 'C4'), 8]];
// The turn between: bVI – bvii – V(sus4), two bars each.
const turnBass = [[n('Ab1'), 8], [n('Bb1'), 8], [n('G1'), 8]];
const turn = [[v('Eb3', 'Ab3', 'C4'), 8], [v('F3', 'Bb3', 'Db4'), 8], [v('D3', 'G3', 'C4'), 8]];

const bassNote = { vel: 0.5, rev: 0.3, cut: 700, a: 1.2, r: 2.4 };
const bassHi = { ...bassNote, vel: 0.26, cut: 900 };
const upper = { vel: 0.3, rev: 0.4, cut: 850, a: 1.8, r: 2.6 };

for (const at of [0, 48]) {
  // Layer 1 — low strings: EMBER as the bass, in octaves; the chords above it.
  s.line('strings', at, ember, { legato: 1.05, note: bassNote });
  s.line('strings', at, ember.map(([m, b]) => [m + 12, b]), { legato: 1.05, note: bassHi });
  hold('strings', at, overEmber, upper);
  // The turn, bass and chords.
  s.line('strings', at + 24, turnBass, { legato: 1.05, note: bassNote });
  hold('strings', at + 24, turn, upper);
}

// Layer 2 — choir chords, the names inside them: each swells for most of its
// chord and breaks off (short release) before the chord is done.
function swell(beat, chords) {
  let b = beat;
  for (const [notes, len] of chords) {
    notes.forEach((m, i) => s.note('choir', b + 0.5, len * 0.62, m + 12,
      { vowel: 'ah', vel: 0.17, rev: 0.6, a: 2.4, r: 0.7, pan: (i / (notes.length - 1) - 0.5) * 0.7 }));
    b += len;
  }
}
for (const at of [0, 48]) { swell(at, overEmber); swell(at + 24, turn); }

// Layer 3 — NAMES, one choir voice, never finished.
const voice = { legato: 1, note: { vowel: 'ah', vel: 0.32, rev: 0.6, a: 1.1, r: 0.8, pan: 0.15 } };
s.line('choir', 2, motif('C4', 'names', { stretch: 1.5, unfinished: true }), voice);   // G4 F4 Eb4 D4
s.line('choir', 50, motif('F4', 'names', { stretch: 1.5, unfinished: true }), voice);  // C5 Bb4 Ab4 G4
// Bar 20: the one who asks. Two notes of it, and the voice gives out.
s.line('choir', 80, motif('C4', 'names', { stretch: 2, unfinished: true }).slice(0, 2),
  { legato: 1, note: { ...voice.note, vel: 0.26, r: 0.5 } });

// Layer 4 — taiko on beat 1 only: a heart that sometimes does not come.
const missed = new Set([3, 8, 13, 14, 19, 23]);
for (let bar = 0; bar < s.bars; bar++) {
  if (missed.has(bar)) continue;
  const head = bar % 6 === 0 || bar % 6 === 2 || bar % 6 === 4;
  s.note('taiko', bar * 4, 1, head ? 'C2' : 'G1', { vel: head ? 0.5 : 0.34, rev: 0.4, decay: 3.5, ring: 2, pan: head ? -0.08 : 0.08 });
}

export default s;
