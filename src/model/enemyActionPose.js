// Receives a resolved, committed action. Never inspect the next enemy move here.
export function enemyActionPose(kind, plan = {}) {
  if (kind !== 'attack') return kind === 'block' || plan.family === 'guard' ? 'guard' : 'buff';
  if (plan.casting || plan.family === 'spell') return 'magicAttack';
  if (plan.family === 'projectile') return 'projectile';
  if (plan.family === 'sweep') return 'sweep';
  return 'attack';
}
