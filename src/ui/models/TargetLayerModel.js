import { wireframeUi } from '../../content/wireframeUi.js';

// WGC4 target layer. One home for which combatants a pending command may be
// aimed at: a living enemy in the pending command's target plan. The engine
// still revalidates the command; this decides what the battlefield highlights.
export function targetLayer({ armed, enemies = [], legalIds = null }) {
  const eligibleIds = armed ? enemies.filter(enemy => enemy.alive && (!legalIds || legalIds.includes(enemy.id))).map(enemy => enemy.id) : [];
  return Object.freeze({ active: eligibleIds.length > 0, eligibleIds: Object.freeze(eligibleIds) });
}

// The eligible-target outline lives on the sprite host, which the formation
// zooms by `scale` (screen px per sprite px). Authored in sprite px, it is held
// at a physical minimum so a small phone sprite does not thin it to 1 px.
// Browsers floor outline widths and offsets to whole device pixels, so each
// minimum is asked for with half a pixel of headroom (2 * 0.7115 = 1.9999
// drew 1 px).
export const OUTLINE_SNAP_HEADROOM_PX = 0.5;
export function targetOutline({ scale = 1, config = wireframeUi.targetLayer } = {}) {
  const k = scale > 0 ? scale : 1;
  return Object.freeze({
    width: Math.max(config.outlinePx, (config.outlineMinPx + OUTLINE_SNAP_HEADROOM_PX) / k),
    offset: Math.max(config.offsetPx, (config.offsetMinPx + OUTLINE_SNAP_HEADROOM_PX) / k),
  });
}
