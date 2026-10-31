// Independent source-alpha glows retain the authored palette and offsets without
// recursively casting shadows of earlier shadows. The intentionally thinner aura
// uses one reusable work surface; the stage owns the other visible surface.
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

// Assigning a canvas filter makes the browser resolve the canvas element's style first, a forced
// style and layout flush after the caller's DOM writes. A context whose filter already reads back
// as the requested value keeps its pixels the same, so the assignment is skipped then.
function setFilter(context, value) { if (context.filter !== value) context.filter = value; }

const STILL_LIMIT = 12;

export function createAlternativeAuraRenderer({ canvasWidth=768, canvasHeight=544, createCanvas = () => document.createElement('canvas') } = {}) {
  let surface = null, work = null, disposed = false, current = null;
  const parsed = new Map();
  const rendered = []; // Opt-in fixed-travel actions retain at most four phase surfaces.
  const stills = []; // Effects off: one baked bitmap per (artwork, glow, size); at most STILL_LIMIT.
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
    draw(context, image, filter, x, y, width = 512, height = 512, { materialize = false, reuse = false, immutable = false, still = false } = {}) {
      if (disposed || !image) return false;
      const plan = layers(filter);
      context.save();
      try {
        if (!plan || !plan.shadows.length) {
          // Unknown future filter grammar preserves its original rendering rather
          // than silently discarding effects. Authored filters use the fast path.
          setFilter(context, filter); context.drawImage(image, x, y, width, height);
        } else {
          // Hit-stop and contact holds can request the same immutable bitmap at
          // the same placement on successive frames. The work surface already
          // contains those pixels; do not rasterize its shadows again.
          // STATIC AURA (Effects off, owner 2026-10-30): the glow is drawn once for this
          // artwork + glow + size and every later frame only blits that bitmap, shifted by
          // however far the body has moved. It never reads pixels back (no materialize)
          // and never re-rasterizes shadows while a stance, status and pose hold.
          if (still) {
            let entry = stills.find(e => e.image === image && e.filter === filter && e.width === width && e.height === height);
            if (!entry) {
              const copy = createCanvas(); copy.width = canvasWidth; copy.height = canvasHeight;
              const copyContext = copy.getContext('2d');
              if (!copyContext) throw new Error('Character aura requires a canvas context');
              const outside = canvasWidth + width + Math.abs(x);
              for (const glow of plan.shadows) {
                copyContext.save(); copyContext.shadowColor = glow.color; copyContext.shadowBlur = glow.blur;
                copyContext.shadowOffsetX = glow.x - outside; copyContext.shadowOffsetY = glow.y;
                copyContext.drawImage(image, x + outside, y, width, height); copyContext.restore();
              }
              copyContext.save(); copyContext.drawImage(image, x, y, width, height); copyContext.restore();
              entry = { image, filter, x, y, width, height, surface: copy };
              stills.push(entry);
              if (stills.length > STILL_LIMIT) { const oldest = stills.shift().surface; oldest.width = oldest.height = 0; }
            }
            setFilter(context, plan.brightness === 1 ? 'none' : `brightness(${plan.brightness})`);
            context.drawImage(entry.surface, x - entry.x, y - entry.y);
            return true;
          }
          const matches = entry => entry && entry.image === image && entry.filter === filter
            && entry.x === x && entry.y === y && entry.width === width && entry.height === height;
          const cached = (reuse && rendered.find(matches)) || (immutable && matches(current) && current);
          if (cached) {
            setFilter(context, plan.brightness === 1 ? 'none' : `brightness(${plan.brightness})`);
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
          // Move the source wholly beyond the work surface while compensating
          // each shadow offset. Only the source-alpha shadow enters the stage.
          const outside = canvasWidth + width + Math.abs(x);
          for (const glow of plan.shadows) {
            work.save(); work.shadowColor = glow.color; work.shadowBlur = glow.blur;
            work.shadowOffsetX = glow.x - outside; work.shadowOffsetY = glow.y;
            work.drawImage(image, x + outside, y, width, height); work.restore();
          }
          work.save(); work.drawImage(image, x, y, width, height); work.restore();
          current = immutable ? {image,filter,x,y,width,height,surface} : null;
          if (reuse) {
            const copy = createCanvas(); copy.width = canvasWidth; copy.height = canvasHeight;
            const copyContext = copy.getContext('2d');
            if (!copyContext) throw new Error('Character aura reuse requires a canvas context');
            copyContext.drawImage(surface, 0, 0);
            rendered.push({image,filter,x,y,width,height,surface:copy});
            if (rendered.length > 4) { const oldest = rendered.shift().surface; oldest.width = oldest.height = 0; }
          }
          setFilter(context, plan.brightness === 1 ? 'none' : `brightness(${plan.brightness})`);
          context.drawImage(surface, 0, 0);
        }
        if (materialize) context.getImageData(0, 0, 1, 1);
      } finally { context.restore(); }
      return true;
    },
    dispose() {
      disposed = true; parsed.clear();
      if (surface) { surface.width = 0; surface.height = 0; }
      for (const entry of [...rendered, ...stills]) entry.surface.width = entry.surface.height = 0;
      rendered.length = 0; stills.length = 0;surface = null; work = null; current = null;
    },
  });
}
