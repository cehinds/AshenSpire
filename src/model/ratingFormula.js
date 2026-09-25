import { statRowValue } from './derivedStats.js';

export const ratingIds = Object.freeze(['ar', 'dr', 'pr', 'poise', 'ward']);
export const ratingAttributeIds = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);

// THE RATING FORMULA IS A STAT ROW (ruleset 7, owner 2026-09-24). AR, DR, PR,
// Poise and Ward are rows of the derived-stat table, priced by the one row
// formula (`statRowValue`), and `config.ratings` holds the rows THIS run reads
// (model/statRows.js ratingsConfigFor). The frozen ruleset-6 formula and its
// global multiplier live on only as the legacy adapter there, so a fight saved
// under them — whose rules still say `multiplier` — is priced as it was.

/**
 * attributeRatingReceipt(config, attributes, id, level) → the attribute part of
 * one rating: `{ base, weights, terms, weighted, attribute, value, … }`.
 */
export function attributeRatingReceipt(config, attributes, id, level = undefined) {
  const rule = config?.ratings?.[id];
  if (!rule) throw new Error(`Missing ${id} rating formula`);
  // A saved fight from before ruleset 7 states one multiplier for every row.
  const legacyMultiplier = Number.isFinite(config.multiplier) && config.multiplier !== 1 && rule.multiplier === undefined;
  const row = legacyMultiplier ? { ...rule, multiplier: config.multiplier } : rule;
  const receipt = statRowValue(row, { attributes, level, statId: id, lenientAttributes: true });
  const values = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, Number(attributes?.[attributeId]) || 0]));
  const weights = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, row[attributeId] || 0]));
  const terms = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, receipt.terms[attributeId] || 0]));
  return {
    id,
    base: receipt.base,
    multiplier: Number.isFinite(row.multiplier) ? row.multiplier : 1,
    values,
    weights,
    terms,
    weighted: receipt.points,
    levelBonus: receipt.levelBonus,
    attribute: receipt.value - receipt.base,
    min: receipt.min,
    max: receipt.max,
    value: receipt.value,
  };
}

// ---- WEAPON SCALING GRADES (SPEC §13.4o) ------------------------------------
//
// A grade is the rate one attribute point ABOVE the anchor pays into a graded
// weapon's attack rating. At or below the anchor every weapon reads the flat
// rule weight, so a stock lean character's creation damage does not move;
// above it, the grade. An ungraded attribute keeps the rule's own weight.
// Only the attack ratings are graded: a weapon's Defense, the wearer's Poise
// and Ward keep the flat formula.
export const WEAPON_SCALING_RATING_IDS = Object.freeze(['ar', 'pr']);

/**
 * Problems with a weapon-scaling table (balance or a run's snapshot), by name.
 * A run's snapshot also carries `pieces` — each graded armament's own
 * attribute → grade letters as the run was born with them (`{ snapshot: true }`);
 * balance never does (the letters are authored in weaponScaling.csv).
 */
export function weaponScalingProblems(scaling, where = 'balance.weaponScaling', { snapshot = false } = {}) {
  const problems = [];
  if (!scaling || typeof scaling !== 'object' || Array.isArray(scaling)) return [`${where}: must be an object { anchor, grades }`];
  const fields = snapshot ? ['anchor', 'grades', 'pieces'] : ['anchor', 'grades'];
  for (const key of Object.keys(scaling)) if (!fields.includes(key)) problems.push(`${where}.${key}: unknown field`);
  if (!Number.isInteger(scaling.anchor) || scaling.anchor < 0) problems.push(`${where}.anchor: must be a non-negative integer, got ${JSON.stringify(scaling.anchor)}`);
  const gradesOk = !!scaling.grades && typeof scaling.grades === 'object' && !Array.isArray(scaling.grades);
  if (!gradesOk) problems.push(`${where}.grades: must be an object of grade → coefficient`);
  else for (const [grade, coefficient] of Object.entries(scaling.grades)) {
    if (!/^[A-Z]$/.test(grade)) problems.push(`${where}.grades.${grade}: a grade is one capital letter`);
    if (!Number.isFinite(coefficient) || coefficient < 0) problems.push(`${where}.grades.${grade}: must be a finite non-negative number, got ${JSON.stringify(coefficient)}`);
  }
  if (snapshot && scaling.pieces !== undefined) {
    const isMap = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    if (!isMap(scaling.pieces)) problems.push(`${where}.pieces: must be an object of armament id → { attribute: grade }`);
    else for (const [pieceId, grades] of Object.entries(scaling.pieces)) {
      if (!isMap(grades)) { problems.push(`${where}.pieces.${pieceId}: must be an object of attribute → grade`); continue; }
      for (const [attributeId, grade] of Object.entries(grades)) {
        if (!ratingAttributeIds.includes(attributeId)) problems.push(`${where}.pieces.${pieceId}.${attributeId}: unknown attribute`);
        if (typeof grade !== 'string' || !(gradesOk && Object.hasOwn(scaling.grades, grade))) problems.push(`${where}.pieces.${pieceId}.${attributeId}: grade ${JSON.stringify(grade).replace(/"/g, "'")} is not in the table`);
      }
    }
  }
  return problems;
}

/**
 * The grade letters `piece` is priced by under `scaling`. A run's snapshot
 * that carries `pieces` owns them (a piece it does not name is ungraded for
 * that run, whatever a later content update says); a table without `pieces`
 * (a save from before the per-weapon snapshot, or balance itself) reads the
 * live piece's own letters.
 */
export function pieceGrades(piece, scaling) {
  if (!piece || !scaling) return null;
  if (scaling.pieces) return scaling.pieces[piece.id] || null;
  return piece.scaling || null;
}

/** True when this piece's `id` rating is priced by its grades under `scaling`. */
export function pieceIsGraded(piece, id, scaling) {
  const grades = pieceGrades(piece, scaling);
  return !!(scaling && scaling.grades && grades
    && WEAPON_SCALING_RATING_IDS.includes(id)
    && Object.keys(grades).length);
}

/**
 * gradedAttributeRatingReceipt(config, attributes, id, grades, scaling, level)
 * → the attributeRatingReceipt shape, priced by the SAME stat row
 * (`statRowValue`, SPEC §13.4o on the ruleset-7 row model) with each graded
 * attribute's term
 *   floor(w × min(v, anchor) + c × max(0, v − anchor))
 * — `w` the row's weight (0 when the row does not weigh it), `c` the grade's
 * coefficient; an ungraded attribute is the row's own flat term. The row's
 * base, multiplier, level bonus and bounds apply exactly as for the flat
 * rating. Carries `grades`, `anchor` and `coefficients`.
 */
export function gradedAttributeRatingReceipt(config, attributes, id, grades, scaling, level = undefined) {
  const rule = config?.ratings?.[id];
  if (!rule) throw new Error(`Missing ${id} rating formula`);
  const legacyMultiplier = Number.isFinite(config.multiplier) && config.multiplier !== 1 && rule.multiplier === undefined;
  const row = legacyMultiplier ? { ...rule, multiplier: config.multiplier } : rule;
  const anchor = scaling.anchor;
  const weights = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, Number.isFinite(row[attributeId]) ? row[attributeId] : 0]));
  const coefficients = Object.fromEntries(ratingAttributeIds.map((attributeId) => {
    const grade = grades?.[attributeId];
    if (grade == null) return [attributeId, weights[attributeId]];
    if (!Number.isFinite(scaling.grades[grade])) throw new Error(`weapon scaling grade '${grade}' is not in the run's grade table`);
    // A grade never pays less than the row's own weight (SPEC §13.4o): the
    // stat rows moved some weights above the lowest grades (AR STR 0.75 vs D 0.5).
    return [attributeId, Math.max(scaling.grades[grade], weights[attributeId])];
  }));
  const graded = Object.fromEntries(Object.keys(grades || {}).filter((a) => ratingAttributeIds.includes(a)).map((a) => [a, coefficients[a]]));
  const receipt = statRowValue(row, { attributes, level, statId: id, lenientAttributes: true, graded: { anchor, coefficients: graded } });
  const values = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, Number(attributes?.[attributeId]) || 0]));
  const terms = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, receipt.terms[attributeId] || 0]));
  return {
    id,
    base: receipt.base,
    multiplier: Number.isFinite(row.multiplier) ? row.multiplier : 1,
    values,
    weights,
    terms,
    weighted: receipt.points,
    levelBonus: receipt.levelBonus,
    attribute: receipt.value - receipt.base,
    min: receipt.min,
    max: receipt.max,
    value: receipt.value,
    grades: { ...grades },
    anchor,
    coefficients,
  };
}

export function equipmentRatingBase(piece, id, profile = null) {
  if (!piece) return 0;
  if (id === 'ar' || id === 'pr') return piece.attackRating || 0;
  if (id === 'dr') return piece.defenseRating || 0;
  if (id === 'poise' && piece.kind === 'armor') return piece.poiseThreshold || 0;
  if (id === 'ward' && profile?.ratingId === 'ward') return piece.defenseRating || 0;
  return 0;
}

/**
 * effectiveEquipmentRating(config, attributes, piece, profile, id, { level, scaling })
 * — `level` is the character level the rating row's per-level term reads;
 * `scaling` the run's weapon-scaling snapshot (SPEC §13.4o). A bare number in
 * place of the options is read as the level.
 */
export function effectiveEquipmentRating(config, attributes, piece, profile, id = profile?.ratingId, options = {}) {
  const { level = undefined, scaling = null } = (typeof options === 'number' || options == null) ? { level: options ?? undefined } : options;
  if (!ratingIds.includes(id)) throw new Error(`Unknown equipment rating '${id}'`);
  // A graded piece's attack rating reads its grades (SPEC §13.4o) — but only
  // under a scaling table the caller hands in (the run's own snapshot). No
  // table, or no grades on the piece, is the flat receipt, byte for byte.
  const graded = pieceIsGraded(piece, id, scaling);
  const attribute = graded
    ? gradedAttributeRatingReceipt(config, attributes, id, pieceGrades(piece, scaling), scaling, level)
    : attributeRatingReceipt(config, attributes, id, level);
  // THE ITEM'S RATING IS ITS OWN NUMBER, NOT A PLUS ON TOP OF IT (#1242). A
  // rating the item has a column for was written onto the piece by
  // `applyItemRatingConfig`, so `equipmentRatingBase` already reads it; one it
  // has no column for travels in the rules as `itemRatings` and REPLACES the
  // authored base. The old `bonuses.<item>` table is not read: a saved fight
  // still carries it, but the registries it is restored into already hold
  // authored + plus on the piece, and adding it here scored the plus twice.
  const itemKey = piece?.kind === 'armor' ? `armor:${piece.classId}:${piece.id}` : piece ? `armament:${piece.id}` : null;
  const configured = itemKey ? config?.itemRatings?.[itemKey]?.[id] : undefined;
  const equipmentBase = Number.isFinite(configured) ? configured : equipmentRatingBase(piece, id, profile);
  return {
    id,
    attributeBase: attribute.base,
    attributeValue: attribute.value,
    equipmentBase,
    value: attribute.value + equipmentBase,
    ...(graded ? { scaling: { grades: attribute.grades, anchor: attribute.anchor, coefficients: attribute.coefficients, terms: attribute.terms } } : {}),
  };
}
