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

export function createAlternativeAuraRenderer({ createCanvas = () => document.createElement('canvas') } = {}) {
  let surface = null, work = null, disposed = false;
  const parsed = new Map();
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
    draw(context, image, filter, x, y, width = 512, height = 512, { materialize = false } = {}) {
      if (disposed || !image) return false;
      const plan = layers(filter);
      context.save();
      try {
        if (!plan || !plan.shadows.length) {
          // Unknown future filter grammar preserves its original rendering rather
          // than silently discarding effects. Authored filters use the fast path.
          context.filter = filter; context.drawImage(image, x, y, width, height);
        } else {
          if (!surface) {
            surface = createCanvas(); surface.width = 768; surface.height = 544;
            work = surface.getContext('2d');
            if (!work) throw new Error('Character aura requires a canvas context');
          }
          work.clearRect(0, 0, 768, 544);
          // Move the source wholly beyond the work surface while compensating
          // each shadow offset. Only the source-alpha shadow enters the stage.
          const outside = 768 + width + Math.abs(x);
          for (const glow of plan.shadows) {
            work.save(); work.filter = 'none'; work.shadowColor = glow.color; work.shadowBlur = glow.blur;
            work.shadowOffsetX = glow.x - outside; work.shadowOffsetY = glow.y;
            work.drawImage(image, x + outside, y, width, height); work.restore();
          }
          work.save(); work.filter = 'none'; work.drawImage(image, x, y, width, height); work.restore();
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
      surface = null; work = null;
    },
  });
}
