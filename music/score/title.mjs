// Title — the premise of Ashen Spire. D minor at 52 BPM, 16 bars (~74 s).
//
// Lore it carries (docs/LORE.md, premise and §1–§4): "You are a Forsaken."
// "The flames are cold. The cities are ash." A Forsaken is "a name nobody
// promised to the fire"; the written dead fed the Ember, and the Blight is "a
// name the fire has not quite finished reading". The Ember itself is "loose on
// the ring since, thin and starving".
//
// So the track is the Forsaken setting out alone, the dead answering, and the
// starving fire moving once, underneath, where you almost cannot hear it:
//   beat 2  FORSAKEN — solo cello, alone over nothing but a cold organ fifth
//           (the blank medallion: open fifth, a minor third lifted, settle).
//   beat 16 low strings enter; the kingdom's ash, one chord per 1–3 bars.
//   beat 22 NAMES — the choir answers, unfinished: A–G–F–E and the D never
//           comes (the reading not finished).
//   beat 36 EMBER — once, low in the organ pedal, under everything: D, the
//           semitone up to Eb that cannot hold, the tritone fall to A, back to D.
//   beat 50 the cello returns to its open fifth, D and A, and the loop turns.
// Four layers: organ (pedal / EMBER), strings, cello (the Forsaken), choir (NAMES).
import { Score, chord } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'title';

const s = new Score({ bpm: 52, bars: 16, seed: 3, reverb: { room: 0.92, damp: 0.4 }, gain: 0.9 });

// Organ: the cold fifth. A holds the whole loop; D holds until the Ember moves it.
const organ = { stop: 'soft', rev: 0.4, a: 2, r: 3 };
s.note('organ', 0, s.beats, 'A2', { ...organ, vel: 0.2, rev: 0.45 });
s.note('organ', 0, 37, 'D2', { ...organ, vel: 0.36 });
// EMBER, once, in the pedal (beats 36–60), then D again into the loop point.
const end = s.line('organ', 36, motif('D2', 'ember', { stretch: 2 }), { note: { ...organ, vel: 0.4 } });
s.note('organ', end, s.beats - end + 1, 'D2', { ...organ, vel: 0.36 });

// Low strings from bar 4, following the pedal: i – VI – iv – bII (under the Ember's Eb)
// – V(sus4) (under its A) – i.
s.pad('strings', [
  [chord('D2', 'm'), 3], [chord('Bb1', 'M', 1), 2], [chord('G1', 'm', 1), 1],
  [chord('Eb2', 'M'), 1.5], [chord('A1', 'sus4'), 1.5], [chord('D2', 'm'), 3],
], { from: 4, overlap: 0.3, note: { vel: 0.26, rev: 0.55, cut: 650, a: 2.5, r: 3 } });

// FORSAKEN, the cello alone.
const cello = { vel: 0.6, rev: 0.45, pan: -0.15, a: 0.5, r: 2 };
s.line('cello', 2, motif('D3', 'forsaken', { stretch: 4 / 3 }), { note: cello });

// NAMES, the choir's answer, unfinished.
s.line('choir', 22, motif('D4', 'names', { stretch: 2, unfinished: true }),
  { legato: 1.05, note: { vowel: 'ah', vel: 0.32, rev: 0.6, pan: 0.2, a: 1.4, r: 3 } });

// The cello's open fifth again, closing the loop.
s.line('cello', 50, [['A2', 4], ['D3', 8]], { note: { ...cello, vel: 0.5 } });

export default s;
