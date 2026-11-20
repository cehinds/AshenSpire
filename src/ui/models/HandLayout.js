import { wireframeUi } from '../../content/wireframeUi.js';
import { uiConfig } from '../../config/generated/ui.js';

// Combat tool row: 30px row plus 4px gap. The band allocator and renderer share this floor.
export const COMBAT_TOOLS_HEIGHT_PX = 34;
// Desktop tool row is 36px plus the same 4px gap. Used only when hand.js cannot measure the live row.
export const COMBAT_TOOLS_DESKTOP_HEIGHT_PX = 40;
const compactCard = uiConfig.scenes.w4a.sizing.compactCombat;

/** Keeps the previous display order for cards still in hand, then appends new cards. */
export function reconcileHandOrder(previous, current) {
  const live = new Set(current);
  return [
    ...previous.filter((id) => live.delete(id)),
    ...current.filter((id) => live.delete(id)),
  ];
}

/** Returns a copy of `order` with `id` moved to `slot` (clamped to the list). */
export function moveHandInstance(order, id, slot) {
  if (!order.includes(id)) return [...order];
  const next = order.filter((value) => value !== id);
  next.splice(Math.max(0, Math.min(next.length, slot)), 0, id);
  return next;
}

/**
 * Sizes and places the fanned hand inside a `width` x `height` band.
 * `headroom` is spare space above the band (the phone's tool row) that a selected card may rise into.
 * Returns a frozen plan: card size, spacing, per-card { x, y, angle } and the resting/clearance edges.
 */
export function handLayout(
  { width, height, count, rem = 16, zoom = 1, compact = false, controlsHeight = 0, controlled = null, headroom = 0 },
  config = wireframeUi.hand,
) {
  // Vertical space available for the card
  let inset = config.verticalInsetRem * rem;
  const lift = config.selectedLiftRem * rem;
  const liftReserve = Math.max(0, lift - headroom);
  // The selected card already rises by `lift`; reserve only the extra room its controls need below it.
  const controlsReserve = Math.max(0, controlsHeight - Math.max(lift, headroom));
  const arc = config.arcRem * rem;
  const available = Math.max(0, height - inset * 2 - liftReserve - arc - controlsReserve);

  // How many cards fit side by side, from the width
  const widthRange = config.wideWidthRem - config.narrowWidthRem;
  const progress = Math.max(0, Math.min(1, (width / rem - config.narrowWidthRem) / widthRange));
  const capacityRange = config.maxCapacity - config.minCapacity;
  const requested = Math.round(config.minCapacity + progress * capacityRange);

  // Phone fan: each card shows `cardVisibleFraction` of its width past its neighbour, and the
  // rotated outer corners stay `cardSideGutterPx` from the edges. `spread` is the extra half-width
  // a rotated card gains per unit of card width.
  const fanAngle = Math.abs(config.fanAngleDegrees) * Math.PI / 180;
  const spread = (Math.sin(fanAngle) / wireframeUi.card.ratio + Math.cos(fanAngle) - 1) / 2;
  const gutter = compact ? compactCard.cardSideGutterPx / zoom : 0;
  const fanCount = Math.max(1, Math.min(count, requested));
  const fanWidthUnits = 1 + (fanCount - 1) * compactCard.cardVisibleFraction + spread * 2;
  const readableWidth = (width - gutter * 2) / fanWidthUnits;

  // Card size: phones fill the band between a floor and a cap, others up to the shared cap
  const fillWidth = available * wireframeUi.card.ratio;
  const cardWidth = compact
    ? Math.max(
      compactCard.cardMinWidthPx / zoom,
      Math.min(compactCard.cardMaxWidthPx / zoom, readableWidth, fillWidth),
    )
    : Math.max(config.minWidthRem * rem, Math.min(config.maxWidthRem * rem, fillWidth));
  const cardHeight = cardWidth / wireframeUi.card.ratio;
  inset = Math.max(inset, Math.sin(config.fanAngleDegrees * Math.PI / 180) * cardHeight / 2 + 1);
  // Horizontal margin: the inset, except on a phone, which keeps its gutter clear of rotated corners
  const side = compact ? Math.max(inset, gutter + spread * cardWidth) : inset;

  // Horizontal spacing
  const touch = config.exposedTargetPx / zoom;
  const fitCapacity = Math.floor(Math.max(0, width - cardWidth) / touch) + 1;
  const capacity = Math.max(1, Math.min(requested, fitCapacity));
  const visible = Math.max(1, Math.min(count, capacity));
  const fullStep = (width - cardWidth - side * 2) / (visible - 1);
  let step = 0;
  if (visible > 1) step = Math.max(touch, Math.min(cardWidth, fullStep));
  else if (count > 1) step = touch;
  const span = count ? cardWidth + Math.max(0, count - 1) * step : 0;
  const start = Math.max(side, (width - span) / 2);

  // Rotated corners must clear the footer, with one physical pixel to spare
  const middle = (count - 1) / 2;
  const rotatedExtra = Math.max(
    0,
    (Math.sin(fanAngle) * cardWidth + Math.cos(fanAngle) * cardHeight - cardHeight) / 2,
  );
  const fanDepth = count > 1 ? arc + rotatedExtra : 0;
  const bottomLimit = height - cardHeight - fanDepth - controlsReserve - 1 / zoom;

  // Card positions
  const cards = Array.from({ length: count }, (_, index) => {
    const offset = (index - middle) / Math.max(1, middle);
    return {
      x: start + index * step,
      angle: count > 1 ? offset * config.fanAngleDegrees : 0,
      y: count > 1 ? Math.pow(offset, 2) * arc : 0,
    };
  });
  // Resting left edge of the rotated fan (ignores hover and selection lift)
  const restLeft = cards.length
    ? Math.min(...cards.map((card) => {
      const radians = card.angle * Math.PI / 180;
      const halfWidth = (Math.abs(Math.cos(radians)) * cardWidth + Math.abs(Math.sin(radians)) * cardHeight) / 2;
      return card.x + cardWidth / 2 - halfWidth;
    }))
    : 0;

  // Vertical placement: a phone docks right under its tool row; others centre in the spare height
  const centred = compact ? 0 : (height - controlsReserve - cardHeight - arc) / 2;
  const base = Math.max(inset + liftReserve, centred);
  // A phone drops a little lower into its tool row's space, limited by each card's own bottom edge.
  // Only a card with a chooser reserves room below it; with no `controlled` list every card does.
  const drop = compact ? (config.compactDropRem || 0) * rem : 0;
  const reach = Math.max(...cards.map((card, index) => {
    const radians = card.angle * Math.PI / 180;
    const reserve = !controlled || controlled.includes(index) ? controlsReserve : 0;
    const halfHeight = (Math.abs(Math.sin(radians)) * cardWidth + Math.abs(Math.cos(radians)) * cardHeight) / 2;
    return card.y + cardHeight / 2 + halfHeight + reserve;
  }), 0);
  const top = drop > 0
    ? Math.max(0, Math.min(Math.max(bottomLimit, height - 1 / zoom - reach), base + drop))
    : Math.max(0, Math.min(bottomLimit, base));
  const restTop = cards.length
    ? Math.min(...cards.map((card) => {
      const radians = card.angle * Math.PI / 180;
      const halfHeight = (Math.abs(Math.sin(radians)) * cardWidth + Math.abs(Math.cos(radians)) * cardHeight) / 2;
      return top + card.y + cardHeight / 2 - halfHeight;
    }))
    : 0;

  // Selection clearance: a chooser may lift its card to the clipping edge, so reserve that room up front
  const clearanceTop = controlsHeight > 0
    ? 0 - headroom
    : Math.min(restTop, Math.max(0 - Math.min(headroom, lift), top - lift));

  return Object.freeze({
    cardWidth,
    cardHeight,
    capacity,
    span,
    start,
    step,
    lift,
    restLeft,
    restTop,
    clearanceTop,
    controlsReserve,
    top,
    cards,
  });
}

// Fan style per form factor and the tool-row reserve: content/config/ui/scenes/w4a-combat.json
// (sizing.responsiveHand, sizing.handToolRowReservePx). Edit the JSON, not this file.
// mobile/tablet: card width = widthFraction of the hand width, clamped to minPx..maxPx.
// desktop/widescreen: card size comes from handLayout; `spread` sets the overlap.
export const HAND_TOOL_ROW_RESERVE_PX = uiConfig.scenes.w4a.sizing.handToolRowReservePx;
export const RESPONSIVE_HAND = Object.freeze(Object.fromEntries(
  Object.entries(uiConfig.scenes.w4a.sizing.responsiveHand).map(([name, style]) => [name, Object.freeze({ ...style })]),
));

/**
 * Lays out the hand for the input's form factor, on top of a size plan from `handLayout`.
 * Returns the size plan with card size, positions, step, span, top and rest/clearance edges replaced.
 */
export function responsiveHandLayout(input, sizePlan = handLayout(input)) {
  const style = RESPONSIVE_HAND[input.formFactor] || RESPONSIVE_HAND.mobile;
  const { width, height, count, zoom = 1 } = input;

  // Card size
  const profileWidth = style.widthFraction
    ? Math.max(style.minPx / zoom, Math.min(style.maxPx / zoom, width * style.widthFraction))
    : sizePlan.cardWidth;
  const fitReserve = (sizePlan.fitReservePx ?? 40) / zoom;
  const cardWidth = Math.min(
    profileWidth,
    (height - sizePlan.controlsReserve - fitReserve) * wireframeUi.card.ratio,
  );
  const cardHeight = cardWidth / wireframeUi.card.ratio;
  const angle = style.angle * Math.PI / 180;
  const edge = (Math.cos(angle) * cardWidth + Math.sin(angle) * cardHeight - cardWidth) / 2;
  const side = Math.max(2 / zoom, edge + 2 / zoom);

  // Horizontal spacing: a phone fills the full width with no gaps; other form factors keep about
  // five cards overlapping, spread further for fewer and compress for more
  const fill = (width - cardWidth - side * 2) / Math.max(1, count - 1);
  const preferred = style.spread
    ? cardWidth * Math.min(.94, style.spread * Math.sqrt(5 / Math.max(1, count)))
    : cardWidth;
  let step = 0;
  if (count > 1) step = Math.max(0, input.formFactor === 'mobile' ? Math.min(cardWidth, fill) : Math.min(preferred, fill));
  const span = count ? cardWidth + (count - 1) * step : 0;
  const start = (width - span) / 2;
  const middle = (count - 1) / 2;

  // Card positions
  const arc = cardHeight * style.arc;
  const cards = Array.from({ length: count }, (_, index) => {
    const t = count > 1 ? (index - middle) / middle : 0;
    return { x: start + index * step, y: t * t * arc, angle: t * style.angle };
  });
  const extra = (Math.sin(angle) * cardWidth + Math.cos(angle) * cardHeight - cardHeight) / 2;

  // Vertical placement: the size plan may set its own reserve and dock (the desktop footer plan docks
  // to the hand box bottom); a phone sits lower than the default tool-row reserve
  const defaultReserve = input.formFactor === 'mobile'
    ? uiConfig.scenes.w4a.sizing.mobileHandReservePx
    : HAND_TOOL_ROW_RESERVE_PX;
  const reserve = sizePlan.reserve ?? defaultReserve;
  const dock = sizePlan.dock ?? style.dock;
  const top = Math.max(
    0,
    (height - cardHeight - arc - extra - sizePlan.controlsReserve - reserve / zoom) * dock,
  );
  const restTop = cards.length
    ? Math.min(...cards.map((card) => {
      const radians = card.angle * Math.PI / 180;
      const halfHeight = (Math.abs(Math.sin(radians)) * cardWidth + Math.cos(radians) * cardHeight) / 2;
      return top + card.y + cardHeight / 2 - halfHeight;
    }))
    : 0;

  return {
    ...sizePlan,
    cardWidth,
    cardHeight,
    cards,
    step,
    span,
    start,
    top,
    capacity: Math.max(1, count),
    restLeft: start - edge,
    restTop,
    clearanceTop: Math.min(restTop, top - sizePlan.lift),
  };
}

// After a card is played, survivors keep their slots (the played card's gap stays open) for `holdMs`,
// then the hand closes up once. Authored in w4a-combat.json (behavior.hand.playSettle); `maxShiftPx`
// is the largest allowed difference from the held layout.
export const HAND_PLAY_SETTLE = Object.freeze({ ...uiConfig.scenes.w4a.behavior.hand.playSettle });

/**
 * Keeps surviving cards on their previous slots after a play.
 * `previous` is { ids, key, plan } as last applied; `ids` the hand now; `plan` the fresh plan; `key`
 * the geometry key the plan was made from. Returns the previous plan restricted to the survivors,
 * or null when the hand did more than lose cards (a draw, reorder or resize).
 */
export function holdPlaySlots(previous, ids, plan, key, { maxShiftPx = HAND_PLAY_SETTLE.maxShiftPx } = {}) {
  if (!previous || previous.key !== key || !(ids.length && ids.length < previous.ids.length)) return null;
  const at = new Map(previous.ids.map((id, i) => [id, i]));
  let last = -1;
  for (const id of ids) {
    const i = at.get(id);
    if (i === undefined || i <= last) return null;
    last = i;
  }
  const cardWidthShift = Math.abs(plan.cardWidth - previous.plan.cardWidth);
  const topShift = Math.abs(plan.top - previous.plan.top);
  if (cardWidthShift > maxShiftPx || topShift > maxShiftPx) return null;
  const cards = ids.map((id) => previous.plan.cards[at.get(id)]);
  // Each survivor's tap lane runs to the next survivor (capped at card width), so the gap stays tappable
  const hitWidths = cards.map((card, i) => (i === cards.length - 1
    ? plan.cardWidth
    : Math.min(plan.cardWidth, Math.max(0, cards[i + 1].x - card.x))));
  return { ...previous.plan, cards, hitWidths };
}

/** Cache key for the hand's geometry inputs. */
export function handGeometryKey({ width, height, zoom, fontSize, left }) {
  return [width, height, zoom, fontSize, left].join(':');
}

/**
 * Converts the authored resting fan (not live transformed cards) to screen px.
 * Returns null if the rect is unusable, an unvalidated rect-based envelope if the layout receipt is
 * stale or missing, or the validated envelope (reusing `previous` when nothing changed).
 */
export function restingHandEnvelope(
  { rect, clientWidth, clientHeight, fontSize, geometry, restLeft, restTop, clearanceTop },
  previous,
) {
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !(clientWidth > 0)
    || !(rect.width > 0)) return null;
  const zoom = rect.width / clientWidth;
  const key = handGeometryKey({ width: clientWidth, height: clientHeight, zoom, fontSize, left: rect.left });
  if (geometry !== key || !Number.isFinite(restLeft) || !Number.isFinite(restTop) || !Number.isFinite(clearanceTop)) {
    return { key, validated: false, left: rect.left, top: rect.top, clearanceTop: rect.top };
  }
  const unchanged = previous?.key === key
    && previous.originTop === rect.top
    && previous.restLeft === restLeft
    && previous.restTop === restTop
    && previous.localClearanceTop === clearanceTop;
  if (unchanged) return previous;
  return {
    key,
    validated: true,
    originTop: rect.top,
    restLeft,
    restTop,
    localClearanceTop: clearanceTop,
    left: rect.left + restLeft * zoom,
    top: rect.top + restTop * zoom,
    clearanceTop: rect.top + clearanceTop * zoom,
  };
}

/**
 * Places the info door above its card and inside the hand's port, avoiding HUD obstacles.
 * Tries a free horizontal anchor first, then moves above the obstructing HUD.
 * Returns { left, top }.
 */
export function handInfoPosition({ card, port, size, gap, viewportWidth, obstacles = [] }) {
  const left = Math.max(0, port.left);
  const right = Math.min(viewportWidth, port.right);
  const clamp = (value) => Math.max(left + size / 2, Math.min(right - size / 2, value));
  const top = Math.max(0, card.top - size - gap);
  const centers = [...new Set([
    clamp(card.left + card.width / 2),
    clamp(card.right - size / 2),
    right - size / 2,
    left + size / 2,
  ])];
  const blocked = (center, y) => obstacles.some((box) => center + size / 2 > box.left
    && center - size / 2 < box.right
    && y + size > box.top
    && y < box.bottom);
  const free = centers.find((center) => !blocked(center, top));
  if (free !== undefined) return { left: free, top };
  const above = Math.max(0, Math.min(top, ...obstacles.map((box) => box.top - size - gap)));
  return { left: centers.find((center) => !blocked(center, above)) ?? centers[0], top: above };
}
