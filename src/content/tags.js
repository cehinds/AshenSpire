// src/content/tags.js — card subtype tags, indexed for lookup.
//
// The primary card type (attack / skill / power) is engine-load-bearing and
// frozen. Tags are the layer beneath it: what KIND of attack, which school a
// skill belongs to. They are authored as two spreadsheets and compiled by
// tools/content-build.mjs:
//
//   content/source/cardTags.csv     the registry — id, label, colour, glyph
//   content/source/cardTagging.csv  which cards carry which tags
//
// Tagging a card is a CSV row, never a code change. Nothing here mutates the
// card defs, so the validated content bundle is untouched and a bad tag shows
// up as a test failure rather than a silently missing chip.

import { cardTags } from './generated/cardTags.js';
import { cardTagging } from './generated/cardTagging.js';

/** All registered tags, in authoring order. */
export const TAGS = cardTags;

const BY_ID = new Map(cardTags.map((t) => [t.id, t]));

// cardId → [tagId]. The CSV coerces a single value to a string and a
// pipe-separated one to an array, so normalise both to an array here.
const BY_CARD = new Map(
  cardTagging.map((row) => [
    row.cardId,
    row.tags === '' ? [] : (Array.isArray(row.tags) ? row.tags : [row.tags]),
  ])
);

/** tagsFor(cardId) → [{ id, label, color, glyph, blurb }] (empty when untagged). */
export function tagsFor(cardId) {
  return (BY_CARD.get(cardId) || []).map((id) => BY_ID.get(id)).filter(Boolean);
}

/** Raw tag ids for a card — for validation and future synergy predicates. */
export function tagIdsFor(cardId) {
  return BY_CARD.get(cardId) || [];
}

/** Every card id that carries a given tag (e.g. "all Blade cards"). */
export function cardsWithTag(tagId) {
  const out = [];
  for (const [cardId, ids] of BY_CARD) if (ids.includes(tagId)) out.push(cardId);
  return out;
}

export function hasTag(id) {
  return BY_ID.has(id);
}
