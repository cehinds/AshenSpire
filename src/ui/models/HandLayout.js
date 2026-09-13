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

export function handLayout({ width, height, count, rem = 16, zoom = 1 }, config = wireframeUi.hand) {
  let inset = config.verticalInsetRem * rem;
  const lift = config.selectedLiftRem * rem;
  const arc = config.arcRem * rem;
  const available = Math.max(0, height - inset * 2 - lift - arc);
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
  const step = visible > 1 ? Math.max(touch, Math.min(cardWidth, (width - cardWidth - inset * 2) / (visible - 1))) : 0;
  const span = count ? cardWidth + Math.max(0, count - 1) * step : 0;
  const start = Math.max(inset, (width - span) / 2);
  const middle = (count - 1) / 2;
  return Object.freeze({ cardWidth, cardHeight, capacity, span, start, step, lift,
    top: Math.max(inset + lift, (height - cardHeight - arc) / 2),
    cards: Array.from({ length: count }, (_, index) => ({
      x: start + index * step,
      angle: count > 1 ? (index - middle) / Math.max(1, middle) * config.fanAngleDegrees : 0,
      y: count > 1 ? Math.pow((index - middle) / Math.max(1, middle), 2) * arc : 0,
    })),
  });
}
