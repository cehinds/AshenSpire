import { COL_X, NODE_R, ZOOM_MAX } from '../../model/mapview.js';

export const ATLAS_NODE_SIZE = NODE_R * 2 * ZOOM_MAX;

// World coordinates stay authored. Match the traditional map's close-up pitch
// and frame the current node plus connected choices, rather than the continent.
export function atlasFocusCamera(points, width, height) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  let nearest = Infinity;
  for (let i = 0; i < points.length; i++) for (let k = i + 1; k < points.length; k++) {
    const distance = Math.hypot(points[i].x - points[k].x, points[i].y - points[k].y);
    if (distance > 0) nearest = Math.min(nearest, distance);
  }
  const padding = ATLAS_NODE_SIZE * 1.8;
  const desired = COL_X * ZOOM_MAX / (Number.isFinite(nearest) ? nearest : .06);
  const fit = Math.min((width - padding) / Math.max(.001, x1 - x0),
    (height - padding) / Math.max(.001, y1 - y0));
  const worldSize = Math.max(width, Math.min(desired, fit));
  return { zoom: Math.max(1, Math.min(32, worldSize / width)),
    x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}
