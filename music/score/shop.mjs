// Shop — the merchant's cart. A minor at 54 BPM in 3/4, 18 bars (60 s), with
// the phrygian Bb and the harmonic-minor G# making it faintly wrong.
//
// Lore it carries (docs/LORE.md §1, §3): the merchant "was a Saint of the
// Furnace Chapel who left before the Burning with a censer under his coat, and
// he keeps one small hearth alive in the back of the cart on the names he
// buys". His buy-back line: "Half price. The other half is already burning."
//
// So a small bell ticks once a bar, swinging left and right like a censer on a
// chain (and, like a swing, it slows and misses a stroke at each phrase end);
// the harp and the low cello are the counter; and under it, barely audible,
// the choir hums the names he bought, burning:
//   beat 0  bell starts its swing; harp phrase 1; cello floor on A.
//   beat 12 NAMES — a choir hum ("oo"), very quiet, unfinished and slow
//           (E–D–C–B, the A never comes): the names in the back of the cart.
//   beat 18, 36 harp phrases 2 and 3; the bell misses a stroke before each.
// Four layers: bell (the censer), harp (lead), cello (floor), choir hum (NAMES).
import { Score } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'shop';

const s = new Score({ bpm: 54, meter: 3, bars: 18, seed: 41, reverb: { room: 0.9, damp: 0.45 }, gain: 0.85 });

// The censer: one small bell a bar, swinging L/R, the outer swing a hair lower.
// No stroke on bars 5 and 11 (the swing slowing), none on 17 (back into the loop).
for (let bar = 0; bar < 18; bar++) {
  if ([5, 11, 17].includes(bar)) continue;
  const left = bar % 2 === 0;
  s.note('bell', bar * 3, 1, left ? 'E5' : 'D5', { vel: left ? 0.07 : 0.055, rev: 0.7, pan: left ? -0.45 : 0.45, ring: 5 });
}

// Harp: three short phrases of single notes, three beats apart, then air.
const harp = { note: { vel: 0.5, rev: 0.6, pan: 0.3, ring: 5 } };
s.line('harp', 0, [['E4', 3], ['C4', 3], ['Bb3', 3], ['A3', 6], [null, 3]], harp);
s.line('harp', 18, [['E4', 3], ['F4', 3], ['D4', 3], ['G#3', 6], [null, 3]], harp);
s.line('harp', 36, [['C4', 3], ['Bb3', 3], ['A3', 9], [null, 3]], harp);

// Low cello: the floor of the room, long notes, leaning on E at the loop point.
s.line('cello', 0, [['A2', 12], ['F2', 9], ['E2', 9], ['D2', 12], ['E2', 12]],
  { legato: 1.02, note: { vel: 0.4, rev: 0.45, pan: -0.25, a: 1.5, r: 3, cut: 700 } });

// NAMES, hummed and nearly lost: the names he bought, burning.
s.line('choir', 12, motif('A3', 'names', { stretch: 3, unfinished: true }),
  { legato: 1.1, note: { vowel: 'oo', vel: 0.11, rev: 0.7, pan: 0.1, a: 2.5, r: 4 } });

export default s;
