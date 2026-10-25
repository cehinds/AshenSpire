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
 * paintingGround({ ink, w, y0, h, aim }) -> {x0,y0,w,h}: the ground the camera can
 * ever show. It does not depend on the pan offset, so framing against it makes a
 * pan a pure translate.
 *  - no `aim` (two-axis pan): the act's ink, or the viewport width `w` centred on
 *    it if wider.
 *  - `aim` {min,max} (no free pan): the viewBox is `aimX +- w/2` and centring can
 *    put aimX anywhere in [min,max], so the ground is the union of every such
 *    viewBox with the ink. Without this the frame stops at the ink and a node in
 *    an end column leaves bare paper beside the painting.
 */
export function paintingGround({ ink, w, y0, h, aim }) {
  if (aim) {
    const x0 = Math.min(ink.x0, aim.min - w / 2);
    return { x0, y0, w: Math.max(ink.x1, aim.max + w / 2) - x0, h };
  }
  const mid = (ink.x0 + ink.x1) / 2;
  const x0 = Math.min(ink.x0, mid - w / 2);
  return { x0, y0, w: Math.max(ink.x1, mid + w / 2) - x0, h };
}

/** The cache key for a solved frame: changes only when the ground does (a pan never changes it). */
export function paintingFrameKey(box) {
  return [box.x0, box.y0, box.w, box.h].map(v => Math.round(v * 100)).join('|');
}

/**
 * paintingPointAt(frame, point) -> {u, v} | null
 * Inverts the frame (placement, zoom and mirror) to the normalised coordinates
 * of the UNMIRRORED painting that sit under a board point (SVG units).
 */
export function paintingPointAt(frame, point) {
  if (!frame || !point || !(frame.cw > 0) || !(frame.ch > 0)) return null;
  const lx = frame.flipX ? frame.ox + frame.cw - point.x : point.x - frame.ox;
  const ly = frame.flipY ? frame.oy + frame.ch - point.y : point.y - frame.oy;
  return { u: lx / frame.cw, v: ly / frame.ch };
}

/**
 * terrainSettingAt(painting, frame, point) -> settingId | null
 *  painting  a megaMaps entry; `terrain: [{ rect:[x,y,w,h], settingId }]` in
 *            normalised unmirrored-painting coordinates, first match wins
 *  frame     the current paintingFrame (null when the painting is not framed)
 *  point     the node's board position (SVG units)
 * Null when there is no frame, no zone list or no zone under the point; the
 * caller then keeps the node-type rule.
 */
export function terrainSettingAt(painting, frame, point) {
  const zones = painting?.terrain;
  if (!Array.isArray(zones) || !zones.length) return null;
  const at = paintingPointAt(frame, point);
  if (!at) return null;
  for (const zone of zones) {
    const [x, y, w, h] = zone.rect || [];
    if (at.u >= x && at.u <= x + w && at.v >= y && at.v <= y + h) return zone.settingId;
  }
  return null;
}
