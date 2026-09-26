// The Cinder Reach — the Crown Flame's region, where the Ember came from.
//
// Lore it carries (docs/LORE.md):
//   §1  the Crown Flame kept "The dead. Names written and kept, and the
//       Sovereign Ember itself, fed in the crown until the night it left."
//   §2  "at death your name was *written* into the Crown Flame, and the writing
//       was the fuel."
//   §6  "the Ember was mined here before it was worshipped"; the Furnace Saint
//       "is still feeding a hearth with nothing in it."
//
// Floor (music/score/_STYLE.md, "Direction now"): the current build's map bed,
// VARIANT 1 — Eb, 'calm' scale, one note per 2.5 s (24 BPM), rendered by
// inGameBeat exactly as the game plays it, plus its strong cello bass every
// fourth step. The floor's steady tread is the mine, or the heartbeat, so no
// taiko is added. On top: the chapel ledger in the choir (the one extra layer),
// then EMBER low in the cello, slow, where the organ pedal used to be.
//
// Motifs (music/score/_motifs.mjs):
//   GOLDBOUGH — cello, beat 2, Gb major (the walk's relative major; only the
//               cut note leaves the scale): Gb4–Bb4–Db5–Eb5–Db5, pinched out on
//               F5 at ≈ beat 7.9. Then seven beats (≈ 18 s) of floor, no lead.
//   NAMES     — choir hum, "mm", beat 15: Bb3–Ab3–Gb3–F3, unfinished — the
//               ledger read aloud and never closed.
//   EMBER     — low cello, beat 22: Eb3–E3–Bb2–Eb3, the fire the names fed;
//               its E is the semitone that climbs and cannot hold (the one note
//               outside the floor's scale). It settles into the loop point.
// Layers: the game's floor + cello bass, cello (lead, then EMBER), choir.
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'map-cinder-reach';
const V = 1;

// 8 bars of 4 = 32 in-game notes = 80 s.
const s = new Score({ bpm: ingame('map', V).bpm, bars: 8, seed: 37, reverb: { room: 0.88, damp: 0.6 }, gain: 0.9 });

// The floor: the game's own map music, and the cello bass under it.
inGameBeat(s, 'map', { variant: V });

// The kingdom, remembered, and put out.
snuffed(s, 2, 'Gb4', { stretch: 0.75, vel: 0.55 });

// NAMES, hummed low: the chapel ledger read aloud, unfinished.
s.line('choir', 15, motif('Eb3', 'names', { unfinished: true }),
  { legato: 1.05, note: { vowel: 'mm', vel: 0.6, rev: 0.5, pan: 0.15, a: 1, r: 2.5 } });

// EMBER, slow and low in the cello: the fire the ledger fed.
s.line('cello', 22, motif('Eb3', 'ember', { stretch: 0.75 }), { legato: 1.02, note: { vel: 0.58, rev: 0.45, pan: -0.1, a: 0.6, r: 2 } });

export default s;
