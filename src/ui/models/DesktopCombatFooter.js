import { uiConfig } from '../../config/generated/ui.js';
import { responsiveHandLayout, handLayout } from './HandLayout.js';

// Physical desktop geometry; UI zoom changes the ruler, never the art's shape.
export function desktopFooterEnabled({ formFactor, appearance, layout }) {
  return ['desktop', 'widescreen'].includes(formFactor) && appearance === 'alternative' && layout === 'formation';
}
export function desktopFooterLayout({ width, height, zoom = 1 }, config = uiConfig.scenes.w4a.sizing.desktopFooter) {
  const scale = Math.max(config.minimumScale, Math.min(config.maximumScale, height * zoom / config.scaleHeightPx));
  const unit = scale / zoom;
  const bottom = height - config.bottomInsetPx * unit;
  const corner = config.cornerInsetPx * unit;
  const controls = {
    sp: { x: corner, y: bottom - 106 * unit, w: 101 * unit, h: 106 * unit },
    draw: { x: corner + 125 * unit, y: bottom - 108 * unit, w: 64.1584 * unit, h: 108 * unit },
    discard: { x: width - corner - config.cornerWidthPx * unit, y: bottom - 101 * unit, w: 80.398 * unit, h: 101 * unit },
    potions: { x: width - corner - 100 * unit, y: bottom - 91.6667 * unit, w: 100 * unit, h: 91.6667 * unit },
    end: { x: (width - config.endHitWidthPx * unit) / 2, y: bottom - config.endHitHeightPx * unit,
      w: config.endHitWidthPx * unit, h: config.endHitHeightPx * unit },
  };
  // Owner (2026-10-31): the fan's lowest card sits handGapPx (viewport px) above End Turn's top edge.
  return { unit, controls, handTop: controls.end.y - config.handGapPx / zoom - config.handHeightPx * unit,
    handHeight: config.handHeightPx * unit, backgroundTop: height - (config.referenceHeightPx - config.backgroundTopPx) * unit,
    backgroundFadeHeight: config.backgroundFadeHeightPx * unit,
    toolsTop: bottom - config.toolsBottomPx * unit, corner, endArtWidth: config.endArtWidthPx * unit,
    endArtHeight: config.endArtHeightPx * unit };
}
export function desktopHandLayout({ width, height, count, zoom = 1 }, config = uiConfig.scenes.w4a.sizing.desktopFooter) {
  const unit = height / config.handHeightPx;
  // Owner (2026-10-26): desktop cards stay at the SPEC floor (150 viewport px) however large
  // the screen, so the whole face, bottom line included, shows above the footer.
  const capped = Math.min(config.cardWidthPx * unit, (config.cardMaxViewportPx || Infinity) / zoom);
  const cardWidth = capped, cardHeight = capped * config.cardHeightPx / config.cardWidthPx;
  const side = Math.max(14 / zoom, (width - 1010 * unit) / 2);
  const step = count > 1 ? Math.max(44 / zoom, Math.min(config.cardStepPx * unit * (capped / (config.cardWidthPx * unit)), (width - side * 2 - cardWidth) / (count - 1))) : 0;
  const span = count ? cardWidth + (count - 1) * step : 0;
  const start = Math.max(side, (width - span) / 2), middle = (count - 1) / 2;
  const cards = Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? (i - middle) / Math.max(1, middle) : 0;
    return { x: start + i * step, y: t * t * config.arcPx * unit, angle: t * config.fanAngleDegrees };
  });
  const top = 8 * unit;
  const restTop = Math.min(...cards.map(c => top + c.y + cardHeight / 2 - (Math.abs(Math.sin(c.angle * Math.PI / 180)) * cardWidth + Math.cos(c.angle * Math.PI / 180) * cardHeight) / 2), top);
  return { cardWidth, cardHeight, cards, capacity: Math.max(1, count), span, start, step, top, lift: 18 * unit,
    // Owner (2026-10-31): the fan docks to the hand box's bottom; handGapPx above End Turn is its only buffer.
    restLeft: start - 12 * unit, restTop, clearanceTop: -10 * unit, controlsReserve: 0, reserve: 0, dock: 1 };
}

// The battlefield's bottom edge, in combat-root px: the fan's clearance line (its resting top
// raised by the selection lift). The hand band is cut to this, so the band the lowered, smaller
// fan no longer needs goes to the battlefield instead of an empty strip.
export function desktopFieldBottom(plan, { width, zoom = 1, rem = 16, formFactor = 'desktop' }, config = uiConfig.scenes.w4a.sizing.desktopFooter) {
  const input = { width, height: plan.handHeight, count: 5, rem, zoom, compact: false, controlsHeight: 0, controlled: [], headroom: 0, formFactor };
  const fan = responsiveHandLayout(input, desktopHandLayout(input, config));
  // Owner (2026-11-01): the cards overlap the battlefield's lower edge by handOverlapFraction of their height,
  // but never so far that the player rank's feet (the profile's top + 4 * rowHeight of the field) pass the resting
  // top card edge: on a short desktop the overlap shrinks until the feet stand one px above that edge.
  const cardTop = plan.handTop + fan.restTop;
  const header = uiConfig.scenes.w4a.sizing.desktopHeader.splitHeightPx / zoom;
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
  const profile = grid.profiles?.[formFactor] || grid.wide;
  const feet = profile.top + 4 * profile.rowHeight;
  return Math.min(cardTop + (config.handOverlapFraction || 0) * fan.cardHeight, header + (cardTop - 1 / zoom - header) / feet);
}

// Phone (owner, 2026-11-01): the field runs up to mobileFieldHandOverlapPx under the cards, but never so far that the
// player rank's feet (the phone profile's top + 4 * rowHeight of the extended field) pass the resting top card edge,
// which is where the real fan puts it: the hand band's top (the field's natural bottom) plus the fan's restTop. The
// extension is whatever that allows, between 0 and the authored cap; a field that would fall under shortBelowPx once
// extended keeps its natural height (it then draws the short profile, whose rank D ends at 94% of that height).
// Lengths are layout units; zoom converts to the viewport px the authored values use. Five cards stand for the hand
// (the resting top moves under half a pixel with the count; the 1px margin covers it). controlsHeight is the hand's
// live chooser reserve (hand.js publishes it as --hand-controls-height), which raises the resting cards.
export function mobileFieldOverlap({ natural, width, handHeight, rem = 16, zoom = 1, compact = true, controlsHeight = 0 }, sizing = uiConfig.scenes.w4a.sizing) {
  const input = { width, height: handHeight, count: 5, rem, zoom, compact, controlsHeight, controlled: [], headroom: 0, formFactor: 'mobile' };
  const { restTop } = responsiveHandLayout(input, handLayout(input));
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
  const profile = grid.profiles.mobile;
  const feet = profile.top + 4 * profile.rowHeight;
  const room = (natural + restTop - 1 / zoom) / feet - natural;
  const extension = Math.max(0, Math.min(sizing.mobileFieldHandOverlapPx / zoom, room));
  return (natural + extension) * zoom < grid.shortBelowPx ? 0 : extension;
}
