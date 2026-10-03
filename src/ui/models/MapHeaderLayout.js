import { wireframeUi } from '../../content/wireframeUi.js';

// W4b MAP HEADER: the run HUD and the route strip share ONE band of
// `heightFraction` of the visible height (the owner's "10 vh for w4b"). DOM-free:
// the caller passes the viewport in physical (on-glass) CSS px and gets back
// the band's height and composition; the stylesheet converts through the page
// zoom, so this never needs to know it.
//
// The readable minimum wins over the percentage: the band is never shorter than
// one touch row (`targetPx`, the player's tap size, else the configured 44)
// plus its two insets. On a short host (844×390: 39 px nominal) the floor
// binds and `floored` says so.
//
// Composition:
//   wide    route | facts / meters | Armoury · Menu   (two text lines)
//   narrow  facts / meters / route | Armoury · Menu   (three text lines)
// A narrow band too short for three lines drops the route line (`route:
// 'hidden'`); the Act chip in the facts line still names the act.
export function mapHeaderLayout({ viewportWidthPx = 0, viewportHeightPx = 0, targetPx = null } = {}, config = wireframeUi.map.header) {
  const positive = (n) => (Number.isFinite(n) && n > 0 ? n : 0);
  const width = positive(viewportWidthPx);
  const height = positive(viewportHeightPx);
  const target = positive(targetPx) || config.minimumTargetPx;
  const minimumPx = target + 2 * config.insetPx;
  const nominalPx = round(config.heightFraction * height);
  const heightPx = Math.max(nominalPx, minimumPx);
  const contentPx = heightPx - 2 * config.insetPx;
  const lines = Math.max(1, Math.floor((contentPx + config.lineGapPx) / (config.lineHeightPx + config.lineGapPx)));
  const layout = width >= config.wideMinWidthPx ? 'wide' : 'narrow';
  const route = layout === 'wide' ? 'side' : lines >= config.narrowRouteLines ? 'line' : 'hidden';
  return Object.freeze({
    heightPx, nominalPx, minimumPx, floored: nominalPx < minimumPx,
    insetPx: config.insetPx, gapPx: config.lineGapPx, targetPx: target,
    layout, lines, route,
  });
}

const round = (n) => Math.round(n * 100) / 100;
