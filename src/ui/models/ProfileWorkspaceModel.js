// W1g Profile: the rail's categories are the kinds of entry the save drawer
// actually holds (engine/save.js writes exactly two: a set-aside profile,
// kind 'meta', and a set-aside run, kind 'run'), so no category is invented.
// The current profile's identity is shown beside whichever is selected.
// DOM-free; it reads the list saves.listArchives() returned and changes nothing.

export const PROFILE_CATEGORIES = Object.freeze(['meta', 'run']);

/** An entry's category. Anything that is not a profile is a run, as describe() reads it. */
export function profileCategoryOf(entry) {
  return entry && entry.kind === 'meta' ? 'meta' : 'run';
}

/**
 * profileWorkspaceView(archives, current) → { categories, current, entries, empty }
 * The first category that holds anything is selected until the player picks
 * one; a pick is kept even when that category is empty. `empty` is 'drawer'
 * when nothing at all is set aside, 'category' when only this one is empty.
 */
export function profileWorkspaceView(archives = [], current = null) {
  const counts = Object.fromEntries(PROFILE_CATEGORIES.map((id) => [id, 0]));
  for (const entry of archives) counts[profileCategoryOf(entry)] += 1;
  const active = PROFILE_CATEGORIES.includes(current)
    ? current
    : PROFILE_CATEGORIES.find((id) => counts[id] > 0) || PROFILE_CATEGORIES[0];
  const entries = Object.freeze(archives.filter((entry) => profileCategoryOf(entry) === active));
  return Object.freeze({
    categories: Object.freeze(PROFILE_CATEGORIES.map((id) => Object.freeze({ id, count: counts[id], selected: id === active }))),
    current: active,
    entries,
    empty: archives.length === 0 ? 'drawer' : entries.length === 0 ? 'category' : null,
  });
}
