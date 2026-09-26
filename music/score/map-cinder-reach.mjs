// The Cinder Reach — where the Ember was mined; "it did not burn in the
// Burning: it was already burning" (docs/LORE.md). C phrygian, smouldering
// and patient: a deep organ pedal on C, low strings that lean onto the flat
// second (Db) and back, and one lead — a low hummed "mm" voice that keeps
// sinking. Bowed metal shimmers like heat haze. Nothing hurries; no drums.
// Original material (music/score/_STYLE.md).
import { Score, n } from '../../tools/score/compose.mjs';

export const context = 'map-cinder-reach';

// 46 BPM, 14 bars of 4 = 56 beats ≈ 73 s.
const s = new Score({ bpm: 46, bars: 14, seed: 37, reverb: { room: 0.88, damp: 0.6 }, gain: 0.9 });

// Bed: organ pedal C1 + C2 for the whole loop.
s.note('organ', 0, s.beats, 'C2', { stop: 'soft', vel: 0.42, rev: 0.35, a: 3, r: 4 });
s.note('organ', 0, s.beats, 'C1', { stop: 'soft', vel: 0.32, rev: 0.3, a: 3, r: 4 });

// Low strings: C, then the grind onto Db, then back — one chord per 3–4 bars.
s.pad('strings', [
  [[n('C2'), n('G2')], 4], [[n('Db2'), n('Ab2')], 3], [[n('Bb1'), n('F2')], 3], [[n('C2'), n('G2')], 4],
], { note: { vel: 0.4, rev: 0.4, cut: 600, a: 3, r: 3 } });

// Lead: a low hummed voice. Leans on Ab and Db, sinks to C, never lifts.
const hum = { note: { vel: 0.6, rev: 0.5, vowel: 'mm', pan: -0.1, a: 1, r: 2.5 } };
s.line('choir', 2, [['G3', 4], ['Ab3', 4], ['G3', 8], [null, 4], ['F3', 3], ['Eb3', 1], ['Db3', 4]], hum);
s.line('choir', 32, [['C3', 6], ['Db3', 2], ['Eb3', 4], ['Db3', 4], ['C3', 6]], hum);

// Heat haze: one bowed-metal swell a loop, high and faint.
s.note('metal', 22, 10, 'Db4', { vel: 0.1, rev: 0.8, pan: 0.55, a: 3.5 });

export default s;
