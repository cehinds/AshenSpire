// Pointer geometry only. The screen supplies live legal targets and commits.
export function cardDragConfig(settings, tuning) {
  const key = Object.prototype.hasOwnProperty.call(tuning.distances, settings?.cardDragDistance)
    ? settings.cardDragDistance : tuning.def;
  return { ...tuning, distance: tuning.distances[key],
    flick: typeof settings?.cardFlick === 'boolean' ? settings.cardFlick : tuning.flick };
}

export function cardDragVelocity(samples, point, windowMs) {
  const recent = samples.filter(sample => point.time - sample.time <= windowMs && sample.time < point.time);
  if (!recent.length) return 0;
  const first = recent[0];
  return Math.max(0, (first.y - point.y) / (point.time - first.time));
}

/** Returns the same legal target set for the preview and pointer release. */
export function cardDragPlan({ start, point, velocity = 0, peakUp = 0, config,
  mode, enemies = [], directTarget = null, blocked = false }) {
  const none = { legal: false, targetIds: [], gesture: false };
  if (blocked) return none;
  // Pointer hit testing remains available, but card artwork is never a hitbox.
  if (mode === 'none' && directTarget === 'self') return { legal: true, targetIds: [], gesture: false };
  const direct = enemies.find(enemy => enemy.id === directTarget);
  if (mode !== 'none' && direct) return { legal: true,
    targetIds: mode === 'all' ? enemies.map(enemy => enemy.id) : [direct.id], gesture: false };
  const dx = point.x - start.x, up = start.y - point.y;
  const towardField = up > 0 && up >= Math.abs(dx);
  const returned = peakUp - up > config.returnDistance;
  const distanceReady = up >= config.distance;
  const flickReady = config.flick && up >= config.flickDistance && velocity >= config.flickVelocity;
  if (!towardField || returned || (!distanceReady && !flickReady)) return none;
  if (mode === 'none') return { legal: true, targetIds: [], gesture: true };
  if (!enemies.length) return none;
  if (mode === 'all' || enemies.length === 1) return { legal: true, targetIds: enemies.map(enemy => enemy.id), gesture: true };
  // Multiple enemies require a clearly directed ray, not an arbitrary nearest
  // target. An angular tie stays unarmed so the player can continue aiming.
  const length = Math.hypot(dx, up);
  const aimed = enemies.map(enemy => {
    const ex = enemy.x - start.x, ey = start.y - enemy.y;
    const targetLength = Math.hypot(ex, ey);
    const cosine = targetLength ? (dx * ex + up * ey) / (length * targetLength) : -1;
    return { id: enemy.id, angle: Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI };
  }).sort((a, b) => a.angle - b.angle);
  if (aimed[0].angle > config.aimConeDegrees
      || aimed[1].angle - aimed[0].angle < config.aimSeparationDegrees) return none;
  return { legal: true, targetIds: [aimed[0].id], gesture: true };
}
