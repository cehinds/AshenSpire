// src/model/tagService.js — the one door to the tag layer.
//
// The schema is five normalised tables (content/tags.js) and the constraints
// are one pass (model/tags.js). This is the third piece: the queries. Anything
// that wants to ASK something about tags asks here, so a new question is a
// method rather than a fresh `filter` written twice in two files.
//
// WHAT THIS IS NOT. It is not a wrapper over `obj.tags`. That field is the join
// already resolved — model/registries.js stamps it at boot from the same rows
// this service reads — and reading it in a hot path (the engine's proc gate,
// the equipment fit check) is correct and stays correct. What that field cannot
// do is answer a question in the other direction, say which tags a family is
// even ALLOWED to carry, or fail loudly when code names a tag that does not
// exist. Those are what this is for.
//
// WHY A FACTORY AND NOT LOOSE FUNCTIONS. Every query needs the same three
// indexes folded out of the frozen tables. Building them per call would be
// wasteful in the model layer's hot paths, so they are built once per
// registries object and memoised on it — the registries IS the unit of work,
// and it never changes after boot.
//
// The service reads REGISTRIES, not the bundle: the collections it walks are
// the materialised ones, so `withTag` hands back real objects rather than ids
// a caller then has to look up.

/**
 * @typedef {string} TagDomainId          a row in tagDomains.csv: card | creature | item | run
 * @typedef {string} TagFamilyId          a row in tagFamilies.csv: card | armament | enemy | ...
 * @typedef {{ id: string, domain: TagDomainId, label: string,
 *             color: string, glyph: string, blurb: string }} Tag
 * @typedef {{ family: TagFamilyId, source: string, scopeField: string,
 *             label: string, blurb: string }} TagFamily
 * @typedef {{ id: string, tags: string[] }} Tagged
 */

const CACHE = new WeakMap();

const SEP = '\u001f';
const keyOf = (family, scope, objectId) => `${family}${SEP}${scope || ''}${SEP}${objectId}`;

/**
 * Walk a family's dotted `source` into registries. Bundle collections become
 * either a plain array (equipment.armaments, unlocks) or an id registry
 * (cards, relics, enemies) on the way in, so both shapes resolve to rows here.
 */
function rowsAt(registries, source) {
  if (!source) return [];
  let node = registries;
  for (const part of String(source).split('.')) {
    if (!node || typeof node !== 'object') return [];
    node = node[part];
  }
  if (Array.isArray(node)) return node;
  if (node && typeof node.all === 'function') return node.all();
  return [];
}

function build(registries) {
  const tags = registries.tags || [];
  const byId = new Map(tags.map((t) => [t.id, t]));
  const families = new Map((registries.tagFamilies || []).map((f) => [f.family, f]));

  const domainsByFamily = new Map();
  for (const row of registries.tagFamilyDomains || []) {
    const list = domainsByFamily.get(row.family);
    if (list) list.push(row.domain);
    else domainsByFamily.set(row.family, [row.domain]);
  }

  // The junction, folded by the whole parent key, in authoring order.
  const byObject = new Map();
  for (const row of registries.tagging || []) {
    const k = keyOf(row.family, row.scope, row.objectId);
    const list = byObject.get(k);
    if (list) list.push(row.tagId);
    else byObject.set(k, [row.tagId]);
  }

  return { tags, byId, families, domainsByFamily, byObject };
}

/**
 * tagService(registries) -> frozen query object.
 *
 * Memoised per registries: the tables are frozen at boot, so the indexes are
 * built at most once for the life of the run.
 */
export function tagService(registries) {
  const cached = CACHE.get(registries);
  if (cached) return cached;

  const { tags, byId, families, domainsByFamily, byObject } = build(registries);

  /** The scope half of a parent key, from the family's scopeField. */
  const scopeOf = (family, object) => {
    const spec = families.get(family);
    if (!spec || !spec.scopeField) return '';
    return (object && object[spec.scopeField]) || '';
  };

  const service = Object.freeze({
    /**
     * The tag ids on one object, read from the junction rather than from the
     * object — so a hand-built or edited copy cannot answer for content.
     * @returns {string[]}
     */
    idsOf(family, object) {
      if (!object) return [];
      return byObject.get(keyOf(family, scopeOf(family, object), object.id)) || [];
    },

    /** The same, resolved to registry rows (label, colour, glyph). @returns {Tag[]} */
    tagsOf(family, object) {
      return service.resolve(service.idsOf(family, object));
    },

    /** Whether one object carries one tag. @returns {boolean} */
    has(family, object, tagId) {
      return service.idsOf(family, object).includes(tagId);
    },

    /**
     * Every object in a family carrying a tag, as the objects themselves.
     * "Every relic that shares a tag with the equipped weapon" is two calls,
     * not a filter written out again.
     * @returns {object[]}
     */
    withTag(family, tagId) {
      const spec = families.get(family);
      if (!spec) return [];
      return rowsAt(registries, spec.source)
        .filter((row) => row && service.idsOf(family, row).includes(tagId));
    },

    /** Every registered tag in one domain, e.g. every creature kind. @returns {Tag[]} */
    inDomain(domain) {
      return tags.filter((t) => t.domain === domain);
    },

    /** Every tag a family is permitted to carry. @returns {Tag[]} */
    allowedFor(family) {
      const domains = domainsByFamily.get(family) || [];
      return tags.filter((t) => domains.includes(t.domain));
    },

    /** The domains a family may draw from. @returns {TagDomainId[]} */
    domainsFor(family) {
      return [...(domainsByFamily.get(family) || [])];
    },

    /** One registered tag, or null. @returns {Tag|null} */
    tag(id) {
      return byId.get(id) || null;
    },

    /** Ids to rows, dropping anything unregistered. @returns {Tag[]} */
    resolve(ids) {
      return (ids || []).map((id) => byId.get(id)).filter(Boolean);
    },

    /**
     * Throw unless `tagId` is registered AND legal for `family`.
     *
     * tagContentProblems catches bad CONTENT at the boot door; this catches bad
     * CODE at the call, with the same message shape — the name of the offence
     * and the legal set, so the caller is told what to write instead.
     */
    assertLegal(family, tagId) {
      const tag = byId.get(tagId);
      if (!tag) {
        throw new Error(`unknown tag '${tagId}' — register it in content/source/tags.csv (known: ${[...byId.keys()].join(', ')})`);
      }
      const domains = domainsByFamily.get(family) || [];
      if (!domains.includes(tag.domain)) {
        const legal = service.allowedFor(family).map((t) => t.id);
        throw new Error(`tag '${tagId}' is a ${tag.domain} tag; ${family} carries ${domains.join('/') || 'no'} tags only (legal: ${legal.join(', ') || 'none'})`);
      }
      return tag;
    },
  });

  CACHE.set(registries, service);
  return service;
}
