// Rest — a shrine, the one warm place. D minor at 44 BPM, 12 bars (~65 s),
// the slowest thing in the game.
//
// Lore it carries (docs/LORE.md §3–§4): cinders "are the only thing in the Spire
// that is still alive ... The shrines drink them." A Forsaken is someone "the
// light did not reach"; "They are not surviving the winter that came after."
// Here, for once, the climber is warm.
//
// So a soft organ and a breathing choir "oo" hold one chord per three bars
// (the shrine drinking, slow swell, slow fade), a few harp notes fall far
// apart, and the Forsaken's own line is heard once, gently, at rest:
//   beat 22 FORSAKEN — solo cello, slow and soft: D, up the open fifth to A,
//           lifted to C, settling on A over iv – V, unresolved, so the loop
//           returns to D on its own.
// The choir only sings chords here; no NAMES — nobody is being read tonight.
// Four layers: organ, choir "oo" chords, harp, cello (the Forsaken).
import { Score, chord } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'rest';

const s = new Score({ bpm: 44, bars: 12, seed: 17, reverb: { room: 0.93, damp: 0.35 }, gain: 0.85 });

// i – VI – iv – V(sus4), three bars each.
const prog = [[chord('D3', 'm'), 3], [chord('Bb2', 'M', 1), 3], [chord('G2', 'm', 1), 3], [chord('A2', 'sus4'), 3]];

s.pad('organ', prog, { overlap: 0.4, note: { stop: 'soft', vel: 0.26, rev: 0.5, a: 3, r: 4 } });
s.note('organ', 0, s.beats, 'D2', { stop: 'soft', vel: 0.22, rev: 0.4, a: 3, r: 4 });
s.pad('choir', prog.map(([c, l]) => [c.map((m) => m + 12), l]), { overlap: 0.5, note: { vowel: 'oo', vel: 0.2, rev: 0.65, a: 4, r: 5 } });

// A few harp notes, far apart, kept out of the cello's way.
for (const [beat, m, pan] of [[4, 'A4', 0.35], [14, 'F4', -0.3], [42, 'E4', -0.25]])
  s.note('harp', beat, 1, m, { vel: 0.36, rev: 0.7, pan, ring: 6 });

// FORSAKEN, once, gently.
s.line('cello', 22, motif('D3', 'forsaken', { stretch: 1.5 }), { note: { vel: 0.42, rev: 0.55, pan: -0.15, a: 1, r: 3.5 } });

export default s;
