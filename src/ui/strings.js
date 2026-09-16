// src/ui/strings.js — the one lookup for every sentence the interface says.
//
// WHY A TABLE. The copy audit counted 493 hardcoded copy sites across 64 files
// in src/ui, 404 of them distinct. Three costs, all of them paid by a player:
// two screens say the same thing in two voices (the Armoury's "Storage full"
// and the spoils door's "storage is full"); a reword is a code change in n
// files, so it does not happen; and nothing can tell whether a string is even
// reachable. content/source/uiStrings.csv is the table those sentences move
// to — authored in a spreadsheet like every other content table, compiled to
// a data module by tools/content-build.mjs, and read from here.
//
// THREE FORMS PER ID, never a runtime guess between them: `short` is what the
// control wears, `full` is the sentence it means, `tip` is the tooltip title a
// too-small face gets. A form the table leaves blank is not '' — it is absent,
// and asking for it throws by name. That is Law 1 clause 5 applied to prose:
// a missing string fails loud at the call site rather than painting an empty
// button nobody notices until a player meets it.
//
// EXTENDS is the inheritance the content review asked for, applied to this
// table first because copy is where near-duplication actually lives: a row
// inherits each cell it leaves blank from the row it names. `reward.skip` is
// the house Skip with one sentence changed, and the word "Skip" has one home.
//
// TOKENS are {braced} and substituted from the caller's object. An unresolved
// token throws: prose that names a number the caller never passed is prose
// lying about the game state, and a visible '{amount}' is the kinder half of
// that same defect.
//
// WHAT THIS IS NOT. Not an i18n layer — there is one locale and the table has
// no language column. Adding one is a column and a resolver argument, and the
// shape here does not prevent it; claiming it exists would.

import { uiStrings } from '../content/generated/uiStrings.js';

const FORMS = ['short', 'full', 'tip'];

/** The table as authored, indexed by id, before inheritance. */
const rows = new Map();
for (const row of uiStrings) {
  const id = String(row?.id || '').trim();
  if (!id) throw new Error('uiStrings: a row has no id');
  if (rows.has(id)) throw new Error(`uiStrings: duplicate id '${id}'`);
  rows.set(id, row);
}

/**
 * resolve(id) → { short, full, tip } with every blank cell filled from the
 * chain of `extends` rows above it. Memoised, because a screen asks for the
 * same handful of ids on every render.
 *
 * A cell containing '|' arrives here as an array (the CSV reader's list rule)
 * and is refused rather than joined: nobody authored the joined sentence.
 */
const resolved = new Map();
function resolve(id, seen = []) {
  if (resolved.has(id)) return resolved.get(id);
  const row = rows.get(id);
  if (!row) throw new Error(`uiStrings: unknown id '${id}'`);
  if (seen.includes(id)) throw new Error(`uiStrings: extends cycle ${[...seen, id].join(' → ')}`);
  const parentId = String(row.extends || '').trim();
  const parent = parentId ? resolve(parentId, [...seen, id]) : null;
  const out = {};
  for (const form of FORMS) {
    const cell = row[form];
    if (Array.isArray(cell)) throw new Error(`uiStrings: '${id}.${form}' contains '|' — a cell is one sentence, not a list`);
    const own = cell == null ? '' : String(cell);
    out[form] = own || (parent ? parent[form] : '');
  }
  resolved.set(id, out);
  return out;
}

/** Substitute {tokens}; an unresolved one is a defect, not a visible brace. */
function fill(text, tokens, id, form) {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    if (!tokens || !Object.hasOwn(tokens, key)) {
      throw new Error(`uiStrings: '${id}.${form}' wants {${key}} and the caller passed none`);
    }
    return String(tokens[key]);
  });
}

function read(id, form, tokens) {
  const text = resolve(id)[form];
  if (!text) throw new Error(`uiStrings: '${id}' has no ${form} form`);
  return fill(text, tokens, id, form);
}

/** t(id, tokens) — the control's own words. */
export function t(id, tokens = null) { return read(id, 'short', tokens); }
/** tFull(id, tokens) — the sentence it means. */
export function tFull(id, tokens = null) { return read(id, 'full', tokens); }
/** tTip(id, tokens) — the tooltip title a too-small face gets. */
export function tTip(id, tokens = null) { return read(id, 'tip', tokens); }

/** has(id, form) — for a caller that offers a form only when it is authored. */
export function has(id, form = 'short') {
  if (!rows.has(id)) return false;
  return !!resolve(id)[form];
}

/** Every authored id, for instruments that sweep the table. */
export function stringIds() { return [...rows.keys()]; }
