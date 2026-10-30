// Read idle artwork once, excluding transparent padding. Cache by asset URL;
// animation/stance changes must never resize the formation during a turn.
const boundsCache = new Map();
export function imageBounds(img, refresh) {
  const key = img.currentSrc || img.src;
  if (!key) return null;
  if (!img.complete || !img.naturalWidth) {
    img.addEventListener('load', refresh, { once: true });
    img.addEventListener('error', refresh, { once: true });
    return null;
  }
  if (boundsCache.has(key)) return boundsCache.get(key);
  let bounds = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(img, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    // The same box as testing every pixel, found from the edges inwards: each
    // scan stops at the first opaque pixel, so only the transparent margin is
    // read. A fight's first frame waits on this once per enemy art, and the
    // whole-canvas loop read every pixel of a 512 px canvas to find four edges.
    const w = canvas.width, h = canvas.height;
    const opaque = (x, y) => data[(y * w + x) * 4 + 3] >= 40;
    const rowHit = (y) => { for (let x = 0; x < w; x++) if (opaque(x, y)) return true; return false; };
    let y0 = 0; while (y0 < h && !rowHit(y0)) y0++;
    if (y0 < h) {
      let y1 = h - 1; while (y1 > y0 && !rowHit(y1)) y1--;
      const colHit = (x) => { for (let y = y0; y <= y1; y++) if (opaque(x, y)) return true; return false; };
      let x0 = 0; while (!colHit(x0)) x0++;
      let x1 = w - 1; while (x1 > x0 && !colHit(x1)) x1--;
      bounds = { x0, y0, x1, y1 };
    }
  } catch { /* A cross-origin or unavailable image retains box geometry. */ }
  boundsCache.set(key, bounds);
  return bounds;
}

// Reads a loaded image's opaque box into the cache ahead of its first use. The first read of each
// pose costs a whole-canvas readback, and it would otherwise land inside the first card play that
// shows the pose. An image still loading is left alone.
export function warmImageBounds(img) {
  if (img && img.complete && img.naturalWidth) imageBounds(img, () => {});
}

// The same, one image per idle slot, so the readbacks never join a frame's work. Without
// requestIdleCallback nothing is read early and the first use pays, as it always did.
const warmQueue = [];
let warmHandle = 0;
function warmStep() {
  warmHandle = 0;
  warmImageBounds(warmQueue.shift());
  if (warmQueue.length) warmHandle = requestIdleCallback(warmStep);
}
export function warmImageBoundsWhenIdle(img) {
  if (!img || typeof requestIdleCallback !== 'function' || warmQueue.includes(img) || warmQueue.length >= 64) return;
  warmQueue.push(img);
  if (!warmHandle) warmHandle = requestIdleCallback(warmStep);
}
