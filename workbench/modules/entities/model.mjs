// workbench/modules/entities/model.mjs — DOM-free helpers shared by the Entity
// Browser module (index.mjs) and its render page (render.mjs, served by the game
// server). Everything here is plain data in, plain data out: the index rows, the
// filters, the sort orders, the deep link and the URLs.

/** The ten kinds the browser shows, in chip order. `registry` names the content collection. */
export const KINDS = Object.freeze([
  { id: 'armaments', label: 'Armaments', singular: 'Armament', registry: 'equipment.armaments' },
  { id: 'armor', label: 'Armor', singular: 'Armor', registry: 'equipment.armour' },
  { id: 'potions', label: 'Potions', singular: 'Potion', registry: 'flasks' },
  { id: 'relics', label: 'Relics', singular: 'Relic', registry: 'relics' },
  { id: 'cards', label: 'Cards', singular: 'Card', registry: 'cards' },
  { id: 'statuses', label: 'Statuses', singular: 'Status', registry: 'statuses' },
  { id: 'stances', label: 'Stances', singular: 'Stance', registry: 'stances' },
  { id: 'keywords', label: 'Keywords', singular: 'Keyword', registry: 'keywords' },
  { id: 'enemies', label: 'Enemies', singular: 'Enemy', registry: 'enemies' },
  { id: 'classes', label: 'Classes', singular: 'Class', registry: 'classes' },
]);

export const DEFAULT_KIND = 'armaments';
export const VIEWS = Object.freeze(['grid', 'detail', 'worn', 'tooltip', 'inventory', 'data']);
export const DENSITIES = Object.freeze(['compact', 'comfortable', 'spacious']);
export const LAYOUTS = Object.freeze(['grid', 'list']);

/** The five sort orders. */
export const SORTS = Object.freeze([
  { id: 'name', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'id', label: 'ID A–Z' },
  { id: 'rarity', label: 'Rarity, then name' },
  { id: 'class', label: 'Class, then name' },
]);
export const DEFAULT_SORT = 'name';

/** Rarity ranks: lower sorts first; anything unlisted goes after these, by name. */
export const RARITY_ORDER = Object.freeze(['starter', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'boss', 'unique']);

/**
 * The Data Studio table each kind is authored in (content/source), where one
 * exists. A kind without an entry opens no table; the module disables the button.
 */
export const SOURCE_TABLES = Object.freeze({
  armaments: 'content/source/weapons.csv',
  armor: 'content/source/outfits.csv',
});

/** The table a kind is edited in, or null (the Data Studio button is then disabled). */
export function sourceTableFor(kind, files = null) {
  const path = SOURCE_TABLES[kind];
  if (!path) return null;
  if (!files) return path;
  return files.includes(path) ? path : null;
}

/** Escapes text for HTML element content and quoted attribute values. */
export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** The hand choices for the Try in fight form: the empty hand, then each armament as [id, name]. */
export function handChoices(armaments = []) {
  return [['', 'Empty hand'], ...armaments.map((a) => [String(a.id), String(a.name ?? a.id)])];
}

export function kindOf(id) {
  return KINDS.find((k) => k.id === id) || null;
}

const text = (v) => (v === undefined || v === null ? '' : String(v));
const list = (v) => (Array.isArray(v) ? v : []).filter((x) => x !== undefined && x !== null && x !== '');

/**
 * One index row from a plain content definition. `itemTypes` may be labels or
 * {tag,label} rows; `class` is the classId or class field a definition carries.
 * The render page calls this on the real registry objects.
 */
export function entryOf(kind, def) {
  const itemTypes = list(def.itemTypes).map((t) => (typeof t === 'string' ? t : text(t.label ?? t.tag))).filter(Boolean);
  const cls = text(def.classId || def.class || (kind === 'classes' ? def.id : ''));
  return {
    id: text(def.id),
    name: text(def.name || def.id),
    kind,
    tags: list(def.tags).map(text),
    itemTypes,
    rarity: text(def.rarity),
    class: cls,
  };
}

/** Lower-case words of an entry, searched by the filter column. */
function haystack(entry) {
  return [entry.name, entry.id, ...entry.tags, ...entry.itemTypes].join(' ').toLowerCase();
}

/**
 * Keeps the entries that match every filter. `q` is a search: each word must
 * appear in the name, id, tags or item types. class/type/tag/rarity match exactly
 * ('' or missing means any).
 */
export function filterEntries(entries, filters = {}) {
  const words = text(filters.q).toLowerCase().split(/\s+/).filter(Boolean);
  return list(entries).filter((e) => {
    if (words.length) {
      const hay = haystack(e);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (filters.class && e.class !== filters.class) return false;
    if (filters.type && !e.itemTypes.includes(filters.type)) return false;
    if (filters.tag && !e.tags.includes(filters.tag)) return false;
    if (filters.rarity && e.rarity !== filters.rarity) return false;
    return true;
  });
}

const rarityRank = (r) => {
  const i = RARITY_ORDER.indexOf(r);
  return i < 0 ? RARITY_ORDER.length : i;
};
const byName = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

/** A copy of the entries in one of the five sort orders (unknown sort = name). */
export function sortEntries(entries, sort = DEFAULT_SORT) {
  const copy = [...list(entries)];
  switch (sort) {
    case 'name-desc': return copy.sort((a, b) => byName(b, a));
    case 'id': return copy.sort((a, b) => a.id.localeCompare(b.id));
    case 'rarity': return copy.sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || byName(a, b));
    case 'class': return copy.sort((a, b) => a.class.localeCompare(b.class) || byName(a, b));
    default: return copy.sort(byName);
  }
}

/** Facet values for the filter column, each with how many entries carry it. */
export function facetsOf(entries) {
  const count = (pick) => {
    const m = new Map();
    for (const e of list(entries)) for (const v of [].concat(pick(e))) {
      if (v) m.set(v, (m.get(v) || 0) + 1);
    }
    return [...m].map(([value, n]) => ({ value, count: n })).sort((a, b) => a.value.localeCompare(b.value));
  };
  return {
    classes: count((e) => e.class),
    types: count((e) => e.itemTypes),
    tags: count((e) => e.tags),
    rarities: count((e) => e.rarity),
  };
}

/** Counts per kind from a { kind: number } map, in KINDS order, zero when unknown. */
export function chipCounts(counts = {}) {
  return KINDS.map((k) => ({ id: k.id, label: k.label, count: Number(counts[k.id]) || 0 }));
}

const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/**
 * The deep link and the state it names. `params` is the object of `#mod=entities&…`
 * (or URLSearchParams). Unknown values fall back to the defaults.
 */
export function parseDeepLink(params = {}) {
  const get = (k) => (params instanceof URLSearchParams ? params.get(k) : params[k]);
  const kind = pick(get('kind'), KINDS.map((k) => k.id), DEFAULT_KIND);
  return {
    kind,
    view: pick(get('view'), ['grid', 'detail', 'worn', 'tooltip', 'inventory', 'data'], 'grid'),
    id: text(get('id')) || null,
    q: text(get('q')),
    sort: pick(get('sort'), SORTS.map((s) => s.id), DEFAULT_SORT),
    class: text(get('class')),
    type: text(get('type')),
    tag: text(get('tag')),
    rarity: text(get('rarity')),
    density: pick(get('density'), DENSITIES, 'comfortable'),
    layout: pick(get('layout'), LAYOUTS, 'grid'),
    tab: pick(get('tab'), ['card', 'inventory', 'worn', 'tooltip', 'data', 'try'], 'card'),
  };
}

/** The inverse of parseDeepLink: only the non-default values are written. */
export function deepLinkOf(state = {}) {
  const s = { ...parseDeepLink({}), ...state };
  const out = new URLSearchParams({ mod: 'entities', kind: s.kind });
  if (s.id) out.set('id', s.id);
  if (s.q) out.set('q', s.q);
  if (s.sort !== DEFAULT_SORT) out.set('sort', s.sort);
  for (const k of ['class', 'type', 'tag', 'rarity']) if (s[k]) out.set(k, s[k]);
  if (s.tab && s.tab !== 'card') out.set('tab', s.tab);
  return `#${out}`;
}

/** The game's entry page with the render page's parameters. */
export function renderUrl(gameBase, { parentOrigin = '', ...params } = {}) {
  const base = String(gameBase || '').replace(/\/?$/, '/');
  const q = new URLSearchParams();
  if (parentOrigin) q.set('po', parentOrigin);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  return `${base}workbench/modules/entities/render.html?${q}`;
}

/**
 * The fight URL the armament-kits preview opened (its shotKit/shotMainHand/
 * shotOffHand combat), relative to the game base. The built AshenSpire.html is not
 * in a checkout, so the game's index page carries the same shot parameters.
 */
export function tryFightUrl(gameBase, { classId = 'reaver', mainHand = '', offHand = '' } = {}) {
  const base = String(gameBase || '').replace(/\/?$/, '/');
  const q = new URLSearchParams({ shot: 'combat', shotKit: '1', shotClass: classId, shotMainHand: mainHand, shotOffHand: offHand });
  return `${base}index.html?${q}`;
}

/** The Workbench's `tools` listing → the game server's base URL, or null when it is down. */
export function gameBaseOf(tools = []) {
  const game = list(tools).find((t) => t && t.id === 'game');
  return game && game.status === 'up' && game.url ? String(game.url).replace(/\/?$/, '/') : null;
}
