// src/ui/sceneConfig.js — the one seam the W4 screens read their scene
// configs through: w4Parent() is uiConfig.scenes.w4, w4cLayout() is
// uiConfig.scenes.w4c (content/config/ui/scenes/*.json, compiled by
// tools/config-build.mjs into src/config/generated/ui.js). The models take
// these objects as parameters and read no config of their own.
import { uiConfig } from '../config/generated/ui.js';

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const isPlain = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

// Fills only the keys `base` does not have; a value the config sets is never
// overridden.
function fillGaps(base, gaps) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(gaps)) {
    if (!(key in out)) out[key] = value;
    else if (isPlain(out[key]) && isPlain(value)) out[key] = fillGaps(out[key], value);
  }
  return out;
}

// PENDING RELAY — keys the W4c context-band pass (owner, 2026-09-15: up to
// four responses without scrolling, smaller type, no sub-headings) needs and
// content/config/ui/scenes/w4c-dialogue.json does not have yet. They belong in
// that file; this block goes when they land there. Only missing keys are
// filled: every value the config already sets is the config's.
const PENDING_W4C = {
  sizing: {
    context: { titleRem: 0.95, titleLineHeight: 1.2, textRem: 0.9, paddingRem: 0.35, gapRem: 0.25 },
    responses: { fontRem: 0.85, lineHeight: 1.2, paddingBlockRem: 0.2, paddingInlineRem: 0.5, gapRem: 0.25, maxLines: 2 },
  },
  behavior: {
    maxVisibleResponses: 4,
    responseLayouts: [
      { columns: 1, placement: 'below' },
      { columns: 2, placement: 'below' },
      { columns: 2, placement: 'beside', textShare: 0.45 },
    ],
  },
};

const W4C = freeze(fillGaps(uiConfig.scenes.w4c, PENDING_W4C));

export const w4Parent = () => uiConfig.scenes.w4;
export const w4cLayout = () => W4C;
