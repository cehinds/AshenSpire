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
 * closeUpPlacement(art, slot, revealLine, layout) → { scale, x, y }
 *
 * art:        { top, height, centerX } — the visible art in the host's px.
 * slot:       { left, top, width } — the portrait slot in layer px.
 * revealLine: the context band's top edge, in layer px, below the slot top.
 * layout:     a W4 scene config with positioning.portraits.visibleFraction.
 */
export function closeUpPlacement(art, slot, revealLine, layout) {
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
  const fraction = layout?.positioning?.portraits?.visibleFraction;
  if (!Number.isFinite(fraction) || !(fraction > 0) || fraction > 1) {
    throw new Error(`closeUpPlacement: visibleFraction must satisfy 0 < f ≤ 1 (got ${fraction})`);
  }
  const scale = span / (height * fraction);
  return Object.freeze({
    scale,
    x: left + width / 2 - centerX * scale,
    y: slotTop - top * scale,
  });
}
