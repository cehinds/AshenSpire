const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
export function localCamera(view, policy) {
  return {
    x: clamp(finite(view?.x, .5), 0, 1), y: clamp(finite(view?.y, .5), 0, 1),
    zoom: clamp(finite(view?.zoom, policy.defaultZoom), policy.minZoom, policy.maxZoom),
  };
}
export function cameraSize(view, width, height) { return Math.min(width, height) * view.zoom; }
export function anchoredZoom(view, zoom, anchor, width, height, policy) {
  const next = localCamera({ ...view, zoom }, policy);
  const oldSize = cameraSize(view, width, height), newSize = cameraSize(next, width, height);
  if (!oldSize || !newSize) return next;
  return localCamera({ ...next,
    x: view.x + (anchor.x - width / 2) * (1 / oldSize - 1 / newSize),
    y: view.y + (anchor.y - height / 2) * (1 / oldSize - 1 / newSize),
  }, policy);
}
export function panCamera(view, dx, dy, width, height, policy) {
  const size = cameraSize(view, width, height);
  return localCamera({ ...view, x: view.x - dx / (size || 1), y: view.y - dy / (size || 1) }, policy);
}
export function inspectionCamera(view, point, inspectionZoom, policy) {
  // Re-selecting or switching sites does not compound inspection zoom.
  const zoom = Math.max(view.zoom, inspectionZoom || view.zoom * policy.inspectionFactor);
  return localCamera({ x: point.x, y: point.y, zoom }, policy);
}
