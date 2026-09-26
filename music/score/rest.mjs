// Rest — stillness at a grace. D minor at 44 BPM, the slowest thing in the
// game: a soft organ and a choir "oo" hold one chord per three bars and let it
// breathe (slow swell, slow fade, overlapping), a few harp notes fall far apart,
// and a solo cello sings one short phrase that stops on A, unresolved, so the
// loop returns to D on its own.
// Four layers: organ, choir "oo", harp, cello.
import { Score, chord } from '../../tools/score/compose.mjs';

export const context = 'rest';

const s = new Score({ bpm: 44, bars: 12, seed: 17, reverb: { room: 0.93, damp: 0.35 }, gain: 0.85 });

// i – VI – iv – V(sus4), three bars each.
const prog = [[chord('D3', 'm'), 3], [chord('Bb2', 'M', 1), 3], [chord('G2', 'm', 1), 3], [chord('A2', 'sus4'), 3]];

s.pad('organ', prog, { overlap: 0.4, note: { stop: 'soft', vel: 0.26, rev: 0.5, a: 3, r: 4 } });
s.note('organ', 0, s.beats, 'D2', { stop: 'soft', vel: 0.22, rev: 0.4, a: 3, r: 4 });
s.pad('choir', prog.map(([c, l]) => [c.map((m) => m + 12), l]), { overlap: 0.5, note: { vowel: 'oo', vel: 0.2, rev: 0.65, a: 4, r: 5 } });

// A few harp notes, far apart.
for (const [beat, m, pan] of [[4, 'A4', 0.35], [16, 'F4', -0.3], [28, 'D5', 0.3], [42, 'E4', -0.25]])
  s.note('harp', beat, 1, m, { vel: 0.36, rev: 0.7, pan, ring: 6 });

// One short cello phrase over iv – V.
s.line('cello', 24, [['D3', 4], ['C3', 2], ['Bb2', 4], ['A2', 6]], { note: { vel: 0.45, rev: 0.5, pan: -0.15, a: 0.8, r: 3 } });

export default s;
