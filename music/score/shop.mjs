// Shop — the merchant in the ashes: curious, a little uneasy, never cozy. A
// 3/4 harp ostinato in A dorian (the raised F# keeps it from pure lament), a
// plucked cello and string bass, a light frame drum on the downbeat, and a
// sly plucked tune that keeps leaning on a Bb it has no right to. The second
// half turns to D minor and a bowed cello, then an E major hangs on the
// merchant's question and drops back into the loop.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'shop';

const s = new Score({ bpm: 76, meter: 3, bars: 30, seed: 41, reverb: { room: 0.78, damp: 0.5 }, gain: 0.9 });

const V = (...names) => names.map(n);
// Harp voicings: root, fifth, octave, colour tone above.
const Am = V('A2', 'E3', 'A3', 'C4'), D = V('D3', 'A3', 'D4', 'F#4'), Bb = V('Bb2', 'F3', 'Bb3', 'D4'),
  F = V('F2', 'C3', 'F3', 'A3'), E = V('E2', 'B2', 'E3', 'G#3'), Dm = V('D3', 'A3', 'D4', 'F4'), Esus = V('E2', 'B2', 'E3', 'A3');
const prog = [
  [Am, 2], [D, 2], [Am, 2], [Bb, 2], [Am, 2], [D, 2], [F, 2], [E, 2],
  [Dm, 2], [Am, 2], [Bb, 2], [F, 2], [Dm, 2], [Esus, 2], [E, 2],
];

// Harp ostinato, eighths: up and back, the colour tone on the offbeat.
s.arp('harp', prog.map(([c, l]) => [c.map((m) => m + 12), l]), 0.5,
  { pattern: [0, 1, 3, 2, 1, 2], note: { vel: 0.3, rev: 0.4, pan: 0.3, ring: 2 } });

// Plucked bass: root on one, fifth on three.
let bar = 0;
for (const [c, len] of prog) {
  for (let k = 0; k < len; k++, bar++) {
    s.note('cello', bar * 3, 0.3, c[0], { vel: 0.5, rev: 0.25, a: 0.01, r: 0.25, cut: 700, pan: -0.2 });
    s.note('cello', bar * 3 + 2, 0.25, c[1], { vel: 0.36, rev: 0.25, a: 0.01, r: 0.2, cut: 700, pan: -0.2 });
  }
}

// A thin string bed so the room never goes empty.
s.pad('strings', prog.map(([c, l]) => [c.slice(0, 3), l]), { note: { vel: 0.16, rev: 0.5, cut: 650 } });

// The merchant's tune, plucked strings (A section, bars 0–15).
const pluck = { legato: 0.35, note: { vel: 0.4, rev: 0.4, a: 0.01, r: 0.3, cut: 1600, pan: 0.1 } };
s.line('strings', 0, [
  ['E4', 1], ['A4', 1], ['G4', 0.5], ['E4', 0.5], ['C4', 1.5], ['D4', 0.5], ['E4', 1],
  ['F#4', 1], ['E4', 0.5], ['D4', 0.5], ['E4', 1], ['A3', 1], [null, 2],
  ['E4', 1], ['A4', 1], ['B4', 0.5], ['C5', 0.5], ['A4', 1.5], ['G4', 0.5], ['E4', 1],
  ['F4', 1], ['D4', 0.5], ['Bb3', 0.5], ['D4', 1], ['F4', 1], ['E4', 1], [null, 1],
  ['E4', 1], ['A4', 1], ['G4', 0.5], ['E4', 0.5], ['C4', 1.5], ['D4', 0.5], ['E4', 1],
  ['F#4', 1], ['A4', 1], ['F#4', 0.5], ['E4', 0.5], ['D4', 1], [null, 2],
  ['C5', 1], ['A4', 0.5], ['F4', 0.5], ['A4', 1], ['G4', 1.5], ['F4', 0.5], ['E4', 1],
  ['G#4', 1], ['E4', 1], ['D4', 1], ['B3', 1], [null, 2],
], pluck);

// B section (bars 16–29): the cello bows a low, guarded answer.
s.line('cello', 48, [
  ['F3', 3], ['E3', 1.5], ['D3', 1.5], ['E3', 3], ['C3', 3], ['D3', 2], ['F3', 1], ['Bb3', 3],
  ['A3', 3], ['G3', 1.5], ['F3', 1.5], ['F3', 2], ['A3', 1], ['D4', 3],
  ['B3', 1.5], ['C4', 1.5], ['B3', 1.5], ['A3', 1.5], ['G#3', 6],
], { note: { vel: 0.45, rev: 0.45, pan: -0.25 } });

// Frame drum: soft on the downbeat, a ghost pickup into every other bar.
s.hits('frame', 'A2', [0], { note: { vel: 0.3, rev: 0.25, pan: -0.1 } });
s.hits('frame', 'E3', [2.5], { every: 2, from: 1, note: { vel: 0.18, rev: 0.25, pan: 0.2 } });

// Faint bells on the odd corners: a coin, a tritone.
for (const [beat, m, pan] of [[0, 'E5', 0.6], [27, 'Bb4', -0.6], [48, 'A4', 0.5], [78, 'D#5', -0.5]])
  s.note('bell', beat, 1, m, { vel: 0.09, rev: 0.75, pan, ring: 6 });

export default s;
