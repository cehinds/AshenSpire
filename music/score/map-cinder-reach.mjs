// The Cinder Reach — where the Ember was mined; "it did not burn in the
// Burning: it was already burning" (docs/LORE.md). Smouldering and
// subterranean in C Phrygian: a deep organ pedal on C, low strings grinding
// on the flat second (C against Db), a taiko heartbeat very far back, bowed
// metal shimmering like heat haze, and a low choir humming "mm". Menacing and
// patient — nothing hurries, nothing resolves upward.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'map-cinder-reach';

const s = new Score({ bpm: 60, bars: 20, seed: 37, reverb: { room: 0.88, damp: 0.6 }, gain: 0.9 });

// Deep organ pedal: C1 + C2 soft stop for the whole loop, a G joining halfway.
s.note('organ', 0, s.beats, 'C2', { stop: 'soft', vel: 0.45, rev: 0.35, a: 3, r: 4 });
s.note('organ', 0, s.beats, 'C1', { stop: 'soft', vel: 0.35, rev: 0.3, a: 3, r: 4 });
s.note('drone', 0, s.beats, 'C2', { vel: 0.35, rev: 0.2, cut: 260 });

// Grinding low strings: Phrygian motion that keeps leaning on Db.
const grind = [
  [[n('C2'), n('G2'), n('Db3')], 4],
  [[n('Db2'), n('Ab2'), n('C3')], 4],
  [[n('Bb1'), n('F2'), n('Db3')], 4],   // bbm over the pedal
  [[n('C2'), n('Gb2'), n('Db3')], 2],   // the tritone smoulders
  [[n('C2'), n('G2'), n('C3')], 2],
  [[n('Ab1'), n('Eb2'), n('C3')], 2],
  [[n('Db2'), n('Ab2'), n('Db3')], 2],
];
s.pad('strings', grind, { note: { vel: 0.42, rev: 0.4, cut: 650, a: 2.2 } });

// Taiko heartbeat, far back: lub-dub each bar, the second softer.
for (let bar = 0; bar < s.bars; bar++) {
  s.note('taiko', bar * 4, 0.5, 'C2', { vel: 0.4, rev: 0.75, ring: 1.6, decay: 3.5, skin: 500 });
  s.note('taiko', bar * 4 + 0.75, 0.5, 'G1', { vel: 0.26, rev: 0.75, ring: 1.4, decay: 4, skin: 450 });
}

// Low male choir hum, "mm": a Db–C sigh that repeats.
const hum = [[[n('C3'), n('G3')], 4], [[n('Db3'), n('Ab3')], 4], [[n('Bb2'), n('F3')], 4], [[n('C3'), n('Gb3')], 4], [[n('C3'), n('G3')], 4]];
s.pad('choir', hum, { spread: 0.8, note: { vowel: 'mm', vel: 0.3, rev: 0.55, a: 2.5, r: 3 } });

// Heat haze: bowed metal high and slow, alternating sides.
const haze = [[0, 'Db5', 0.7], [14, 'G4', -0.7], [28, 'C5', 0.6], [42, 'Gb4', -0.6], [56, 'Db5', 0.7], [68, 'Ab4', -0.6]];
for (const [b, m, pan] of haze) s.note('metal', b + 2, 10, m, { vel: 0.17, rev: 0.75, pan, a: 4 });

// A low organ figure surfacing twice, the flat second rising and falling back.
s.line('organ', 24, [['C3', 3], ['Db3', 3], ['C3', 2], ['Bb2', 4], ['C3', 4]], { note: { stop: 'soft', vel: 0.22, rev: 0.5, pan: -0.3 } });
s.line('organ', 56, [['G3', 3], ['Ab3', 3], ['G3', 2], ['F3', 2], ['Eb3', 2], ['Db3', 4]], { note: { stop: 'soft', vel: 0.2, rev: 0.5, pan: 0.3 } });

export default s;
