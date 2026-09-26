// The Hollow Weald — "growth without a Field Flame does not stop; it goes wrong"
// (docs/LORE.md). Overgrown and heavy: a D drone under slow minor harmony, a
// harp that plucks slightly out of true, a cello that never resolves, and a
// choir whose "oo" sours into a cluster before it settles. No drums.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'map-hollow-weald';

const s = new Score({ bpm: 56, bars: 20, seed: 11, reverb: { room: 0.9, damp: 0.45 }, gain: 0.9 });

// Harmony: i – VI – iv – v, then a darker turn through bII before home.
const prog = [
  [chord('D3', 'm'), 2], [chord('Bb2', 'M'), 2], [chord('G2', 'm', 1), 2], [chord('A2', 'm'), 2],
  [chord('D3', 'm'), 2], [chord('Eb3', 'M'), 2], [chord('G2', 'm', 1), 2], [chord('A2', 'sus4'), 1], [chord('A2', 'm'), 1],
  [chord('D3', 'madd9'), 2], [chord('D3', 'm'), 2],
];
s.note('drone', 0, s.beats, 'D2', { vel: 0.55, rev: 0.2 });
s.note('drone', 0, s.beats, 'A2', { vel: 0.25, rev: 0.2, cut: 300 });
s.pad('strings', prog, { note: { vel: 0.45, rev: 0.45, cut: 900 } });

// Choir: an "oo" chord that leans into a sour cluster on the Eb bars.
s.pad('choir', [[[n('D4'), n('F4'), n('A4')], 8], [[n('Eb4'), n('F4'), n('Bb4')], 4], [[n('D4'), n('E4'), n('A4')], 8]],
  { note: { vel: 0.3, rev: 0.6, vowel: 'oo' } });

// Harp, sparse and a little out of true, falling figures every two bars.
for (let bar = 0; bar < s.bars; bar += 2) {
  const top = [n('A4'), n('F4'), n('G4'), n('E4')][(bar / 2) % 4];
  s.line('harp', bar * 4 + 1, [[top, 1], [top - 3, 1], [top - 7, 2]], { note: { vel: 0.35, rev: 0.55, pan: 0.35, nudge: 0.03 } });
}

// Cello: a lament that climbs and never lands on the tonic.
s.line('cello', 16, [['A3', 3], ['Bb3', 1], ['A3', 2], ['G3', 2], ['F3', 4], ['E3', 4]], { note: { vel: 0.5, rev: 0.4, pan: -0.25 } });
s.line('cello', 48, [['D4', 2], ['C4', 2], ['Bb3', 3], ['A3', 1], ['G3', 4], ['A3', 4]], { note: { vel: 0.5, rev: 0.4, pan: -0.25 } });

// Wood under strain: bowed metal, low and slow. One distant bell per cycle.
s.note('metal', 8, 10, 'D3', { vel: 0.18, rev: 0.7, pan: 0.6 });
s.note('metal', 52, 10, 'Ab2', { vel: 0.16, rev: 0.7, pan: -0.6 });
s.note('bell', 36, 1, 'D5', { vel: 0.14, rev: 0.8, pan: 0.5, ring: 8 });

export default s;
