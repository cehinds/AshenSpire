// src/content/haptics.js — the vibration patterns, as data (FINISH wave 13).
//
// A haptic is the body of a sound cue: the same sfx ids the synth recipes in
// content/sfx.js answer (ui/sfx.js is the one seam every cue passes through),
// each mapped to a `navigator.vibrate` pattern — milliseconds, alternating
// vibrate / pause. An id with no row here makes no vibration; there is no
// default row on purpose, because an unasked buzz is worse than none.
//
// Retuning a buzz, or giving another cue one, is an edit to this table and
// nothing else. The setting that turns all of them off is `haptics` in
// Settings → Audio; HAPTICS_DEFAULT_ON is its default (the row reads it).
export const HAPTICS_DEFAULT_ON = true;

export const HAPTIC_PATTERNS = Object.freeze({
  cardPlay: Object.freeze([12]),            // a card leaves the hand (combat.js)
  playerHurt: Object.freeze([40, 30, 60]),  // the player takes HP damage (ui/fx.js)
  turnStinger: Object.freeze([20, 40, 20]), // the player's turn begins (ui/fx.js)
});

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
