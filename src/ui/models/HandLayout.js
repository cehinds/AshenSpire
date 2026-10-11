import { wireframeUi } from '../../content/wireframeUi.js';
import { uiConfig } from '../../config/generated/ui.js';

// The combat hand reserves a 30px compact row plus four physical pixels of
// separation before card geometry begins. Keep the band allocator and the
// renderer on the same physical floor.
export const COMBAT_TOOLS_HEIGHT_PX = 34;
const compactCard = uiConfig.scenes.w4a.sizing.compactCombat;

// How many cards a fan shows before it pages, from the hand's width in rem.
export function requestedHandCapacity(width, rem, config = wireframeUi.hand) {
  const progress = Math.max(0, Math.min(1,
    (width / rem - config.narrowWidthRem) / (config.wideWidthRem - config.narrowWidthRem)));
  return Math.round(config.minCapacity + progress * (config.maxCapacity - config.minCapacity));
}

// The rotated face's extra half-width per unit of card width.
function fanSpread(config) {
  const angle = Math.abs(config.fanAngleDegrees) * Math.PI / 180;
  return (Math.sin(angle) / wireframeUi.card.ratio + Math.cos(angle) - 1) / 2;
}

// The widest phone card a fan of `fanCount` cards can show readably, before
// the band's height has its say: each card shows at least cardVisibleFraction
// of its width past its neighbour, the outer rotated corners keep
// cardSideGutterPx from the hand's edges, and no card passes the cap.
export function phoneFanCardWidth({ width, zoom = 1, fanCount }, config = wireframeUi.hand) {
  const gutter = compactCard.cardSideGutterPx / zoom;
  const visible = Math.max(1, fanCount);
  const readable = (width - gutter * 2) / (1 + (visible - 1) * compactCard.cardVisibleFraction + fanSpread(config) * 2);
  return Math.min(compactCard.cardMaxWidthPx / zoom, readable);
}

// Presentation order is local, keyed by instance, and never mutates a pile.
export function reconcileHandOrder(previous, current) {
  const live = new Set(current);
  return [...previous.filter((id) => live.delete(id)), ...current.filter((id) => live.delete(id))];
}

export function moveHandInstance(order, id, slot) {
  if (!order.includes(id)) return [...order];
  const next = order.filter((value) => value !== id);
  next.splice(Math.max(0, Math.min(next.length, slot)), 0, id);
  return next;
}

// `headroom` is band above `height` (the phone's compact tool row) that a
// selected card may rise into. Its lift, and its chooser's rise, are reserved
// only where they exceed that headroom, so the resting fan sits right under
// the row instead of under an empty band, and the reclaimed height goes to
// the cards.
export function handLayout({ width, height, count, rem = 16, zoom = 1, compact = false, controlsHeight = 0, headroom = 0 }, config = wireframeUi.hand) {
  let inset = config.verticalInsetRem * rem;
  const lift = config.selectedLiftRem * rem;
  const liftReserve = Math.max(0, lift - headroom);
  // The selected face already rises by lift, and the chooser's correction
  // (handInspectionOverlay) may raise it on through the headroom. Reserve only
  // the additional space its below-card controls need, before selection or a
  // touch begins.
  const controlsReserve = Math.max(0, controlsHeight - Math.max(lift, headroom));
  const arc = config.arcRem * rem;
  const available = Math.max(0, height - inset * 2 - liftReserve - arc - controlsReserve);
  const requested = requestedHandCapacity(width, rem, config);
  const spread = fanSpread(config);
  const gutter = compact ? compactCard.cardSideGutterPx / zoom : 0;
  const cardWidth = compact
    // Phone cards fill the band between a readable floor and a cap, both in
    // physical px (content/config/ui/scenes/w4a-combat.json, compactCombat).
    ? Math.max(compactCard.cardMinWidthPx / zoom, Math.min(
      phoneFanCardWidth({ width, zoom, fanCount: Math.min(count, requested) }, config), available * wireframeUi.card.ratio))
    : Math.max(config.minWidthRem * rem, Math.min(config.maxWidthRem * rem, available * wireframeUi.card.ratio));
  const cardHeight = cardWidth / wireframeUi.card.ratio;
  inset = Math.max(inset, Math.sin(config.fanAngleDegrees * Math.PI / 180) * cardHeight / 2 + 1);
  // Horizontal margin: the vertical inset everywhere but a phone, which keeps
  // its gutter clear of the outer cards' rotated corners.
  const side = compact ? Math.max(inset, gutter + spread * cardWidth) : inset;
  const touch = config.exposedTargetPx / zoom;
  const capacity = Math.max(1, Math.min(requested, Math.floor(Math.max(0, width - cardWidth) / touch) + 1));
  const visible = Math.max(1, Math.min(count, capacity));
  const step = visible > 1 ? Math.max(touch, Math.min(cardWidth, (width - cardWidth - side * 2) / (visible - 1))) : count > 1 ? touch : 0;
  const span = count ? cardWidth + Math.max(0, count - 1) * step : 0;
  const start = Math.max(side, (width - span) / 2);
  const middle = (count - 1) / 2;
  // The rotated outside corners, not just the unrotated face, must clear
  // the footer. Keep one physical pixel between the fan and that next band.
  const angle = Math.abs(config.fanAngleDegrees) * Math.PI / 180;
  const rotatedExtra = Math.max(0, (Math.sin(angle) * cardWidth + Math.cos(angle) * cardHeight - cardHeight) / 2);
  const bottomLimit = height - cardHeight - (count > 1 ? arc + rotatedExtra : 0) - controlsReserve - 1 / zoom;
  const cards = Array.from({ length: count }, (_, index) => ({
    x: start + index * step,
    angle: count > 1 ? (index - middle) / Math.max(1, middle) * config.fanAngleDegrees : 0,
    y: count > 1 ? Math.pow((index - middle) / Math.max(1, middle), 2) * arc : 0,
  }));
  // The resting rotated edge is independent of hover and selected-card lift.
  const restLeft = cards.length ? Math.min(...cards.map(card => {
    const radians = card.angle * Math.PI / 180;
    return card.x + cardWidth / 2 - (Math.abs(Math.cos(radians)) * cardWidth
      + Math.abs(Math.sin(radians)) * cardHeight) / 2;
  })) : 0;
  // A phone docks the fan right under its tool row; a width-bound fan leaves
  // its spare height below the cards, not in a gap under the row.
  const centred = compact ? 0 : (height - controlsReserve - cardHeight - arc) / 2;
  const top = Math.max(0, Math.min(bottomLimit, Math.max(inset + liftReserve, centred)));
  const restTop = cards.length ? Math.min(...cards.map(card => {
    const radians = card.angle * Math.PI / 180;
    return top + card.y + cardHeight / 2 - (Math.abs(Math.sin(radians)) * cardWidth
      + Math.abs(Math.cos(radians)) * cardHeight) / 2;
  })) : 0;
  // The chooser's bounded vertical correction may lift its owner to the hand
  // clipping edge. Reserve that possible face before selection, not afterwards.
  const clearanceTop = controlsHeight > 0 ? 0 - headroom : Math.min(restTop, Math.max(0 - Math.min(headroom, lift), top - lift));
  return Object.freeze({ cardWidth, cardHeight, capacity, span, start, step, lift, restLeft, restTop, clearanceTop, controlsReserve,
    top,
    cards,
  });
}

export function handGeometryKey({ width, height, zoom, fontSize, left }) {
  return [width, height, zoom, fontSize, left].join(':');
}

// Convert the authored resting fan, not live transformed cards, to screen px.
// A stale or absent hand-layout receipt falls back to the finite hand viewport.
export function restingHandEnvelope({ rect, clientWidth, clientHeight, fontSize, geometry, restLeft, restTop, clearanceTop }, previous) {
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !(clientWidth > 0)
    || !(rect.width > 0)) return null;
  const zoom = rect.width / clientWidth;
  const key = handGeometryKey({ width: clientWidth, height: clientHeight, zoom, fontSize, left: rect.left });
  if (geometry !== key || !Number.isFinite(restLeft) || !Number.isFinite(restTop) || !Number.isFinite(clearanceTop)) {
    return { key, validated: false, left: rect.left, top: rect.top, clearanceTop: rect.top };
  }
  if (previous?.key === key && previous.originTop === rect.top && previous.restLeft === restLeft && previous.restTop === restTop
    && previous.localClearanceTop === clearanceTop) return previous;
  return { key, validated: true, originTop: rect.top, restLeft, restTop, localClearanceTop: clearanceTop,
    left: rect.left + restLeft * zoom, top: rect.top + restTop * zoom, clearanceTop: rect.top + clearanceTop * zoom };
}

// The reading door remains above its owner and outside the clipped hand.
// Pick a free horizontal anchor before moving it above an obstructing HUD.
export function handInfoPosition({ card, port, size, gap, viewportWidth, obstacles = [] }) {
  const left = Math.max(0, port.left), right = Math.min(viewportWidth, port.right);
  const clamp = value => Math.max(left + size / 2, Math.min(right - size / 2, value));
  const top = Math.max(0, card.top - size - gap);
  const centers = [...new Set([clamp(card.left + card.width / 2), clamp(card.right - size / 2),
    right - size / 2, left + size / 2])];
  const blocked = (center, y) => obstacles.some(box => center + size / 2 > box.left && center - size / 2 < box.right &&
    y + size > box.top && y < box.bottom);
  const free = centers.find(center => !blocked(center, top));
  if (free !== undefined) return { left: free, top };
  const above = Math.max(0, Math.min(top, ...obstacles.map(box => box.top - size - gap)));
  return { left: centers.find(center => !blocked(center, above)) ?? centers[0], top: above };
}
