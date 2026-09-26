// Elite — a champion of one of the orders (Wardens, Knights, Saints): the heat
// held longer, by someone who served the fire on purpose.
//
// Lore (docs/LORE.md §2–§3): "the Saints began writing the living"; the Burning
// was "the fire calling in the promise"; the Blight is "ember without a hearth,
// burning inside things that were promised to it". An elite is that heat in a
// body the order built.
//
// Built on the in-game beat (music/score/_STYLE.md, "Direction now"): the
// elite bed, VARIANT 0 — A, 'tense' scale (A Bb D Eb E G), 1150 ms cadence
// ≈ 52.2 BPM, lift 3. inGameBeat() writes the game's walk on a strong low
// cello, one note per beat, over the drone on A0, with the taiko heartbeat on
// every half beat, for the whole loop.
//
// Over that, the lore:
//   LOW STRINGS — EMBER on A as the bass (A1–Bb1–E1–A1, stretch 2, 24 beats)
//     at beats 0 and 32, harmonised a tritone above in a thinner string voice
//     (Eb2–E2–Bb1–Eb2): the order's fire, sour at every step. Between the two
//     statements the strings hold A1 + Eb2, the tritone itself.
//   BELL — the order's bell every two bars; it tolls the tritone (Eb3) where
//     EMBER falls (beats 8 and 40), A2 otherwise.
//   CHOIR — NAMES in one strained high voice, never finished:
//       beat 18  NAMES on A: E5–D5–C5–B4, and stops short of the A.
//       beat 48  NAMES on D, higher and more strained: A5–G5–F5–E5, and stops.
//
// 16 bars × 4 beats at ≈52.2 BPM = 73.6 s. All material original.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat } from './_motifs.mjs';

export const context = 'elite';
const V = 0;

const s = new Score({ bpm: ingame('elite', V).bpm, bars: 16, seed: 41, reverb: { room: 0.88, damp: 0.38 }, gain: 0.9 });

// The in-game beat: strong cello walk, drone, heartbeat thump — the whole loop.
inGameBeat(s, 'elite', { variant: V, vel: 0.64 });

// Low strings — EMBER in the bass with the tritone above it; the tritone held between.
const ember = motif('A1', 'ember', { stretch: 2 }); // A1 4, Bb1 6, E1 6, A1 8
const low = { vel: 0.58, rev: 0.25, cut: 700, a: 0.8, r: 2 };
const tri = { ...low, vel: 0.26, cut: 800, pan: 0.2 };
for (const at of [0, 32]) {
  s.line('strings', at, ember, { legato: 1.04, note: low });
  s.line('strings', at, ember.map(([m, b]) => [m + 6, b]), { legato: 1.04, note: tri });
  s.note('strings', at + 24, 8.5, 'A1', low);
  s.note('strings', at + 24, 8.5, 'Eb2', tri);
}

// The order's bell, every other bar; the tritone where EMBER falls.
for (let beat = 0; beat < s.beats; beat += 8) {
  const falls = beat === 8 || beat === 40;
  s.note('bell', beat, 1, falls ? 'Eb3' : 'A2', { vel: falls ? 0.22 : 0.18, rev: 0.6, pan: -0.4, ring: 7 });
}

// NAMES — one strained high voice, unfinished both times.
const voice = { legato: 1, note: { vowel: 'ah', vel: 0.26, rev: 0.55, a: 0.7, r: 0.9, pan: 0.2 } };
s.line('choir', 18, motif('A4', 'names', { stretch: 1.5, unfinished: true }), voice);                                   // E5 D5 C5 B4
s.line('choir', 48, motif('D5', 'names', { stretch: 1.25, unfinished: true }), { ...voice, note: { ...voice.note, vel: 0.2, r: 0.4 } }); // A5 G5 F5 E5

export default s;
