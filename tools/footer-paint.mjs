// The transparent padding of authored PNG/WebP components is not missing ink.
// Still require real artwork pixels, independently of labels, and preserve
// the whole-control and text occlusion checks in hintstrip.
export function coveragePass(p, floor = .25) {
  if (!p.artwork) return p.own >= floor;
  return p.artwork.decoded && p.artwork.expectedInk >= 16
    && p.artwork.ownPixels >= Math.max(16, p.artwork.expectedInk * floor);
}

export function cssPixelCount(pixels, imageWidth, imageHeight, clip) {
  return pixels * clip.width * clip.height / (imageWidth * imageHeight);
}

// Serialized into the existing browser gate. Source alpha supplies the
// expected footprint; current opacity and current paint never lower it.
export async function authoredFooterInk(selector, expectedAssets, clip) {
  const el = document.querySelector(selector);
  const images = [...el.querySelectorAll('image[data-footer-asset]')];
  if (images.length !== expectedAssets.length
      || expectedAssets.some((id, i) => images[i].dataset.footerAsset !== id)) return { decoded: false, expectedInk: 0 };
  const canvas = document.createElement('canvas');
  canvas.width = clip.width; canvas.height = clip.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  try {
    for (const node of images) {
      const source = new Image(); source.src = node.getAttribute('href') || '';
      let timer;
      try { await Promise.race([source.decode(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('art decode timeout')), 5000); })]); }
      finally { clearTimeout(timer); }
      const r = node.getBoundingClientRect();
      if (!source.naturalWidth || r.width < 1 || r.height < 1) return { decoded: false, expectedInk: 0 };
      // Footer images explicitly use preserveAspectRatio=none; SVG has
      // already projected their authored rectangle into the screen space.
      context.drawImage(source, r.left - clip.x, r.top - clip.y, r.width, r.height);
    }
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let expectedInk = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] >= 32) expectedInk++;
    return { decoded: true, expectedInk };
  } catch { return { decoded: false, expectedInk: 0 }; }
}
