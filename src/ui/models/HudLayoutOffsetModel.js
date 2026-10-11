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

/**
 * The screen box a packed target paints: its visible footer (centred on x,
 * top at y - footerSize / 2, footerHeight tall) united with its square tap
 * area (hitPx, centred on x, y). x and y are field-local; fieldLeft/fieldTop
 * turn them into screen px.
 */
export function targetPlateBox({ x, y, footerWidth = 0, footerHeight = 0, footerSize = 0, hitPx, fieldLeft = 0, fieldTop = 0 }) {
  const half = Math.max(footerWidth, hitPx) / 2;
  const top = Math.min(y - footerSize / 2, y - hitPx / 2);
  const bottom = Math.max(y - footerSize / 2 + footerHeight, y + hitPx / 2);
  return { left: fieldLeft + x - half, top: fieldTop + top, width: half * 2, height: bottom - top };
}

/**
 * offsetTargetPlate({ target, plate, dy, bounds, obstacles }) → target
 *   The selected enemy nameplate token moves the visible footer AND its tap
 *   target together: the returned target's y carries the accepted shift, so
 *   every consumer of the target (hit area, footer translate, HUD footprint)
 *   follows it. The offset is clamped to bounds and dropped when the moved
 *   plate would newly cover an obstacle (offsetPlacement). dy 0 returns the
 *   same target object.
 */
export function offsetTargetPlate({ target, plate, dy = 0, bounds, obstacles = [] }) {
  if (!dy) return target;
  const moved = offsetPlacement({ rect: plate, dy, bounds, obstacles });
  const shift = moved.top - plate.top;
  return shift ? { ...target, y: target.y + shift } : target;
}

/**
 * toolsRowTop({ dockTop, dy, row, screenTop, obstacles }) → top (screen px)
 *   The Combat log / Reaction row docks on the hand's top edge. Its offset
 *   token only RAISES it: below the dock are the cards, so a positive dy is
 *   ignored (the row stays docked). A negative dy is clamped to the combat
 *   screen's top and refused when the raised row would newly cover a control
 *   (header, ribbon, intents, HP plates, Inspect, targets).
 *   row: { left, width, height } of the docked row.
 */
export function toolsRowTop({ dockTop, dy = 0, row, screenTop = -Infinity, obstacles = [] }) {
  if (!(dy < 0)) return dockTop;
  return offsetPlacement({ rect: { left: row.left, top: dockTop, width: row.width, height: row.height }, dy,
    bounds: { left: -Infinity, right: Infinity, top: screenTop, bottom: dockTop + row.height }, obstacles }).top;
}
