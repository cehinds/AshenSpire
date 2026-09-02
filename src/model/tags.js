// src/model/tags.js — the tag system's rules, as one validation pass.
//
// The vocabulary is one registry (content/source/tags.csv) and the carriers
// are declared in one table (tagFamilies.csv), so the rules that hold them
// together are one function rather than a check per family. Adding a family
// or a domain is a spreadsheet row; nothing here names a family or a tag.
//
// What this refuses, all BY NAME:
//   registry   a duplicate id, a malformed row, a domain no family carries,
//              an id that collides with a frozen engine keyword
//   families   an unknown `home`, an empty domain list, a duplicate family,
//              a `source` that cannot be read while rows depend on it
//   tagging    an unknown family, a row for an `inline` family (two homes for
//              one tag is how they drift), an id no object has, an unregistered
//              tag, a tag from a domain that family may not carry, a second row
//              for the same object, and an empty row
//   inline     the same tag/domain checks against the objects themselves
//
// The `legal:` list on a domain error is the point: the message tells the
// author which words this family accepts instead of making them find out.

/** Homes a family may declare — where its tags are authored. */
export const TAG_HOMES = Object.freeze(['inline', 'table']);

/** '' to [], 'a' to ['a'], ['a','b'] to ['a','b'] (the CSV coercion, undone). */
function list(v) {
  if (v === '' || v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Walk a dotted `source` path ('equipment.armaments') into the bundle. */
function atPath(bundle, path) {
  let node = bundle;
  for (const part of String(path).split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

/**
 * tagContentProblems(bundle) -> [{ path, message }]
 *
 * Pure: reads the bundle, allocates nothing on it. `keywordIds` is the frozen
 * engine keyword set, passed in so this module stays free of engine imports.
 */
export function tagContentProblems(bundle, keywordIds = []) {
  const problems = [];
  const err = (path, message) => problems.push({ path, message });
  const b = bundle || {};

  const registry = Array.isArray(b.tags) ? b.tags : null;
  const families = Array.isArray(b.tagFamilies) ? b.tagFamilies : null;
  const tagging = Array.isArray(b.tagging) ? b.tagging : null;
  if (!registry) err('tags', 'Missing required tag registry array');
  if (!families) err('tagFamilies', 'Missing required tagFamilies array');
  if (!tagging) err('tagging', 'Missing required tagging array');
  if (!registry || !families || !tagging) return problems;

  // ---- families -------------------------------------------------------------
  const familyByName = new Map();
  const declaredDomains = new Set();
  for (const row of families) {
    const name = (row && row.family) || '?';
    const path = `tagFamilies.${name}`;
    if (!row || typeof row.family !== 'string' || !row.family) {
      err(path, 'every family row needs a non-empty `family` name');
      continue;
    }
    if (familyByName.has(row.family)) {
      err(path, `duplicate family '${row.family}' — a family declares its home and domains exactly once`);
      continue;
    }
    if (!TAG_HOMES.includes(row.home)) {
      err(`${path}.home`, `unknown home '${row.home}' (legal: ${TAG_HOMES.join(', ')})`);
    }
    const domains = list(row.domains);
    if (!domains.length) {
      err(`${path}.domains`, 'domain list must be non-empty — a family that may carry no tag is not in the tag system; delete the row instead');
    }
    for (const domain of domains) declaredDomains.add(domain);
    familyByName.set(row.family, { ...row, domains });
  }

  // ---- registry -------------------------------------------------------------
  const byId = new Map();
  for (const row of registry) {
    const id = (row && row.id) || '?';
    const path = `tags.${id}`;
    if (!row || typeof row.id !== 'string' || !row.id) {
      err(path, 'every tag row needs a non-empty `id`');
      continue;
    }
    if (byId.has(row.id)) {
      err(path, `duplicate tag id '${row.id}' — one row per tag, in one registry`);
      continue;
    }
    if (typeof row.domain !== 'string' || !row.domain) {
      err(`${path}.domain`, 'every tag names the domain it describes — it is what keeps one registry from making every word legal everywhere');
    } else if (!declaredDomains.has(row.domain)) {
      err(`${path}.domain`, `no family carries domain '${row.domain}' (declared: ${[...declaredDomains].sort().join(', ')}) — this tag can never be worn by anything`);
    }
    if (!String(row.label || '').length) err(`${path}.label`, 'a tag needs a label — it is what the chip reads');
    if (!String(row.glyph || '').length) err(`${path}.glyph`, 'a tag needs a glyph');
    if (!/^[0-9A-Fa-f]{6}$/.test(String(row.color || ''))) {
      err(`${path}.color`, `colour must be a 6-digit hex with no '#', got ${JSON.stringify(row.color)}`);
    }
    // Tags are CONTENT; keywords are a frozen engine set. Overlapping names
    // would make 'exhaust' ambiguous between flavour and mechanics.
    if (keywordIds.includes(row.id)) {
      err(path, `tag id '${row.id}' collides with the frozen engine keyword of the same name`);
    }
    byId.set(row.id, row);
  }

  /** The shared per-carrier check: registered, and in a domain this family carries. */
  const checkTags = (family, path, ids) => {
    const spec = familyByName.get(family);
    const domains = spec ? spec.domains : [];
    for (const id of ids) {
      const tag = byId.get(id);
      if (!tag) {
        err(path, `unknown tag '${id}' — register it in content/source/tags.csv or fix the spelling`);
      } else if (!domains.includes(tag.domain)) {
        const legal = [...byId.values()].filter((t) => domains.includes(t.domain)).map((t) => t.id);
        err(path, `tag '${id}' is a ${tag.domain} tag; ${family} carries ${domains.join('/')} tags only (legal: ${legal.join(', ')})`);
      }
    }
  };

  // ---- the association table ------------------------------------------------
  // A family's `source` is checked HERE, against the rows that need it, rather
  // than on the family row: a bundle assembled without some collection is
  // another door's red (tools/content-build.mjs owns several by name), and
  // this pass must not quietly take ownership of it. What it does own is a
  // source that cannot be read while rows depend on it — then the id check
  // below would pass vacuously, which is worse than a missing collection.
  const badSource = new Set();
  const seen = new Set();
  for (const row of tagging) {
    const family = (row && row.family) || '?';
    const id = (row && row.id) || '?';
    const path = `tagging.${family}.${id}`;
    const spec = familyByName.get(family);
    if (!spec) {
      err(path, `unknown family '${family}' — add it to content/source/tagFamilies.csv (known: ${[...familyByName.keys()].join(', ')})`);
      continue;
    }
    if (spec.home !== 'table') {
      err(path, `family '${family}' authors its tags inline, on the object itself — a row here would be a second home for the same tag, and the two would drift`);
      continue;
    }
    const dupeKey = `${family} ${id}`;
    if (seen.has(dupeKey)) {
      err(path, `'${id}' is tagged twice in family '${family}' — the second row is silently ignored; put every tag on one row`);
      continue;
    }
    seen.add(dupeKey);
    const collection = spec.source ? atPath(b, spec.source) : null;
    if (spec.source && !Array.isArray(collection)) {
      if (!badSource.has(family)) {
        badSource.add(family);
        err(`tagFamilies.${family}.source`, `source '${spec.source}' is not a collection in the content bundle, so the ${family} rows in tagging.csv are checked against nothing`);
      }
    } else if (Array.isArray(collection) && !collection.some((entry) => entry && entry.id === id)) {
      err(path, `no ${family} with id '${id}' — the row tags nothing`);
    }
    const ids = list(row.tags);
    if (!ids.length) {
      err(path, 'tag list must be non-empty — an untagged thing simply has no row here');
    }
    checkTags(family, path, ids);
  }

  // ---- inline carriers ------------------------------------------------------
  for (const spec of familyByName.values()) {
    if (spec.home !== 'inline' || !spec.source) continue;
    const collection = atPath(b, spec.source);
    if (!Array.isArray(collection)) continue; // shape is the owning validator's red
    for (const entry of collection) {
      if (!entry) continue;
      const path = `${spec.source}.${entry.id || '?'}.tags`;
      if (entry.tags != null && !Array.isArray(entry.tags)) {
        err(path, `tags must be an array, got ${JSON.stringify(entry.tags)} — a '|'-separated cell normalises to one in the content module`);
        continue;
      }
      checkTags(spec.family, path, entry.tags || []);
    }
  }

  return problems;
}

/**
 * tagIdsInDomain(bundle, domain) -> [tagId]
 *
 * The legal vocabulary for one domain, read from content. Rules that used to
 * name a hard-coded list (creature kinds, effect schools) ask this instead, so
 * adding a creature kind stays a spreadsheet row.
 */
export function tagIdsInDomain(bundle, domain) {
  return (Array.isArray(bundle && bundle.tags) ? bundle.tags : [])
    .filter((t) => t && t.domain === domain)
    .map((t) => t.id);
}
