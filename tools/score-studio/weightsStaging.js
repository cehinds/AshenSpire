// tools/score-studio/weightsStaging.js — pure helpers for the Weights tab's staged edits (owner, 2026-11-23).
//
// Weight edits collect in a pending copy of the scoring config. Nothing rescores until Apply copies that
// pending copy onto the applied config. No DOM here, so tests/score-studio.test.mjs can run it in Node.

// Sections the studio edits outside the Weights tab (card overrides, naming words). Apply keeps their
// applied values, so staging a weight never undoes a card edit made while the weight was pending.
export const LIVE_SECTIONS = Object.freeze(['overrides', 'naming']);

// Override fields that fix a card's score, and so its rank. A rarity override is not a rank pin.
export const RANK_PIN_FIELDS = Object.freeze(['rank', 'cp', 'raw']);

// Where Save keeps the studio's own config: outside content/, which the game build would read.
export const STUDIO_SAVE_PATH = 'tools/score-studio/saved-scoring.json';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Every leaf path whose value differs between two scoring configs, as 'a.b.c' strings.
export function ScoringDiffPaths(from, to)
{
  const paths = [];
  const walk = (before, after, prefix) =>
  {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const key of keys)
    {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(before?.[key]) && isPlainObject(after?.[key])) walk(before[key], after[key], path);
      else if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) paths.push(path);
    }
  };
  walk(from, to, '');
  return paths;
}

// The config Apply produces. Staged edits replace every weight section; an import replaces everything.
export function MergePendingScoring(applied, pending, { replaceAll = false } = {})
{
  const merged = structuredClone(pending);
  if (replaceAll) return merged;
  for (const section of LIVE_SECTIONS)
  {
    if (applied?.[section] === undefined) delete merged[section];
    else merged[section] = structuredClone(applied[section]);
  }
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
