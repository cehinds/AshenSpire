// Title — the main theme of Ashen Spire. D minor at 52 BPM, almost nothing
// moving: a soft organ holds the bare fifth D–A for the whole loop, low strings
// change chord once every few bars, and a solo cello sings one plain, falling
// line that stops on an open A. A single choir voice answers it once, from
// above, and the cello closes on D just before the loop turns over.
// Four layers: organ pedal, string pad, cello (lead), one choir voice (answer).
import { Score, chord } from '../../tools/score/compose.mjs';

export const context = 'title';

const s = new Score({ bpm: 52, bars: 16, seed: 3, reverb: { room: 0.92, damp: 0.4 }, gain: 0.9 });

// i (6 bars) – VI – iv – V(sus4) – i (4 bars). One chord per two bars or more.
const prog = [
  [chord('D2', 'm'), 6], [chord('Bb1', 'M', 1), 2], [chord('G1', 'm', 1), 2],
  [chord('A1', 'sus4'), 2], [chord('D2', 'm'), 4],
];

// Organ pedal: the open fifth, unbroken.
s.note('organ', 0, s.beats, 'D2', { stop: 'soft', vel: 0.34, rev: 0.4, a: 2, r: 3 });
s.note('organ', 0, s.beats, 'A2', { stop: 'soft', vel: 0.2, rev: 0.45, a: 2, r: 3 });

// Low strings, dark and quiet, one chord per 2–6 bars.
s.pad('strings', prog, { overlap: 0.3, note: { vel: 0.26, rev: 0.55, cut: 650, a: 2.5, r: 3 } });

// The theme, solo cello: rises a step, turns, and falls to an open A.
const cello = { note: { vel: 0.6, rev: 0.45, pan: -0.15, a: 0.5, r: 2 } };
s.line('cello', 4, [['A2', 2], ['D3', 3], ['E3', 1], ['F3', 4], ['E3', 2], ['D3', 2], ['C3', 2], ['A2', 6]], cello);

// The answer: one choir voice, once, over VI – iv – V.
s.line('choir', 28, [['F4', 3], ['E4', 1], ['D4', 4], ['Bb3', 4], ['A3', 8]],
  { legato: 1.05, note: { vowel: 'ah', vel: 0.32, rev: 0.6, pan: 0.2, a: 1.4, r: 3 } });

// The cello closes the arc on D.
s.line('cello', 48, [['A2', 2], ['D3', 4], ['C3', 2], ['D3', 6]], { note: { ...cello.note, vel: 0.52 } });

export default s;
