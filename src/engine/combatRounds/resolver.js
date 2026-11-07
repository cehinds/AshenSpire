// The combat screen's and the counter's hit tables (SPEC §4.9, §5): accuracy, evasion, the stance advantage
// table and the stance outline. Pure: no DOM, no randomness. Formerly the resolver of the combat-rounds preview,
// whose round, timeline and momentum halves were removed in cleanup 3i-A.

// floor(1*STR + 1*DEX + 0.5*WIS + 0.5*INT)
export function attributeBonus(attrs = {}) {
  const v = (k) => {
    const n = Number(attrs[k] ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return Math.floor(1 * v('STR') + 1 * v('DEX') + 0.5 * v('WIS') + 0.5 * v('INT'));
}

// Attack tags that change accuracy (DESIGN.md, Hit roll). Other tags add nothing.
export const ATTACK_TAG_ACCURACY = Object.freeze({ quick: 1, telegraphed: -2 });

// Accuracy = floor(STR + DEX + WIS/2 + INT/2) + floor(level / 5) + attack tag
// (DESIGN.md, Hit roll). `accuracy` is any extra flat bonus, and a plain numeric
// accuracy works on its own. The attribute term is attributeBonus().
export function accuracyFor({ attrs = {}, level = 0, tags = [], accuracy = 0 } = {}) {
  const lvl = Number(level ?? 0);
  let tagMod = 0;
  for (const t of Array.isArray(tags) ? tags : []) {
    if (Object.hasOwn(ATTACK_TAG_ACCURACY, t)) tagMod += ATTACK_TAG_ACCURACY[t];
  }
  const flat = Number(accuracy ?? 0);
  return attributeBonus(attrs)
    + (Number.isFinite(lvl) ? Math.floor(lvl / 5) : 0)
    + tagMod
    + (Number.isFinite(flat) ? flat : 0);
}

// A numeric CSV cell. A blank or missing cell is NaN, not 0, so it is rejected.
function evasionCell(cell) {
  return cell == null || cell.trim() === '' ? NaN : Number(cell);
}

// Parses evasion-armor.csv (armor,base,dexCap) into a Map from armor name to
// { base, dexCap } (DESIGN.md, Hit roll). A blank base or dexCap cell throws.
export function parseEvasionArmor(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const header = (lines.shift() ?? '').split(',').slice(0, 3).join(',');
  if (header !== 'armor,base,dexCap') throw new TypeError('evasion-armor.csv: unexpected header');
  const table = new Map();
  for (const line of lines) {
    const [armor, baseCell, capCell] = line.split(',');
    const base = evasionCell(baseCell);
    const dexCap = evasionCell(capCell);
    if (!Number.isFinite(base) || !Number.isFinite(dexCap)) {
      throw new TypeError(`evasion-armor.csv: bad row "${line}"`);
    }
    table.set(armor, { base, dexCap });
  }
  return table;
}

// Evasion (DESIGN.md, Hit roll): armor base + min(DEX - 1, armor DEX cap) + shield
// + card bonus + `evasion` (any extra flat bonus). `tables` is { armor, cards }
// from parseEvasionArmor and parseEvasionCards. The inputs are evasionArmor,
// dex, shield and evasionCard. They are not the action's `armor` and `card`,
// which are speed-table ids. A missing evasionArmor counts as Cloth. A missing
// dex takes attrs.DEX, and a missing DEX adds nothing. The DEX term is never negative. A buckler adds
// 1 and any other shield adds 0. An evasionCard not in the table throws, like an
// unknown armor.
// Owner rule (2026-10-11): the armor formula also runs when attrs.DEX is present,
// so a side with attrs.DEX and no armor, shield, card or dex counts as Cloth.
// Cloth works with no tables: a missing Cloth row falls back to the built-in
// { base: 0, dexCap: 4 }. Any other unknown armor name still throws.
// With none of evasionArmor, dex, shield, evasionCard or attrs.DEX given, the
// result is the plain `evasion` number, so existing callers are unchanged.
export const SHIELD_EVASION = Object.freeze({ buckler: 1 });
const BUILTIN_CLOTH = Object.freeze({ base: 0, dexCap: 4 });

export function evasionFor({ evasionArmor, dex, shield, evasionCard, attrs, evasion = 0 } = {}, tables = {}) {
  const flat = Number(evasion ?? 0);
  const extra = Number.isFinite(flat) ? flat : 0;
  if (evasionArmor == null && dex == null && shield == null && evasionCard == null && attrs?.DEX == null) return extra;
  const armorName = evasionArmor ?? 'Cloth';
  const row = tables?.armor?.get(armorName) ?? (armorName === 'Cloth' ? BUILTIN_CLOTH : undefined);
  if (!row) throw new RangeError(`unknown armor "${armorName}"`);
  // A missing dex takes attrs.DEX, and a missing attrs.DEX counts as 1 (adds 0).
  const dexNum = Number(dex ?? attrs?.DEX ?? 1);
  const dexTerm = Math.max(0, Math.min(dexNum - 1, row.dexCap)) || 0;
  const shieldBonus = shield != null && Object.hasOwn(SHIELD_EVASION, shield) ? SHIELD_EVASION[shield] : 0;
  let cardBonus = 0;
  if (evasionCard != null) {
    // Card names are case-sensitive, as in evasion-cards.csv. An unknown card throws.
    if (!tables?.cards?.has(evasionCard)) throw new RangeError(`unknown evasion card "${evasionCard}"`);
    cardBonus = tables.cards.get(evasionCard);
  }
  return row.base + dexTerm + shieldBonus + cardBonus + extra;
}

// Parses stance-advantage.csv text into a Map from 'attacker>defender' to a
// bonus. A blank bonus cell means the default, 1 (DESIGN.md, Momentum).
export function parseStanceAdvantage(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const header = (lines.shift() ?? '').split(',').slice(0, 3).join(',');
  if (header !== 'attacker_stance,defender_stance,bonus') {
    throw new TypeError('stance-advantage.csv: unexpected header');
  }
  const table = new Map();
  for (const line of lines) {
    const [attacker, defender, bonusCell] = line.split(',');
    const bonus = bonusCell === undefined || bonusCell.trim() === '' ? 1 : Number(bonusCell);
    if (!Number.isFinite(bonus)) throw new TypeError(`stance-advantage.csv: bad bonus in "${line}"`);
    table.set(`${attacker}>${defender}`, bonus);
  }
  return table;
}

// The bonus a stance earns against the opposing stance. 0 if none.
export function stanceBonus(table, stance, opposing) {
  if (!table || !stance || !opposing) return 0;
  return table.get(`${stance}>${opposing}`) ?? 0;
}

export const PERCEPTION_MAX = 3;

// Perception stage 0..3, clamped. Anything not a finite number counts as 0.
export function clampStage(stage) {
  const n = Number(stage);
  // NaN counts as 0. +-Infinity clamp to the ends, like any other out-of-range number.
  if (Number.isNaN(n)) return 0;
  return Math.min(PERCEPTION_MAX, Math.max(0, Math.trunc(n)));
}

// The target outline (owner decision 2026-10-12): the stance alone. Green when the card's stance beats the foe's
// revealed stance, red when the foe's beats the card's, and none when neutral, unrevealed (stage below 2) or
// aimed at the card's own side.
export function stanceOutline({ card, foe, stage = 3, stanceTable = null } = {}) {
  if (!card || typeof card !== 'object') throw new TypeError('card must be an object');
  if (!foe || typeof foe !== 'object') throw new TypeError('foe must be an object');
  if (card.target === 'self' || clampStage(stage) < 2) return null;
  if (stanceBonus(stanceTable, card.stance, foe.stance) > 0) return 'green';
  if (stanceBonus(stanceTable, foe.stance, card.stance) > 0) return 'red';
  return null;
}
