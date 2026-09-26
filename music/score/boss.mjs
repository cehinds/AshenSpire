// Boss — the tower's keeper. G minor at 126 BPM, doom held at one height: a
// full-organ pedal under everything, a racing sixteenth string ostinato,
// taiko pounding every beat, and the full choir chanting a four-bar "ah"
// motif over its own sustained chords, while bells toll the phrase heads. The
// intensity is constant: no drop-outs and no sudden peaks.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'boss';

const s = new Score({ bpm: 126, bars: 40, seed: 67, reverb: { room: 0.85, damp: 0.4 }, gain: 0.95 });

// Harmony, 8 bars: i – VI – iv – V, then i – bII – VI – V.
const prog = [
  [chord('G2', 'm'), 1], [chord('Eb3', 'M', 2), 1], [chord('C3', 'm', 1), 1], [chord('D3', 'M'), 1],
  [chord('G2', 'm'), 1], [chord('Ab2', 'M'), 1], [chord('Eb3', 'M', 2), 1], [chord('D3', 'M'), 1],
];
const roots = ['G1', 'Eb1', 'C2', 'D2', 'G1', 'Ab1', 'Eb1', 'D2'];

// Full-organ pedal: root and fifth per bar, legato.
for (let bar = 0; bar < s.bars; bar++) {
  const r = n(roots[bar % 8]);
  s.note('organ', bar * 4, 4.05, r, { stop: 'full', vel: 0.34, rev: 0.4, a: 0.15, r: 0.6 });
  s.note('organ', bar * 4, 4.05, r + 7, { stop: 'full', vel: 0.18, rev: 0.4, a: 0.15, r: 0.6 });
}

// Racing string ostinato: sixteenths, root–fifth–octave–fifth with the b2 on 4.
for (let bar = 0; bar < s.bars; bar++) {
  const r = n(roots[bar % 8]) + 24;
  const fig = [0, 7, 12, 7, 0, 7, 12, 13, 0, 7, 12, 7, 0, 3, 7, 3];
  fig.forEach((iv, k) => s.note('strings', bar * 4 + k * 0.25, 0.2, r + iv,
    { vel: k % 4 === 0 ? 0.42 : 0.3, a: 0.008, r: 0.08, cut: 1700, rev: 0.15, pan: k % 2 ? 0.3 : -0.3 }));
}

// Pounding taiko on every beat, a lower drum on 1 and 3, frame drum eighths between.
s.hits('taiko', 'D2', [0, 1, 2, 3], { accent: [0, 2], note: { vel: 0.66, rev: 0.12 } });
s.hits('taiko', 'G1', [0, 2.5], { note: { vel: 0.55, rev: 0.12, decay: 4, pan: -0.15 } });
s.hits('frame', 'A2', [0.5, 1.5, 2.5, 3.5, 3.75], { accent: [1.5, 3.5], note: { vel: 0.45, rev: 0.1, pan: 0.35 } });

// Choir: sustained "ah" chords throughout (an octave up)...
s.pad('choir', prog.map(([ns, len]) => [ns.map((m) => m + 12), len]), { overlap: 0.1, note: { vel: 0.17, rev: 0.5, vowel: 'ah', a: 0.5 } });
// ...and the chant motif, unison with a fifth below, four bars on, four answering.
const chant = [['G4', 1], ['G4', 1], ['A4', 1], ['Bb4', 1], ['Bb4', 2], ['G4', 2], ['Bb4', 1], ['C5', 1], ['D5', 2], ['Eb5', 1], ['D5', 1], ['C5', 1], ['A4', 1]];
const reply = [['D5', 2], ['Bb4', 2], ['C5', 1], ['Eb5', 1], ['C5', 1], ['Ab4', 1], ['G4', 2], ['Bb4', 2], ['A4', 1], ['F#4', 1], ['A4', 2]];
for (let bar = 0; bar < s.bars; bar += 8) {
  for (const [shift, v] of [[0, 0.24], [-7, 0.15]]) {
    s.line('choir', bar * 4, chant.map(([m, l]) => [n(m) + shift, l]), { legato: 1.05, note: { vel: v, vowel: 'ah', a: 0.12, r: 0.5, rev: 0.45 } });
    s.line('choir', (bar + 4) * 4, reply.map(([m, l]) => [n(m) + shift, l]), { legato: 1.05, note: { vel: v, vowel: 'ah', a: 0.12, r: 0.5, rev: 0.45 } });
  }
}

// Tolling bells at every phrase head, low and high.
for (let bar = 0; bar < s.bars; bar += 4) {
  s.note('bell', bar * 4, 1, bar % 8 ? 'D4' : 'G3', { vel: 0.18, rev: 0.45, pan: -0.45, ring: 5 });
  s.note('bell', bar * 4 + 2, 1, 'G4', { vel: 0.1, rev: 0.5, pan: 0.45, ring: 4 });
}
// Bowed metal on the Ab bars.
for (let bar = 5; bar < s.bars; bar += 8) s.note('metal', bar * 4, 4, 'Ab2', { vel: 0.12, rev: 0.5, pan: 0.6, a: 1 });

export default s;
