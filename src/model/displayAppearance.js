// Presentation choice only: never part of a run's combat rules or save checkpoint.
// The perspective-grid ("alternative") layout is the only appearance (owner,
// 2026-11-03: "Classic layout can now be deprecated."). A saved
// `classicAppearance` setting is ignored, so an old profile loads as the grid.
export function resolveDisplayAppearance(_settings = {}) {
  return 'alternative';
}
