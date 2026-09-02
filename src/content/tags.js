// src/content/tags.js — THE tag vocabulary, and who carries it.
//
// One registry for the whole game. A card's school, a weapon's identity, a
// creature's kind, a relic's flavour — all of it is one row in one file, and
// nothing may carry a tag that is not registered. Tagging anything is a
// spreadsheet row, never a code change. Three tables, compiled by
// tools/content-build.mjs:
//
//   content/source/tags.csv          the registry — id, DOMAIN, label, colour, glyph
//   content/source/tagFamilies.csv   who may carry which domains, and from where
//   content/source/tagging.csv       family + id to tags, for families authored in JS
//
// WHY A DOMAIN COLUMN: one file holding the whole vocabulary would otherwise
// make 'beast' a legal card school and 'blade' a legal creature kind. Each
// family declares the domains it draws from, and the validator refuses the
// rest — one home for the words, without collapsing distinctions the engine
// depends on (creature tags gate proc resistance).
//
// WHY TWO HOMES FOR THE TAGS THEMSELVES: a family already authored as a CSV
// row carries a `tags` column on that row, where the author is already
// looking. A family authored in JS/JSON has no such row, so it is tagged in
// the association table. Which of the two applies is stated per family in
// tagFamilies.csv as `home`, and the validator refuses a family that uses
// both — one home each, so a tag can never be authored twice and drift.
//
// Nothing here mutates content. Resolution is a lookup, so a bad tag shows up
// as a named validation failure rather than a silently missing chip.

import { tags } from './generated/tags.js';
import { tagFamilies } from './generated/tagFamilies.js';
import { tagging } from './generated/tagging.js';

/** '' to [], 'a' to ['a'], ['a','b'] to ['a','b'] (the CSV coercion, undone). */
function list(v) {
  if (v === '' || v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** All registered tags, in authoring order. */
export const TAGS = tags;

/** Every content family that carries tags, in authoring order. */
export const TAG_FAMILIES = tagFamilies.map((row) => ({ ...row, domains: list(row.domains) }));

/** The raw association rows, for validation (which must see duplicates). */
export const TAGGING = tagging.map((row) => ({ ...row, tags: list(row.tags) }));

const BY_ID = new Map(tags.map((t) => [t.id, t]));
const FAMILY_BY_NAME = new Map(TAG_FAMILIES.map((f) => [f.family, f]));

// 'family id' to [tagId]. One key space, so a card and a class may share an
// id without sharing tags.
const key = (family, id) => `${family} ${id}`;
const BY_OBJECT = new Map(TAGGING.map((row) => [key(row.family, row.id), row.tags]));

/** The family row, or null — `home`, `domains` and `source` live on it. */
export function tagFamily(family) {
  return FAMILY_BY_NAME.get(family) || null;
}

/** The domains a family may draw from (empty for an unknown family). */
export function domainsFor(family) {
  const row = FAMILY_BY_NAME.get(family);
  return row ? row.domains : [];
}

/** Every registered tag in a domain, e.g. every creature kind. */
export function tagsInDomain(domain) {
  return tags.filter((t) => t.domain === domain);
}

/** Every tag a family is allowed to carry, resolved. */
export function tagsAllowedFor(family) {
  const domains = domainsFor(family);
  return tags.filter((t) => domains.includes(t.domain));
}

/**
 * objectTagIds(family, id) to [tagId]
 *
 * The association-table half only — what tagging.csv says about this object.
 * Families whose home is `inline` are not in that table; read their `tags`
 * off the object (or use tagIdsOf, which handles both).
 */
export function objectTagIds(family, id) {
  return BY_OBJECT.get(key(family, id)) || [];
}

/**
 * tagIdsOf(family, object) to [tagId]
 *
 * Tags for any object, from whichever home its family declares. This is the
 * one call a mechanic should make: it never needs to know where an author
 * happened to type the tag.
 */
export function tagIdsOf(family, object) {
  if (!object) return [];
  const row = FAMILY_BY_NAME.get(family);
  if (row && row.home === 'inline') return list(object.tags);
  return objectTagIds(family, object.id);
}

/** The same, resolved to registry rows (label, colour, glyph). */
export function tagsOf(family, object) {
  return resolve(tagIdsOf(family, object));
}

/** Ids to registry rows, dropping anything unregistered. */
export function resolve(ids) {
  return (ids || []).map((id) => BY_ID.get(id)).filter(Boolean);
}

/** Every object id in a family carrying a given tag (association table only). */
export function objectsWithTag(family, tagId) {
  const out = [];
  for (const row of TAGGING) if (row.family === family && row.tags.includes(tagId)) out.push(row.id);
  return out;
}

// ---- cards: the original callers, unchanged --------------------------------

/** tagsFor(cardId) to [{ id, domain, label, color, glyph, blurb }] (empty when untagged). */
export function tagsFor(cardId) {
  return resolve(objectTagIds('card', cardId));
}

/** Raw tag ids for a card — for validation and synergy predicates. */
export function tagIdsFor(cardId) {
  return objectTagIds('card', cardId);
}

/**
 * damageTagIds(cardId, effectTags) to [tagId]
 *
 * A card hit inherits the card's authored identity. `effectTags` remains a
 * fallback for non-card effects and isolated engine fixtures; it never
 * overrides a card row, because that would restore two homes for one tag.
 */
export function damageTagIds(cardId, effectTags) {
  const derived = cardId ? tagIdsFor(cardId) : [];
  return derived.length ? derived : (Array.isArray(effectTags) ? effectTags : []);
}

/** Every card id that carries a given tag (e.g. "all Blade cards"). */
export function cardsWithTag(tagId) {
  return objectsWithTag('card', tagId);
}

export function hasTag(id) {
  return BY_ID.has(id);
}
