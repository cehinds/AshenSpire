// Shop — the merchant's cart, built on top of the game's own shop music.
//
// In-game variant: shop #1 (F, 'calm' minor pentatonic, 2000 ms a note, sine,
// lift 4) → 30 BPM (one beat = one in-game note), F root.
// 13 bars of 3 = 39 beats = 78 s.
//
// Lore it carries (docs/LORE.md §1, §3): the merchant "was a Saint of the
// Furnace Chapel who left before the Burning with a censer under his coat, and
// he keeps one small hearth alive in the back of the cart on the names he
// buys". His buy-back line: "Half price. The other half is already burning."
//
// The floor (inGameBeat): the current build's shop bed note for note — the
// sine walk, its fifth, the game drone — plus the strong cello bass on F every
// fourth step. Everything below sits on top of it, in F calm.
//   beats 0–14  the censer: a small bell on every beat (F5 / Eb5), swinging
//               left and right.
//   beat 2      GOLDBOUGH — snuffed(), cello, in the key's own major (Ab, the
//               relative major): Ab3–C4–Eb4–F4–Eb4–G4, pinched out before the
//               Ab4; the lead then stays silent for the rest of the loop.
//   beat 15     the bell stops, and in its place NAMES is hummed ("oo"), barely
//               audible, unfinished: C4–Bb3–Ab3–G3, the F never comes — the
//               names he bought, burning in the back of the cart.
//   beats 28–39 the censer swings again into the loop point.
// Added layers: cello lead, and one extra layer at a time — the bell, then the
// choir hum in its place (never both at once). The earlier harp is gone.
// Original material.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat, snuffed } from './_motifs.mjs';

export const context = 'shop';
const v = 1;
const g = ingame(context, v);

const s = new Score({ bpm: g.bpm, meter: 3, bars: 13, seed: 41, reverb: { room: 0.9, damp: 0.45 }, gain: 0.9 });

// The floor: the game's own shop bed, the whole loop.
inGameBeat(s, context, { variant: v });

// The censer: one small bell a beat, swinging L/R, the outer swing a hair lower.
const censer = (from, to) => {
  for (let b = from; b < to; b++) {
    const left = b % 2 === 0;
    s.note('bell', b, 1, left ? g.root + 24 : g.root + 22, { vel: left ? 0.07 : 0.055, rev: 0.7, pan: left ? -0.45 : 0.45, ring: 4 });
  }
};
censer(0, 15);
censer(28, s.beats);

// GOLDBOUGH, once, in the relative major, snuffed out; then no lead.
snuffed(s, 2, g.root + 3, { stretch: 0.75, vel: 0.58 });

// NAMES, hummed and nearly lost, while the censer is still.
s.line('choir', 15, motif(g.root - 12, 'names', { stretch: 1.5, unfinished: true }),
  { legato: 1.1, note: { vowel: 'oo', vel: 0.12, rev: 0.7, pan: 0.1, a: 2.5, r: 4 } });

export default s;
