// The Ashen Crown — the causeway to the Spire's summit, laid by the Ember.
//
// Lore it carries (docs/LORE.md):
//   §1  "the causeway to the Spire opens from whichever tower you relight last,
//       its light laid across the water by the Ember fleeing ahead of you"
//   §4  "herd the fire ... out along the open spur, toward the Spire, with the
//       climber behind it."
//   §6  the Blighted Valkyrie, "the last name written into the Chapel's memory",
//       "waits on the causeway to the Spire".
//
// Floor (music/score/_STYLE.md, "Direction now"): the current build's map bed,
// VARIANT 3 — D, 'veiled' scale, one note per 2.35 s (≈25.5 BPM), rendered by
// inGameBeat exactly as the game plays it, plus its strong cello bass every
// fourth step. It shares the variant with the Hollow Weald (four variants, five
// regions): the last road begins in the first region's key. The floor's tread
// is the procession's pace, so no taiko is added. The choir is silent until one
// late NAMES phrase.
//
// Motifs (music/score/_motifs.mjs):
//   GOLDBOUGH — cello, beat 2, Bb major, an octave above the Weald's (the
//               veiled scale holds no major triad; the Bb and the cut A are the
//               notes outside it): Bb4–D5–F5–G5–F5, pinched out on A5 at
//               ≈ beat 7.9. Then eight beats (≈ 19 s) of floor, no lead.
//   EMBER     — the procession, on the cello (strings) from beat 16, slow:
//               D4–Eb4–A3–D4, ahead of you, drawing you on (to beat 31).
//   NAMES     — the one extra layer, and the choir's only entry: beat 31,
//               A4–G4–F4–E4, unfinished — the last name written, waiting at
//               the Spire's foot.
// Layers: the game's floor + cello bass, cello (lead, then EMBER), choir.
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'map-ashen-crown';
const V = 3;

// 10 bars of 4 = 40 in-game notes ≈ 94 s.
const s = new Score({ bpm: ingame('map', V).bpm, bars: 10, seed: 71, reverb: { room: 0.9, damp: 0.4 }, gain: 0.9 });

// The floor: the game's own map music, and the cello bass under it.
inGameBeat(s, 'map', { variant: V });

// The kingdom, remembered at the foot of the road, and put out.
snuffed(s, 2, 'Bb4', { stretch: 0.75, vel: 0.55 });

// EMBER as the procession, on the cello, ahead of you.
s.line('cello', 16, motif('D4', 'ember', { stretch: 1.25 }), { legato: 1.02, note: { vel: 0.56, rev: 0.5, pan: -0.1, a: 0.6, r: 2 } });

// The choir, silent until now: one NAMES phrase, unfinished.
s.line('choir', 31, motif('D4', 'names', { unfinished: true }),
  { legato: 1.05, note: { vowel: 'ah', vel: 0.44, rev: 0.65, pan: 0.15, a: 1.4, r: 3 } });

export default s;
