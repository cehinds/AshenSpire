// Boss — the climber's own marked person, half-read and still standing, making
// the offer before the fight.
//
// Lore (docs/LORE.md §4): "Every climber has one marked person somewhere on the
// ring … They are the bosses." "Every one of them will make the offer before
// the fight: my hearth-key for the Keeper's name. Let the fire have one that
// was never promised, and you can leave me standing." (LORE-CAST: "Refusing is
// the fight.")
//
// Built on the in-game beat (music/score/_STYLE.md, "Direction now"): the boss
// bed, VARIANT 0 — G, 'dread' scale (G A Bb D Eb F), 1000 ms cadence = 60 BPM,
// lift 2. inGameBeat() writes the game's walk on a strong low cello, one note
// per beat, over the drone on G0, with the taiko heartbeat on every half beat,
// for the whole loop. Low strings double the bass (G1 + G2) throughout.
//
// Over that, the offer as a dialogue, in two layers:
//   ORGAN — the fire and the boss making the case: EMBER, whose Ab grinds on
//     the walk's A.
//   CELLO LEAD — the Forsaken, above the walk: FORSAKEN, the open fifth of a
//     blank medallion, answering and refusing.
//       beats  0–18  ORGAN: EMBER on G (G2–Ab2–D2–G2, stretch 1.5), in octaves.
//       beats 20–38  CELLO: FORSAKEN on G (G3–D4–F4–D4, stretch 1.5).
//       beats 40–58  ORGAN: EMBER on C (C3–Db3–G2–C3), the offer pressed higher.
//       beats 60–80  CELLO: FORSAKEN on D (D4–A4–C5–A4), the refusal; the organ
//                    returns under its last note on a held G — they meet —
//                    and the loop turns over into the offer again.
//   No choir here: the boss's name is the reading the fight will do (the lore
//   table's unfinished NAMES is left to combat/elite to keep this at two layers).
//
// 20 bars × 4 beats at 60 BPM = 80 s. All material original.
import { Score } from '../../tools/score/compose.mjs';
import { motif, ingame, inGameBeat } from './_motifs.mjs';

export const context = 'boss';
const V = 0;

const s = new Score({ bpm: ingame('boss', V).bpm, bars: 20, seed: 67, reverb: { room: 0.9, damp: 0.4 }, gain: 0.9 });

// The in-game beat: strong cello walk, drone, heartbeat thump — the whole loop.
inGameBeat(s, 'boss', { variant: V, vel: 0.64 });

// Low strings double the bass, one long bow per four bars.
for (let beat = 0; beat < s.beats; beat += 16) {
  s.note('strings', beat, 16.5, 'G1', { vel: 0.55, rev: 0.25, cut: 600, a: 1, r: 2 });
  s.note('strings', beat, 16.5, 'G2', { vel: 0.26, rev: 0.25, cut: 800, a: 1.2, r: 2 });
}

// ORGAN — EMBER, the offer, with an octave below.
const organ = { stop: 'full', vel: 0.3, rev: 0.45, a: 0.5, r: 1.6, pan: 0.15 };
function offer(beat, root) {
  const m = motif(root, 'ember', { stretch: 1.5 });
  s.line('organ', beat, m, { legato: 1.02, note: organ });
  s.line('organ', beat, m.map(([p, b]) => [p - 12, b]), { legato: 1.02, note: { ...organ, vel: 0.2 } });
}
offer(0, 'G2');
offer(40, 'C3');

// CELLO LEAD — FORSAKEN, the answer, above the walk.
const lead = { legato: 1, note: { vel: 0.58, rev: 0.45, pan: -0.25, a: 0.45, r: 1.8 } };
s.line('cello', 20, motif('G3', 'forsaken', { stretch: 1.5 }), lead);
s.line('cello', 60, motif('D4', 'forsaken', { stretch: 1.5 }), { ...lead, note: { ...lead.note, vel: 0.55 } });
// They meet: the organ comes back on G under the refusal's last note.
s.note('organ', 74, 6.5, 'G2', { ...organ, vel: 0.24, a: 1.2, r: 2.4 });

export default s;
