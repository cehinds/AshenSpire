// The Ashen Crown — the causeway to the Spire's summit, laid by the Ember;
// reached from any seat, belonging to none (docs/LORE.md). G minor, a slow
// procession toward something terrible: soft organ chords a whole four bars
// each, falling through the Neapolitan (Ab) instead of rising; one distant
// taiko stroke every two bars as the only step; and one lead — a lone "ah"
// voice that climbs a little and sinks back. A bell tolls once. Never triumphant.
// Original material (music/score/_STYLE.md).
import { Score, chord, n } from '../../tools/score/compose.mjs';

export const context = 'map-ashen-crown';

// 50 BPM, 16 bars of 4 = 64 beats ≈ 77 s.
const s = new Score({ bpm: 50, bars: 16, seed: 71, reverb: { room: 0.9, damp: 0.4 }, gain: 0.9 });

// Bed: organ chords over a low G pedal.
s.note('organ', 0, s.beats, 'G1', { stop: 'soft', vel: 0.36, rev: 0.3, a: 3, r: 4 });
s.pad('organ', [
  [chord('G2', 'm'), 4], [chord('Eb2', 'M', 1), 4], [chord('Ab2', 'M'), 4], [chord('D2', 'sus4'), 2], [[n('D2'), n('A2'), n('D3')], 2],
], { overlap: 0.1, spread: 0.6, note: { stop: 'full', vel: 0.2, rev: 0.5, a: 2, r: 2.5 } });

// The step: one far taiko stroke every two bars.
s.hits('taiko', 'G1', [0], { every: 2, note: { vel: 0.3, rev: 0.7, ring: 1.6 } });

// Lead: a lone "ah" voice.
const voice = { note: { vel: 0.55, rev: 0.6, vowel: 'ah', pan: -0.1, a: 1.2, r: 2.5 } };
s.line('choir', 2, [['D4', 4], ['Eb4', 4], ['D4', 8], [null, 4], ['C4', 3], ['Bb3', 1], ['A3', 8]], voice);
s.line('choir', 38, [['Bb3', 3], ['C4', 1], ['D4', 4], ['Eb4', 4], ['C4', 4], ['G3', 8]], voice);

// One toll per loop.
s.note('bell', 32, 1, 'G4', { vel: 0.12, rev: 0.85, pan: 0.5, ring: 9 });

export default s;
