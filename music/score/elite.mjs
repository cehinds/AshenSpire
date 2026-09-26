// Elite — a harder fight. A minor at 120 BPM, heavier and sourer than combat:
// the taiko fills every eighth, staccato low strings bark like brass, the
// harmony leans on the flat second (Bb) and the tritone (Eb), the choir's "ah"
// arrives urgent and short-breathed, and a low bell tolls every other bar.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'elite';

const s = new Score({ bpm: 120, bars: 30, seed: 41, reverb: { room: 0.82, damp: 0.38 }, gain: 0.95 });

// Harmony, 6 bars: i – bII – i – bV (tritone) – iv – V.
const prog = [
  [chord('A2', 'm'), 1], [chord('Bb2', 'M'), 1], [chord('A2', 'm'), 1],
  [[n('Eb3'), n('G3'), n('Bb3')], 1], [chord('D3', 'm'), 1], [chord('E2', 'M'), 1],
];
const roots = ['A1', 'Bb1', 'A1', 'Eb2', 'D2', 'E1'];

s.note('drone', 0, s.beats, 'A1', { vel: 0.35, rev: 0.15, cut: 300 });
s.note('drone', 0, s.beats, 'E2', { vel: 0.18, rev: 0.15, cut: 260 });

// Staccato low strings, brass-like: root stabs in a 3+3+2 pattern with octaves.
for (let bar = 0; bar < s.bars; bar++) {
  const r = n(roots[bar % 6]);
  const fig = [[0, 0], [0.5, 0], [1.5, 12], [2, 0], [2.5, 0], [3, 1], [3.5, 12]];
  for (const [b, iv] of fig) {
    s.note('strings', bar * 4 + b, 0.28, r + 12 + iv, { vel: b % 1.5 === 0 ? 0.58 : 0.44, a: 0.01, r: 0.12, cut: 1500, rev: 0.12, pan: -0.2 });
    s.note('cello', bar * 4 + b, 0.26, r + iv, { vel: 0.3, a: 0.01, r: 0.1, cut: 800, rev: 0.1, pan: 0.15 });
  }
}

// Denser drums: taiko eighths with low accents, frame sixteenths on the backbeat.
s.hits('taiko', 'D2', [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], { accent: [0, 1.5, 3], note: { vel: 0.6, rev: 0.1, pan: -0.1 } });
s.hits('taiko', 'A1', [0, 2], { note: { vel: 0.6, rev: 0.12, decay: 4 } });
s.hits('frame', 'A2', [1, 1.25, 3, 3.25, 3.75], { accent: [1, 3], note: { vel: 0.48, rev: 0.1, pan: 0.4 } });

// Urgent choir: short-breathed "ah" pulses on each bar, a fifth and the b2 above.
for (let bar = 0; bar < s.bars; bar++) {
  const [a, b, c] = prog[bar % 6][0];
  for (const [k, m] of [[0, a + 12], [1, b + 12], [2, c + 12]]) {
    s.note('choir', bar * 4, 3.3, m, { vel: 0.2, vowel: 'ah', a: 0.25, r: 0.9, rev: 0.45, pan: (k - 1) * 0.4 });
  }
}
// A high held cry in the second half of each six-bar phrase, leaning on Bb.
for (let bar = 0; bar < s.bars; bar += 6) {
  s.line('choir', (bar + 3) * 4, [['Bb4', 4], ['A4', 4], ['G#4', 4]], { note: { vel: 0.16, vowel: 'ah', a: 0.6, r: 1.2, rev: 0.55 } });
}

// Tolling bell every other bar, and dissonant bowed metal on the tritone.
for (let bar = 0; bar < s.bars; bar += 2) s.note('bell', bar * 4, 1, bar % 6 === 4 ? 'Eb4' : 'A3', { vel: 0.16, rev: 0.45, pan: 0.5, ring: 4 });
for (let bar = 3; bar < s.bars; bar += 6) {
  s.note('metal', bar * 4, 4, 'Eb3', { vel: 0.14, rev: 0.5, pan: -0.6, a: 0.8 });
  s.note('metal', bar * 4 + 2, 4, 'A3', { vel: 0.1, rev: 0.5, pan: 0.6, a: 0.8 });
}

export default s;
