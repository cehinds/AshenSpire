// Attachment points measured on the shipped 640px pose canvases (floor 600).
// Rows: idle, attack1..4. Each point is [x, y, rotation in degrees].
// These belong to the painting, not the target or card. Re-measure when art changes.
//
// The measurements live in
// content/config/ui/presentation/combatEffectAnchors.json. Everything above
// still binds whoever edits that file: these are measured on the art, and they
// are wrong until re-measured when the art is replaced.
import { uiConfig } from '../config/generated/ui.js';
import { thaw } from '../config/authored.js';

const { positioning, layering, sizing, behavior } = uiConfig.presentation.combatEffectAnchors;

export const COMBAT_EFFECT_ANCHORS = thaw(positioning.anchors);

export function combatPoseAttachment(actor, pose = behavior.defaultPose, anchor = behavior.defaultAnchor) {
  const row = COMBAT_EFFECT_ANCHORS[actor];
  if (!row) return null;
  // Index, not parse: the rows are ordered idle, attack1..4 and bash1..3, so
  // the frame lists in the config say the order once instead of a regex
  // re-deriving it from the pose name.
  let point;
  if (anchor === behavior.shieldAnchor) {
    const bash = behavior.shieldBashPoses.indexOf(pose);
    point = row[behavior.shieldRow][bash < 0 ? 0 : bash];
  } else {
    const attack = behavior.attackPoses.indexOf(pose);
    point = row[anchor === behavior.handAnchor ? behavior.castRow : behavior.weaponRow][attack + 1];
  }
  return { x: point[0], y: point[1], rotation: point[2] || 0 };
}

export function combatEffectAttachment(plan) {
  if (!plan || plan.projectile || plan.targetEvent !== behavior.attachTargetEvent) return null;
  if (plan.kind === behavior.shieldBashKind) return behavior.shieldAnchor;
  return behavior.weaponKinds.includes(plan.kind) ? behavior.defaultAnchor : null;
}

// Both halves share an origin. Complementary feathered masks split the trail
// around the actual pose silhouette without doubling the entire bright sprite.
export const COMBATANT_EFFECT_PLANES = thaw(layering.planes);
export const ATTACHMENT_SIZE = thaw(sizing.attachment);
