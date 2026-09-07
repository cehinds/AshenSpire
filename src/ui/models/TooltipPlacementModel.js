import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clampPct = (value, fallback) => Math.max(0, Math.min(50, finite(value, fallback)));

// Shared timing and presentation settings for contextual explanations.
// Placement prefers above; the primitive measures the room around the anchor.
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

/** Prefer above the target. The placement primitive measures actual space and
 * falls back below when the panel cannot fit, instead of reserving a fixed
 * top band that can unnecessarily cover buttons beneath the target. */
export function tooltipPlacementIntent() {
  return 'above';
}
