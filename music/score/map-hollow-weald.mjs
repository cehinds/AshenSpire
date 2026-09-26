// The Hollow Weald — the Field Flame's region, stuck.
//
// Lore it carries (docs/LORE.md):
//   §4  "the weald in a spring that will not turn"
//   §1  the Field Flame kept "the seasons turning on time. Its bell told the weald the hour."
//   §6  the Bell Keeper: "The bell is cracked and the dawn does not come, and he rings it anyway."
//   §6  the Grave of the Nameless on the weald road: "the graves of Forsaken who
//       climbed before you and were never written into memory."
//
// How it sounds (music/score/_STYLE.md, lore table): D aeolian, 48 BPM. The choir
// "oo" chords try to turn — Dm lifts to Bb for one bar, four times a loop — and
// every time fall back to Dm: the season that will not turn. Late in the loop a
// cracked bell tolls an hour (three strokes) and stops short of the count.
//
// Motifs (music/score/_motifs.mjs):
//   FORSAKEN — solo cello, beat 16 (bar 5), D3–A3–C4–A3: the Grave of the Nameless.
//   NAMES    — one choir voice, beat 32 (bar 9), A4–G4–F4–E4, unfinished; the
//              missing D would fall on beat 44, exactly where the harmony tries to
//              turn again — the name and the season both stall.
// Four layers: organ/drone pedal, choir chords, cello (lead) / choir voice, bell.
// Original material.
import { Score, n } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'map-hollow-weald';

// 48 BPM, 16 bars of 4 = 64 beats = 80 s.
const s = new Score({ bpm: 48, bars: 16, seed: 11, reverb: { room: 0.9, damp: 0.45 }, gain: 0.9 });

// Bed: soft organ pedal on D and A, and a low drone, for the whole loop.
s.note('organ', 0, s.beats, 'D2', { stop: 'soft', vel: 0.34, rev: 0.35, a: 3, r: 4 });
s.note('organ', 0, s.beats, 'A2', { stop: 'soft', vel: 0.18, rev: 0.35, a: 3, r: 4 });
s.note('drone', 0, s.beats, 'D2', { vel: 0.3, rev: 0.2, cut: 280 });

// The spring that will not turn: Dm for three bars, one bar reaching for Bb,
// and back to Dm. Four times; the loop ends on the reach and falls into bar 1.
const Dm = [n('D4'), n('F4'), n('A4')];
const Bb = [n('D4'), n('F4'), n('Bb4')];
s.pad('choir', [[Dm, 3], [Bb, 1]], { spread: 0.7, note: { vel: 0.26, rev: 0.65, vowel: 'oo', a: 2.5, r: 3 } });

// FORSAKEN on the cello, once, over Dm: the Nameless on the weald road.
s.line('cello', 16, motif('D3', 'forsaken'), { note: { vel: 0.55, rev: 0.5, pan: -0.15 } });

// NAMES in one choir voice, unfinished — the last note never sung.
s.line('choir', 32, motif('D4', 'names', { stretch: 1.5, unfinished: true }),
  { legato: 1.05, note: { vowel: 'ah', vel: 0.36, rev: 0.65, pan: 0.2, a: 1.2, r: 3 } });

// The cracked bell tells the hour: three strokes, and the count stops short.
const cracked = n('D4') - 0.22;
for (const b of [50, 53, 56]) s.note('bell', b, 1, cracked, { vel: 0.16, rev: 0.8, pan: 0.45, ring: 8 });

export default s;
