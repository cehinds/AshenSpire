import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

// Immutable presentation contract for the playable corridor between the run
// HUD and the hand. The view projects these authored values to CSS/device
// geometry; the combat screen does not own a second set of spacing numbers.
export function battlefieldStageModel(presentation = {}) {
  return componentModel(UI.battlefieldStage, {
    tokens: {
      hudClearanceViewportPct: finite(presentation.hudClearanceViewportPct, 3),
      actionClearanceViewportPct: finite(presentation.actionClearanceViewportPct, 3),
      intentGapPx: finite(presentation.intentGapPx, 6),
      centerPct: finite(presentation.centerPct, 50),
    },
    accessibility: {
      label: 'Combat battlefield',
    },
  });
}
