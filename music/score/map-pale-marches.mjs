// The Pale Marches — the Citadel's bridges froze the night the Court Flame
// died (docs/LORE.md). B minor, frozen and hollow: a low string pedal on B
// that never moves, a thin high fifth held like rime, and one lead — a lone
// "ah" voice, very far away, singing long notes with wide silences. Glassy
// bowed metal swells now and then. Cold, silent law; no drums.
// Original material (music/score/_STYLE.md).
import { Score, n } from '../../tools/score/compose.mjs';

export const context = 'map-pale-marches';

// 44 BPM, 12 bars of 4 = 48 beats ≈ 65 s.
const s = new Score({ bpm: 44, bars: 12, seed: 29, reverb: { room: 0.94, damp: 0.2 }, gain: 0.85 });

// Bed: the pedal — drone and low strings on B and F#, never leaving.
s.note('drone', 0, s.beats, 'B1', { vel: 0.48, rev: 0.25, cut: 320 });
s.pad('strings', [[[n('B1'), n('F#2')], 12]], { note: { vel: 0.38, rev: 0.4, cut: 600, a: 3 } });
// A thin high fifth, bright and faint, shifting to a bare second halfway.
s.pad('strings', [[[n('F#5'), n('B5')], 6], [[n('F#5'), n('G5')], 6]],
  { spread: 1.2, note: { vel: 0.1, rev: 0.8, cut: 5000, a: 4, r: 4 } });

// Lead: one far "ah" voice. Long notes, then nothing.
const voice = { note: { vel: 0.5, rev: 0.75, vowel: 'ah', pan: 0.1, a: 1.2, r: 2.5 } };
s.line('choir', 2, [['F#4', 6], ['G4', 2], ['F#4', 8], [null, 6], ['D4', 4], ['E4', 4], ['C#4', 4], ['B3', 6]], voice);

// Ice: glassy bowed metal, twice a loop.
s.note('metal', 14, 8, 'B3', { vel: 0.12, rev: 0.85, pan: 0.6, a: 3 });
s.note('metal', 34, 8, 'C4', { vel: 0.1, rev: 0.85, pan: -0.6, a: 3 });

export default s;
