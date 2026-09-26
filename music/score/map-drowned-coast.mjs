// The Drowned Coast — salt causeways and a grave of ships, where the Ashen
// Spire stands, the fourth tower, never lit (docs/LORE.md). A desolate tide in
// F minor: low strings that swell and ebb like waves (long bows, one per
// chord), a bell-buoy tolling out of step in the fog, a solo cello lament,
// a wordless "oo" choir drifting in and out, and bowed metal like wind.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'map-drowned-coast';

const s = new Score({ bpm: 50, bars: 16, seed: 53, reverb: { room: 0.95, damp: 0.5 }, gain: 0.9 });

// Tide: each chord is bowed as one long wave — slow attack, long release.
// i – VI – iv – v(m) with a Neapolitan Gb washing through.
const tide = [
  [chord('F2', 'm'), 2], [chord('Db2', 'M'), 2], [chord('Bb1', 'm', 1), 2], [chord('C2', 'm'), 2],
  [chord('F2', 'm'), 2], [chord('Gb2', 'M'), 2], [chord('Db2', 'M7'), 2], [chord('C2', 'sus4'), 1], [chord('C2', 'm'), 1],
];
s.pad('strings', tide, { overlap: 0.5, spread: 0.9, note: { vel: 0.5, rev: 0.5, cut: 700, a: 4.5, r: 4 } });
s.note('drone', 0, s.beats, 'F1', { vel: 0.4, rev: 0.25, cut: 240 });

// Swell accents: a lower wave under each two-bar chord, arriving late.
for (let bar = 0; bar < s.bars; bar += 2) {
  const root = [n('F1'), n('Db1'), n('Bb0'), n('C1'), n('F1'), n('Gb1'), n('Db1'), n('C1')][bar / 2];
  s.note('strings', bar * 4 + 1, 6, root + 12, { vel: 0.3, rev: 0.4, cut: 450, a: 4, r: 4, pan: (bar / 2) % 2 ? 0.4 : -0.4 });
}

// Bell-buoy: two pitches rocking, irregular, far out in the fog.
const buoy = [[3, 'C5'], [9.5, 'F4'], [19, 'C5'], [26, 'F4'], [34.5, 'C5'], [41, 'Ab4'], [50, 'C5'], [55.5, 'F4']];
buoy.forEach(([b, m], i) => s.note('bell', b, 1, m, { vel: 0.2, rev: 0.85, pan: i % 2 ? 0.65 : 0.45, ring: 9 }));

// Solo cello lament over the second half of each pass.
s.line('cello', 6, [['C4', 4], ['Db4', 2], ['C4', 2], ['Bb3', 3], ['Ab3', 1], ['G3', 4], ['Ab3', 2], ['F3', 6]],
  { note: { vel: 0.46, rev: 0.45, pan: -0.25, a: 0.8 } });
s.line('cello', 38, [['F4', 3], ['Eb4', 1], ['Db4', 4], ['C4', 2], ['Bb3', 2], ['Ab3', 4], ['G3', 2], ['E3', 2], ['F3', 4]],
  { note: { vel: 0.46, rev: 0.45, pan: -0.25, a: 0.8 } });

// Choir "oo" drifting in and out.
s.note('choir', 12, 12, 'Ab4', { vowel: 'oo', vel: 0.24, rev: 0.8, pan: 0.3, a: 5, r: 5 });
s.note('choir', 14, 10, 'C5', { vowel: 'oo', vel: 0.2, rev: 0.8, pan: -0.2, a: 5, r: 5 });
s.note('choir', 44, 12, 'Bb4', { vowel: 'oo', vel: 0.24, rev: 0.8, pan: -0.3, a: 5, r: 5 });
s.note('choir', 46, 10, 'Db5', { vowel: 'oo', vel: 0.2, rev: 0.8, pan: 0.2, a: 5, r: 5 });

// Wind: low-ish bowed metal, long and wide.
s.note('metal', 0, 12, 'F3', { vel: 0.18, rev: 0.8, pan: 0.8, a: 5 });
s.note('metal', 22, 12, 'Gb3', { vel: 0.16, rev: 0.8, pan: -0.8, a: 5 });
s.note('metal', 42, 12, 'C4', { vel: 0.16, rev: 0.8, pan: 0.7, a: 5 });

export default s;
