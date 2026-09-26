// Victory — a flame relit, built on top of the game's own victory music.
//
// In-game variant: victory #2 (B, 'calm' minor pentatonic, 1300 ms a note,
// sine, lift 2) → 46.15 BPM (one beat = one in-game note), B root.
// 7 bars of 4 = 28 beats ≈ 36 s.
//
// Lore it carries (docs/LORE.md §4): "Relighting a hearth *finishes the
// reading*: the cinders you feed it are names the fire completes, and the
// things that carried them stop." Whether that is mercy or the old crime again
// the game will not say (Restore: "The marked burn on, finished one by one").
//
// So this is the one place where NAMES is sung COMPLETE, and the one place
// GOLDBOUGH is allowed its octave — the kingdom's warmth, bought with names.
// Then the uneasy close. Solemn, not a fanfare.
//
// The floor (inGameBeat): the current build's victory bed note for note — the
// sine walk and its fifth, and the cello bass on B every fourth step (this bed
// has no game drone). Everything below sits on top of it, in B calm.
//   beat 1      NAMES — complete, choir in octaves: F#4–E4–D4–C#4–B3, the B
//               landing at beat 9 and held (the reading finished).
//   beat 9      GOLDBOUGH — cello, in the key's own major (D, the relative
//               major): D4–F#4–A4–B4–A4–C#5, and this once it reaches the
//               octave, D5, held (beats 18–23), over a brief D major "ah" in
//               the choir (all three notes in the floor's scale).
//   beat 23.5   the uneasy close: the cello lets the D fall to B4 — the warmth
//               was only ever B minor's relative — and fades into the loop.
// Added layers: cello lead, choir (the one extra layer). The earlier bell is gone.
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat } from './_motifs.mjs';

export const context = 'victory';
const v = 2;
const g = ingame(context, v);

const s = new Score({ bpm: g.bpm, bars: 7, seed: 89, reverb: { room: 0.92, damp: 0.35 }, gain: 0.9 });

// The floor: the game's own victory bed, the whole loop.
inGameBeat(s, context, { variant: v });

// NAMES, complete — the only time in the score.
const names = motif(g.root, 'names');
names[names.length - 1][1] = 6; // hold the finished B
const choir = { vowel: 'ah', rev: 0.65, a: 1.2, r: 3 };
s.line('choir', 1, names, { legato: 1.05, note: { ...choir, vel: 0.28, pan: 0.15 } });
s.line('choir', 1, names.map(([m, b]) => [m + 12, b]), { legato: 1.05, note: { ...choir, vel: 0.14, pan: -0.15 } });

// GOLDBOUGH, whole this once: the rise, and the octave it is always denied.
const gold = g.root + 3; // D4, the relative major
const cello = { vel: 0.62, rev: 0.5, pan: -0.15, a: 0.3, r: 1 };
s.line('cello', 9, [...motif(gold, 'goldbough'), [gold + 12, 5]], { legato: 0.98, note: cello });

// The warmth it bought: a brief D major "ah" under the octave.
for (const [i, pan] of [[0, -0.2], [4, 0.05], [7, 0.2]])
  s.note('choir', 17.5, 4.5, gold + i, { ...choir, vel: 0.14, pan, a: 1.5 });

// The uneasy close: the octave falls to the minor tonic.
s.note('cello', 23.5, 4, g.root + 12, { ...cello, vel: 0.5, a: 0.8, r: 2.5 });

export default s;
