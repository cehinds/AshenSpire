// Title — the premise of Ashen Spire, built on top of the game's own title music.
//
// In-game variant: title #0 (D, 'calm' minor pentatonic, 2600 ms a note,
// triangle, lift 3) → 23.08 BPM (one beat = one in-game note), D root.
// 8 bars of 4 = 32 beats ≈ 83 s.
//
// Lore it carries (docs/LORE.md, premise and §1–§4): "You are a Forsaken."
// "The flames are cold. The cities are ash." A Forsaken is "a name nobody
// promised to the fire"; the Blight is "a name the fire has not quite finished
// reading". So: the kingdom remembered and put out, the pulse of the world
// going on regardless, the climber setting out alone, the dead answering.
//
// The floor (inGameBeat): the current build's title bed note for note — the
// triangle walk, its fifth, the game drone — plus the strong cello bass on D
// every fourth step. Everything below sits on top of it, in D calm.
//   beat 1      GOLDBOUGH — snuffed(), cello, in the key's own major (F, the
//               relative major): F4–A4–C5–D5–C5–E5, pinched out before the F5.
//   beats 7–14  no lead: the kingdom went out; the game's walk goes on.
//   beat 14     FORSAKEN — cello, alone above the walk: D4–A4–C5–A4.
//   beat 21     NAMES — the choir answers quietly, unfinished: A4–G4–F4–E4, and
//               the D never comes (the reading not finished).
//   beats 29–32 the floor alone into the loop.
// Added layers: cello lead, choir (the one extra layer). EMBER is no longer
// quoted here (the organ it lived in is gone).
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'title';
const v = 0;
const g = ingame(context, v);

const s = new Score({ bpm: g.bpm, bars: 8, seed: 3, reverb: { room: 0.9, damp: 0.4 }, gain: 0.9 });

// The floor: the game's own title bed, the whole loop.
inGameBeat(s, context, { variant: v });

const lead = g.root + 12; // D4

// GOLDBOUGH, once, in the relative major, snuffed out.
snuffed(s, 1, lead + 3, { stretch: 0.75, vel: 0.58 });

// FORSAKEN, after the silence.
s.line('cello', 14, motif(lead, 'forsaken', { stretch: 0.5 }),
  { note: { vel: 0.6, rev: 0.45, pan: -0.15, a: 0.5, r: 1.5 } });

// NAMES, the choir's answer, quiet and unfinished.
s.line('choir', 21, motif(lead, 'names', { unfinished: true }),
  { legato: 1.05, note: { vowel: 'ah', vel: 0.2, rev: 0.6, pan: 0.2, a: 1.2, r: 2.5 } });

export default s;
