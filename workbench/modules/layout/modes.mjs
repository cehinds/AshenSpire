// workbench/modules/layout/modes.mjs — Layout Studio's modes and the deep link
// that opens one: #mod=layout&mode=battlefield|sketch|deck|orb|book-recipes|card-layers&…. Pure; index.mjs draws them.

export const MODES = Object.freeze([
  { id: 'config', label: 'UI config', built: true },
  { id: 'sketch', label: 'Sketch', built: true },
  { id: 'battlefield', label: 'Battlefield', built: true },
  { id: 'deck', label: 'Deck row', built: true },
  { id: 'orb', label: 'SP orb', built: true },
  { id: 'book-recipes', label: 'Book recipes', built: true },
  { id: 'card-layers', label: 'Card layers', built: true },
]);

/** The mode a deep link or a saved choice names; anything unknown or not built yet opens UI config. */
export function modeFor(value) {
  const mode = MODES.find((m) => m.id === value);
  return mode && mode.built ? mode.id : 'config';
}

/** The modes still listed under More: the ones not built yet. */
export const comingNext = () => MODES.filter((m) => !m.built);

/** The deep-link params for a mode: config needs none, so its link is #mod=layout alone. */
export function paramsFor(mode) {
  return mode === 'config' ? {} : { mode };
}
