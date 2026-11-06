// The battlefield is laid out once when combat mounts and is then static (owner, 2026-11-06: "just let
// everything be static/fixed. No more dynamic adjusting"). It is laid out again only when the viewport
// really changes: width by more than widthDelta, height by more than heightDelta (a phone's address bar,
// 10-15%, is ignored), or the orientation flips. A phone (coarse pointer, short side <= phoneShortSidePx)
// is portrait-only: it relays out once when it turns upright (a combat mounted sideways must not stay stuck
// there) and ignores turning sideways.
export function isPhoneViewport({ width, height, coarse }, cfg) {
  return !!coarse && Math.min(width, height) <= cfg.phoneShortSidePx;
}
export function viewportKey({ width, height }) {
  return { width, height, portrait: height >= width };
}
export function shouldRelayout(laidOut, now, cfg, { phone = false } = {}) {
  if (!laidOut) return true;
  if (phone) return !laidOut.portrait && now.height >= now.width;
  if (laidOut.portrait !== (now.height >= now.width)) return true;
  if (Math.abs(now.width - laidOut.width) > laidOut.width * cfg.widthDelta) return true;
  return Math.abs(now.height - laidOut.height) > laidOut.height * cfg.heightDelta;
}
// What the formation shows: who stands in which cell, who is alive, the strips and the policy. A committed move,
// an engagement step (rangeRanks) or a death changes it and must reposition the figures; selection never does.
export function formationKey({ playerCell, occupancy, rangeRanks, policy, frames }) {
  return [playerCell, occupancy, rangeRanks, policy, ...frames.map(frame => `${frame.eid}:${frame.cell ?? ''}:${frame.dead ? 1 : 0}`)].join('|');
}
