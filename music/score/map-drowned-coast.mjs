// The Drowned Coast — the Ashen Spire's shore. No flame, and nobody written.
//
// Lore it carries (docs/LORE.md):
//   §1  the Ashen Spire: "Its hearth was built to burn without names. It was
//       never tried." ... "The Spire burns the unwritten."
//   §6  "The sea has the lower city to its second storeys. Nothing here burned:
//       there was nothing lit to burn, and the Blight has no one here to collect."
//   §4  the Forsaken lived "on the coast among the ship-breakers" — "a name
//       nobody promised to the fire."
//
// How it sounds (music/score/_STYLE.md, lore table): F minor, 50 BPM. NO CHOIR at
// all — the choir is the written dead, and nobody here was written. Low strings
// swell and ebb like tide, one slow bow per chord, over a drone under the water;
// bell-buoys toll out of step. The only voice is the unwritten one. Emptiness is
// the point.
//
// Motifs (music/score/_motifs.mjs):
//   FORSAKEN — solo cello, beat 2: F3–C4–Eb4–C4, broadened (these are the
//              unwritten's shores); again at beat 34, an octave lower and plain,
//              F2–C3–Eb3–C3, as if answered by nobody.
// Four layers: drone, strings (tide), cello (lead), bell-buoys.
// Original material.
import { Score, chord } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'map-drowned-coast';

// 50 BPM, 16 bars of 4 = 64 beats ≈ 77 s.
const s = new Score({ bpm: 50, bars: 16, seed: 53, reverb: { room: 0.95, damp: 0.5 }, gain: 0.9 });

// Under the water: a drone on F.
s.note('drone', 0, s.beats, 'F1', { vel: 0.42, rev: 0.25, cut: 240 });

// Tide: each chord bowed in and out with a very slow attack, four bars each.
s.pad('strings', [
  [chord('F2', 'm'), 4], [chord('Db2', 'M'), 4], [chord('F2', 'm'), 4], [chord('C2', 'sus4'), 2], [chord('C2', 'm'), 2],
], { overlap: 0.5, spread: 0.9, note: { vel: 0.44, rev: 0.55, cut: 700, a: 5, r: 4.5 } });

// FORSAKEN, the only voice on this shore.
const cello = { note: { vel: 0.56, rev: 0.5, pan: 0.15 } };
s.line('cello', 2, motif('F3', 'forsaken', { stretch: 1.25 }), cello);
s.line('cello', 34, motif('F2', 'forsaken'), { note: { ...cello.note, vel: 0.52 } });

// Bell-buoys, out of step, far off.
s.note('bell', 22.5, 1, 'C5', { vel: 0.13, rev: 0.9, pan: 0.6, ring: 9 });
s.note('bell', 49, 1, 'F4', { vel: 0.12, rev: 0.9, pan: -0.45, ring: 9 });
s.note('bell', 58.5, 1, 'C5', { vel: 0.09, rev: 0.9, pan: 0.55, ring: 9 });

export default s;
