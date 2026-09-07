import { ACTION_ANIMATION_ACTORS, ACTION_ANIMATION_FAMILIES, ACTION_ANIMATION_TAGS, ACTION_ANIMATION_TYPES } from '../content/actionAnimations.js';
const own = (object, key) => Object.hasOwn(object, key) ? object[key] : undefined;

/** Pure animation plan. actorId is a class/enemy definition ID, not an instance
 * ID. Pass tags resolved by the existing tag service (IDs or tag rows). Pose
 * availability is explicit so missing art never requests an unshipped frame.
 * Precedence: actor/action override, authored tag order, intent, type, neutral.
 */
export function resolveActionAnimation({ actorId, actionId, tags = [], type, intent, availablePoses = [] } = {}) {
  const actor = own(ACTION_ANIMATION_ACTORS, actorId);
  let family = actor && own(actor.actions, actionId);
  let source = 'override';
  let matchedTag = null;
  if (!family) {
    const ids = new Set((Array.isArray(tags) ? tags : []).map(tag => typeof tag === 'string' ? tag : tag?.id));
    const row = ACTION_ANIMATION_TAGS.find(([id]) => ids.has(id));
    if (row) { [matchedTag, family] = row; source = 'tag'; }
  }
  if (!family) { family = own(ACTION_ANIMATION_TYPES, intent) || own(ACTION_ANIMATION_TYPES, type); source = 'type'; }
  if (!family) { family = 'neutral'; source = 'fallback'; }
  const definition = ACTION_ANIMATION_FAMILIES[family];
  const poses = new Set(Array.isArray(availablePoses) ? availablePoses : []);
  const pose = poses.has(definition.pose) ? definition.pose : (poses.has('idle') ? 'idle' : null);
  return Object.freeze({ family, source, matchedTag, motion: definition.motion, pose,
    spriteClass: actor?.spriteClass || null, tempo: actor?.tempo || 1, reach: actor?.reach || 1 });
}
