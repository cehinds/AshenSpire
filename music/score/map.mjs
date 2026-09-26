// Fallback map — the ring road between the towers, and the cold after.
//
// Lore it carries (docs/LORE.md):
//   §1  "The old viaducts still join the three in a ring ... There is no first
//       seat ... the ring decides the rest."
//   §4  "The Forsaken survived the Burning because the fire could not read them.
//       They are not surviving the winter that came after."
//   §4  the Forsaken Medallion, "a slug of cold iron, blank on both faces."
//
// How it sounds (music/score/_STYLE.md, lore table): E aeolian, 52 BPM, as bare as
// it can be. A drone on E with a faint fifth — nothing else under it, no chords —
// and wind-like bowed metal passing over. The one voice is the climber's own.
//
// Motifs (music/score/_motifs.mjs):
//   FORSAKEN — solo cello, beat 4: E3–B3–D4–B3, broadened; then air; again at
//              beat 36, E2–B2–D3–B2, lower and slower, the road going on.
// Three layers: drone, cello (lead), metal (wind).
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'map';

// 52 BPM, 16 bars of 4 = 64 beats ≈ 74 s.
const s = new Score({ bpm: 52, bars: 16, seed: 23, reverb: { room: 0.92, damp: 0.5 }, gain: 0.9 });

// The bare drone: E with a faint fifth, unbroken.
s.note('drone', 0, s.beats, 'E2', { vel: 0.5, rev: 0.2 });
s.note('drone', 0, s.beats, 'B2', { vel: 0.22, rev: 0.2, cut: 300 });

// FORSAKEN on the cello, twice, with the road between.
const cello = { note: { vel: 0.56, rev: 0.45, pan: -0.15 } };
s.line('cello', 4, motif('E3', 'forsaken', { stretch: 1.5 }), cello);
s.line('cello', 36, motif('E2', 'forsaken', { stretch: 1.75 }), { note: { ...cello.note, vel: 0.52 } });

// Wind over the viaducts: bowed metal swells, far apart, left and right.
s.note('metal', 0, 10, 'B3', { vel: 0.1, rev: 0.8, pan: 0.5, a: 4 });
s.note('metal', 22, 10, 'E4', { vel: 0.11, rev: 0.8, pan: -0.55, a: 4 });
s.note('metal', 46, 12, 'F#3', { vel: 0.12, rev: 0.8, pan: 0.4, a: 4 });

export default s;
