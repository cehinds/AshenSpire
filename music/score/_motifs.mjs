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
