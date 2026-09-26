// Elite — a harder fight, and a sourer one. A minor at 88 BPM in half-time:
// heavy low strings hold each chord for two bars over an A that will not move,
// so the flat second (Bb) and the tritone (Eb) grind against it; a choir "ah"
// swells under them while one lone voice sings a slow lament; a low bell tolls
// every other bar, and the taiko strikes only on 1 and 3.
import { Score, n } from '../../tools/score/compose.mjs';

export const context = 'elite';

const s = new Score({ bpm: 88, bars: 22, seed: 41, reverb: { room: 0.9, damp: 0.38 }, gain: 0.95 });

// Harmony, 22 bars, two bars a chord. The bass A holds under the Bb and Eb
// chords (b2 and tritone), then lets go for Dm – Bb – E before coming home.
const v = (...ns) => ns.map(n);
const Am = v('A1', 'E2', 'A2', 'C3');
const BbA = v('A1', 'F2', 'Bb2', 'D3');
const EbA = v('A1', 'Eb2', 'G2', 'Bb2');
const Dm = v('D2', 'A2', 'D3', 'F3');
const Bb = v('Bb1', 'F2', 'Bb2', 'D3');
const E = v('E1', 'B1', 'E2', 'G#2');
const prog = [Am, BbA, Am, EbA, Dm, Bb, E, Am, BbA, EbA, E].map((c) => [c, 2]);

// Layer 1 — heavy low strings, doubled an octave below by a quiet drone-cello.
s.pad('strings', prog, { overlap: 0.2, spread: 0.6, note: { vel: 0.42, rev: 0.3, cut: 850, a: 1.4, r: 2.8 } });
s.pad('cello', prog.map(([c, l]) => [[c[0]], l]), { overlap: 0.1, note: { vel: 0.22, rev: 0.25, cut: 500, a: 0.9, r: 2 } });

// Layer 2 — choir: "ah" chords an octave up, slow swell...
s.pad('choir', prog.map(([c, l]) => [c.slice(1).map((m) => m + 12), l]),
  { overlap: 0.25, spread: 0.7, note: { vel: 0.17, rev: 0.6, vowel: 'ah', a: 2.8, r: 3 } });
// ...and one voice above it, the line to hum.
s.line('choir', 0, [
  [null, 4], ['E4', 4],                  // Am
  ['F4', 6], ['E4', 2],                  // Bb/A
  ['E4', 4], ['C4', 2], ['B3', 2],       // Am
  ['Eb4', 8],                            // Eb/A — the tritone, held
  ['D4', 4], ['F4', 4],                  // Dm
  ['F4', 6], ['D4', 2],                  // Bb
  ['F4', 2], ['E4', 6],                  // E — the b2 sighs onto the fifth
  ['C4', 4], ['A3', 4],                  // Am
  [null, 4], ['D4', 4],                  // Bb/A
  ['Eb4', 6], ['D4', 2],                 // Eb/A
  ['E4', 6], [null, 2],                  // E — then the loop
], { legato: 1.05, note: { vel: 0.26, vowel: 'ah', a: 0.9, r: 2.2, rev: 0.55, pan: 0.15 } });

// Layer 3 — a low bell tolling every other bar; it tolls Eb on the tritone chord.
prog.forEach(([c], i) => {
  s.note('bell', i * 8, 1, c === EbA ? 'Eb3' : 'A2', { vel: 0.2, rev: 0.6, pan: -0.4, ring: 7 });
});

// Layer 4 — taiko on 1 and 3 only: a low stroke and a softer answer.
s.hits('taiko', 'A1', [0], { note: { vel: 0.48, rev: 0.4, decay: 3.5, ring: 2, pan: -0.08 } });
s.hits('taiko', 'E2', [2], { note: { vel: 0.4, rev: 0.4, decay: 4, ring: 1.6, pan: 0.1 } });

export default s;
