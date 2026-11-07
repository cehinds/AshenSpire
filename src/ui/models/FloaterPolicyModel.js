// Which floaters show (owner, 2026-11-07): "show only attack damage, Hit, Miss, Blocked, Countered and Defeated."
// A presentation policy only: the event -> word mapping (calloutForEvent / outcomeKindForEvent) is unchanged, and
// sounds and haptics play as before. ui/fx.js gates its two spawn primitives (callout, floatNum) through this.

// The words that still show. `evadeFailed` is the "Hit - Evade Failed" variant of Hit (docs/STANCE-COMBAT-RULES.md).
export const FLOATER_WORDS_SHOWN = Object.freeze(['hit', 'evadeFailed', 'missed', 'blocked', 'countered']);

// Dodged and Evaded are misses, so they draw as the Missed word.
const MISS_KINDS = Object.freeze(['dodged', 'evaded']);

/** The callout kind to draw for `kind`, or null when the word is hidden (status:*, action:*, breaks, contests, ...). */
export function floaterWordShown(kind) {
  const k = String(kind ?? '');
  if (FLOATER_WORDS_SHOWN.includes(k)) return k;
  if (MISS_KINDS.includes(k)) return 'missed';
  return null;
}

// The number classes fx.js passes to floatNum:
//   shown : 'dmg', 'dmg small|heavy|crit|pct20|pct35' (dmgClass; HP damage), 'dmg heavy' (Defeated)
//   hidden: 'blk' (block gain), 'blk small' (cost, guard, RESISTED), 'blk <tier>' (guardHitFloatParts fullHit),
//           'heal', 'burst' (resource and proc bursts), 'poise small', 'ward small', 'barrier small',
//           'pierce small', 'immune small'
/** True only for HP damage numbers and Defeated: a class string whose first token is `dmg`. */
export function floaterNumberShown(cls) {
  return String(cls ?? '').trim().split(/\s+/)[0] === 'dmg';
}
