// src/model/loadout/grantSources.js — where starting-deck and gear grants come from (settings, config, bound grants).
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

/**
 * grantSourceFor(cfg, role) -> tagId
 *
 * The grantSource tag a minting seam stamps, READ FROM THE AUTHORED MAP rather
 * than typed at the seam. Round twenty's finding: with the ids typed inline,
 * renaming a grantSource tag and its `sourceOrder` entry validated clean and
 * then dealt that source's cards last, because `sortBySourceOrder` no longer
 * recognised what the seam stamped. Validation guarantees every role in
 * MINTED_GRANT_ROLES is bound, so the fallback here is for hand-built configs
 * that never went through that door, not for shipped content.
 */
export function grantSourceFor(cfg, role) {
  const bound = ((cfg || {}).sources || {})[role];
  return typeof bound === 'string' && bound ? bound : null;
}

/** The composed-deck config, or null when the legacy roleCopies path is live. */
export function startingDeckConfig(registries) {
  const cfg = startingDeckSettings(registries);
  if (!cfg || cfg.enabled !== true) return null;
  return cfg;
}

/**
 * The same block, WITHOUT the enabled gate. Provenance is not a planner
 * feature: a granted card carries the id of the source that minted it whether
 * or not the composed plan is switched on, so the stamp reads this and the
 * planner reads startingDeckConfig.
 */
export function startingDeckSettings(registries) {
  return ((registries.balance || {}).equipment || {}).startingDeck;
}

/** The tag that says "this object carries its own cards"; payload in equipmentGrants.csv. */
export const BOUND_GRANT_TAG = 'bound';

/**
 * The two halves of a bound grant, held together.
 *
 * Tagged with no row is a broken promise the player can see and the deck never
 * honours; a row with no tag is a grant that lands with nothing declaring it.
 * Both are authoring mistakes, and neither is visible from its own side — so
 * they are checked from here, where both halves are in scope.
 */
export function boundGrantProblems(registries) {
  const problems = [];
  const eq = registries.equipment || {};
  const rows = eq.equipmentGrants;
  if (!Array.isArray(rows)) return ['equipmentGrants.csv: missing generated table'];
  // Pieces carry their family with them here, because the KEY is (family,
  // scope, sourceId) — an outfit id is unique only within its class, so
  // `default` alone names four different outfits and the bare id could neither
  // tell them apart nor let two of them grant different cards.
  const pieces = [
    ...(eq.armaments || []).map((piece) => ({ piece, family: 'armament' })),
    ...(eq.armour || []).map((piece) => ({ piece, family: 'armour' })),
  ];
  const keyFor = (family, scope, sourceId) => `${family}\u001f${scope || ''}\u001f${sourceId}`;
  const named = (row) => (row.scope ? `${row.family}/${row.scope}/${row.sourceId}` : `${row.family || '?'}/${row.sourceId}`);
  const seen = new Set();

  for (const row of rows) {
    if (!row || typeof row.sourceId !== 'string' || !row.sourceId) { problems.push('equipmentGrants.csv: row missing sourceId'); continue; }
    if (row.family !== 'armament' && row.family !== 'armour') {
      problems.push(`equipmentGrants.csv: '${row.sourceId}' names family '${row.family}' — must be 'armament' or 'armour'`);
      continue;
    }
    const key = keyFor(row.family, row.scope, row.sourceId);
    if (seen.has(key)) problems.push(`equipmentGrants.csv: duplicate row for ${named(row)}`);
    seen.add(key);
    const owners = pieces.filter((entry) => entry.family === row.family
      && entry.piece.id === row.sourceId
      && (entry.piece.classId || '') === (row.scope || ''));
    if (!owners.length) { problems.push(`equipmentGrants.csv: ${named(row)} names no known piece`); continue; }
    if (!owners.some((entry) => (entry.piece.tags || []).includes(BOUND_GRANT_TAG))) {
      problems.push(`equipmentGrants.csv: ${named(row)} grants cards but is not tagged '${BOUND_GRANT_TAG}' — the grant would be silent`);
    }
    if (!(row.cards || []).length) problems.push(`equipmentGrants.csv: ${named(row)} names no cards`);
    for (const cardId of row.cards || []) {
      if (!registries.cards.has(cardId)) problems.push(`equipmentGrants.csv: ${named(row)} grants unknown card '${cardId}'`);
    }
  }

  for (const { piece, family } of pieces) {
    if (!(piece.tags || []).includes(BOUND_GRANT_TAG)) continue;
    if (!seen.has(keyFor(family, piece.classId || '', piece.id))) {
      problems.push(`${piece.id}: tagged '${BOUND_GRANT_TAG}' but equipmentGrants.csv names no cards for it — the promise is empty`);
    }
  }
  return problems;
}

/**
 * Cards an object carries, or [] — the tag GATES the table, so a row nobody
 * tagged is inert rather than a silent grant. Works on anything with `tags`
 * and an `id`; nothing here is equipment-specific.
 */
export function boundGrantCardIds(registries, object, family = null) {
  if (!object || !(object.tags || []).includes(BOUND_GRANT_TAG)) return [];
  // The WHOLE piece identity, not the bare id: outfit ids repeat per class, so
  // `default` alone names four different outfits. `family` narrows it when the
  // caller knows which table the piece came from; the scope half is read off
  // the object, so a scoped family matches only its own row.
  const rows = (registries.equipment || {}).equipmentGrants || [];
  const row = rows.find((entry) => entry.sourceId === object.id
    && (!family || !entry.family || entry.family === family)
    && (entry.scope || '') === scopeOfPiece(registries, entry.family || family, object));
  return (row && row.cards) || [];
}

/** The scope half of a piece's key, from its family's scopeField. */
function scopeOfPiece(registries, family, object) {
  const spec = (registries.tagFamilies || []).find((row) => row.family === family);
  if (!spec || !spec.scopeField) return '';
  return (object && object[spec.scopeField]) || '';
}

/**
 * sortBySourceOrder(cfg, rows, sourceOf) -> rows
 *
 * Stable sort by `startingDeck.sourceOrder`, a list of grantSource tag ids. A
 * row whose source the list does not name sorts last, keeping its incoming
 * position. Shared so the plan's grants and the assembled deck cannot disagree
 * about what "in source order" means.
 */
export function sortBySourceOrder(cfg, rows, sourceOf) {
  const order = Array.isArray(cfg && cfg.sourceOrder) ? cfg.sourceOrder : [];
  const rank = (row) => {
    const at = order.indexOf(sourceOf(row));
    return at === -1 ? order.length : at;
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (rank(a.row) - rank(b.row)) || (a.index - b.index))
    .map((entry) => entry.row);
}
