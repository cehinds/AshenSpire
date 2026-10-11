// HUD layout geometry tokens (docs/hud-layout-tokens.md): the `px` offsets the
// studio authors per form factor. Pure and DOM-free.
//
// An offset is added AFTER the existing placement and then clamped by the same
// rules that placement obeys: the box stays inside its bounds, and an offset
// that would land it on another control is refused — the box keeps its placed
// position. With both offsets 0 the placed rect is returned untouched, so the
// placement models behave exactly as they did before the tokens existed.

export const HUD_GEOMETRY_TOKENS = Object.freeze({
  playerDetailsDx: '--hud-player-details-dx',
  playerDetailsDy: '--hud-player-details-dy',
  enemyNameplateDy: '--hud-enemy-nameplate-dy',
  turnRibbonDy: '--hud-turn-ribbon-dy',
  toolsDy: '--hud-tools-dy',
});

/** Reads every geometry token from one computed style (CSS px; 0 when unset). */
export function hudGeometry(style) {
  const read = (name) => {
    const value = parseFloat(style?.getPropertyValue?.(name));
    return Number.isFinite(value) ? value : 0;
  };
  return Object.fromEntries(Object.entries(HUD_GEOMETRY_TOKENS).map(([key, name]) => [key, read(name)]));
}

const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * offsetPlacement({ rect, dx, dy, bounds, obstacles }) → { left, top, shifted }
 *   rect      the placed box { left, top, width, height } in screen px
 *   dx, dy    the offset in screen px
 *   bounds    { left, right, top, bottom } the box must stay inside
 *   obstacles boxes it must not newly overlap
 */
export function offsetPlacement({ rect, dx = 0, dy = 0, bounds, obstacles = [] }) {
  if (!dx && !dy) return { left: rect.left, top: rect.top, shifted: false };
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const left = bounds ? clamp(rect.left + dx, bounds.left, bounds.right - rect.width) : rect.left + dx;
  const top = bounds ? clamp(rect.top + dy, bounds.top, bounds.bottom - rect.height) : rect.top + dy;
  const moved = { left, top, right: left + rect.width, bottom: top + rect.height };
  const placed = { left: rect.left, top: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height };
  // Only a NEW overlap refuses the offset: an obstacle the placed box already
  // touched (its own anchored door, say) is not the offset's doing.
  const blocked = obstacles.some((box) => box && overlaps(moved, box) && !overlaps(placed, box));
  if (blocked) return { left: rect.left, top: rect.top, shifted: false };
  return { left, top, shifted: left !== rect.left || top !== rect.top };
}
