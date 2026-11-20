// src/model/validate/shared.js — the two small helpers every section validator reads.
// Split out of validate.js; a leaf (imports nothing from validate.js).

export function describe(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined'; // JSON.stringify(undefined) is undefined — 'undefined undefined' otherwise
  if (Array.isArray(v)) return 'array';
  // NaN and ±Infinity JSON.stringify to "null", so without this branch a NaN
  // red printed the riddle "Expected number, got number null" (Vira, #46).
  if (typeof v === 'number' && !Number.isFinite(v)) return `number ${String(v)}`;
  return typeof v === 'object' ? 'object' : `${typeof v} ${JSON.stringify(v)}`;
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Effects / triggers / predicates / formulas (closed-set checks)
// ---------------------------------------------------------------------------
