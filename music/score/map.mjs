// Fallback map — "slow, bleak wandering through ash" (music/PROMPTS.md). Plays
// in any region that has no track of its own. E aeolian, as simple as it can
// be: a low E/B drone, a hushed string chord changing every four bars, and one
// solo cello line with long silences between its two phrases. A far bell and a
// bowed-metal swell mark the empty distance. No drums, never bright.
// Original material (music/score/_STYLE.md).
import { Score, chord } from '../../tools/score/compose.mjs';

export const context = 'map';

// 52 BPM, 16 bars of 4 = 64 beats ≈ 74 s.
const s = new Score({ bpm: 52, bars: 16, seed: 23, reverb: { room: 0.92, damp: 0.5 }, gain: 0.9 });

// Bed: drone on E with a faint fifth, and a quiet string chord every four bars.
s.note('drone', 0, s.beats, 'E2', { vel: 0.5, rev: 0.2 });
s.note('drone', 0, s.beats, 'B2', { vel: 0.2, rev: 0.2, cut: 300 });
s.pad('strings', [
  [chord('E2', 'm', 1), 4], [chord('C3', 'M'), 4], [chord('A2', 'm'), 4], [chord('B2', 'sus4'), 2], [chord('B2', 'm'), 2],
], { note: { vel: 0.36, rev: 0.5, cut: 750, a: 3, r: 3 } });

// Lead: solo cello. Two phrases, then air. The first falls to the second
// degree and hangs; the second sinks to the fifth, never home.
const cello = { note: { vel: 0.55, rev: 0.45, pan: -0.15 } };
s.line('cello', 4, [['B3', 3], ['C4', 1], ['B3', 4], [null, 4], ['A3', 3], ['G3', 1], ['F#3', 8]], cello);
s.line('cello', 36, [['G3', 3], ['A3', 1], ['B3', 4], ['E4', 6], ['D4', 2], ['C4', 4], ['B3', 8]], cello);

// Distance: one bell, one bowed-metal swell per loop.
s.note('bell', 26, 1, 'E5', { vel: 0.12, rev: 0.85, pan: 0.55, ring: 8 });
s.note('metal', 50, 8, 'B2', { vel: 0.14, rev: 0.75, pan: -0.5, a: 3 });

export default s;
