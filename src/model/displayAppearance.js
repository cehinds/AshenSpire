// Presentation choice only: never part of a run's combat rules or save checkpoint.
export const DISPLAY_APPEARANCES = Object.freeze(['alternative', 'classic']);
export function resolveDisplayAppearance(settings = {}) {
  return settings.classicAppearance === true ? 'classic' : 'alternative';
}
