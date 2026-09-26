// The Pale Marches — the Court Flame's region, frozen under its last law.
//
// Lore it carries (docs/LORE.md):
//   §1  the Citadel: "bridges over water that froze the night the flame died"
//   §6  "every oath in the kingdom came due at once ... Order, kept by force,
//       past the point of meaning anything."
//   §3  "The Stitched King is what a throne looks like when it refuses to be empty."
//
// How it sounds (music/score/_STYLE.md, lore table): B minor, 44 BPM. A pedal on B
// that never moves, the whole loop — the law that outlived itself, the King who
// will not leave. Above it, knight-like bare fifths in the low strings, changing
// every two to four bars, never a third. Glassy bowed metal for the ice.
//
// Motifs (music/score/_motifs.mjs):
//   NAMES — one frozen choir voice. Beat 4: F#4–E4–D4–C#4, unfinished. Beat 26:
//           it starts again, slower, and freezes on its third note (D4, held)
//           — it stops mid-line and never moves on.
// Four layers: drone/string pedal, low-string fifths, choir voice (lead), metal.
// Original material.
import { Score, chord, n } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'map-pale-marches';

// 44 BPM, 12 bars of 4 = 48 beats ≈ 65 s.
const s = new Score({ bpm: 44, bars: 12, seed: 29, reverb: { room: 0.94, damp: 0.2 }, gain: 0.85 });

// The pedal: drone and low strings on B and F#, never leaving.
s.note('drone', 0, s.beats, 'B1', { vel: 0.48, rev: 0.25, cut: 320 });
s.pad('strings', [[[n('B1'), n('F#2')], 12]], { note: { vel: 0.36, rev: 0.4, cut: 600, a: 3 } });

// Knights: bare fifths in the low strings, moving over the pedal.
s.pad('strings', [
  [chord('B2', 'five'), 4], [chord('G2', 'five'), 2], [chord('A2', 'five'), 2],
  [chord('E2', 'five'), 2], [chord('F#2', 'five'), 2],
], { spread: 0.6, note: { vel: 0.3, rev: 0.5, cut: 800, a: 2.5, r: 3 } });

// NAMES in one far choir voice — unfinished, then frozen mid-line.
const voice = { legato: 1.05, note: { vowel: 'ah', vel: 0.48, rev: 0.75, pan: 0.1, a: 1.2, r: 2.5 } };
s.line('choir', 4, motif('B3', 'names', { stretch: 1.5, unfinished: true }), voice);
const frozen = motif('B3', 'names', { stretch: 2, unfinished: true }).slice(0, 3);
frozen[2][1] = 12; // the third note is held, and the line goes no further
s.line('choir', 26, frozen, voice);

// Ice: glassy bowed metal, twice a loop.
s.note('metal', 14, 8, 'B3', { vel: 0.12, rev: 0.85, pan: 0.6, a: 3 });
s.note('metal', 38, 8, 'C4', { vel: 0.1, rev: 0.85, pan: -0.6, a: 3 });

export default s;
