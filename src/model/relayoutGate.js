// The battlefield is laid out once when combat mounts and is then static (owner, 2026-11-06: "just let
// everything be static/fixed. No more dynamic adjusting"). It is laid out again only when the viewport
// really changes: width by more than widthDelta, height by more than heightDelta (a phone's address bar,
// 10-15%, is ignored), or the orientation flips. A phone (coarse pointer, short side <= phoneShortSidePx)
// is portrait-only: it never relays out for rotation, the turn-upright notice covers it instead.
export function isPhoneViewport({ width, height, coarse }, cfg) {
  return !!coarse && Math.min(width, height) <= cfg.phoneShortSidePx;
}
export function viewportKey({ width, height }) {
  return { width, height, portrait: height >= width };
}
export function shouldRelayout(laidOut, now, cfg, { phone = false } = {}) {
  if (!laidOut) return true;
  if (phone) return false;
  if (laidOut.portrait !== (now.height >= now.width)) return true;
  if (Math.abs(now.width - laidOut.width) > laidOut.width * cfg.widthDelta) return true;
  return Math.abs(now.height - laidOut.height) > laidOut.height * cfg.heightDelta;
}
