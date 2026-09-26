// The Pale Marches — the Citadel's bridges froze the night the Court Flame
// died (docs/LORE.md). Frozen and hollow: a low B string pedal that never
// moves, glassy bowed metal and high thin strings held on open fifths and
// seconds, harp harmonics that crack like lake ice, and a thin "ah" choir very
// far away. Harmony is almost static — cold, silent law. No drums.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'map-pale-marches';

const s = new Score({ bpm: 52, bars: 18, seed: 23, reverb: { room: 0.93, damp: 0.2 }, gain: 0.85 });

// The pedal: low strings and drone on B, never leaving.
s.note('drone', 0, s.beats, 'B1', { vel: 0.5, rev: 0.25, cut: 320 });
s.pad('strings', [[[n('B1'), n('F#2')], 18]], { note: { vel: 0.4, rev: 0.4, cut: 600, a: 3 } });

// High thin strings (a bright filter stands in for sul ponticello): open
// fifths and bare seconds that shift by one note at a time.
const high = [
  [[n('F#5'), n('B5'), n('C#6')], 3],
  [[n('F#5'), n('A5'), n('D6')], 3],
  [[n('E5'), n('G5'), n('B5')], 3],
  [[n('E5'), n('F#5'), n('C6')], 3],   // the C natural: a Phrygian chill
  [[n('D5'), n('F#5'), n('B5')], 3],
  [[n('C#5'), n('F#5'), n('B5')], 3],
];
s.pad('strings', high, { overlap: 0.5, spread: 1.2, note: { vel: 0.14, rev: 0.75, cut: 5200, a: 3.5, r: 3.5 } });

// Mid strings: a hollow Bm – Gmaj7 – Em – F#sus4 underlay, very soft.
s.pad('strings', [
  [chord('B2', 'five'), 3], [[n('G2'), n('D3'), n('F#3')], 3], [chord('E3', 'm'), 3],
  [[n('C3'), n('G3'), n('B3')], 3], [chord('B2', 'm'), 3], [chord('F#2', 'sus4'), 3],
], { note: { vel: 0.22, rev: 0.5, cut: 800, a: 2.5 } });

// Glassy bowed metal: the signature — high plates swelling on the fifths.
const metal = [[0, 'B4', 0.6], [12, 'F#5', -0.6], [24, 'C#5', 0.5], [36, 'B4', -0.5], [48, 'D5', 0.6], [60, 'F#4', -0.4]];
for (const [b, m, pan] of metal) s.note('metal', b + 1, 9, m, { vel: 0.2, rev: 0.8, pan, a: 4 });

// Harp harmonics: single high plucks, heavily damped, scattered like ice
// cracking — an octave pair now and then, never a tune.
const ice = [[2.5, 'B6'], [7, 'F#6'], [11.5, 'C#7'], [17, 'B6'], [18, 'F#6'], [26.5, 'D7'], [31, 'A6'],
  [38.5, 'B6'], [43, 'E7'], [44, 'B6'], [51.5, 'F#6'], [58, 'C#7'], [62.5, 'B6'], [67, 'F#6'], [70.5, 'C#7']];
ice.forEach(([b, m], i) => s.note('harp', b, 1, m, { vel: 0.3, rev: 0.85, pan: i % 2 ? -0.7 : 0.7, ring: 2.2, damp: 0.985, nudge: (i % 3) * 0.04 }));

// A thin choir "ah", far away: two voices on a bare fifth, then a second.
s.note('choir', 8, 14, 'F#4', { vowel: 'ah', vel: 0.14, rev: 0.9, pan: -0.3, a: 4, r: 4 });
s.note('choir', 10, 12, 'B4', { vowel: 'ah', vel: 0.12, rev: 0.9, pan: 0.3, a: 4, r: 4 });
s.note('choir', 44, 14, 'D5', { vowel: 'ah', vel: 0.12, rev: 0.9, pan: 0.3, a: 4, r: 4 });
s.note('choir', 46, 12, 'C#5', { vowel: 'ah', vel: 0.12, rev: 0.9, pan: -0.3, a: 4, r: 4 });

export default s;
