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

// Whether a role shows its intent above the sprite. Enemies do by default; the
// player has no intent of its own today, and the override stays configurable.
export function intentVisible(role, config = wireframeUi.overlay) {
  if (!OVERLAY_ROLES.includes(role)) throw new Error(`Unknown overlay role '${role}'`);
  return config.intentVisibleByRole?.[role] === true;
}
