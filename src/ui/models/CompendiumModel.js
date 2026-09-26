// W1f Compendium: the rail's categories, the entry list and the selected
// entry's known facts. DOM-free. The reveal decision is not made here: each
// piece arrives with pieceReveal()'s answer (model/unlocks.js), and this model
// only projects what that answer allows. A withheld entry yields its rarity,
// its hand and why it is not yours; never its name (unless 'listed'), mods or
// tags, the same line the silhouette and the tooltip hold.

const DEFAULT_RARITY = 'common';

/**
 * compendiumSections(drawn, labelOf) → [{ kind, label, entries, have, total }]
 * `drawn` is [{ piece, reveal }] with hidden pieces already removed. A kind
 * exists because a row is filed under it, in the order the table first
 * mentions it; nothing here is an authored list of sections.
 */
export function compendiumSections(drawn = [], labelOf = (kind) => kind) {
  const order = [];
  const byKind = new Map();
  for (const entry of drawn) {
    const kind = entry.piece.kind;
    if (!byKind.has(kind)) { byKind.set(kind, []); order.push(kind); }
    byKind.get(kind).push(entry);
  }
  return order.map((kind) => {
    const entries = byKind.get(kind);
    return Object.freeze({
      kind, label: labelOf(kind), entries: Object.freeze(entries),
      have: entries.filter((e) => e.reveal.state === 'held').length, total: entries.length,
    });
  });
}

/**
 * compendiumView(drawn, { current, selectedId, labelOf }) → the rail, the
 * current kind's entries and the selected entry. The selection falls back to
 * the kind's first entry, so the detail slot is never an empty frame beside a
 * full list; a selection from another kind is not carried over.
 */
export function compendiumView(drawn = [], { current = null, selectedId = null, labelOf } = {}) {
  const sections = compendiumSections(drawn, labelOf);
  const section = sections.find((s) => s.kind === current) || sections[0] || null;
  const entries = section ? section.entries : Object.freeze([]);
  const selected = entries.find((e) => e.piece.id === selectedId) || entries[0] || null;
  return Object.freeze({
    categories: Object.freeze(sections.map((s) => Object.freeze({
      kind: s.kind, label: s.label, have: s.have, total: s.total, selected: s === section,
    }))),
    current: section ? section.kind : null,
    entries,
    selected,
    held: sections.reduce((n, s) => n + s.have, 0),
    total: sections.reduce((n, s) => n + s.total, 0),
  });
}

/**
 * entryDetail(piece, reveal, { modLines, tags, lockCopy }) → the selected
 * entry's known facts. `modLines` are the piece's mods already written as a
 * player reads them; they and the tags are dropped unless the piece is held,
 * whatever the caller passes.
 */
export function entryDetail(piece, reveal, { modLines = [], tags = [], lockCopy = {} } = {}) {
  const state = reveal.state;
  const held = state === 'held';
  const named = held || state === 'listed';
  const tagRows = held ? (piece.tags || []).map((id) => {
    const row = tags.find((tag) => tag.id === id);
    return Object.freeze({ id, label: row?.label || id, blurb: row?.blurb || id });
  }) : [];
  return Object.freeze({
    id: piece.id,
    state,
    held,
    named,
    name: named ? piece.name : null,
    kind: piece.kind,
    rarity: piece.rarity || DEFAULT_RARITY,
    hand: piece.hand,
    mods: Object.freeze(held ? [...modLines] : []),
    tags: Object.freeze(tagRows),
    hint: held ? '' : (reveal.hint || lockCopy[reveal.gate] || ''),
  });
}
