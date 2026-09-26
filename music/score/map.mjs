// Fallback map — "slow, bleak wandering through ash" (music/PROMPTS.md). Plays
// in any region that has no track of its own. E minor over an E/B drone: low
// strings move through a phrygian F and back, a solo cello wanders and never
// quite comes home, a faint choir "oo" hangs above, and far bells and bowed
// metal mark the empty distance. No drums, never bright.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'map';

const s = new Score({ bpm: 56, bars: 18, seed: 23, reverb: { room: 0.9, damp: 0.5 }, gain: 0.9 });

// Harmony: i – VI – iv – v, then the ash turn through bII (F) before home.
const prog = [
  [chord('E2', 'm', 1), 2], [chord('C3', 'M'), 2], [chord('A2', 'm'), 2], [chord('B2', 'sus4'), 1], [chord('B2', 'm'), 1],
  [chord('E2', 'm', 1), 2], [chord('F2', 'M', 1), 2], [chord('A2', 'm'), 2], [chord('B2', 'm'), 2],
  [chord('E3', 'madd9'), 2],
];
s.note('drone', 0, s.beats, 'E2', { vel: 0.5, rev: 0.2 });
s.note('drone', 0, s.beats, 'B2', { vel: 0.22, rev: 0.2, cut: 300 });
s.pad('strings', prog, { note: { vel: 0.42, rev: 0.45, cut: 800 } });

// Choir: faint and high, a bare fifth that darkens with the F.
s.pad('choir', [[[n('E4'), n('B4')], 10], [[n('F4'), n('A4'), n('C5')], 2], [[n('E4'), n('G4'), n('B4')], 6]],
  { note: { vel: 0.2, rev: 0.7, vowel: 'oo' } });

// Cello: three wandering phrases; the last sinks to the fifth, not the tonic.
const cello = { note: { vel: 0.5, rev: 0.45, pan: -0.2 } };
s.line('cello', 6, [['B3', 4], ['C4', 2], ['B3', 1], ['A3', 1], ['G3', 4], ['F#3', 2], ['E3', 4]], cello);
s.line('cello', 32, [['E4', 3], ['D4', 1], ['C4', 2], ['B3', 2], ['A3', 3], ['G3', 1], ['F3', 4]], cello);
s.line('cello', 52, [['E3', 2], ['G3', 2], ['F#3', 3], ['D#3', 1], ['E3', 4], ['B2', 8]], cello);

// Far bells and bowed metal: the distance, not an event.
s.note('bell', 2, 1, 'B4', { vel: 0.12, rev: 0.85, pan: 0.55, ring: 9 });
s.note('bell', 30, 1, 'E5', { vel: 0.1, rev: 0.85, pan: -0.5, ring: 9 });
s.note('bell', 46, 1, 'F4', { vel: 0.11, rev: 0.85, pan: 0.4, ring: 9 });
s.note('metal', 16, 10, 'E3', { vel: 0.16, rev: 0.7, pan: 0.6 });
s.note('metal', 42, 12, 'Bb2', { vel: 0.15, rev: 0.7, pan: -0.6 });
s.note('metal', 62, 8, 'B2', { vel: 0.12, rev: 0.7, pan: 0.3 });

export default s;
