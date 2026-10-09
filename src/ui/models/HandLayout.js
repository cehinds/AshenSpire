import { wireframeUi } from '../../content/wireframeUi.js';

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

export function handLayout({ width, height, count, rem = 16, zoom = 1, controlsHeight = 0 }, config = wireframeUi.hand) {
  let inset = config.verticalInsetRem * rem;
  const lift = config.selectedLiftRem * rem;
  // The selected face already rises by lift. Reserve only the additional
  // space its below-card controls need, before selection or a touch begins.
  const controlsReserve = Math.max(0, controlsHeight - lift);
  const arc = config.arcRem * rem;
  const available = Math.max(0, height - inset * 2 - lift - arc - controlsReserve);
  const cardWidth = Math.max(config.minWidthRem * rem,
    Math.min(config.maxWidthRem * rem, available * wireframeUi.card.ratio));
  const cardHeight = cardWidth / wireframeUi.card.ratio;
  inset = Math.max(inset, Math.sin(config.fanAngleDegrees * Math.PI / 180) * cardHeight / 2 + 1);
  const progress = Math.max(0, Math.min(1,
    (width / rem - config.narrowWidthRem) / (config.wideWidthRem - config.narrowWidthRem)));
  const requested = Math.round(config.minCapacity + progress * (config.maxCapacity - config.minCapacity));
  const touch = config.exposedTargetPx / zoom;
  const capacity = Math.max(1, Math.min(requested, Math.floor(Math.max(0, width - cardWidth) / touch) + 1));
  const visible = Math.max(1, Math.min(count, capacity));
  const step = visible > 1 ? Math.max(touch, Math.min(cardWidth, (width - cardWidth - inset * 2) / (visible - 1))) : count > 1 ? touch : 0;
  const span = count ? cardWidth + Math.max(0, count - 1) * step : 0;
  const start = Math.max(inset, (width - span) / 2);
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
  return Object.freeze({ cardWidth, cardHeight, capacity, span, start, step, lift, restLeft, controlsReserve,
    top: Math.max(0, Math.min(bottomLimit, Math.max(inset + lift, (height - controlsReserve - cardHeight - arc) / 2))),
    cards,
  });
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
