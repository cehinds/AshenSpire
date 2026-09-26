// The Hollow Weald — "growth without a Field Flame does not stop; it goes
// wrong" (docs/LORE.md). D aeolian, heavy and still: a damp organ drone, a
// wordless choir "oo" chord that sours into a cluster once per loop, and one
// lead — single harp notes, far apart, a few of them plucked slightly out of
// true. Bowed metal creaks like wood under strain. No drums.
// Original material (music/score/_STYLE.md).
import { Score, n } from '../../tools/score/compose.mjs';

export const context = 'map-hollow-weald';

// 48 BPM, 16 bars of 4 = 64 beats = 80 s.
const s = new Score({ bpm: 48, bars: 16, seed: 11, reverb: { room: 0.9, damp: 0.45 }, gain: 0.9 });

// Bed: soft organ pedal on D and A for the whole loop.
s.note('organ', 0, s.beats, 'D2', { stop: 'soft', vel: 0.34, rev: 0.35, a: 3, r: 4 });
s.note('organ', 0, s.beats, 'A2', { stop: 'soft', vel: 0.18, rev: 0.35, a: 3, r: 4 });
s.note('drone', 0, s.beats, 'D2', { vel: 0.32, rev: 0.2, cut: 280 });

// Choir "oo": one chord per four bars; the third one sours (E against F).
s.pad('choir', [
  [[n('D4'), n('F4'), n('A4')], 4], [[n('D4'), n('F4'), n('Bb4')], 4],
  [[n('E4'), n('F4'), n('A4')], 4], [[n('D4'), n('E4'), n('A4')], 4],
], { spread: 0.7, note: { vel: 0.24, rev: 0.65, vowel: 'oo', a: 3, r: 3 } });

// Lead: harp, single notes, long rings. Slightly flat notes where it goes wrong.
const harp = { note: { vel: 0.5, rev: 0.55, pan: 0.2, ring: 6 } };
const sour = (name) => n(name) - 0.18;
s.line('harp', 2, [['A4', 2], ['F4', 2], ['E4', 4], [null, 4], ['D4', 2], ['E4', 2], ['F4', 3], [sour('G4'), 1], ['E4', 6]], harp);
s.line('harp', 38, [['A4', 2], ['C5', 2], ['Bb4', 4], [null, 2], [sour('A4'), 2], ['G4', 2], ['F4', 2], ['E4', 4], ['D4', 8]], harp);

// Wood under strain: two low bowed-metal swells, and one distant bell.
s.note('metal', 12, 10, 'D3', { vel: 0.15, rev: 0.7, pan: 0.6, a: 3 });
s.note('metal', 44, 10, 'Ab2', { vel: 0.13, rev: 0.7, pan: -0.6, a: 3 });
s.note('bell', 30, 1, 'D5', { vel: 0.1, rev: 0.85, pan: 0.5, ring: 8 });

export default s;
