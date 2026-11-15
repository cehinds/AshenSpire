// Which floaters show (owner, 2026-11-07): "show only attack damage, Hit, Miss, Blocked, Countered and Defeated."
// A presentation policy only: the event -> word mapping (calloutForEvent / outcomeKindForEvent) is unchanged, and
// sounds and haptics play as before. ui/fx.js gates its two spawn primitives (callout, floatNum) through this.

// The words that still show. A plain landed hit says no "Hit" (owner, 2026-11-14: "just show damage or status effect or miss, or blocked"): its numbers say it. `evadeFailed` is the "Hit - Evade Failed" variant of Hit (docs/STANCE-COMBAT-RULES.md).
export const FLOATER_WORDS_SHOWN = Object.freeze(['evadeFailed', 'missed', 'evaded', 'blocked', 'countered']);

// Dodged is a miss, so it draws as the Missed word. Evaded keeps its own word (owner, 2026-11-14): an Evade stack cancelled the hit.
const MISS_KINDS = Object.freeze(['dodged']);

// On by default. Tests of the floater column's mechanics (spawn order, stagger, lift, cap) switch it off so they can
// exercise every kind of floater; nothing in the game calls this.
let policyOn = true;
export function setFloaterPolicyEnabled(on) { policyOn = on !== false; }

/** The callout kind to draw for `kind`, or null when the word is hidden (status:*, action:*, breaks, contests, ...). */
export function floaterWordShown(kind) {
  const k = String(kind ?? '');
  if (!policyOn) return k;
  if (FLOATER_WORDS_SHOWN.includes(k)) return k;
  if (MISS_KINDS.includes(k)) return 'missed';
  return null;
}

// Glyph words that fx.js spawnFx draws outside the callout path (the Cast, Guard and Stun flares): only allowlisted words show.
export function floaterGlyphShown(word) {
  return !policyOn || FLOATER_WORDS_SHOWN.includes(word);
}

// The number classes fx.js passes to floatNum:
//   shown : 'dmg', 'dmg small|heavy|crit|pct20|pct35' (dmgClass; HP damage), 'dmg heavy' (Defeated),
//           'blk small hitpart' (the Block a hit met, white), 'poise small hitpart' (the Poise it removed, yellow)
//   hidden: 'blk' (block gain), 'blk small' (cost, RESISTED), 'blk <tier>' (guardHitFloatParts fullHit),
//           'heal', 'burst' (resource and proc bursts), 'poise small' (gain, guarded), 'ward small', 'barrier small',
//           'pierce small', 'immune small'
/**
 * True for HP damage numbers and Defeated (a class string whose first token is `dmg`) and for the Block and Poise
 * parts of a hit (owner, 2026-11-14: "blocked damage white, poise damage yellow, health damage red"): `blk` or `poise`
 * together with the `hitpart` token that guardHitFloatParts adds. Every other `blk` / `poise` number stays hidden.
 */
export function floaterNumberShown(cls) {
  if (!policyOn) return true;
  const tokens = String(cls ?? '').trim().split(/\s+/);
  if (tokens[0] === 'dmg') return true;
  return tokens.includes('hitpart') && (tokens[0] === 'blk' || tokens[0] === 'poise');
}
