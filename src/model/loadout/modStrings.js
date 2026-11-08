// src/model/loadout/modStrings.js — parsing a mod string and describing its effect.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

/**
 * parseMod('strike.damage=+4') → { prefix, field, mode: 'add'|'set', value }
 * Returns null on anything malformed; validateEquipment() reports those.
 */
export function parseMod(str) {
  const m = /^([A-Za-z]\w*)\.([A-Za-z]\w*)=([+-]?)(\d+(?:\.\d+)?)$/.exec(String(str).trim());
  if (!m) return null;
  const [, prefix, field, sign, num] = m;
  return {
    prefix,
    field,
    mode: sign ? 'add' : 'set',
    value: sign === '-' ? -Number(num) : Number(num),
  };
}

/**
 * modEffectLines(registries, piece) → the piece's mods, written the way a
 * player reads them: `strike.damage=+4` → `Strike Damage +4`.
 *
 * THIS EXISTS BECAUSE THE ANSWER WAS ALREADY IN TWO PLACES AND THE THIRD SITE
 * PRINTED THE RAW ROW. Measured 2026-09-03 on ?shot=reward: the Victory screen
 * showed a player `Greatsword — strike.damage=+4, strike.cost=+1,
 * strike.poise=+3` — engine keys, on the screen where a reward is chosen. The
 * two existing renderers were `pieceEffects` (model/creationBrief.js, via
 * parseMod) and `modSummary` (ui/screens/compendium.js, via its own regex),
 * and they disagreed in two ways worth naming because this function had to
 * pick one of each:
 *
 *   THE PREFIX. creationBrief dropped it ("Damage +4"); compendium kept it
 *   ("Strike Damage +4"). KEPT — the prefix names WHICH CARD the mod rewrites,
 *   and a weapon that changes two cards reads as two identical lines without
 *   it.
 *
 *   AN UNKNOWN FIELD. creationBrief printed the raw row; compendium DROPPED the
 *   line. RAW — and the reasoning is creationBrief's, quoted because it is
 *   right: "A visible oddity is a bug report; a dropped line is a screen that
 *   quietly under-describes a weapon." An unregistered field is already a hard
 *   content failure (content/source/equipMods.csv), so reaching that branch
 *   means the tables disagree and a player should see something.
 *
 * `set` mode reads `= 3` rather than a bare `3`, so "Cost = 0" cannot be
 * misread as "Cost 0 added".
 */
export function modEffectLines(registries, piece) {
  const fields = (registries?.equipment || {}).modFields || {};
  return (piece?.mods || []).map((raw) => modEffectLine(fields, raw));
}

/** One mod string, rendered. Split out so a caller holding only the vocabulary
 *  (compendium walks a table, not a registry) reaches the same sentence. */
export function modEffectLine(fields, raw) {
  const mod = parseMod(raw);
  const spec = mod && (fields || {})[mod.field];
  if (!spec) return String(raw);
  const where = !mod.prefix || mod.prefix === 'self'
    ? ''
    : `${mod.prefix[0].toUpperCase()}${mod.prefix.slice(1)} `;
  const amount = mod.mode === 'add'
    ? `${mod.value >= 0 ? '+' : ''}${mod.value}`
    : `= ${mod.value}`;
  return `${where}${spec.label} ${amount}`;
}
