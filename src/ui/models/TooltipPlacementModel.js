import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clampPct = (value, fallback) => Math.max(0, Math.min(50, finite(value, fallback)));

// One authored policy for every contextual explanation. Views supply only the
// anchor and whether the current composition is narrow; the model decides which
// side points toward the readable centre of the glass.
export function tooltipPlacementModel(presentation = {}) {
  return componentModel(UI.tooltip, {
    variant: 'edge-aware',
    tokens: {
      hoverDelayMs: Math.max(0, finite(presentation.hoverDelayMs, 500)),
      autoFadeMs: Math.max(0, finite(presentation.autoFadeMs, 5000)),
      topBandViewportPct: clampPct(presentation.topBandViewportPct, 25),
      sideBandViewportPct: clampPct(presentation.sideBandViewportPct, 30),
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
