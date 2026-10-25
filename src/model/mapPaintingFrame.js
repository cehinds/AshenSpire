// Framing of the world painting behind an act's route board, so the act's start
// sits on the biome of the act's region (Weald meadow, Marches frost, Reach
// lava). Pure: no DOM, no RNG. The painting choice stays seed-stable
// (worldMapForRun); only this framing changes per act.
//
// A world painting carries `biomes[regionId] = { rect:{x,y,w,h}, flipX, flipY }`
// in normalised 0..1 image coordinates (content/config/ui/presentation/
// environments.json). The board shows the painting cover-fit; the start nodes
// sit at the board's bottom. We mirror the painting when the biome is far from
// that edge, then zoom in just enough, and slide it, so the start lands inside
// the biome rectangle. A painting without an anchor for the region returns null
// and the caller keeps the plain cover fit.

export const MAX_FRAME_SCALE = 3;
const STEP = 0.05;
const MARGIN = 0.15; // keep the start this far (of the rect's size) inside the rect

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * paintingFrame({ anchor, aspect, box, start }) -> frame | null
 *  anchor  the painting's `biomes[region]` entry
 *  aspect  painting width / height
 *  box     {x0,y0,w,h} the ground the painting must cover (SVG units)
 *  start   {x,y} the act's start point (SVG units)
 * frame: { cw, ch, ox, oy, flipX, flipY, scale, transform }. The image is drawn
 * at (0,0) size cw x ch inside a group whose `transform` places and mirrors it.
 */
export function paintingFrame({ anchor, aspect, box, start }) {
  const rect = anchor?.rect;
  if (!rect || !(aspect > 0) || !box || !start) return null;
  const flipX = !!anchor.flipX, flipY = !!anchor.flipY;
  const rx = flipX ? 1 - rect.x - rect.w : rect.x;
  const ry = flipY ? 1 - rect.y - rect.h : rect.y;
  const baseH = Math.max(box.h, box.w / aspect);
  for (let scale = 1; scale <= MAX_FRAME_SCALE + 1e-9; scale += STEP) {
    const ch = baseH * scale, cw = ch * aspect;
    const ox = clamp(start.x - (rx + rect.w / 2) * cw, box.x0 + box.w - cw, box.x0);
    const oy = clamp(start.y - (ry + rect.h / 2) * ch, box.y0 + box.h - ch, box.y0);
    const u = (start.x - ox) / cw, v = (start.y - oy) / ch;
    if (u >= rx + rect.w * MARGIN && u <= rx + rect.w * (1 - MARGIN)
      && v >= ry + rect.h * MARGIN && v <= ry + rect.h * (1 - MARGIN)) {
      const tx = flipX ? ox + cw : ox, ty = flipY ? oy + ch : oy;
      const transform = `translate(${+tx.toFixed(2)} ${+ty.toFixed(2)}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1})`;
      return { cw, ch, ox, oy, flipX, flipY, scale, transform, u, v };
    }
  }
  return null;
}

/**
 * paintingGround({ ink, w, y0, h }) -> {x0,y0,w,h}: the ground the camera can ever
 * show (the act's ink, or the viewport width `w` centred on it if wider). It does
 * not depend on the pan offset, so framing against it makes a pan a pure translate.
 */
export function paintingGround({ ink, w, y0, h }) {
  const mid = (ink.x0 + ink.x1) / 2;
  const x0 = Math.min(ink.x0, mid - w / 2);
  return { x0, y0, w: Math.max(ink.x1, mid + w / 2) - x0, h };
}
