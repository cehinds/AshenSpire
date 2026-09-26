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
// Floor (music/score/_STYLE.md, "Direction now"): the current build's map bed,
// VARIANT 2 — F, 'dread' scale, one note per 2 s (30 BPM), rendered by
// inGameBeat exactly as the game plays it, plus its strong cello bass every
// fourth step, which swells in and out like tide. NO CHOIR at all: the choir is
// the written dead, and nobody here was written. Bell-buoys (the one extra
// layer) toll out of step. Emptiness is the point.
//
// Motifs (music/score/_motifs.mjs):
//   GOLDBOUGH — cello, beat 5, Ab major (every note, the cut one too, is in the
//               floor's scale): Ab4–C5–Eb5–F5–Eb5, pinched out on G5 at ≈ beat
//               10.9. Then eleven beats (≈ 22 s) of sea and floor, no lead.
//   FORSAKEN  — cello, beat 22: F4–C5–Eb5–C5, broadened, the only voice on
//               the unwritten's shore; answered by nobody. Air from beat 34.
// Layers: the game's floor + cello bass, cello lead, bell-buoys.
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'map-drowned-coast';
const V = 2;

// 10 bars of 4 = 40 in-game notes = 80 s.
const s = new Score({ bpm: ingame('map', V).bpm, bars: 10, seed: 53, reverb: { room: 0.95, damp: 0.5 }, gain: 0.9 });

// The floor: the game's own map music, and the cello bass under it.
inGameBeat(s, 'map', { variant: V });

// The kingdom, remembered from the shore, and put out.
snuffed(s, 5, 'Ab4', { stretch: 0.75, vel: 0.55 });

// FORSAKEN, the only voice here.
s.line('cello', 22, motif('F4', 'forsaken'), { note: { vel: 0.56, rev: 0.55, pan: 0.15 } });

// Bell-buoys, out of step, far off.
s.note('bell', 15.5, 1, 'C5', { vel: 0.13, rev: 0.9, pan: 0.6, ring: 9 });
s.note('bell', 29, 1, 'F4', { vel: 0.12, rev: 0.9, pan: -0.45, ring: 9 });
s.note('bell', 37.5, 1, 'C5', { vel: 0.09, rev: 0.9, pan: 0.55, ring: 9 });

export default s;
