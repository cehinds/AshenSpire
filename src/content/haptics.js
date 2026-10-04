// src/content/haptics.js — the vibration patterns, as data (FINISH wave 13).
//
// A haptic is a semantic moment, not a sound: the ids below are named by the
// call sites that MEAN them (ui/haptics.js `haptic.play(id)`), never by the
// sfx id that happens to sound there. That is deliberate (review of #1517):
// the `cardPlay` SOUND is also played by equipping and armament swaps, so a
// haptic keyed on sound ids buzzed for non-card actions. Each id maps to a
// `navigator.vibrate` pattern — milliseconds, alternating vibrate / pause. An
// id with no row makes no vibration; there is no default row on purpose,
// because an unasked buzz is worse than none.
//
// Who plays them:
//   cardPlay    — a card actually played: combat.js's playCard (solo), and
//                 co-op's authoritative cardPlayed receipt for a local seat.
//   damageTaken — the player loses HP, attack or not (Guilt, Herald, Gorefire,
//                 Venom's hpLost too): ui/fx.js playBeatCues, once per beat.
//   turnStart   — the player's turn begins: ui/fx.js playBeatCues.
//
// Retuning a buzz, or giving another moment one, is an edit to this table and
// one call site. The setting that turns all of them off is `haptics` in
// Settings → Audio; HAPTICS_DEFAULT_ON is its default (the row reads it).
export const HAPTICS_DEFAULT_ON = true;

export const HAPTIC_PATTERNS = Object.freeze({
  cardPlay: Object.freeze([12]),            // a card leaves the hand
  damageTaken: Object.freeze([40, 30, 60]), // the player loses HP
  turnStart: Object.freeze([20, 40, 20]),   // the player's turn begins
});

// Cues asked for in one tick (an instant replay, a co-op receipt batch) are
// played as ONE pattern, in order, HAPTIC_BATCH_GAP_MS apart: a second
// navigator.vibrate call aborts the first (W3C Vibration, "perform
// vibration"), so separate calls would truncate each other. The batch stops
// growing past HAPTIC_BATCH_MAX_MS of buzz-and-pause, so a long replay is a
// short rumble, not a ten-second one.
export const HAPTIC_BATCH_GAP_MS = 60;
export const HAPTIC_BATCH_MAX_MS = 900;

/** hapticPatternIssues(table?) → a list of problems, each naming its id; [] is valid. */
export function hapticPatternIssues(table = HAPTIC_PATTERNS) {
  const issues = [];
  for (const [id, pattern] of Object.entries(table)) {
    if (!Array.isArray(pattern) || pattern.length === 0) { issues.push(`${id}: pattern must be a non-empty array of ms`); continue; }
    pattern.forEach((ms, i) => {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) issues.push(`${id}[${i}]: ${JSON.stringify(ms)} is not a non-negative number of ms`);
    });
  }
  return issues;
}
