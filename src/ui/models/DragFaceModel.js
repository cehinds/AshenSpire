// What a card dragged over an enemy shows (owner, 2026-11-14, Wave 2): the number and the cost of the enemy it is over, before release.
// The click path prices an aimed card with previewCard(combat, id, targetId) and attaches the target's name; the drag asks the same
// question through here, so what the ghost shows is what the play will deal and charge. Headless: no DOM, no rolls (a preview runs on a
// detached copy of the fight).

/**
 * DragFaceTargetId(plan) → the enemy id a drop plan would hit, or null when it points at no single enemy (the reference target then).
 * `plan` is the screen's dropPlan result: { legal, targetId? }.
 */
export function DragFaceTargetId(plan) {
  return plan?.legal && plan.targetId ? plan.targetId : null;
}

/**
 * DragFaceQuote({ preview, combat, instanceId, targetId, ranks, targetName, unplayable }) → { preview, affordable }
 *   preview(combat, instanceId, targetId, ranks): the screen's memoised previewCard.
 *   targetName(id): the enemy's name for the breakdown, as the click path attaches it.
 * `affordable` is the hand's own test, against what THIS target costs: a farther enemy that needs Advance can be out of reach.
 */
export function DragFaceQuote({ preview, combat, instanceId, targetId, ranks, targetName = null, unplayable = false }) {
  const quote = preview(combat, instanceId, targetId ?? undefined, ranks);
  const shown = targetId && targetName ? { ...quote, targetName: targetName(targetId) } : quote;
  const player = combat.player;
  const affordable = player.energy >= (shown.costIsX ? 0 : shown.cost) && player.mana >= shown.manaCost
    && player.stamina >= (shown.staminaCost || 0) && !unplayable;
  return { preview: shown, affordable };
}
