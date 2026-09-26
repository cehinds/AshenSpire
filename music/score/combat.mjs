// Combat — the ordinary fight, against a citizen still burning.
//
// Lore (docs/LORE.md §2–§3): "A cinder in a corrupted thing's chest is a name
// the fire has not quite finished reading." "There is a cinder where his heart
// was. Some of them still know it. One in a patrol will lower his blade and
// ask you to finish reading his name."
//
// Built on the in-game beat (music/score/_STYLE.md, "Direction now"): the
// combat bed, VARIANT 0 — C, 'tense' scale (C Db F Gb G Bb), 1500 ms cadence
// = 40 BPM, lift 3. inGameBeat() writes the game's own walk on a strong low
// cello, one note per beat, over the drone on C1, with the taiko heartbeat on
// every half beat, for the whole loop.
//
// Over that, the lore, in two layers only:
//   LOW STRINGS — EMBER, the starving fire, as the bass line, doubling the
//     drone's weight: C2–Db2–G1–C2 (stretch 2, 24 beats), twice, in octaves.
//   CHOIR — the names inside the corrupted. NAMES, one voice, each time
//     broken off before its last note and cut short on the one it reaches:
//       beat  2  NAMES on C: G4–F4–Eb4–D4, and stops.
//       beat 26  NAMES a fourth up, on F: C5–Bb4–Ab4–G4, and stops.
//       beat 40  NAMES on C begun once more: G4–F4 only — the one who asks.
//     A faint "ah" chord swells under each entry and breaks off with it.
//
// 12 bars × 4 beats at 40 BPM = 72 s. All material original.
import { Score, n } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat } from './_motifs.mjs';

export const context = 'combat';
const V = 0;

const s = new Score({ bpm: ingame('combat', V).bpm, bars: 12, seed: 23, reverb: { room: 0.88, damp: 0.4 }, gain: 0.9 });

// The in-game beat: strong cello walk, drone, heartbeat thump — the whole loop.
inGameBeat(s, 'combat', { variant: V, vel: 0.64 });

// Low strings — EMBER on C as the bass, in octaves, twice.
const ember = motif('C2', 'ember', { stretch: 2 }); // C2 4, Db2 6, G1 6, C2 8
const low = { vel: 0.58, rev: 0.25, cut: 650, a: 0.8, r: 2 };
for (const at of [0, 24]) {
  s.line('strings', at, ember, { legato: 1.04, note: low });
  s.line('strings', at, ember.map(([m, b]) => [m + 12, b]), { legato: 1.04, note: { ...low, vel: 0.3, cut: 850 } });
}

// Choir — NAMES, never finished; each phrase breaks off on its last sung note.
const voice = { vowel: 'ah', vel: 0.3, rev: 0.6, a: 0.9, r: 0.6, pan: 0.18 };
function broken(beat, notes) {
  let b = beat;
  notes.forEach(([m, len], i) => {
    const last = i === notes.length - 1;
    s.note('choir', b, last ? len * 0.55 : len, m, { ...voice, r: last ? 0.15 : voice.r });
    b += len;
  });
  return b;
}
const swell = (beat, beats, notes) => notes.forEach((m, i) => s.note('choir', beat, beats, n(m),
  { vowel: 'ah', vel: 0.13, rev: 0.65, a: 2.2, r: 0.4, pan: (i - 1) * 0.35 }));

broken(2, motif('C4', 'names', { unfinished: true }));                  // G4 F4 Eb4 D4
swell(2, 6, ['Eb3', 'G3', 'C4']);
broken(26, motif('F4', 'names', { unfinished: true }));                 // C5 Bb4 Ab4 G4
swell(26, 6, ['F3', 'Ab3', 'Db4']);
broken(40, motif('C4', 'names', { stretch: 1.5, unfinished: true }).slice(0, 2)); // G4 F4 — gives out
swell(40, 4, ['Eb3', 'G3', 'C4']);

export default s;
