// The Pale Marches — the Court Flame's region, frozen under its last law.
//
// Lore it carries (docs/LORE.md):
//   §1  the Citadel: "bridges over water that froze the night the flame died"
//   §6  "every oath in the kingdom came due at once ... Order, kept by force,
//       past the point of meaning anything."
//   §3  "The Stitched King is what a throne looks like when it refuses to be empty."
//
// Floor (music/score/_STYLE.md, "Direction now"): the current build's map bed,
// VARIANT 0 — E, 'calm' scale, one note per 2.2 s (≈27.3 BPM), rendered by
// inGameBeat exactly as the game plays it, plus its strong cello bass every
// fourth step. It shares the variant with the fallback map track (four
// variants, six map tracks) and differs in length, placement and lore layer.
// The floor's drone on E never moves and the game sets its own bare fifth over
// the walk: that is the pedal, the law that outlived itself, the King who will
// not leave. Nothing is added under it.
//
// Motifs (music/score/_motifs.mjs):
//   GOLDBOUGH — cello, beat 2, G major (the walk's relative major; only the cut
//               note leaves the scale), slower than the map's: G4–B4–D5–E5–D5,
//               pinched out on F#5 at ≈ beat 9.2 — the night the flame died and
//               the river froze. Then eleven beats (≈ 24 s) of floor, no lead.
//   NAMES     — the one extra layer: a single far choir voice, beat 20:
//               B4–A4 and then G4, held ten beats and going no further — the
//               name frozen mid-line, like the river. Air from beat 34.
// Layers: the game's floor + cello bass, cello lead, choir.
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'map-pale-marches';
const V = 0;

// 10 bars of 4 = 40 in-game notes = 88 s.
const s = new Score({ bpm: ingame('map', V).bpm, bars: 10, seed: 29, reverb: { room: 0.94, damp: 0.2 }, gain: 0.9 });

// The floor: the game's own map music, and the cello bass under it.
inGameBeat(s, 'map', { variant: V });

// The Court Flame's last night: the kingdom, remembered, and put out.
snuffed(s, 2, 'G4', { stretch: 0.92, vel: 0.55 });

// NAMES in one far choir voice, frozen on its third note.
const frozen = motif('E4', 'names', { unfinished: true }).slice(0, 3);
frozen[2][1] = 10;
s.line('choir', 20, frozen, { legato: 1.05, note: { vowel: 'ah', vel: 0.44, rev: 0.75, pan: 0.2, a: 1.2, r: 2.5 } });

export default s;
