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

/**
 * The version of the messages between the module and the render page. The render page is served by
 * the game's checkout, which may be another one; it sends this in `ready`, and the module refuses a
 * page that sends a different number. Bump it when a message changes shape.
 */
export const RENDER_PROTOCOL = 1;

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
 * The key value of an entity's row in its Data Studio table (the table's `id` column). An armour entity
 * is `classId:id` in the browser, but its table row is keyed by the outfit id alone; every other kind is
 * keyed by its entity id as it is.
 */
export function tableRowOf(kind, entityId) {
  const id = text(entityId);
  if (kind === 'armor' && id.includes(':')) return id.slice(id.indexOf(':') + 1);
  return id;
}

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

/**
 * The hands the Try in fight form starts with. A hand is an armament id or '' (an empty hand).
 * A hand that is unset (null) or names no known armament takes its default: main straightSword,
 * off roundShield, each when available, else the empty hand. A default off hand never equals the
 * main hand; a choice the reader made is kept as given.
 */
export function handsFor({ mainHand = null, offHand = null } = {}, armamentIds = []) {
  const ids = list(armamentIds).map(String);
  const known = (v) => v === '' || ids.includes(v);
  const main = known(mainHand) ? mainHand : (known('straightSword') ? 'straightSword' : '');
  let off = known(offHand) ? offHand : (known('roundShield') ? 'roundShield' : '');
  if (!known(offHand) && off !== '' && off === main) off = ids.find((id) => id !== main) ?? '';
  return { mainHand: main, offHand: off };
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

const FACET_OF = Object.freeze({ class: 'classes', type: 'types', tag: 'tags', rarity: 'rarities' });

/**
 * The filter values to show for the facets of the kind's loaded index. A value survives only when the
 * facets carry it. Before the index has loaded (`facets` null) every wanted value stays pending, so a
 * deep link's filters are not dropped while the index is still arriving.
 */
export function settleFilters(wanted = {}, facets = null) {
  const out = {};
  for (const [name, facet] of Object.entries(FACET_OF)) {
    const want = text(wanted[name]);
    out[name] = !facets || (facets[facet] || []).some((v) => v.value === want) ? want : '';
  }
  return out;
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

/**
 * What the module does after it resolves the game server: 'setup' (the server is down, show the setup
 * message), 'keep' (the same origin is already answering, leave the frames) or 'load' (point the frames
 * at the game, because the origin changed, the frames never answered, or a reload was forced).
 */
export function connectPlan({ base = null, currentOrigin = null, ready = false, force = false } = {}) {
  if (!base) return 'setup';
  const origin = new URL(base).origin;
  return !force && ready && origin === currentOrigin ? 'keep' : 'load';
}

/** The Workbench's `tools` listing → the game server's base URL, or null when it is down. */
export function gameBaseOf(tools = []) {
  const game = list(tools).find((t) => t && t.id === 'game');
  return game && game.status === 'up' && game.url ? String(game.url).replace(/\/?$/, '/') : null;
}
