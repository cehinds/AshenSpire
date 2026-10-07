// The Hollow Weald — the Field Flame's region, stuck.
//
// Lore it carries (docs/LORE.md):
//   §4  "the weald in a spring that will not turn"
//   §1  the Field Flame kept "the seasons turning on time. Its bell told the weald the hour."
//   §6  the Bell Keeper: "The bell is cracked and the dawn does not come, and he rings it anyway."
//   §6  the Grave of the Nameless on the weald road: "the graves of Forsaken who
//       climbed before you and were never written into memory."
//
// Floor (music/score/_STYLE.md, "Direction now"): the current build's map bed,
// VARIANT 3 — D, 'veiled' scale, one note per 2.35 s (≈25.5 BPM), rendered by
// inGameBeat exactly as the game plays it, plus its strong cello bass every
// fourth step. The floor never turns — its drone holds D for the whole loop —
// so the turn is attempted on top: the cello reaches for Bb major (the warm
// sixth over the D), is pinched out, and the floor is still on D. A cracked
// bell (the one extra layer) tolls an hour and stops short of the count.
//
// Motifs (music/score/_motifs.mjs):
//   GOLDBOUGH — cello, beat 4, Bb major: Bb3–D4–F4–G4–F4 (D, F, G in the
//               floor's scale), pinched out on A4 at ≈ beat 9.9. The veiled
//               scale holds no major triad, so the Bb and the cut A are the two
//               notes outside it: the season the weald cannot reach. Then
//               thirteen beats (≈ 31 s) of floor, no lead.
//   (bell)    — three strokes, beats 16–18, in the lead's silence; the fourth
//               never comes.
//   FORSAKEN  — cello, beat 23: D4–A4–C5–A4, the Grave of the Nameless (its
//               fifth is the game's own fifth); air from beat 32.
// Layers: the game's floor + cello bass, cello lead, bell.
// Original material.
import { Score, n } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'map-hollow-weald';
const V = 3;

// 9 bars of 4 = 36 in-game notes ≈ 85 s.
const s = new Score({ bpm: ingame('map', V).bpm, bars: 9, seed: 11, reverb: { room: 0.9, damp: 0.45 }, gain: 0.9 });

// The floor: the game's own map music, and the cello bass under it.
inGameBeat(s, 'map', { variant: V });

// The turn to spring, remembered, and put out; the floor stays on D.
snuffed(s, 4, 'Bb3', { stretch: 0.75, vel: 0.55, ember: false });

// The cracked bell tells the hour: three strokes, and the count stops short.
const cracked = n('D5') - 0.22;
for (const b of [16, 17, 18]) s.note('bell', b, 1, cracked, { vel: 0.15, rev: 0.8, pan: 0.45, ring: 8 });

// The Nameless on the weald road.
s.line('cello', 23, motif('D4', 'forsaken', { stretch: 0.75 }), { note: { vel: 0.56, rev: 0.5, pan: -0.15 } });

export default s;
