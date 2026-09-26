// Fallback map — the ring road between the towers, and the cold after.
//
// Lore it carries (docs/LORE.md):
//   §1  "The old viaducts still join the three in a ring ... There is no first
//       seat ... the ring decides the rest."
//   §4  "The Forsaken survived the Burning because the fire could not read them.
//       They are not surviving the winter that came after."
//   §4  the Forsaken Medallion, "a slug of cold iron, blank on both faces."
//
// Floor (music/score/_STYLE.md, "Direction now"): the current build's map bed,
// VARIANT 0 — E, 'calm' scale, one note per 2.2 s (≈27.3 BPM), rendered by
// inGameBeat exactly as the game plays it (note, fifth, drone), plus its strong
// cello bass every fourth step. On top, in E calm, as bare as it can be:
// wind-like bowed metal over the viaducts (the one extra layer) and the cello.
//
// Motifs (music/score/_motifs.mjs):
//   GOLDBOUGH — cello, beat 4, G major (the walk's relative major; only the cut
//               note leaves the scale): G4–B4–D5–E5–D5, pinched out on F#5 at
//               ≈ beat 9.9. Then twelve beats (≈ 26 s) of floor, no lead.
//   FORSAKEN  — cello, beat 22: E4–B4–D5–B4, the one voice left on the road;
//               air from beat 31 to the loop.
// Layers: the game's floor + cello bass, cello lead, metal.
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'map';
const V = 0;

// 9 bars of 4 = 36 in-game notes ≈ 79 s.
const s = new Score({ bpm: ingame('map', V).bpm, bars: 9, seed: 23, reverb: { room: 0.92, damp: 0.5 }, gain: 0.9 });

// The floor: the game's own map music, and the cello bass under it.
inGameBeat(s, 'map', { variant: V });

// The kingdom, remembered, and put out.
snuffed(s, 4, 'G4', { stretch: 0.75, vel: 0.55 });

// The climber, alone on the ring road.
s.line('cello', 22, motif('E4', 'forsaken', { stretch: 0.75 }), { note: { vel: 0.56, rev: 0.5, pan: -0.15 } });

// Wind over the viaducts: bowed metal swells, far apart, left and right.
s.note('metal', 0, 6, 'B3', { vel: 0.1, rev: 0.8, pan: 0.5, a: 4 });
s.note('metal', 14, 6, 'E4', { vel: 0.11, rev: 0.8, pan: -0.55, a: 4 });
s.note('metal', 29, 6, 'A3', { vel: 0.1, rev: 0.8, pan: 0.4, a: 4 });

export default s;
