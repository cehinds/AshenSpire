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
// How it sounds (music/score/_STYLE.md, lore table): G minor, 50 BPM, a slow
// procession. EMBER is the road: the organ pedal and its chords walk the motif
// across the whole loop, and the low strings state it plainly ahead of you, twice,
// drawing you on. A distant taiko stroke every two bars is the only step. The
// choir is silent until one late NAMES phrase — the last name written, waiting
// at the Spire's foot. A bell tolls once. Never triumphant.
//
// Motifs (music/score/_motifs.mjs):
//   EMBER — organ pedal + chords from beat 0, stretched over the loop:
//           G (Gm) → Ab (beat 16) → D (beat 28, the tritone fall) → G (beat 40).
//           Strings lead, beat 4: G3–Ab3–D3–G3; beat 28: G4–Ab4–D4–G4.
//   NAMES — the choir's only entry, beat 44: D4–C4–Bb3–A3, unfinished.
// Four layers: organ (pedal + chords), strings (lead), taiko, choir (late).
// Original material.
import { Score, chord } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'map-ashen-crown';

// 50 BPM, 16 bars of 4 = 64 beats ≈ 77 s.
const s = new Score({ bpm: 50, bars: 16, seed: 71, reverb: { room: 0.9, damp: 0.4 }, gain: 0.9 });

// EMBER as the road: pedal at quadruple length, first and last notes held
// longer to fill the loop (16 + 12 + 12 + 24 = 64 beats).
const road = motif('G2', 'ember', { stretch: 4 });
road[0][1] += 8;
road[3][1] += 8;
s.line('organ', 0, road.map(([m, b]) => [m - 12, b]), { legato: 1.02, note: { stop: 'soft', vel: 0.4, rev: 0.3, a: 3, r: 4 } });
// Chords over the same walk: Gm, Ab, bare D, Gm (bars 4 + 3 + 3 + 6).
s.pad('organ', [
  [chord('G3', 'm'), 4], [chord('Ab3', 'M'), 3], [chord('D3', 'fifth8'), 3], [chord('G3', 'm'), 6],
], { overlap: 0.1, spread: 0.6, note: { stop: 'full', vel: 0.16, rev: 0.5, a: 2, r: 2.5 } });

// The procession motif in the low strings, ahead of you.
const strings = { legato: 1.02, note: { vel: 0.46, rev: 0.5, cut: 1100, pan: -0.1, a: 0.9, r: 2.5 } };
s.line('strings', 4, motif('G3', 'ember'), strings);
s.line('strings', 28, motif('G4', 'ember'), { ...strings, note: { ...strings.note, vel: 0.36, pan: 0.1 } });

// The step: one far taiko stroke every two bars.
s.hits('taiko', 'G1', [0], { every: 2, note: { vel: 0.3, rev: 0.7, ring: 1.6 } });

// The choir, silent until now: one NAMES phrase, unfinished.
s.line('choir', 44, motif('G3', 'names', { stretch: 1.5, unfinished: true }),
  { legato: 1.05, note: { vowel: 'ah', vel: 0.42, rev: 0.65, pan: 0.15, a: 1.4, r: 3 } });

// One toll, as the road comes back to G.
s.note('bell', 40, 1, 'G4', { vel: 0.12, rev: 0.85, pan: 0.5, ring: 9 });

export default s;
