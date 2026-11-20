const SVG_NS = 'http://www.w3.org/2000/svg';
const alphaBoundsByUrl = new Map();

// Measure visible pixels, not the transparent export canvas. A faint fringe
// should not make the object tiny; retain a small margin around its solid art.
export function ItemArtBounds({ data, width, height }, naturalWidth = width, naturalHeight = height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 16) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) return null;
  const scaleX = naturalWidth / width, scaleY = naturalHeight / height;
  const w = (right - left + 1) * scaleX, h = (bottom - top + 1) * scaleY;
  return { x: left * scaleX - w * .04, y: top * scaleY - h * .04, width: w * 1.08, height: h * 1.08 };
}

function measure(image, doc) {
  try {
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext?.('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return ItemArtBounds(context.getImageData(0, 0, canvas.width, canvas.height), image.naturalWidth, image.naturalHeight);
  } catch { return null; } // CORS-tainted or unsupported canvas keeps the original image.
}

/** Fit an item cutout to its well without changing its raster or aspect ratio. */
export function BindMerchantItemArtFit(image, { isCurrent = () => true } = {}) {
  const doc = image.ownerDocument || document;
  let fitted = null;
  let fittedUrl = '';
  function fit() {
    if (!isCurrent() || !image.naturalWidth || !image.naturalHeight) return;
    const url = image.currentSrc || image.getAttribute('src');
    if (!url || (fitted && fittedUrl === url)) return;
    if (!alphaBoundsByUrl.has(url)) alphaBoundsByUrl.set(url, measure(image, doc));
    const bounds = alphaBoundsByUrl.get(url);
    if (!bounds || !isCurrent() || !image.parentNode) return;
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'merchant-item-art-fit');
    svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const raster = doc.createElementNS(SVG_NS, 'image');
    raster.setAttribute('href', url);
    raster.setAttribute('width', String(image.naturalWidth));
    raster.setAttribute('height', String(image.naturalHeight));
    raster.addEventListener('error', () => {
      if (!isCurrent() || fitted !== svg) return;
      svg.remove(); fitted = null; image.hidden = false;
      image.dispatchEvent(new Event('error'));
    }, { once: true });
    svg.append(raster);
    fitted?.remove();
    fitted = svg; fittedUrl = url;
    image.hidden = true;
    image.parentNode.append(svg);
  }
  image.addEventListener('load', fit);
  if (image.complete) fit();
}
