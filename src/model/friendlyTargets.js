// Headless friendly-target semantics shared by the authoritative engine and
// browser clients. This layer deliberately owns no DOM, colours, or rendering.

// Every hostile member of the effect target vocabulary owns card resolution
// before source-side self effects are considered. An AoE/random strike may
// heal, block, exhaust, or otherwise affect its source without becoming a
// friendly-target transaction.
const HOSTILE_TARGETS = new Set(['enemy', 'allEnemies', 'randomEnemy']);

export function friendlyTargetMode(def) {
  const effects = def && Array.isArray(def.effects) ? def.effects : [];
  const hasEnemy = effects.some((effect) => HOSTILE_TARGETS.has(effect.target));
  const hasAlly = effects.some((effect) => effect.target === 'ally');
  const hasSelf = effects.some((effect) => effect.target === 'self');
  // Enemy cards continue through enemy aiming even when they also have a
  // source-side self effect. Friendly aiming owns ally cards and pure self
  // cards only.
  if (hasEnemy || (!hasAlly && !hasSelf)) return 'none';
  if (hasAlly && hasSelf) return 'mixed';
  return hasAlly ? 'ally' : 'self';
}

export function friendlyTargetPlan(def, actorId, players = []) {
  const mode = friendlyTargetMode(def);
  if (mode === 'none') return { mode, active: false, targets: [], legalIds: [] };
  const targets = [];
  for (const player of players) {
    if (!player || !player.alive || !player.connected) continue;
    const relationship = player.id === actorId ? 'self' : 'ally';
    if (mode === 'self' && relationship !== 'self') continue;
    if (mode === 'ally' && relationship !== 'ally') continue;
    targets.push({ id: player.id, relationship });
  }
  return { mode, active: true, targets, legalIds: targets.map((target) => target.id) };
}

export function assertFriendlyTarget(plan, requestedId, actorId) {
  if (!plan || !plan.active) return requestedId;
  // A self-only card historically omitted targetId. Preserve that network
  // compatibility while the new clients always send their explicit choice.
  const targetId = requestedId == null && plan.mode === 'self' ? actorId : requestedId;
  if (!plan.legalIds.includes(targetId)) {
    throw new Error(`Invalid ${plan.mode} target '${targetId == null ? 'none' : targetId}'`);
  }
  return targetId;
}
