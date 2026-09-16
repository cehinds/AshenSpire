// One default for every place a player figure can be created or restored.
// Explicit saved choices remain authoritative; only an absent choice uses this.
export const DEFAULT_SPRITE_STYLE = 'animated';

export const SPRITE_STYLES = Object.freeze([
  Object.freeze({ id: 'animated', name: 'Animated' }),
  Object.freeze({ id: 'rendered', name: 'Rendered' }),
  Object.freeze({ id: 'classic', name: 'Classic' }),
  Object.freeze({ id: 'glyph', name: 'Sigil' }),
]);
