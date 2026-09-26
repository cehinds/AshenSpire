// Victory — the run is cleared, and the kingdom is still ash. C major at 82
// BPM, a hymn rather than a fanfare: soft organ and strings in chorale
// voicing, the choir's "ah" rising a phrase at a time, the mixolydian Bb and
// the lydian D major keeping the gold bittersweet, bells ringing slowly over
// it. It closes on the C it opened with, so the loop turns over without a seam.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'victory';

const s = new Score({ bpm: 82, bars: 20, seed: 89, reverb: { room: 0.9, damp: 0.35 }, gain: 0.9 });

// Hymn harmony, 20 bars: I – IV – bVII – I | vi – IV – II – V(sus) – V | I – v – IV – bVII – IV – V(sus) – I.
const prog = [
  [chord('C3', 'M'), 2], [chord('F3', 'M', 2), 1], [chord('Bb2', 'M', 1), 1], [chord('C3', 'M'), 2],
  [chord('A2', 'm', 1), 2], [chord('F2', 'M', 1), 1], [chord('D3', 'M'), 1], [chord('G2', 'sus4', 1), 1], [chord('G2', 'M', 1), 1],
  [chord('C3', 'M'), 1], [chord('G2', 'm', 1), 1], [chord('F3', 'M', 2), 1], [chord('Bb2', 'M', 1), 1], [chord('F2', 'M', 1), 1], [chord('G2', 'sus4', 1), 1],
  [chord('C3', 'add9'), 2],
];
const bass = ['C2', 'C2', 'F1', 'Bb1', 'C2', 'C2', 'A1', 'A1', 'F1', 'D2', 'G1', 'G1', 'C2', 'G1', 'F1', 'Bb1', 'F1', 'G1', 'C2', 'C2'];

s.pad('organ', prog, { overlap: 0.1, note: { stop: 'soft', vel: 0.26, rev: 0.5, a: 0.5, r: 1.2 } });
s.pad('strings', prog.map(([ns, l]) => [ns.map((m) => m + 12), l]), { overlap: 0.2, note: { vel: 0.26, rev: 0.55, cut: 1500 } });
bass.forEach((m, bar) => s.note('cello', bar * 4, 4.1, m, { vel: 0.34, rev: 0.4, pan: -0.2, a: 0.5, r: 1.4 }));

// Rising choir hymn: four-bar phrases, each climbing past the last, then home.
const hymn = [
  ['E4', 2], ['G4', 2], ['A4', 2], ['G4', 2], ['F4', 2], ['A4', 2], ['Bb4', 2], ['F4', 2],
  ['G4', 2], ['C5', 2], ['D5', 2], ['C5', 2], ['E5', 2], ['C5', 2], ['B4', 2], ['A4', 2],
  ['A4', 2], ['C5', 2], ['D5', 2], ['A4', 2], ['C5', 2], ['D5', 2], ['B4', 4],
  ['E5', 2], ['D5', 2], ['Bb4', 2], ['D5', 2], ['C5', 2], ['A4', 2], ['Bb4', 2], ['F4', 2],
  ['A4', 2], ['C5', 2], ['D5', 1], ['C5', 1], ['D5', 2], ['C5', 8],
];
s.line('choir', 0, hymn, { legato: 1.05, note: { vel: 0.24, vowel: 'ah', a: 0.7, r: 1.6, rev: 0.55, pan: 0.1 } });
// Beneath it the rest of the choir swells on the chords, an octave up.
s.pad('choir', prog.map(([ns, l]) => [ns.map((m) => m + 12), l]), { overlap: 0.15, note: { vel: 0.1, vowel: 'ah', a: 1.4, rev: 0.6 } });

// Bells ringing slowly: a pair at each phrase head, one soft chime between.
for (let bar = 0; bar < s.bars; bar += 4) {
  s.note('bell', bar * 4, 1, 'C5', { vel: 0.14, rev: 0.6, pan: 0.45, ring: 7 });
  s.note('bell', bar * 4 + 1.5, 1, 'G4', { vel: 0.1, rev: 0.6, pan: -0.45, ring: 6 });
  s.note('bell', (bar + 2) * 4, 1, 'E5', { vel: 0.07, rev: 0.65, pan: 0.2, ring: 6 });
}

// Harp, very light: rising broken chords at each phrase's second bar.
for (let bar = 1; bar < s.bars; bar += 4) {
  const ch = prog.reduce((acc, [ns, l]) => { for (let k = 0; k < l; k++) acc.push(ns); return acc; }, [])[bar];
  s.line('harp', bar * 4, [...ch, ch[0] + 12].map((m) => [m + 12, 0.5]), { note: { vel: 0.22, rev: 0.5, pan: 0.35, ring: 3 } });
}

export default s;
