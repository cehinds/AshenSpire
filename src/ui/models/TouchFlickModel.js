// Coordinates are viewport CSS pixels, independent of card artwork and UI zoom.
export function flickPreferences(settings = {}, rules) {
  const raw = settings.touchFlickDistance;
  const value = raw == null || raw === '' ? rules.distance.def : Number(raw);
  return {
    enabled: typeof settings.touchFlickPlay === 'boolean' ? settings.touchFlickPlay : rules.enabled,
    distance: Number.isFinite(value) ? Math.max(rules.distance.min, Math.min(rules.distance.max, Math.floor(value))) : rules.distance.def,
  };
}

export function touchPoint(event) {
  return { x: event.clientX, y: event.clientY, time: event.timeStamp };
}

export function recordFlickPoint(points, point, rules) {
  points.push(point);
  while (points.length > 2 && points[1].time < point.time - rules.velocityWindowMs) points.shift();
}

export function flickVerdict(start, end, points, settings, rules) {
  const prefs = flickPreferences(settings, rules);
  const upward = start.y - end.y;
  const distanceMet = prefs.enabled && upward >= prefs.distance && upward > Math.abs(end.x - start.x);
  const recent = points.find(p => p.time >= end.time - rules.velocityWindowMs && p.time < end.time) || end;
  const elapsed = end.time - recent.time;
  const velocity = elapsed > 0 ? (recent.y - end.y) * 1000 / elapsed : 0;
  return { distanceMet, qualifies: distanceMet && velocity >= rules.minVelocity, velocity, upward };
}

export function nearestFlickTarget(targets, point) {
  return [...targets].sort((a, b) => {
    const distance = t => Math.hypot(point.x - t.x, point.y - t.y);
    return distance(a) - distance(b) || String(a.id).localeCompare(String(b.id));
  })[0] || null;
}
