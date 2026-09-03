// src/model/tags.js — the tag system's rules, as one validation pass.
//
// The schema is five normalised tables (content/tags.js says why), so the rules
// that hold them together are one function rather than a check per family.
// Adding a family or a domain is a spreadsheet row; nothing here names one.
//
// WHAT NORMALISING BOUGHT THIS FILE. The pre-3NF shape needed a rule for every
// way a list-in-a-cell could go wrong, plus a rule forbidding the second home
// (an inline `tags` column) from disagreeing with the first. Both classes of
// rule are gone: a repeating group cannot be written, and there is only one
// home to be wrong. What remains is ordinary referential integrity.
//
// What this refuses, all BY NAME:
//   domains    a duplicate id, a malformed row, a domain no family may carry
//   registry   a duplicate id, a malformed row, a domain that is not a row in
//              tagDomains, an id colliding with a frozen engine keyword
//   families   a duplicate family, a family paired with no domain, a `source`
//              that cannot be read while rows depend on it, a `scopeField` no
//              object in the family carries, and two families claiming one
//              source (the second would replace the first at materialisation)
//   pairs      an unknown family, an unknown domain, a duplicate pair
//   tagging    an unknown family, an unregistered tag, a tag from a domain the
//              family may not carry, an objectId no object has, a scope given
//              for an unscoped family, a scope missing on a scoped one, and a
//              duplicate (family, scope, objectId, tagId)
//   leftovers  an object still carrying its own `tags` — the old second home,
//              refused so it cannot come back one CSV column at a time
//   equipment  a weapon or outfit wearing no item-type tag — the guarantee
//              content/equipment.js used to throw for, moved with the tags —
//              a card profile wearing no tag at all, the guarantee the
//              basicCardProfiles schema used to give by requiring the column —
//              an itemType tag id missing the `item:` prefix the runtime
//              classifies by, which would silently strip every piece's type,
//              and an itemType label disagreeing with the one the runtime
//              derives from the same id, which would name one tag two ways
//
// The `legal:` list on a domain error is the point: the message tells the
// author which words this family accepts instead of making them find out.

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
 * The prefix an itemType tag id must carry. Typed here rather than imported so
 * this pass stays free of content imports; content/equipment.js owns the
 * runtime reader (ITEM_TYPE_TAG_PREFIX), and the suite asserts the two agree.
 */
const ITEM_TYPE_PREFIX = 'item:';

/**
 * itemTypeLabelFrom(id) -> string
 *
 * The Armoury's label for an itemType tag, derived from its id. This mirrors
 * content/equipment.js `itemTypeLabel` exactly (prefix off, split on '-', drop
 * the empties, title-case, rejoin) and returns '' where that returns null, so
 * one call answers both questions this pass asks: whether the id yields a label
 * at all, and what that label must be. Exported so the suite can pin the two
 * derivations to each other directly rather than only through shipped rows.
 */
export function itemTypeLabelFrom(id) {
  if (typeof id !== 'string' || !id.startsWith(ITEM_TYPE_PREFIX)) return '';
  return id.slice(ITEM_TYPE_PREFIX.length)
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

/** The whole parent key of one tagging row, as a string. */
const SEP = '\u001f';
const rowKey = (family, scope, objectId) => `${family}${SEP}${scope || ''}${SEP}${objectId}`;

/**
 * tagContentProblems(bundle, keywordIds) -> [{ path, message }]
 *
 * Pure: reads the bundle, allocates nothing on it. `keywordIds` is the frozen
 * engine keyword set, passed in so this module stays free of engine imports.
 */
export function tagContentProblems(bundle, keywordIds = []) {
  const problems = [];
  const err = (path, message) => problems.push({ path, message });
  const b = bundle || {};

  const table = (name) => (Array.isArray(b[name]) ? b[name] : null);
  const domainRows = table('tagDomains');
  const registry = table('tags');
  const families = table('tagFamilies');
  const pairs = table('tagFamilyDomains');
  const tagging = table('tagging');
  for (const [name, rows] of [['tagDomains', domainRows], ['tags', registry],
    ['tagFamilies', families], ['tagFamilyDomains', pairs], ['tagging', tagging]]) {
    if (!rows) err(name, `Missing required ${name} array`);
  }
  if (!domainRows || !registry || !families || !pairs || !tagging) return problems;

  // ---- domains (the lookup) --------------------------------------------------
  const domainById = new Map();
  for (const row of domainRows) {
    const id = (row && row.id) || '?';
    const path = `tagDomains.${id}`;
    if (!row || typeof row.id !== 'string' || !row.id) {
      err(path, 'every domain row needs a non-empty `id`');
      continue;
    }
    if (domainById.has(row.id)) {
      err(path, `duplicate domain '${row.id}' — one row per domain`);
      continue;
    }
    if (!String(row.label || '').length) err(`${path}.label`, 'a domain needs a label');
    domainById.set(row.id, row);
  }

  // ---- families --------------------------------------------------------------
  const familyByName = new Map();
  for (const row of families) {
    const name = (row && row.family) || '?';
    const path = `tagFamilies.${name}`;
    if (!row || typeof row.family !== 'string' || !row.family) {
      err(path, 'every family row needs a non-empty `family` name');
      continue;
    }
    if (familyByName.has(row.family)) {
      err(path, `duplicate family '${row.family}' — a family declares its source and scope exactly once`);
      continue;
    }
    familyByName.set(row.family, row);
  }
  // One source, one family. model/registries.js stamps per family into a map
  // KEYED BY SOURCE, so a second family naming the same collection does not
  // merge with the first — it replaces it, and every object in that collection
  // silently loses the tags the first family gave it.
  const familyBySource = new Map();
  for (const row of familyByName.values()) {
    if (!row.source) continue;
    const first = familyBySource.get(row.source);
    if (first) {
      err(`tagFamilies.${row.family}.source`, `source '${row.source}' is already claimed by family '${first}' — two families cannot tag one collection, because materialisation keys on the source and the second would replace the first`);
      continue;
    }
    familyBySource.set(row.source, row.family);
  }

  // ---- the family/domain join ------------------------------------------------
  const domainsByFamily = new Map();
  const seenPairs = new Set();
  for (const row of pairs) {
    const family = (row && row.family) || '?';
    const domain = (row && row.domain) || '?';
    const path = `tagFamilyDomains.${family}.${domain}`;
    if (!familyByName.has(family)) {
      err(path, `unknown family '${family}' — add it to content/source/tagFamilies.csv (known: ${[...familyByName.keys()].join(', ')})`);
      continue;
    }
    if (!domainById.has(domain)) {
      err(path, `unknown domain '${domain}' — add it to content/source/tagDomains.csv (known: ${[...domainById.keys()].join(', ')})`);
      continue;
    }
    const pairKey = `${family}${SEP}${domain}`;
    if (seenPairs.has(pairKey)) {
      err(path, `duplicate pair — '${family}' is already permitted to carry ${domain} tags`);
      continue;
    }
    seenPairs.add(pairKey);
    const list = domainsByFamily.get(family);
    if (list) list.push(domain);
    else domainsByFamily.set(family, [domain]);
  }
  for (const family of familyByName.keys()) {
    if (!domainsByFamily.has(family)) {
      err(`tagFamilies.${family}`, 'this family is paired with no domain, so it may carry nothing — pair it in tagFamilyDomains.csv, or delete the row');
    }
  }
  const carriedDomains = new Set([...domainsByFamily.values()].flat());
  for (const id of domainById.keys()) {
    if (!carriedDomains.has(id)) {
      err(`tagDomains.${id}`, 'no family may carry this domain — every tag naming it is unwearable; pair it in tagFamilyDomains.csv or delete the row');
    }
  }

  // ---- the registry ----------------------------------------------------------
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
    if (!domainById.has(row.domain)) {
      err(`${path}.domain`, `unknown domain ${JSON.stringify(row.domain)} — every tag names a row in tagDomains.csv (known: ${[...domainById.keys()].join(', ')})`);
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

  // ---- the association table -------------------------------------------------
  // A family's `source` is checked HERE, against the rows that need it, rather
  // than on the family row: a bundle assembled without some collection is
  // another door's red (tools/content-build.mjs owns several by name), and this
  // pass must not quietly take ownership of it. What it does own is a source
  // that cannot be read while rows depend on it — then the id check below would
  // pass vacuously, which is worse than a missing collection.
  const badSource = new Set();
  const seenRows = new Set();
  for (const row of tagging) {
    const family = (row && row.family) || '?';
    const objectId = (row && row.objectId) || '?';
    const scope = (row && row.scope) || '';
    const tagId = (row && row.tagId) || '?';
    const where = scope ? `${family}.${scope}.${objectId}` : `${family}.${objectId}`;
    const path = `tagging.${where}`;
    const spec = familyByName.get(family);
    if (!spec) {
      err(path, `unknown family '${family}' — add it to content/source/tagFamilies.csv (known: ${[...familyByName.keys()].join(', ')})`);
      continue;
    }

    const dupeKey = `${rowKey(family, scope, objectId)}${SEP}${tagId}`;
    if (seenRows.has(dupeKey)) {
      err(path, `'${objectId}' is given the tag '${tagId}' twice — the second row changes nothing; delete it`);
      continue;
    }
    seenRows.add(dupeKey);

    // The scope half of the parent key: present exactly when the family says so.
    if (spec.scopeField && !scope) {
      err(path, `family '${family}' is scoped by '${spec.scopeField}', so this row must name it — ids in this family are unique only within their scope`);
    } else if (!spec.scopeField && scope) {
      err(path, `family '${family}' declares no scopeField, so scope '${scope}' identifies nothing — leave the column empty`);
    }

    // The tag half: registered, and in a domain this family may carry.
    const tag = byId.get(tagId);
    const domains = domainsByFamily.get(family) || [];
    if (!tag) {
      err(path, `unknown tag '${tagId}' — register it in content/source/tags.csv or fix the spelling`);
    } else if (!domains.includes(tag.domain)) {
      const legal = [...byId.values()].filter((t) => domains.includes(t.domain)).map((t) => t.id);
      err(path, `tag '${tagId}' is a ${tag.domain} tag; ${family} carries ${domains.join('/')} tags only (legal: ${legal.join(', ')})`);
    }

    // The object half: a real row in the collection the family names.
    const collection = spec.source ? atPath(b, spec.source) : null;
    if (spec.source && !Array.isArray(collection)) {
      if (!badSource.has(family)) {
        badSource.add(family);
        err(`tagFamilies.${family}.source`, `source '${spec.source}' is not a collection in the content bundle, so the ${family} rows in tagging.csv are checked against nothing`);
      }
      continue;
    }
    if (!Array.isArray(collection)) {
      err(path, `family '${family}' names no source collection, so nothing can be tagged in it — this row tags nothing`);
      continue;
    }
    const found = collection.some((entry) => entry && entry.id === objectId
      && (!spec.scopeField || entry[spec.scopeField] === scope));
    if (!found) {
      err(path, scope
        ? `no ${family} with id '${objectId}' and ${spec.scopeField} '${scope}' — the row tags nothing`
        : `no ${family} with id '${objectId}' — the row tags nothing`);
    }
  }

  // ---- every equipment piece still declares an item type ---------------------
  // content/equipment.js used to THROW at CSV-normalisation time when a piece
  // carried no `item:*` tag. The tags moved, so the guarantee moved with them:
  // same rule, one table later, and now named rather than thrown.
  // The runtime classifies an item type by its `item:` prefix
  // (content/equipment.js itemTypeLabel), while this pass classifies by domain.
  // Two classifiers, so they must agree by rule or a domain-itemType tag named
  // without the prefix satisfies the check below and is then stamped as an
  // ordinary gameplay tag — every piece silently losing its type. Hold the
  // prefix here, where the author can see it.
  const itemTypeRows = [...byId.values()].filter((t) => t.domain === 'itemType');
  for (const row of itemTypeRows) {
    // The prefix alone is not enough: the runtime treats an id whose label
    // comes out EMPTY as an ordinary tag too, so `item:` and `item:-` would
    // both pass a prefix test and still strip the piece's type.
    const derived = itemTypeLabelFrom(row.id);
    if (!derived) {
      err(`tags.${row.id}`, `an itemType tag id must be '${ITEM_TYPE_PREFIX}' followed by at least one word — the runtime reads the type off that prefix and derives the Armoury's label from it, so an id that yields no label is stamped as an ordinary tag and the piece loses its type`);
      continue;
    }
    // ONE LABEL PER TAG. An itemType tag is the only kind whose display name is
    // written twice: once by the author in tags.csv, and once by the runtime,
    // which DERIVES it from the id when registries.js stamps `itemTypes` onto a
    // piece. Two writers, so they can disagree — `{ id: 'item:armor',
    // label: 'Plate' }` puts "Plate" in the tag registry and "Armor" on every
    // piece wearing it, and the same tag then reads as two different things
    // depending on which screen you are looking at. The derivation cannot bend
    // to the author (the runtime has only the id to work from), so the author
    // bends to the derivation, and the disagreement is named here instead of
    // shipping as a cosmetic mystery.
    if (row.label !== derived) {
      err(`tags.${row.id}`, `label '${row.label}' disagrees with the label the runtime derives from the id ('${derived}') — an itemType tag is named twice, here and by model/registries.js when it stamps a piece's itemTypes, so the two must match; write '${derived}', or rename the id to the one that yields the label you want`);
    }
  }
  const itemTypeIds = new Set(itemTypeRows.map((t) => t.id));
  if (itemTypeIds.size) {
    for (const family of ['armament', 'armour']) {
      const spec = familyByName.get(family);
      if (!spec || !spec.source) continue;
      const collection = atPath(b, spec.source);
      if (!Array.isArray(collection)) continue;
      for (const entry of collection) {
        if (!entry) continue;
        const scope = spec.scopeField ? (entry[spec.scopeField] || '') : '';
        const worn = tagging.filter((row) => row && row.family === family
          && (row.scope || '') === scope && row.objectId === entry.id);
        if (!worn.some((row) => itemTypeIds.has(row.tagId))) {
          err(`${spec.source}.${entry.id || '?'}`, `carries no item-type tag — every piece must declare at least one (legal: ${[...itemTypeIds].join(', ')}); add a tagging.csv row`);
        }
      }
    }
  }

  // ---- every card profile still declares at least one tag -------------------
  // Same story as the item-type rule above, one family over. A profile's tags
  // become the equipment card's `cardTags` — what the damage effect inherits
  // and what the card/weapon fit check reads — and the basicCardProfiles schema
  // used to guarantee they existed simply by requiring the column. The column
  // moved into tagging.csv, so the guarantee moves with it rather than lapsing:
  // a profile with no rows ships a card with no identity, quietly, and nothing
  // else in the pass would say so.
  const profileSpec = familyByName.get('basicCardProfile');
  if (profileSpec && profileSpec.source) {
    const profiles = atPath(b, profileSpec.source);
    if (Array.isArray(profiles)) {
      const tagged = new Set(tagging
        .filter((row) => row && row.family === 'basicCardProfile')
        .map((row) => row.objectId));
      for (const profile of profiles) {
        if (!profile || tagged.has(profile.id)) continue;
        err(`${profileSpec.source}.${profile.id || '?'}`, 'carries no tag — a profile\'s tags become the equipment card\'s identity, so a profile with none ships a card the damage effect and the fit check cannot recognise; add a tagging.csv row');
      }
    }
  }

  // ---- no second home --------------------------------------------------------
  // tagging.csv is the only place a tag is written. An object arriving from
  // content with its own `tags` is the old inline column coming back, and it
  // would be silently overwritten at materialisation — so it is refused here,
  // where the author can see it, rather than discovered later as a lost edit.
  for (const spec of familyByName.values()) {
    if (!spec.source) continue;
    const collection = atPath(b, spec.source);
    if (!Array.isArray(collection)) continue; // shape is the owning validator's red
    for (const entry of collection) {
      if (!entry || entry.tags === undefined) continue;
      err(`${spec.source}.${entry.id || '?'}.tags`, 'tags are authored in content/source/tagging.csv, not on the object — this field is a second home and would be overwritten; move it to a tagging row');
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

/**
 * tagIndex(bundle) -> { families, index, keyOf }
 *
 * The materialisation index: every family's tags, folded once, keyed by the
 * whole parent key. model/registries.js walks it to put a `tags` array on every
 * object — the join resolved eagerly, exactly once, at boot.
 */
export function tagIndex(bundle) {
  const b = bundle || {};
  const families = new Map((Array.isArray(b.tagFamilies) ? b.tagFamilies : [])
    .filter((row) => row && row.family)
    .map((row) => [row.family, row]));
  const index = new Map();
  for (const row of (Array.isArray(b.tagging) ? b.tagging : [])) {
    if (!row || !families.has(row.family)) continue;
    const k = rowKey(row.family, row.scope, row.objectId);
    const list = index.get(k);
    if (list) list.push(row.tagId);
    else index.set(k, [row.tagId]);
  }
  return { families, index, keyOf: rowKey };
}
