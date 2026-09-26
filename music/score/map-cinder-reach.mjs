// The Cinder Reach — the Crown Flame's region, where the Ember came from.
//
// Lore it carries (docs/LORE.md):
//   §1  the Crown Flame kept "The dead. Names written and kept, and the
//       Sovereign Ember itself, fed in the crown until the night it left."
//   §2  "at death your name was *written* into the Crown Flame, and the writing
//       was the fuel."
//   §6  "the Ember was mined here before it was worshipped"; the Furnace Saint
//       "is still feeding a hearth with nothing in it."
//
// How it sounds (music/score/_STYLE.md, lore table): C phrygian, 46 BPM. EMBER is
// the ground itself — the organ pedal walks it, very slowly, across the whole
// loop, with the low strings doubling it an octave up. A low choir hums NAMES,
// "mm", twice, like a chapel ledger read aloud. A far taiko every two bars, a
// strong stroke and a faint one after it: a pick in the mine, or a heartbeat.
//
// Motifs (music/score/_motifs.mjs):
//   EMBER — organ pedal + low strings from beat 0: C2 (bars 1–4), Db2 (the
//           semitone that climbs and cannot hold, beat 14), G1 (the tritone
//           fall, beat 23), C2 again from beat 32 to the loop.
//   NAMES — hummed choir, beat 2 and beat 38: G3–F3–Eb3–D3, unfinished, both
//           over the C of the pedal. The ledger is read twice and never closed.
// Four layers: organ/drone pedal (EMBER), strings doubling, choir hum, taiko.
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'map-cinder-reach';

// 46 BPM, 14 bars of 4 = 56 beats ≈ 73 s.
const s = new Score({ bpm: 46, bars: 14, seed: 37, reverb: { room: 0.88, damp: 0.6 }, gain: 0.9 });

// Under everything: a C1 drone, unbroken.
s.note('drone', 0, s.beats, 'C1', { vel: 0.36, rev: 0.2, cut: 260 });

// EMBER as the pedal: the motif at triple length, its first and last notes
// held longer so it fills the loop exactly (14 + 9 + 9 + 24 = 56 beats).
const ember = motif('C2', 'ember', { stretch: 3 });
ember[0][1] += 8;
ember[3][1] += 12;
s.line('organ', 0, ember, { legato: 1.02, note: { stop: 'soft', vel: 0.44, rev: 0.35, a: 2.5, r: 3 } });
s.line('strings', 0, ember.map(([m, b]) => [m + 12, b]), { legato: 1.04, note: { vel: 0.3, rev: 0.45, cut: 650, a: 3, r: 3 } });

// NAMES, hummed low: the ledger read aloud, twice, never finished.
const hum = { legato: 1.05, note: { vowel: 'mm', vel: 0.6, rev: 0.5, pan: -0.1, a: 1, r: 2.5 } };
s.line('choir', 2, motif('C3', 'names', { stretch: 1.5, unfinished: true }), hum);
s.line('choir', 38, motif('C3', 'names', { stretch: 1.5, unfinished: true }), hum);

// The mine, or a heartbeat: far taiko every two bars, a stroke and its echo.
for (let b = 0; b < s.beats; b += 8) {
  s.note('taiko', b, 1, 'C2', { vel: 0.26, rev: 0.75, pan: 0.3, ring: 1.6 });
  s.note('taiko', b + 0.75, 1, 'C2', { vel: 0.13, rev: 0.75, pan: 0.3, ring: 1.4 });
}

// Heat haze over the tritone: one faint bowed-metal swell.
s.note('metal', 22, 10, 'Db4', { vel: 0.09, rev: 0.8, pan: 0.55, a: 3.5 });

export default s;
