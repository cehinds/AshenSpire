import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

// Immutable presentation contract for the playable corridor between the run
// HUD and the hand. The view projects these authored values to CSS/device
// geometry; the combat screen does not own a second set of spacing numbers.
export function battlefieldStageModel(presentation = {}) {
  const centerPct = finite(presentation.centerPct, 50);
  // A stack translated around an off-centre anchor can only use twice the
  // shorter distance to either corridor edge. Keep that geometry derived from
  // the same authored centre token so valid 25–75 configurations stay safe.
  const centerHeightRatio = Math.max(0, Math.min(1,
    (2 * Math.min(centerPct, 100 - centerPct)) / 100));
  return componentModel(UI.battlefieldStage, {
    tokens: {
      hudClearanceViewportPct: finite(presentation.hudClearanceViewportPct, 3),
      actionClearanceViewportPct: finite(presentation.actionClearanceViewportPct, 3),
      intentGapPx: finite(presentation.intentGapPx, 6),
      centerPct,
      centerHeightRatio,
    },
    accessibility: {
      label: 'Combat battlefield',
    },
  });
}
