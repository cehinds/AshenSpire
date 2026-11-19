// What a fight does with the item properties stamped on the player (`entity.itemProps`, built by
// model/itemProperties.js ItemPropertySummary at fight creation). Headless and import-free: each helper takes the
// combat or entity and queues ordinary effect ops or returns a number, so the seams in combat.js, statuses.js,
// gameProfileCombat.js, stanceRules.js, combatStatusControl.js and proposalStatusRules.js stay one line each.

const propsOf = (entity) => (entity && entity.kind !== 'enemy' ? entity.itemProps || null : null);

const queue = (ctx, entity, effect, card = null) => ctx.enqueue({ effect: { target: 'self', ...effect }, source: entity, owner: entity, target: entity, ...(card ? { card } : {}), meta: { itemProperty: true } });

/** Turn start: Block and a Poise guard are granted, and the once-a-turn flags reset. */
export function QueueItemTurnStart(ctx, player) {
  const props = propsOf(player);
  if (!props) return;
  player.itemSkillDrawn = false;
  if (props.startBlock > 0) queue(ctx, player, { op: 'block', amount: props.startBlock }, { proposalProtectionFloor: true });
  if (props.poiseGuard > 0) queue(ctx, player, { op: 'gainPoise', amount: props.poiseGuard });
}

/** Entering a different stance: draw and refund Stamina. */
export function QueueItemStanceEntry(ctx, entity) {
  const props = propsOf(entity);
  if (!props) return;
  if (props.stanceDraw > 0) queue(ctx, entity, { op: 'draw', amount: props.stanceDraw });
  if (props.stanceStamina > 0) queue(ctx, entity, { op: 'restoreStamina', amount: props.stanceStamina });
}

/** The first skill played each turn draws. */
export function QueueItemSkillPlayed(ctx, entity, def) {
  const props = propsOf(entity);
  if (!props?.firstSkillDraw || entity.itemSkillDrawn || def?.type !== 'skill') return;
  entity.itemSkillDrawn = true;
  queue(ctx, entity, { op: 'draw', amount: props.firstSkillDraw });
}

/** The hand cards kept at turn end by Retain properties: the dearest cards that can be kept (never Ethereal ones). */
export function ItemRetainIds(ctx, player, costOf) {
  const props = propsOf(player);
  if (!(props?.retain > 0)) return [];
  const already = new Set(player.combatRetainedCards || []);
  return ctx.piles.hand
    .filter((card) => !already.has(card.instanceId) && costOf(card) !== null)
    .map((card, index) => ({ id: card.instanceId, cost: costOf(card), index }))
    .sort((a, b) => b.cost - a.cost || a.index - b.index)
    .slice(0, props.retain).map((row) => row.id);
}

/** Percent added to the damage the player takes of one type: -50 for a resist, -100 for an immunity. */
export function ItemIncomingPercent(entity, damageType, element = null) {
  const kind = propsOf(entity)?.resist?.[damageType];
  const base = kind === 'immune' ? -100 : kind === 'resist' ? -50 : 0;
  // Owner, 2026-11-18: a gear Resist takes 25% less damage of its element, read off the hit's damage type or its school.
  const gear = propsOf(entity)?.gearResist;
  const percent = gear ? Math.max(gear[damageType] || 0, gear[element] || 0) : 0;
  return base <= -100 ? base : Math.max(-100, base - percent);
}

/** Stacks of a status after the player's properties made it smaller. */
export function ItemStatusStacks(target, statusId, stacks) {
  const n = propsOf(target)?.statusShorten?.[statusId];
  return n > 0 && stacks > 0 ? Math.max(0, stacks - n) : stacks;
}

/** A damage-channel (STR / DEX / INT) bonus while in the stance the player stands in. */
export function ItemStanceRating(entity, maneuver, ratingId) {
  return propsOf(entity)?.stanceRating?.[maneuver]?.[ratingId] || 0;
}

/** Extra hand size. */
export const ItemHandBonus = (ctx) => propsOf(ctx?.player)?.handSize || 0;

/** Extra Poise a hit removes: the player's Poise damage percent of what the hit took, never past what the pool has left. */
export function ItemPoiseExtra(source, poiseTaken, room) {
  const pct = propsOf(source)?.poiseDamagePct;
  return pct > 0 && poiseTaken > 0 ? Math.max(0, Math.min(room, Math.floor(poiseTaken * pct / 100))) : 0;
}
