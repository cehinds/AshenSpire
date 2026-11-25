export const RECIPIENT_EFFECT_CATEGORIES = Object.freeze([
  'castingMovement', 'attackImpacts', 'defenseReactions', 'buffsStatuses',
]);

const movement = new Set(['spell-circle', 'advance', 'retreat']);
const attacks = new Set(['slash', 'multi-slash', 'thrust', 'smash', 'sweep', 'blunt', 'projectile', 'spell']);
const defenses = new Set(['block', 'block-hit', 'ward', 'ward-shatter', 'poise', 'poise-hit', 'poise-break', 'reflect', 'parry', 'evade', 'evade-gain', 'counter-hit', 'counter-gain']);

export function RecipientEffectCategory(recipe) {
  if (recipe.phase === 'windup' || recipe.phase === 'delivery') return 'castingMovement';
  if (RECIPIENT_EFFECT_CATEGORIES.includes(recipe.category)) return recipe.category;
  if (movement.has(recipe.shape)) return 'castingMovement';
  if (recipe.phase === 'reaction' || defenses.has(recipe.shape)) return 'defenseReactions';
  if (recipe.phase === 'contact' && (attacks.has(recipe.shape) || recipe.action === 'attack' || recipe.camp === 'spell')) return 'attackImpacts';
  return 'buffsStatuses';
}

const sameAction = (a, b) => a.action === b.action;
const isPrimaryOf = (primary, entry) => Boolean(entry.recipe.afterPrimaryKey)
  && sameAction(primary, entry) && primary.recipe.primaryKey === entry.recipe.afterPrimaryKey;

function categoryRank(entry, all, order) {
  const own = order.indexOf(entry.category);
  const primary = all.find(clip => isPrimaryOf(clip, entry));
  return primary ? Math.max(own, order.indexOf(primary.category)) : own;
}

/** Earliest legal admission, using reserved or actual starts and ends to account for occupied slots. */
function categoryQueueStart(entry, previous, pending, policy, now) {
  const all = [...previous, ...pending];
  const rank = categoryRank(entry, all, policy.order);
  const blocks = clip => sameAction(clip, entry) && (isPrimaryOf(clip, entry)
    || categoryRank(clip, all, policy.order) < rank);
  if (pending.some(clip => clip !== entry && blocks(clip))) return Infinity;
  let start = Math.max(now, entry.readyAt);
  for (const clip of previous) {
    if (clip.category === entry.category) start = Math.max(start, clip.start + policy.staggerMs);
    if (!blocks(clip)) continue;
    if (isPrimaryOf(clip, entry)) start = Math.max(start, Math.min(clip.end, clip.lastFrameAt));
    else start = Math.max(start, clip.end - policy.overlapMs);
  }
  const limits = [
    [policy.maxGlobal, previous],
    [policy.maxPerCategory[entry.category], previous.filter(clip => clip.category === entry.category)],
    ...entry.ids.map(id => [policy.maxPerActor, previous.filter(clip => clip.ids.includes(id))]),
  ];
  for (const [cap, lane] of limits) {
    const ends = lane.filter(clip => clip.end > start).map(clip => clip.end).sort((a, b) => b - a);
    if (ends.length >= cap) start = Math.max(start, ends[cap - 1]);
  }
  return start;
}

/** Select the next eligible entry without discarding a pending clip that cannot yet fit. */
export function NextCategoryQueueEntry(pending, previous, policy, now) {
  let next = null, start = Infinity;
  for (const entry of pending) {
    const candidate = categoryQueueStart(entry, previous, pending, entry.policy ?? policy, now);
    if (candidate < start) { next = entry; start = candidate; }
  }
  return next ? { entry: next, start } : null;
}
