// The Ashen Crown — the causeway to the Spire's summit, laid by the Ember;
// reached from any seat, belonging to none (docs/LORE.md). A slow procession
// toward something terrible in G minor: a measured frame drum on every
// step, organ chords that fall through the Neapolitan (Ab) instead of rising,
// a full "ah" choir that climbs and sinks back each phrase, a cello over
// brass-like low strings, and a bell tolling the march. Solemn dread; the
// dominant is always answered by a darker chord, never by triumph.
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'map-ashen-crown';

const s = new Score({ bpm: 54, bars: 18, seed: 71, reverb: { room: 0.9, damp: 0.4 }, gain: 0.9 });

// Harmony, two bars a chord at the procession's pace.
const prog = [
  [chord('G2', 'm'), 2], [chord('Eb2', 'M'), 2], [chord('C3', 'm', 1), 2], [chord('D2', 'sus4'), 1], [chord('D2', 'M'), 1],
  [chord('G2', 'm'), 2], [chord('Ab2', 'M'), 2], [chord('F2', 'm'), 2], [chord('D2', 'dim'), 1], [chord('D2', 'M'), 1],
  [chord('G2', 'm'), 2],
];
// Organ chords (full stop, but held low and soft), plus low pedal.
s.pad('organ', prog, { overlap: 0.1, spread: 0.6, note: { stop: 'full', vel: 0.26, rev: 0.45, a: 1.2, r: 2 } });
s.note('drone', 0, s.beats, 'G1', { vel: 0.4, rev: 0.2, cut: 300 });

// Brass-like low strings: the same chords an octave down, brighter bow.
s.pad('strings', prog.map(([c, l]) => [[c[0] - 12, c[0] - 5], l]), { note: { vel: 0.38, rev: 0.35, cut: 1500, a: 1.6 } });

// The procession: frame drum on beats 1 and 3, a ghost before each step.
s.hits('frame', 'G2', [0, 2], { accent: [0], note: { vel: 0.5, rev: 0.5, pan: 0.1 } });
s.hits('frame', 'D2', [3.5], { every: 2, note: { vel: 0.22, rev: 0.5, pan: -0.1 } });

// Bell tolling at each chord change, low and distant.
for (let bar = 0; bar < s.bars; bar += 2) {
  s.note('bell', bar * 4, 1, bar % 8 === 6 ? 'D4' : 'G3', { vel: 0.2, rev: 0.75, pan: -0.45, ring: 8 });
}

// Choir "ah": each phrase rises by step and sinks back further than it began.
const rise = (from, voices) => voices.forEach(([m, pan]) => s.note('choir', from, 8.5, m, { vowel: 'ah', vel: 0.2, rev: 0.65, pan, a: 2.5, r: 3 }));
const phrase = [
  [0, [['G3', -0.4], ['D4', 0], ['Bb4', 0.4]]],
  [8, [['G3', -0.4], ['Eb4', 0], ['Bb4', 0.4]]],
  [16, [['G3', -0.4], ['Eb4', 0], ['C5', 0.4]]],
  [24, [['F#3', -0.4], ['D4', 0], ['A4', 0.4]]],
  [32, [['G3', -0.4], ['D4', 0], ['Bb4', 0.4]]],
  [40, [['Ab3', -0.4], ['Eb4', 0], ['C5', 0.4]]],
  [48, [['F3', -0.4], ['C4', 0], ['Ab4', 0.4]]],
  [56, [['F#3', -0.4], ['C4', 0], ['A4', 0.4]]],
  [64, [['G3', -0.4], ['D4', 0], ['Bb4', 0.4]]],
];
for (const [b, v] of phrase) rise(b, v);

// Cello over the strings: a narrow, falling lament.
s.line('cello', 8, [['Bb3', 3], ['C4', 1], ['D4', 4], ['Eb4', 3], ['D4', 1], ['C4', 2], ['A3', 2], ['D4', 8]],
  { note: { vel: 0.44, rev: 0.4, pan: 0.3 } });
s.line('cello', 40, [['Eb4', 3], ['D4', 1], ['C4', 4], ['Ab3', 3], ['G3', 1], ['F3', 4], ['F#3', 4], ['G3', 8]],
  { note: { vel: 0.44, rev: 0.4, pan: 0.3 } });

export default s;
