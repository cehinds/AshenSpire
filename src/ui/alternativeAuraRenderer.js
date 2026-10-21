// Independent source-alpha glows retain the authored palette and offsets without
// recursively casting shadows of earlier shadows. The intentionally thinner aura
// uses one reusable work surface and bounded immutable soft-layer caches.
const number = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const shadow = new RegExp(`^drop-shadow\\((${number})(?:px)? (${number})(?:px)? (${number})(?:px)? (rgba\\([^)]*\\)|#[\\da-fA-F]{6,8})\\)`);
const brightness = new RegExp(`^brightness\\((${number})\\)`);

export function alternativeAuraLayers(filter) {
  if (filter === 'none') return { shadows: [], brightness: 1 };
  if (typeof filter !== 'string') return null;
  const shadows = []; let rest = filter.trim(), light = 1, hasBrightness = false;
  while (rest) {
    const match = !hasBrightness && rest.match(shadow);
    if (match) {
      if (shadows.length === 9 || Number(match[3]) < 0) return null;
      shadows.push({ x: Number(match[1]), y: Number(match[2]), blur: Number(match[3]), color: match[4] });
      rest = rest.slice(match[0].length).trim(); continue;
    }
    const gain = !hasBrightness && rest.match(brightness);
    if (!gain || Number(gain[1]) < 0) return null;
    light = Number(gain[1]); hasBrightness = true; rest = rest.slice(gain[0].length).trim();
  }
  return shadows.length ? { shadows, brightness: light } : null;
}

export function createAlternativeAuraRenderer({ canvasWidth=768, canvasHeight=544, createCanvas = () => document.createElement('canvas') } = {}) {
  let surface = null, work = null, disposed = false, current = null;
  const parsed = new Map();
  const glows = []; // Immutable source-alpha masks, independent of stage travel.
  let glowPixels = 0, travelUnavailable = false;
  const rendered = []; // Opt-in fixed-travel actions retain at most four phase surfaces.
  function layers(filter) {
    if (!parsed.has(filter)) {
      // Parsing is tiny; bound retained configurations even if runtime settings
      // provide many distinct aura strengths over a long combat.
      if (parsed.size === 16) parsed.delete(parsed.keys().next().value);
      parsed.set(filter, alternativeAuraLayers(filter));
    }
    return parsed.get(filter);
  }
  return Object.freeze({
    draw(context, image, filter, x, y, width = 512, height = 512, { materialize = false, reuse = false, immutable = false, travel = false } = {}) {
      if (disposed || !image) return false;
      const plan = layers(filter);
      context.save();
      try {
        if (!plan || !plan.shadows.length) {
          // Unknown future filter grammar preserves its original rendering rather
          // than silently discarding effects. Authored filters use the fast path.
          context.filter = filter; context.drawImage(image, x, y, width, height);
        } else {
          // Hit-stop and contact holds can request the same immutable bitmap at
          // the same placement on successive frames. The work surface already
          // contains those pixels; do not rasterize its shadows again.
          const matches = entry => entry && entry.image === image && entry.filter === filter
            && entry.x === x && entry.y === y && entry.width === width && entry.height === height;
          const cached = (reuse && rendered.find(matches)) || (immutable && matches(current) && current);
          if (cached) {
            context.filter = plan.brightness === 1 ? 'none' : `brightness(${plan.brightness})`;
            context.drawImage(cached.surface, 0, 0);
            if (materialize) context.getImageData(0, 0, 1, 1);
            return true;
          }
          if (!surface) {
            surface = createCanvas(); surface.width = canvasWidth; surface.height = canvasHeight;
            work = surface.getContext('2d');
            if (!work) throw new Error('Character aura requires a canvas context');
          }
          current = null;
          work.clearRect(0, 0, canvasWidth, canvasHeight);
          // Cache only soft layers. Zero-blur authored silhouette offsets must
          // draw directly at the fractional position to avoid interpolating a
          // sharp edge twice. Preserve source-over order across both kinds.
          for (const [index, row] of plan.shadows.entries()) {
            let glow = immutable && travel && row.blur > 0 && glows.find(entry => entry.image === image
              && entry.filter === filter && entry.index === index && entry.width === width && entry.height === height);
            const pad = Math.ceil(Math.max(Math.abs(row.x), Math.abs(row.y)) + 3 * row.blur + 2);
            const localWidth = Math.ceil(width + 2 * pad), localHeight = Math.ceil(height + 2 * pad);
            const pixels = localWidth * localHeight;
            if (!glow && immutable && travel && !travelUnavailable && row.blur > 0 && width > 0 && height > 0
                && localWidth <= 2048 && localHeight <= 2048 && pixels <= 4 * 1024 * 1024) {
              while (glows.length && (glows.length >= 4 || glowPixels + pixels > 4 * 1024 * 1024)) {
                const oldest = glows.shift(); glowPixels -= oldest.pixels;
                oldest.surface.width = oldest.surface.height = 0;
              }
              let local, localContext;
              try {
                local = createCanvas(); local.width = localWidth; local.height = localHeight;
                localContext = local.getContext('2d');
              } catch { /* An optional cache must not prevent the original renderer. */ }
              if (!localContext) {
                travelUnavailable = true;
                if (local) local.width = local.height = 0;
              } else {
                const outside = localWidth + width + pad;
                localContext.save(); localContext.filter = 'none';
                localContext.shadowColor = row.color; localContext.shadowBlur = row.blur;
                localContext.shadowOffsetX = row.x - outside; localContext.shadowOffsetY = row.y;
                localContext.drawImage(image, pad + outside, pad, width, height); localContext.restore();
                glow = {image,filter,index,width,height,pad,surface:local,pixels};
                glows.push(glow); glowPixels += pixels;
              }
            }
            if (glow) {
              work.drawImage(glow.surface, x - glow.pad, y - glow.pad);
            } else {
              // Move the source wholly beyond the work surface while compensating
              // the shadow offset. Only the source-alpha shadow enters the stage.
              const outside = canvasWidth + width + Math.abs(x);
              work.save(); work.filter = 'none'; work.shadowColor = row.color; work.shadowBlur = row.blur;
              work.shadowOffsetX = row.x - outside; work.shadowOffsetY = row.y;
              work.drawImage(image, x + outside, y, width, height); work.restore();
            }
          }
          work.save(); work.filter = 'none'; work.drawImage(image, x, y, width, height); work.restore();
          current = immutable ? {image,filter,x,y,width,height,surface} : null;
          if (reuse) {
            const copy = createCanvas(); copy.width = canvasWidth; copy.height = canvasHeight;
            const copyContext = copy.getContext('2d');
            if (!copyContext) throw new Error('Character aura reuse requires a canvas context');
            copyContext.drawImage(surface, 0, 0);
            rendered.push({image,filter,x,y,width,height,surface:copy});
            if (rendered.length > 4) { const oldest = rendered.shift().surface; oldest.width = oldest.height = 0; }
          }
          context.filter = plan.brightness === 1 ? 'none' : `brightness(${plan.brightness})`;
          context.drawImage(surface, 0, 0);
        }
        if (materialize) context.getImageData(0, 0, 1, 1);
      } finally { context.restore(); }
      return true;
    },
    dispose() {
      disposed = true; parsed.clear();
      if (surface) { surface.width = 0; surface.height = 0; }
      for (const entry of glows) entry.surface.width = entry.surface.height = 0;
      glows.length = 0; glowPixels = 0;
      for (const entry of rendered) entry.surface.width = entry.surface.height = 0;
      rendered.length = 0;surface = null; work = null; current = null;
    },
  });
}
