// Read idle artwork once, excluding transparent padding. Cache by asset URL;
// animation/stance changes must never resize the formation during a turn.
const boundsCache = new Map();
function imageBounds(img, refresh) {
  const key = img.currentSrc || img.src;
  if (!key) return null;
  if (boundsCache.has(key)) return boundsCache.get(key);
  if (!img.complete || !img.naturalWidth) {
    img.addEventListener('load', refresh, { once: true });
    img.addEventListener('error', refresh, { once: true });
    return null;
  }
  let bounds = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(img, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] < 40) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (x1 >= x0) bounds = { x0, y0, x1, y1 };
  } catch { /* A cross-origin or unavailable image retains box geometry. */ }
  boundsCache.set(key, bounds);
  return bounds;
}

export function combatSpriteGeometry(sprite, refresh) {
  const host = sprite.firstElementChild;
  const boxHeight = sprite.offsetHeight, boxWidth = sprite.offsetWidth;
  const stage = host.querySelector('.painted-stage');
  if (stage && !host.querySelector('.rendered-stage')) {
    return { boxHeight, visibleHeight: boxHeight * Number(stage.dataset.idleHeightRatio || 1),
      visibleWidth: boxHeight * Number(stage.dataset.idleWidthRatio || boxWidth / boxHeight), footOffset: 0 };
  }
  const img = host.querySelector('.enemy-pose-idle, .painted-presentation, .facing > img');
  const bounds = img && imageBounds(img, refresh);
  if (!bounds) return { boxHeight, visibleHeight: boxHeight, visibleWidth: boxWidth, footOffset: 0 };
  const paintedEnemy = Boolean(img.dataset.artSource);
  const scale = paintedEnemy ? boxHeight / img.naturalHeight
    : Math.min(boxWidth / img.naturalWidth, boxHeight / img.naturalHeight);
  const ground = paintedEnemy ? 364 : bounds.y1 + 1;
  const visibleHeight = Math.max(1, (ground - bounds.y0) * scale);
  // Reserve both sides of the centered canvas, including asymmetric weapons.
  const width = 2 * Math.max(img.naturalWidth / 2 - bounds.x0, bounds.x1 + 1 - img.naturalWidth / 2) * scale;
  return { boxHeight, visibleHeight, visibleWidth: Math.max(1, width),
    footOffset: paintedEnemy ? 0 : boxHeight - ((boxHeight - img.naturalHeight * scale) / 2 + ground * scale) };
}
