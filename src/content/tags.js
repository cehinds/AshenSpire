// src/content/tags.js — THE tag vocabulary, and who carries it.
//
// One registry for the whole game, in third normal form. A card's school, a
// weapon's identity, a creature's kind, a class's leaning — all of it is rows
// in one set of tables, and nothing may carry a tag that is not registered.
// Tagging anything is a spreadsheet row, never a code change. Five tables,
// compiled by tools/content-build.mjs:
//
//   content/source/tagDomains.csv       what a tag can be ABOUT (the lookup)
//   content/source/tags.csv             the vocabulary — id, domain FK, chip
//   content/source/tagFamilies.csv      what can be tagged — source, scopeField
//   content/source/tagFamilyDomains.csv family x domain — who may carry what
//   content/source/tagging.csv          family, scope, objectId, tagId
//
// WHY FIVE TABLES AND NOT TWO. The first cut had a `domains` list on the family
// row, a `tags` list in the association table, and a `tags` COLUMN on every
// family that happened to be authored as a spreadsheet row. Every one of those
// is a repeating group in a cell — a 1NF break — and the last one was worse
// than untidy: it was a second home, so the same tag could be written in two
// places and drift. Normalising removed the lists and, with them, the second
// home. There is now exactly one place a tag on anything is written.
//
// WHY A DOMAIN AT ALL: one file holding the whole vocabulary would otherwise
// make 'beast' a legal card school and 'blade' a legal creature kind. Each
// family is paired with the domains it may draw from, and the validator refuses
// the rest — one home for the words, without collapsing a distinction the
// engine depends on (creature tags gate proc resistance).
//
// WHY A SCOPE COLUMN: an outfit's id is unique per class, not globally, so the
// parent key of `armour` is (classId, id). A junction row must carry the whole
// parent key or it identifies nothing — `scope` is that second half, and the
// family's `scopeField` names which field it came from. Every other family
// leaves it empty.
//
// Nothing here mutates content. Resolution is a lookup, so a bad tag shows up
// as a named validation failure rather than a silently missing chip.

import { tags } from './generated/tags.js';
import { tagDomains } from './generated/tagDomains.js';
import { tagFamilies } from './generated/tagFamilies.js';
import { tagFamilyDomains } from './generated/tagFamilyDomains.js';
import { tagging } from './generated/tagging.js';

/** All registered tags, in authoring order. */
export const TAGS = tags;

/** The domain lookup — what a tag can be about. */
export const TAG_DOMAINS = tagDomains;

/** Every content family that can be tagged, in authoring order. */
export const TAG_FAMILIES = tagFamilies;

/** The family-to-domain join: one row per permitted pair. */
export const TAG_FAMILY_DOMAINS = tagFamilyDomains;

/** The association rows, raw, for validation (which must see duplicates). */
export const TAGGING = tagging;

const BY_ID = new Map(tags.map((t) => [t.id, t]));
const DOMAIN_BY_ID = new Map(tagDomains.map((d) => [d.id, d]));
const FAMILY_BY_NAME = new Map(tagFamilies.map((f) => [f.family, f]));

// family -> [domainId], folded from the join once.
const DOMAINS_BY_FAMILY = new Map();
for (const row of tagFamilyDomains) {
  const list = DOMAINS_BY_FAMILY.get(row.family);
  if (list) list.push(row.domain);
  else DOMAINS_BY_FAMILY.set(row.family, [row.domain]);
}

// The parent key, whole: family + scope + objectId. Unit separator, because a
// scope or an id may legally contain anything an author can type.
const SEP = '\u001f';
const key = (family, scope, objectId) => `${family}${SEP}${scope || ''}${SEP}${objectId}`;

// key -> [tagId], in file order, so the first row authored is the first chip.
const BY_OBJECT = new Map();
for (const row of tagging) {
  const k = key(row.family, row.scope, row.objectId);
  const list = BY_OBJECT.get(k);
  if (list) list.push(row.tagId);
  else BY_OBJECT.set(k, [row.tagId]);
}

/** The family row, or null — `source` and `scopeField` live on it. */
export function tagFamily(family) {
  return FAMILY_BY_NAME.get(family) || null;
}

/** The domains a family may draw from (empty for an unknown family). */
export function domainsFor(family) {
  return DOMAINS_BY_FAMILY.get(family) || [];
}

/** The domain row, or null. */
export function tagDomain(id) {
  return DOMAIN_BY_ID.get(id) || null;
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
 * scopeOf(family, object) -> string
 *
 * The value of the family's `scopeField` on this object, or '' when the family
 * has none. This is the half of the parent key that is not the id.
 */
export function scopeOf(family, object) {
  const row = FAMILY_BY_NAME.get(family);
  if (!row || !row.scopeField) return '';
  return (object && object[row.scopeField]) || '';
}

/**
 * objectTagIds(family, objectId, scope) -> [tagId]
 *
 * By the whole parent key. Pass `scope` only for a family that declares a
 * scopeField; every other family keys on the id alone.
 */
export function objectTagIds(family, objectId, scope = '') {
  return BY_OBJECT.get(key(family, scope, objectId)) || [];
}

/**
 * tagIdsOf(family, object) -> [tagId]
 *
 * Tags for any object, keyed correctly whether or not its family is scoped.
 * This is the one call a mechanic should make.
 */
export function tagIdsOf(family, object) {
  if (!object) return [];
  return objectTagIds(family, object.id, scopeOf(family, object));
}

/** The same, resolved to registry rows (label, colour, glyph). */
export function tagsOf(family, object) {
  return resolve(tagIdsOf(family, object));
}

/** Ids to registry rows, dropping anything unregistered. */
export function resolve(ids) {
  return (ids || []).map((id) => BY_ID.get(id)).filter(Boolean);
}

/** Every object in a family carrying a given tag, as {scope, objectId}. */
export function objectsWithTag(family, tagId) {
  const out = [];
  const seen = new Set();
  for (const row of tagging) {
    if (row.family !== family || row.tagId !== tagId) continue;
    const k = key(row.family, row.scope, row.objectId);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ scope: row.scope || '', objectId: row.objectId });
  }
  return out;
}

// ---- cards: the original callers, unchanged --------------------------------

/** tagsFor(cardId) -> [{ id, domain, label, color, glyph, blurb }]. */
export function tagsFor(cardId) {
  return resolve(objectTagIds('card', cardId));
}

/** Raw tag ids for a card — for validation and synergy predicates. */
export function tagIdsFor(cardId) {
  return objectTagIds('card', cardId);
}

/**
 * damageTagIds(cardId, effectTags) -> [tagId]
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
  return objectsWithTag('card', tagId).map((row) => row.objectId);
}

export function hasTag(id) {
  return BY_ID.has(id);
}
