import { wireframeUi } from '../../content/wireframeUi.js';

// WCO0 combat overlays. The intent above the sprite and the defense (guard)
// badge beside it take their geometry from one config. Inputs and outputs are
// local (pre-zoom) CSS px; `rem` is the reference rem (at least 16 physical px)
// and physical minimums divide through the UI zoom once.

export const OVERLAY_ROLES = Object.freeze(['player', 'enemy']);
const SIDES = Object.freeze(['left', 'right']);

export function overlayGeometry({ zoom = 1, rem = 16 } = {}, config = wireframeUi.overlay) {
  const anchors = {};
  for (const role of OVERLAY_ROLES) {
    const anchor = config.defenseAnchorByRole?.[role];
    if (!anchor || !SIDES.includes(anchor.side)) throw new Error(`overlay: ${role} defense anchor needs side left or right`);
    if (!(anchor.heightFraction >= 0 && anchor.heightFraction <= 1)) throw new Error(`overlay: ${role} defense heightFraction must lie in 0..1`);
    anchors[role] = Object.freeze({ side: anchor.side, heightFraction: anchor.heightFraction });
  }
  return Object.freeze({
    // The badge sits OUTSIDE the sprite by this gap, on its role's side.
    gap: config.defenseGapRem * rem,
    defenseMin: config.defenseMinRem * rem,
    intentMin: config.intentMinRem * rem,
    valueFont: config.valueFontMinPx / zoom,
    anchors: Object.freeze(anchors),
  });
}

// WCO1 headroom. The overhead stack (Inspect over the intent) stands on the
// sprite's visible top, but never rises into the HUD band above the field. On
// a short field the stack comes down over the sprite rather than shrinking:
// its minimums and its order hold. One frame and unit for every input:
// `anchor` is the stack's resting bottom edge, `height` the stack's own
// height and `ceiling` the HUD band's bottom edge. Returns the bottom edge.
export function overheadStackBottom({ anchor, height, ceiling = 0 }) {
  for (const [name, value] of Object.entries({ anchor, height, ceiling })) {
    if (!Number.isFinite(value)) throw new Error(`overhead stack: ${name} must be a finite number`);
  }
  if (height < 0) throw new Error('overhead stack: height must be zero or more');
  const floor = ceiling + height;
  return Object.freeze({ bottom: Math.max(anchor, floor), clamped: anchor < floor });
}

// Whether a role shows its intent above the sprite. Enemies do by default; the
// player has no intent of its own today, and the override stays configurable.
export function intentVisible(role, config = wireframeUi.overlay) {
  if (!OVERLAY_ROLES.includes(role)) throw new Error(`Unknown overlay role '${role}'`);
  return config.intentVisibleByRole?.[role] === true;
}
