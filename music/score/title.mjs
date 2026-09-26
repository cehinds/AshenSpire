// Title — the main theme of Ashen Spire. A solo cello states a slow, noble
// lament in D minor: it opens on the bare fifth D–A (the cold flames, lit and
// looking), climbs through the sixth to a peak on Bb, and falls back to D. An
// organ holds the D pedal, a choir "oo" swells under the peak, the harp answers
// each phrase, and a distant bell marks every phrase start. The last bars turn
// back through Bb – Gm – A to the opening chord, so the loop is heard as one arc.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'title';

const s = new Score({ bpm: 68, bars: 26, seed: 3, reverb: { room: 0.9, damp: 0.4 }, gain: 0.9 });

const Dm = chord('D3', 'm'), F = chord('F2', 'M', 1), Gm = chord('G2', 'm', 1), A = chord('A2', 'M'),
  Asus = chord('A2', 'sus4'), Bb = chord('Bb2', 'M');
// Bars: intro | A | A' | B (rise) | B' (peak, fall) | A (home) | turn.
const prog = [
  [Dm, 2],
  [Dm, 2], [Gm, 1], [A, 1],
  [Dm, 1], [F, 1], [Bb, 1], [A, 1],
  [F, 1], [Bb, 1], [Gm, 1], [A, 1],
  [Bb, 1], [Gm, 1], [Dm, 1], [A, 1],
  [Dm, 2], [Gm, 0.5], [A, 0.5], [Dm, 1],
  [Bb, 1], [Gm, 1], [Asus, 1], [A, 1],
];
s.note('organ', 0, s.beats, 'D2', { vel: 0.32, rev: 0.3, stop: 'soft' });
s.pad('organ', prog, { overlap: 0.1, note: { vel: 0.28, rev: 0.4, stop: 'soft' } });
s.pad('strings', prog, { note: { vel: 0.22, rev: 0.5, cut: 700 } });

// Choir "oo": quiet in the statement, swelling under the climb and the peak.
const up = (notes) => notes.map((m) => m + 12);
const choir = (from, to, vel) => s.pad('choir', prog.map(([c, l]) => [up(c), l]), { from, to, note: { vel, rev: 0.65, vowel: 'oo' } });
choir(0, 26, 0.16);
// the swell: a second choir layer only across bars 10–18 (the climb and peak)
[[F, 10], [Bb, 11], [Gm, 12], [A, 13], [Bb, 14], [Gm, 15], [Dm, 16], [A, 17]].forEach(([c, bar], i) =>
  up(up(c)).forEach((m, k) => s.note('choir', bar * 4, 4.6, m, { vel: 0.1 + 0.02 * Math.min(i, 7 - i), rev: 0.7, vowel: 'oo', pan: (k - 1) * 0.3 })));

// The theme, solo cello.
const cello = { note: { vel: 0.62, rev: 0.4, pan: -0.15 } };
s.line('cello', 8, [['D3', 2], ['A3', 2], ['F3', 1.5], ['G3', 0.5], ['A3', 2], ['Bb3', 2], ['A3', 1], ['G3', 1], ['A3', 4]], cello);
s.line('cello', 24, [['D3', 2], ['A3', 2], ['F3', 1.5], ['G3', 0.5], ['A3', 1], ['C4', 1], ['D4', 3], ['C4', 1], ['Bb3', 2], ['A3', 2]], cello);
s.line('cello', 40, [['A3', 1], ['Bb3', 1], ['C4', 2], ['D4', 2], ['F4', 2], ['G4', 3], ['F4', 1], ['E4', 2], ['D4', 1], ['C#4', 1]], cello);
s.line('cello', 56, [['D4', 1], ['F4', 1], ['G4', 2], ['A4', 2], ['Bb4', 1], ['A4', 1], ['F4', 1.5], ['E4', 0.5], ['D4', 1], ['C4', 1], ['Bb3', 2], ['A3', 2]], cello);
s.line('cello', 72, [['D3', 2], ['A3', 2], ['F3', 1.5], ['G3', 0.5], ['A3', 2], ['G3', 2], ['E3', 2], ['D3', 4]], { note: { ...cello.note, vel: 0.55 } });
// Under the turn the cello drops to a low counter-line that leads back to D.
s.line('cello', 88, [['Bb2', 4], ['G2', 4], ['A2', 6], ['C#3', 2]], { note: { ...cello.note, vel: 0.42 } });

// Harp answers: rising arpeggios in the gaps the cello leaves.
const harp = { note: { vel: 0.34, rev: 0.5, pan: 0.35 } };
const answer = (beat, notes) => s.line('harp', beat, notes.map((m) => [m, 0.5]), harp);
answer(0, ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3']);
answer(4, ['D3', 'A3', 'D4', 'E4', 'F4', 'A4', 'D5', 'A4']);
answer(22, ['A3', 'C#4', 'E4', 'A4']);
answer(38, ['A3', 'C#4', 'E4', 'G4']);
answer(54, ['A3', 'C#4', 'E4', 'A4']);
answer(70, ['E4', 'C#4', 'A3', 'E3']);
answer(86, ['D4', 'F4', 'A4', 'D5']);
answer(88, ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'Bb4', 'F4', 'D4']);
answer(92, ['G3', 'Bb3', 'D4', 'G4', 'Bb4', 'G4', 'D4', 'Bb3']);
answer(96, ['A3', 'D4', 'E4', 'A4', 'A3', 'C#4', 'E4', 'A4']);

// Distant bells mark the phrases; the peak gets the high one.
for (const [beat, m, pan] of [[8, 'D4', 0.5], [24, 'A4', -0.5], [40, 'F4', 0.5], [56, 'D5', -0.4], [72, 'D4', 0.5], [88, 'A3', -0.3]])
  s.note('bell', beat, 1, m, { vel: 0.13, rev: 0.8, pan, ring: 8 });

export default s;
