// music/score/_motifs.mjs — the lore, as three short melodies every track can quote.
//
// docs/LORE.md in one breath: the Sovereign Ember is a coal fed on NAMES; at
// death your name was written into the fire, and the writing was the fuel. The
// Burning was the fire calling in every promised name at once. The corrupted
// are names it has not finished reading. The Forsaken are the names nobody
// ever wrote, and so the only ones who can climb.
//
// So the score has three motifs, and each track is built from them:
//
//   EMBER    — the starving fire. A semitone that climbs and cannot hold, then
//              a fall of a tritone: heat reaching up, then collapsing inward
//              (LORE §2: "the cities burned toward their towers").
//              Organ, low strings or bells. Never sung.
//
//   NAMES    — the written dead. A slow descending line in the choir, the only
//              voices in the score, because the choir IS the names. It is left
//              unfinished (the last note is dropped) everywhere except where a
//              flame is relit, because the Blight is "a name the fire has not
//              quite finished reading". Victory is the one place it completes.
//
//   GOLDBOUGH — the kingdom at its height, remembered. Owner, 2026-09-26: "a
//              quiet cello that's an echo of great prosperity suddenly snuffed
//              out like flame". A warm, noble phrase that rises in the MAJOR
//              (the Goldbough before the Burning) and is cut off dead on its
//              way up, before the peak it is reaching for: the release is a
//              pinch, not a fade. What remains is the room's reverb dying and,
//              under it, a faint low ember. Solo cello, quiet. Written with
//              snuffed() below, which places the phrase and the cut.
//
//   FORSAKEN — the climber, whose name was never written. Solo cello, never a
//              voice: an open fifth (a blank medallion, "cold iron, blank on
//              both faces") that rises a minor third and settles. Heard alone,
//              or against EMBER when a boss makes its offer.
//
// Intervals are semitones from a root; `motif(root, which)` returns [midi, beats]
// pairs for Score.line(). Keep quotations literal enough to recognise; vary
// rhythm and register, not the intervals.

import { n } from '../../tools/score/compose.mjs';

const SHAPES = {
  // step up a semitone, hold, fall a tritone, rest on the root
  ember: [[0, 2], [1, 3], [-5, 3], [0, 4]],
  // descending minor line from the fifth; the full form ends on the root
  names: [[7, 2], [5, 2], [3, 2], [2, 2], [0, 4]],
  // open fifth, lift a minor third, settle on the fifth
  forsaken: [[0, 3], [7, 3], [10, 2], [7, 4]],
  // a noble rise in the major: root, third, fifth, sixth, reaching for the
  // octave — the last note is where the flame is pinched out (see snuffed()).
  goldbough: [[0, 2], [4, 1], [7, 2], [9, 1], [7, 1], [11, 2]],
};

/**
 * motif('D3', 'ember') → [[midi, beats], ...].
 * opts.stretch multiplies durations; opts.unfinished drops the last note
 * (NAMES everywhere but victory).
 */
export function motif(root, which, { stretch = 1, unfinished = false } = {}) {
  const r = n(root);
  const shape = SHAPES[which];
  if (!shape) throw new Error(`motif: no motif '${which}'`);
  const notes = shape.map(([i, b]) => [r + i, b * stretch]);
  return unfinished ? notes.slice(0, -1) : notes;
}

export const MOTIFS = Object.keys(SHAPES);

/**
 * snuffed(score, beat, root, opts) — write GOLDBOUGH on the cello, quietly,
 * and pinch it out: every note sings with a normal bow, but the last one (the
 * leading tone, reaching for the octave it never gets) stops dead after
 * `cutAt` of its length with a near-instant release. The octave is never
 * played. Optionally lays a faint ember (the root, two octaves down, very low
 * and dark) under the silence that follows, so the phrase dies into the key.
 * Returns the beat after the cut.
 */
export function snuffed(score, beat, root, { stretch = 1, vel = 0.42, cutAt = 0.45, ember = true, emberBeats = 8, pan = -0.15, rev = 0.55 } = {}) {
  const notes = motif(root, 'goldbough', { stretch });
  let b = beat;
  notes.forEach(([m, len], i) => {
    const last = i === notes.length - 1;
    score.note('cello', b, last ? len * cutAt : len * 0.98, m,
      { vel: last ? vel * 1.08 : vel, pan, rev, a: 0.3, r: last ? 0.04 : 0.9 });
    b += last ? len * cutAt : len;
  });
  if (ember) score.note('drone', b, emberBeats, n(root) - 24, { vel: 0.22, rev: 0.3, a: 1.5, r: 3, cut: 240 });
  return b;
}

// ---- the in-game beat --------------------------------------------------------
//
// Owner, 2026-09-26: "cello and bass should be pretty strong with the rhythmic
// beat of the current in-game music". The in-game (procedural) score is
// src/content/music.js BEDS + src/ui/audio.js playProcedural: one note every
// `cadence` ms, degree = scale[(step*lift + (step%2 ? 2 : 0)) % len], up an
// octave every fourth step, over a drone an octave below the root; battle beds
// (`pulse: true`) add a low thump twice per note. These helpers read that same
// table, so the recorded score keeps the game's own tempo, key and walk.

import { BEDS, SCALES } from '../../src/content/music.js';

const hzToMidi = (hz) => Math.round(69 + 12 * Math.log2(hz / 440));

/** The in-game bed variant for a context (map-* use the map bed). */
export function ingame(context, variant = 0) {
  const bed = BEDS[context] ?? BEDS.map;
  const v = bed.variants[variant % bed.variants.length];
  return {
    bpm: 60000 / v.cadence, // one beat = one in-game note
    root: hzToMidi(v.root),
    scale: SCALES[v.scale],
    lift: v.lift || 3,
    pulse: !!bed.pulse,
  };
}

const hzMidi = (hz) => 69 + 12 * Math.log2(hz / 440); // exact, fractional

/**
 * inGameBeat(score, context, opts) — THE CURRENT BUILD'S MUSIC, as the floor
 * every track stands on (owner: "use the current build of the game as the
 * reference and just build on top of it"). Reproduces src/ui/audio.js
 * playProcedural for one bed variant, note for note: a `gamenote` in the
 * variant's wave every cadence (one beat), degree = scale[(step*lift +
 * (step%2 ? 2 : 0)) % len], an octave up every fourth step, a soft sine a fifth
 * above every third step; the detuned-saw `gamedrone` at root/2 for the whole
 * span; and, for battle beds, a `gamethump` every max(420 ms, cadence/2).
 * Levels keep the engine's own ratios (note 0.16, fifth 0.07, drone 0.12,
 * thump 0.22), scaled by `level`.
 *
 * On top of that floor, `bass: true` (default) adds a strong bowed cello bass
 * note two octaves under the root on every fourth step, the downbeat of the
 * game's four-note cycle. Everything else a track adds is its own.
 * (Older options — inst, vel, down, fifth — are accepted and ignored: the floor
 * is the game's, not the track's.)
 */
export function inGameBeat(score, context, { variant = 0, from = 0, to = score.beats, level = 1, bass = true, bassVel = 0.62, drone = true, thump = true } = {}) {
  const bed = BEDS[context] ?? BEDS.map;
  const v = bed.variants[variant % bed.variants.length];
  const scale = SCALES[v.scale];
  const lift = v.lift || 3;
  const K = 4 * level; // engine gain → note velocity
  for (let step = 0, b = from; b < to; step++, b++) {
    const deg = scale[(step * lift + (step % 2 ? 2 : 0)) % scale.length];
    const oct = step % 4 === 0 ? 2 : 1;
    const hz = v.root * oct * Math.pow(2, deg / 12);
    score.note('gamenote', b, 1, hzMidi(hz), { wave: v.wave || 'triangle', vel: 0.16 * K, pan: 0.1, rev: 0.35 });
    if (step % 3 === 1) score.note('gamenote', b, 1, hzMidi(hz * 1.4983), { wave: 'sine', vel: 0.07 * K, pan: 0.2, rev: 0.4 });
    if (bass && step % 4 === 0) score.note('cello', b, 3.6, Math.round(hzMidi(v.root)) - 24, { vel: bassVel, pan: -0.15, rev: 0.25, a: 0.12, r: 1.2 });
  }
  if (drone && bed.drone !== false) score.note('gamedrone', from, to - from, hzMidi(v.root / 2), { vel: 0.12 * K, pan: 0, rev: 0.15 });
  if (bed.pulse && thump) {
    const every = Math.max(420, v.cadence / 2) / v.cadence; // in beats
    for (let b = from; b < to - 1e-9; b += every) score.note('gamethump', b, every, hzMidi(v.root / 2), { vel: 0.22 * K, pan: 0, rev: 0.1 });
  }
}
