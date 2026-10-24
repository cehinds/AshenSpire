// src/content/noteKeys.js — lets authored JSON carry the `[NOTE]` blocks.
//
// A `[NOTE]` is a Symbol-keyed property (src/content/balance.js exports it as
// NOTE), and JSON cannot hold a Symbol key. A content/source file writes the
// note under the string key "$note" instead, with the same value shape the
// symbol holds today; tools/content-build.mjs wraps such a file's export in
// `withNotes(...)`, which turns every "$note" key back into the symbol.
// Symbol.for, not an import of balance.js, so this module has no cycle.
export const NOTE_SYMBOL = Symbol.for('ashenspire.balance.note');
export const NOTE_JSON_KEY = '$note';

/** Deep-walk plain objects and arrays, replacing each "$note" key with the NOTE symbol. */
export function withNotes(value) {
  if (Array.isArray(value)) return value.map(withNotes);
  if (value === null || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) out[key === NOTE_JSON_KEY ? NOTE_SYMBOL : key] = withNotes(child);
  return out;
}
