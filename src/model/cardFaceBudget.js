// The roomy face budget (owner, 2026-11-05: "put more text on cards, adjust the font size").
// Data lives in content/config/ui/components/card.json, components.rulesFace.face:
//   maxLines     rendered lines the rules box may hold          (default 5)
//   wordsPerLine words a line is planned to carry               (default 7)
//   minScale     the smallest font, as a share of the face's own full rules size (default 0.7)
//   minPx        never fit a roomy face below this many on-screen px (default 10); a card whose full size is
//                already smaller than that keeps its full size as the floor, so the compact hand is never shrunk further
// A face that cannot show this budget at that floor falls back to the compact projection (the old
// 3 clauses / 5 words / 90 characters) and its Inspect door.
import { uiConfig } from '../config/generated/ui.js';

const whole = (value, fallback, min = 1) => (Number.isFinite(Number(value)) && Number(value) >= min ? Math.floor(Number(value)) : fallback);
const share = (value, fallback) => (Number(value) > 0 && Number(value) <= 1 ? Number(value) : fallback);

export function faceBudget(config = uiConfig.components?.card?.components?.rulesFace?.face) {
  const lines = whole(config?.maxLines, 5), wordsPerLine = whole(config?.wordsPerLine, 7);
  return Object.freeze({
    lines, wordsPerLine,
    // A clause may wrap onto a second line; six characters is the budget the compact face already used per word.
    clauses: lines, clauseWords: wordsPerLine * 2, characters: lines * wordsPerLine * 6,
    minScale: share(config?.minScale, 0.7), minPx: whole(config?.minPx, 10, 0),
  });
}
export const FACE_BUDGET = faceBudget();

// The cards module's own defaults for the face cut (engine/modules/cards/defaults.json). A profile that sets
// faceMaxEffects / faceMaxLines BELOW these has asked for a shorter face, and the roomy reading honours it; at or
// above the defaults the roomy budget above governs.
export const MODULE_FACE_DEFAULTS = Object.freeze({ faceMaxEffects: 2, faceMaxLines: 3 });
export function roomyBudgetFor(cardsModule, budget = FACE_BUDGET) {
  let clauses = budget.clauses;
  for (const key of ['faceMaxEffects', 'faceMaxLines']) {
    const value = cardsModule?.[key];
    if (Number.isFinite(value) && value < MODULE_FACE_DEFAULTS[key]) clauses = Math.min(clauses, Math.max(0, value));
  }
  return clauses === budget.clauses ? budget : Object.freeze({ ...budget, clauses });
}
