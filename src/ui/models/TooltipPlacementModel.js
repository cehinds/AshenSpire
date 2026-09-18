import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';
import { balance } from '../../content/balance.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { uiConfig } from '../../config/generated/ui.js';

// Band defaults, the fade and the clamp live in
// content/config/ui/presentation/tooltipPlacement.json.
const TT = uiConfig.presentation.tooltipPlacement.behavior;

// The presenter's four height rungs, smallest first. tooltip.js steps a panel
// up this list until its content fits; nothing else sizes a tooltip.
export const TOOLTIP_RUNGS = Object.freeze(['small', 'medium', 'large', 'expanded']);
export const TOOLTIP_WIREFRAMES = Object.freeze(['WT1', 'WT2', 'WT3']);
// The panel edge the WT0 arrow sits on: `bottom` when the panel is above its
// trigger, `top` below it, `left`/`right` beside it; `none` when they overlap.
export const TOOLTIP_ARROW_EDGES = Object.freeze(['top', 'bottom', 'left', 'right']);

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clampPct = (value, fallback) => Math.max(0, Math.min(TT.limits.maxBandPct, finite(value, fallback)));

// One authored policy for every contextual explanation. Views supply only the
// anchor and whether the current composition is narrow; the model decides which
// side points toward the readable centre of the glass.
export function tooltipPlacementModel(presentation = {}) {
  return componentModel(UI.tooltip, {
    variant: 'edge-aware',
    tokens: {
      hoverDelayMs: Math.max(0, finite(presentation.hoverDelayMs, balance.ui.tooltipPlacement.hoverDelayMs)),
      autoFadeMs: Math.max(0, finite(presentation.autoFadeMs, TT.defaults.autoFadeMs)),
      topBandViewportPct: clampPct(presentation.topBandViewportPct, TT.defaults.topBandViewportPct),
      sideBandViewportPct: clampPct(presentation.sideBandViewportPct, TT.defaults.sideBandViewportPct),
    },
    accessibility: {
      label: 'Contextual explanation',
    },
  });
}

/**
 * Resolve an anchored explanation toward the viewport centre.
 *
 * Narrow layouts prefer above once the anchor is below the protected top
 * band. Inside that top band they point inward horizontally, or below when the
 * anchor is already centred. Wide layouts point inward from either side band
 * and use above in the middle. The placement primitive still owns the final
 * fit/fallback, so an authored preference can never make the tooltip disappear.
 */
export function tooltipPlacementIntent(anchor, viewport, model, { narrow = false } = {}) {
  if (!anchor || !viewport || !model?.tokens) return 'beside';
  const width = Math.max(1, finite(viewport.width, 1));
  const height = Math.max(1, finite(viewport.height, 1));
  const centerX = finite(anchor.left, 0) + (finite(anchor.width, 0) / 2);
  const top = finite(anchor.top, 0);
  const side = model.tokens.sideBandViewportPct / 100;
  const topBand = model.tokens.topBandViewportPct / 100;

  if (narrow && top >= height * topBand) return 'above';
  if (centerX <= width * side) return 'right';
  if (centerX >= width * (1 - side)) return 'left';
  return top < height * topBand ? 'under' : 'above';
}

/**
 * The WT0 tooltip configuration, checked: every presenter rung names one of
 * WT1–WT3, every one of those is drawn by some rung, a larger rung never
 * names a smaller wireframe, and the arrow has a real size.
 */
export function tooltipWireframeConfig(config = wireframeUi.tooltip) {
  const byRung = config?.wireframeByRung;
  if (!byRung || typeof byRung !== 'object') throw new Error('tooltip: wireframeByRung is required');
  const named = Object.keys(byRung);
  if (named.length !== TOOLTIP_RUNGS.length || !TOOLTIP_RUNGS.every(rung => Object.hasOwn(byRung, rung))) {
    throw new Error(`tooltip: wireframeByRung must name exactly ${TOOLTIP_RUNGS.join(', ')}`);
  }
  let previous = -1;
  for (const rung of TOOLTIP_RUNGS) {
    const at = TOOLTIP_WIREFRAMES.indexOf(byRung[rung]);
    if (at < 0) throw new Error(`tooltip: rung ${rung} names ${JSON.stringify(byRung[rung])}, not one of ${TOOLTIP_WIREFRAMES.join(', ')}`);
    if (at < previous) throw new Error(`tooltip: rung ${rung} names a smaller wireframe than the rung below it`);
    previous = at;
  }
  for (const id of TOOLTIP_WIREFRAMES) {
    if (!TOOLTIP_RUNGS.some(rung => byRung[rung] === id)) throw new Error(`tooltip: no rung draws ${id}`);
  }
  const { arrowWidthRem, arrowHeightRem, arrowInsetRem } = config;
  if (!(Number.isFinite(arrowWidthRem) && arrowWidthRem > 0)) throw new Error('tooltip: arrowWidthRem must be positive');
  if (!(Number.isFinite(arrowHeightRem) && arrowHeightRem > 0)) throw new Error('tooltip: arrowHeightRem must be positive');
  if (!(Number.isFinite(arrowInsetRem) && arrowInsetRem >= 0)) throw new Error('tooltip: arrowInsetRem must be zero or more');
  return Object.freeze({
    wireframeByRung: Object.freeze({ ...byRung }), arrowWidthRem, arrowHeightRem, arrowInsetRem,
  });
}

/** The wireframe (WT1, WT2 or WT3) a measured rung draws. */
export function tooltipWireframe(rung, config = wireframeUi.tooltip) {
  const { wireframeByRung } = tooltipWireframeConfig(config);
  if (!Object.hasOwn(wireframeByRung, rung)) throw new Error(`tooltip: unknown rung ${JSON.stringify(rung)}`);
  return wireframeByRung[rung];
}

/**
 * The arrow's size in the local px a fixed tooltip writes in. A reference rem
 * is at least 16 physical px (REFERENCE_REM_CSS), so divide through the zoom.
 */
export function tooltipArrowSize({ zoom = 1, rootFontPx = 16 } = {}, config = wireframeUi.tooltip) {
  const c = tooltipWireframeConfig(config);
  const z = finite(zoom, 1) > 0 ? zoom : 1;
  const reference = Math.max(16 / z, finite(rootFontPx, 16));
  return Object.freeze({
    widthPx: c.arrowWidthRem * reference,
    heightPx: c.arrowHeightRem * reference,
    insetPx: c.arrowInsetRem * reference,
  });
}

const NO_ARROW = Object.freeze({ edge: 'none', left: 0, top: 0, width: 0, height: 0 });

/**
 * WT0.arrow: where the arrow sits once the panel has been placed and shifted.
 *
 * `panel` and `anchor` are boxes in one coordinate space. The arrow goes on
 * the panel edge that faces the trigger and points at the trigger's centre,
 * slid along that edge but kept `insetPx` clear of the corners, so after a
 * shift it still points at the trigger. Returns the arrow's own box (its long
 * side runs along the edge) or `edge: 'none'` when the panel overlaps the
 * trigger or the edge is too short to carry it.
 */
export function tooltipArrow(panel, anchor, { widthPx, heightPx, insetPx = 0 } = {}) {
  if (!panel || !anchor || !(widthPx > 0) || !(heightPx > 0)) return NO_ARROW;
  const p = { left: finite(panel.left, 0), top: finite(panel.top, 0), width: finite(panel.width, 0), height: finite(panel.height, 0) };
  const a = { left: finite(anchor.left, 0), top: finite(anchor.top, 0), width: finite(anchor.width, 0), height: finite(anchor.height, 0) };
  const eps = TT.limits.edgeEpsilonPx;
  const pRight = p.left + p.width, pBottom = p.top + p.height;
  const aRight = a.left + a.width, aBottom = a.top + a.height;
  const edge = pBottom <= a.top + eps ? 'bottom'
    : p.top >= aBottom - eps ? 'top'
      : pRight <= a.left + eps ? 'right'
        : p.left >= aRight - eps ? 'left' : 'none';
  if (edge === 'none') return NO_ARROW;
  const along = edge === 'bottom' || edge === 'top';
  const inset = Math.max(0, finite(insetPx, 0));
  const lo = (along ? p.left : p.top) + inset + widthPx / 2;
  const hi = (along ? pRight : pBottom) - inset - widthPx / 2;
  if (hi < lo) return NO_ARROW;
  const centre = Math.min(Math.max(along ? a.left + a.width / 2 : a.top + a.height / 2, lo), hi);
  if (along) {
    return Object.freeze({
      edge, left: centre - widthPx / 2, top: edge === 'bottom' ? pBottom : p.top - heightPx, width: widthPx, height: heightPx,
    });
  }
  return Object.freeze({
    edge, left: edge === 'right' ? pRight : p.left - heightPx, top: centre - widthPx / 2, width: heightPx, height: widthPx,
  });
}
