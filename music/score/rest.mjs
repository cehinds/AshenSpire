// Rest — a shrine, the one warm place, built on top of the game's own rest
// music. The gentlest track in the score.
//
// In-game variant: rest #1 (D, 'hymn' major pentatonic, 3000 ms a note, sine,
// lift 2) → 20 BPM (one beat = one in-game note), D root.
// 7 bars of 4 = 28 beats = 84 s.
//
// Lore it carries (docs/LORE.md §3–§4): cinders "are the only thing in the Spire
// that is still alive ... The shrines drink them." A Forsaken is someone "the
// light did not reach"; here, for once, the climber is warm. The warm hymn
// variant keeps the floor in the major, so the snuffed prosperity is nearest.
//
// The floor (inGameBeat): the current build's rest bed note for note — the
// sine walk, its fifth, the game drone — plus the cello bass on D every fourth
// step, softer than elsewhere (bassVel 0.55, the bottom of the strong range).
// Everything below sits on top of it, in D hymn.
//   beat 1      GOLDBOUGH — snuffed(), slow and soft: D4–F#4–A4–B4–A4–C#5,
//               pinched out before the D5; a faint ember under the silence.
//   beats 8–15  no lead: the game's walk breathing on its own.
//   beat 15     FORSAKEN — once, gently, at rest, on the scale's second so its
//               open fifth and minor third stay in the hymn: E4–B4–D5–B4.
// The choir only breathes here — a slow open fifth, D3–A3, two long swells;
// no NAMES, nobody is being read tonight.
// Added layers: cello lead, choir breath (the one extra layer).
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'rest';
const v = 1;
const g = ingame(context, v);

const s = new Score({ bpm: g.bpm, bars: 7, seed: 17, reverb: { room: 0.93, damp: 0.35 }, gain: 0.9 });

// The floor: the game's own rest bed, the whole loop; the cello bass gentler.
inGameBeat(s, context, { variant: v, bassVel: 0.55 });

const lead = g.root + 12; // D4

// GOLDBOUGH, once, snuffed out, softly.
snuffed(s, 1, lead, { stretch: 0.85, vel: 0.52, rev: 0.6 });

// FORSAKEN, once, gently.
s.line('cello', 15, motif(lead + 2, 'forsaken', { stretch: 0.6 }),
  { note: { vel: 0.5, rev: 0.55, pan: -0.15, a: 1, r: 3 } });

// The shrine breathing: an open fifth in the choir, two long swells.
for (const [beat, len] of [[0, 14], [14, 14]])
  for (const [m, pan] of [[g.root - 12, -0.2], [g.root - 5, 0.2]])
    s.note('choir', beat, len, m, { vowel: 'oo', vel: 0.12, rev: 0.65, pan, a: 5, r: 5 });

export default s;
