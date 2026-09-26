// src/ui/models/PortraitCropModel.js — the W4c figure zoom (WGQ2/WGQ3), pure.
//
// A dialogue portrait is the character's WHOLE figure, zoomed in (owner,
// 2026-09-15: "it should be zoomed in and should show the upper 3rd of the
// character", and the layers should "dynamically cut it off"). Nothing is
// cropped or masked. The figure is scaled so the layout's visible fraction of
// its VISIBLE height (transparent padding excluded, measured the way
// combatSpriteGeometry measures it) spans from the slot's top to the reveal
// line, which is the context band's top edge. Its visible top sits on the
// slot top and it is centred on the slot. The lower part runs on behind the
// opaque context band, the footer and the frame edge, and those are what cut
// it. The fraction is the scene config's positioning.portraits.visibleFraction
// (uiConfig.scenes.w4c), handed in by the caller.
//
// Inputs and outputs share one local px space (the portrait layer's). The
// adapter applies `translate(x, y) scale(scale)` about the art host's
// top-left, with the art box measured inside that host before any transform.

const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new Error(`closeUpPlacement: ${name} must be a finite number, got ${value}`);
  return value;
};
const positive = (value, name) => {
  if (!(finite(value, name) > 0)) throw new Error(`closeUpPlacement: ${name} must be > 0, got ${value}`);
  return value;
};

/**
 * closeUpPlacement(art, slot, revealLine, layout, lane) → { scale, x, y, width }
 *
 * art:        { top, height, centerX, width } — the visible art in the host's px.
 * slot:       { left, top, width } — the portrait slot in layer px.
 * revealLine: the context band's top edge, in layer px, below the slot top.
 * layout:     a W4 scene config with positioning.portraits.visibleFraction and,
 *             for the lane rule, fit/anchor.
 * compact:    a compact host, which shows positioning.portraits
 *             .visibleFractionCompact of the figure instead of visibleFraction.
 * lane:       { left, width } — the half of the frame this figure may occupy
 *             (dialogueLanes). Optional: without it the figure is placed as
 *             before, centred on the slot and scaled by height alone.
 *
 * THE LANE RULE (owner, 2026-09-15, #1112). Both speakers stay fully visible at
 * every size, so a figure never leaves its own half of the frame. The zoom is
 * still the height rule — the visible fraction spans slot top to reveal line —
 * and a WIDE host therefore keeps exactly today's figure. Only when that zoom
 * makes the figure wider than its lane is it scaled down AS A WHOLE, by width;
 * it then sinks so its top share still stands on the reveal line rather than
 * hovering above it. The centre is the slot's, clamped into the lane.
 */
export function closeUpPlacement(art, slot, revealLine, layout, lane = null, compact = false, frame = null) {
  if (!art || !slot) throw new Error('closeUpPlacement needs the art box and a slot');
  const top = finite(art.top, 'art.top');
  const height = positive(art.height, 'art.height');
  const centerX = finite(art.centerX, 'art.centerX');
  const left = finite(slot.left, 'slot.left');
  const slotTop = finite(slot.top, 'slot.top');
  const width = positive(slot.width, 'slot.width');
  const span = finite(revealLine, 'revealLine') - slotTop;
  if (!(span > 0)) throw new Error(`closeUpPlacement: the reveal line (${revealLine}) must lie below the slot top (${slotTop})`);
  // uiConfig resolves the fraction at build time, so it arrives as a number.
  // HOW MUCH OF THE FIGURE THE BAND SHOWS, and a phone answers differently.
  // A third of the figure filling slot-top-to-reveal-line is a close-up on a
  // desktop, where the frame is wide enough to carry it. Half a 433px frame is
  // not: the same zoom is three times wider than its lane, so shrinking it to
  // fit left both speakers a third of the height the spec asks for (owner, a
  // real phone, 2026-09-18). A compact host shows the WHOLE figure, filling
  // the same band — large, entire, and still inside its lane.
  const portraitsConfig = layout?.positioning?.portraits ?? {};
  const fraction = compact && Number.isFinite(portraitsConfig.visibleFractionCompact)
    ? portraitsConfig.visibleFractionCompact
    : portraitsConfig.visibleFraction;
  if (!Number.isFinite(fraction) || !(fraction > 0) || fraction > 1) {
    throw new Error(`closeUpPlacement: visibleFraction must satisfy 0 < f ≤ 1 (got ${fraction})`);
  }
  const byHeight = span / (height * fraction);
  const artWidth = Number.isFinite(art.width) ? art.width : null;
  const portraits = layout?.positioning?.portraits ?? {};
  const frameWidth = frame?.width, frameHeight = frame?.height;
  // TWO WAYS TO KEEP A FIGURE IN ITS LANE, and they trade different things.
  //   shrinkToLane  the figure is made smaller until it fits: nothing is cut,
  //                 and on a phone that costs about two thirds of its size,
  //                 because the zoom the spec asks for is three times wider
  //                 than half a 433px frame.
  //   clipToLane    the figure keeps the spec's zoom — its top third fills the
  //                 slot top to the reveal line — and the lane cuts its sides,
  //                 the way the context band and the frame already cut it.
  // The config chooses; the geometry below is the same either way.
  const clips = portraits.fit === 'clipToLane' && lane != null;
  const shrinks = portraits.fit === 'shrinkToLane' && lane != null && artWidth != null;
  let scale = byHeight;
  let overhang = 0;
  if (shrinks) {
    const laneWidth = positive(lane.width, 'lane.width');
    // HEIGHT FIRST, WIDTH YIELDS (owner, 2026-09-18). A figure too wide for its
    // lane leans OUTWARD first — away from the other speaker, so the head and
    // upper body stay in the frame and only the outer shoulder leaves it — and
    // only shrinks when even that is not enough. The lean is bounded by
    // positioning.portraits.maxOuterOverflowVw, in frame widths.
    const overflowVw = portraits.maxOuterOverflowVw;
    const allowance = Number.isFinite(overflowVw) && Number.isFinite(frameWidth)
      ? Math.max(0, frameWidth * (overflowVw / 100))
      : 0;
    const room = laneWidth + allowance;
    if (artWidth * byHeight > room) scale = room / artWidth;
    const drawn = artWidth * scale;
    overhang = Math.max(0, drawn - laneWidth);
    // …but never below the floor the config puts under a figure.
    const floorVh = portraits.minVisibleHeightVh;
    if (Number.isFinite(floorVh) && Number.isFinite(frameHeight)) {
      const floor = frameHeight * (floorVh / 100);
      const shown = height * fraction * scale;
      if (shown < floor) scale = floor / (height * fraction);
    }
  }
  // Anchored on the reveal line: the visible top sits one visible fraction of
  // the scaled figure above it, so a figure that shrank still stands on the
  // line instead of floating. Unshrunk, that is the slot top it always used.
  const anchored = (shrinks || clips) && portraits.anchor === 'revealLine';
  const visibleTop = anchored ? revealLine - height * fraction * scale : slotTop;
  const figureWidth = artWidth == null ? null : artWidth * scale;
  let centerTarget = left + width / 2;
  if (shrinks || clips) {
    const laneLeft = finite(lane.left, 'lane.left');
    const laneWidth = positive(lane.width, 'lane.width');
    const half = figureWidth / 2;
    // A lane narrower than the figure cannot hold it; clamp to the lane's own
    // centre rather than inverting the bounds.
    // The overhang is spent on the OUTER side only: a left figure may cross
    // the frame's left edge, a right figure its right edge, and neither may
    // cross into the other's lane.
    const outerLeft = lane.side === 'right' ? laneLeft : laneLeft - overhang;
    const outerWidth = laneWidth + overhang;
    const low = outerLeft + half, high = outerLeft + outerWidth - half;
    if (low > high) {
      // Wider than lane and lean together: pin the INNER edge to the lane's
      // inner edge, so every extra pixel goes over the frame's outer edge and
      // none of it into the space the other speaker stands in.
      centerTarget = lane.side === 'right' ? laneLeft + half : laneLeft + laneWidth - half;
    } else {
      centerTarget = Math.min(Math.max(centerTarget, low), high);
    }
  }
  return Object.freeze({
    scale,
    x: centerTarget - centerX * scale,
    y: visibleTop - top * scale,
    width: figureWidth,
    // The lane the figure must be cut to, when the config cuts rather than
    // shrinks. Null means nothing is cut and the whole figure is drawn.
    clipTo: clips && figureWidth != null && lane != null && figureWidth > lane.width
      ? Object.freeze({ left: lane.left, width: lane.width })
      : null,
  });
}
