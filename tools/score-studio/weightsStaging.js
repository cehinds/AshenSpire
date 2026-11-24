// tools/score-studio/weightsStaging.js — pure helpers for the Weights tab's staged edits (owner, 2026-11-23).
//
// Weight edits collect in a pending copy of the scoring config, next to the base it was copied from. Nothing
// rescores until Apply. Apply replays only what differs between base and pending onto the applied config as
// it is then, so an undo, an A/B slot load, a naming-word edit or a card override made meanwhile survives.
// No DOM here, so tests/score-studio.test.mjs can run it in Node.

// Override fields that fix a card's score, and so its rank. A rarity override is not a rank pin.
export const RANK_PIN_FIELDS = Object.freeze(['rank', 'cp', 'raw']);

// Where Save keeps the studio's own config: outside content/, which the game build would read.
export const STUDIO_SAVE_PATH = 'tools/score-studio/saved-scoring.json';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Keys an imported file could use to reach Object.prototype; never diffed, read or written.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ownKeys = (node) => Object.keys(node || {}).filter((key) => !UNSAFE_KEYS.has(key));

// Every leaf whose value differs between two configs, as key arrays (keys may hold dots, e.g. "rank.cantrip").
export function ScoringDiffKeys(from, to)
{
  const paths = [];
  const walk = (before, after, prefix) =>
  {
    const keys = new Set([...ownKeys(before), ...ownKeys(after)]);
    for (const key of keys)
    {
      const path = [...prefix, key];
      if (isPlainObject(before?.[key]) && isPlainObject(after?.[key])) walk(before[key], after[key], path);
      else if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) paths.push(path);
    }
  };
  walk(from, to, []);
  return paths;
}

// The same differences as 'a.b.c' strings, for counts and messages.
export function ScoringDiffPaths(from, to)
{
  return ScoringDiffKeys(from, to).map((path) => path.join('.'));
}

function readPath(root, path)
{
  return path.reduce((node, key) => (isPlainObject(node) && Object.hasOwn(node, key) ? node[key] : undefined), root);
}

function writePath(root, path, value)
{
  if (path.some((key) => UNSAFE_KEYS.has(key))) return;
  let node = root;
  for (const key of path.slice(0, -1))
  {
    if (!Object.hasOwn(node, key) || !isPlainObject(node[key])) node[key] = {};
    node = node[key];
  }
  const last = path[path.length - 1];
  if (value === undefined) delete node[last];
  else node[last] = structuredClone(value);
}

// The config Apply produces: the applied config with every staged difference (base -> pending) replayed on it.
export function MergePendingScoring(applied, base, pending)
{
  const merged = structuredClone(applied);
  for (const path of ScoringDiffKeys(base, pending)) writePath(merged, path, readPath(pending, path));
  return merged;
}

// True when an override fixes the card's score or rank.
export function HasRankPin(override)
{
  return isPlainObject(override) && RANK_PIN_FIELDS.some((field) => override[field] !== undefined);
}

// The override without its rank pins, or null when nothing is left.
export function WithoutRankPin(override)
{
  if (!isPlainObject(override)) return null;
  const rest = { ...override };
  for (const field of RANK_PIN_FIELDS) delete rest[field];
  return Object.keys(rest).length ? rest : null;
}

// Keys only the current naming tables have (owner, 2026-11-24): a config without them predates convention names.
const CURRENT_NAMING_PROBES = Object.freeze([['base', 'attack:martial:melee'], ['range'], ['tradition'], ['rarity']]);
// Auto-name word tables the studio used to seed; nothing reads them now.
const RETIRED_NAMING_TABLES = Object.freeze(['prefix', 'suffix']);

/** True when a config's naming.card lacks the current convention-name tables. */
export function NamingIsStale(config)
{
  const card = config?.naming?.card;
  if (!isPlainObject(card)) return true;
  return CURRENT_NAMING_PROBES.some(([table, key]) => !isPlainObject(card[table]) || (key !== undefined && !Object.hasOwn(card[table], key)));
}

/**
 * Brings a restored config's naming up to date, in place: a stale naming.card is replaced by the repo's copy (its limit
 * kept when it had one), and the retired prefix / suffix tables are dropped. Returns the config.
 */
export function RefreshRestoredNaming(config, repoScoring)
{
  if (!isPlainObject(config)) return config;
  const repoNaming = repoScoring?.naming;
  if (NamingIsStale(config) && isPlainObject(repoNaming))
  {
    const ownLimit = config.naming?.card?.limit;
    config.naming = { ...structuredClone(repoNaming), ...(isPlainObject(config.naming) ? { roman: config.naming.roman ?? repoNaming.roman } : {}) };
    if (ownLimit !== undefined) config.naming.card.limit = structuredClone(ownLimit);
  }
  const card = config.naming?.card;
  if (isPlainObject(card)) for (const table of RETIRED_NAMING_TABLES) delete card[table];
  return config;
}
