// The Drowned Coast — salt causeways and a grave of ships, where the Ashen
// Spire stands, the fourth tower, never lit (docs/LORE.md). F minor, a
// desolate tide: low strings that swell and ebb like slow waves (one long bow
// per chord), a drone under the water, and one lead — a solo cello lament in
// its high, grieving register. A bell-buoy tolls twice in the fog. No drums.
// Original material (music/score/_STYLE.md).
import { Score, chord } from '../../tools/score/compose.mjs';

export const context = 'map-drowned-coast';

// 50 BPM, 16 bars of 4 = 64 beats ≈ 77 s.
const s = new Score({ bpm: 50, bars: 16, seed: 53, reverb: { room: 0.95, damp: 0.5 }, gain: 0.9 });

// Bed: drone on F, and waves — each chord bowed in with a very slow attack.
s.note('drone', 0, s.beats, 'F1', { vel: 0.42, rev: 0.25, cut: 240 });
s.pad('strings', [
  [chord('F2', 'm'), 4], [chord('Db2', 'M'), 4], [chord('Bb1', 'm', 1), 4], [chord('C2', 'sus4'), 2], [chord('C2', 'm'), 2],
], { overlap: 0.5, spread: 0.9, note: { vel: 0.44, rev: 0.55, cut: 700, a: 5, r: 4.5 } });

// Lead: solo cello, high. One long lament in two breaths.
const cello = { note: { vel: 0.55, rev: 0.5, pan: 0.15 } };
s.line('cello', 4, [['C4', 4], ['Db4', 2], ['C4', 2], ['Ab3', 8], [null, 4], ['Bb3', 3], ['Ab3', 1], ['G3', 4]], cello);
s.line('cello', 36, [['F3', 3], ['G3', 1], ['Ab3', 4], ['C4', 4], ['Bb3', 2], ['Ab3', 2], ['G3', 8]], cello);

// The bell-buoy, out of step, far off.
s.note('bell', 18.5, 1, 'C5', { vel: 0.13, rev: 0.9, pan: 0.6, ring: 9 });
s.note('bell', 51, 1, 'F4', { vel: 0.12, rev: 0.9, pan: 0.45, ring: 9 });

export default s;
