// src/ui/models/CreationWorkspaceModel.js — W1c Character creation as a W1
// workspace, projected without a DOM.
//
// FRONTEND-WIREFRAMES "W1c — Character creation": W1 is the shell; the
// categories sit in the rail (a selector above the pane on a compact host);
// only the active category is shown; the small portrait belongs to the
// header; Back and Next / Begin stay in a persistent bottom row; attributes
// take two columns when they fit and one in narrow portrait. This file owns
// which category is where, what the footer offers from each one, and how many
// attribute columns a pane width earns. Every number comes from
// uiConfig.screens.creation (content/config/ui/screens/creation.json).
import { uiConfig } from '../../config/generated/ui.js';

const CONFIG = uiConfig.screens.creation;

/** The categories in authored order; a duplicate or an empty list is a config error. */
export function creationCategories(config = CONFIG) {
  const list = config?.behavior?.categories;
  if (!Array.isArray(list) || !list.length) throw new Error('creation behavior.categories must list at least one category');
  if (new Set(list).size !== list.length) throw new Error(`creation behavior.categories repeats a category: ${list.join(', ')}`);
  return Object.freeze([...list]);
}

/**
 * creationStep(categories, current, direction) → the category one step away,
 * or null at either end. `direction` is +1 (Next) or -1 (Back).
 */
export function creationStep(categories, current, direction) {
  const at = categories.indexOf(current);
  if (at < 0) throw new Error(`creationStep: '${current}' is not a creation category`);
  if (direction !== 1 && direction !== -1) throw new Error(`creationStep: direction must be 1 or -1, got ${direction}`);
  return categories[at + direction] ?? null;
}

/**
 * creationFooterPlan({ categories, current }) → what the persistent footer
 * offers from this category: Back leaves the screen on the first category
 * and steps back otherwise; the primary is Next until the last category,
 * where it is Begin. Exactly two actions at every step (W0's footer rule).
 */
export function creationFooterPlan({ categories, current }) {
  const at = categories.indexOf(current);
  if (at < 0) throw new Error(`creationFooterPlan: '${current}' is not a creation category`);
  const last = at === categories.length - 1;
  return Object.freeze({
    back: at === 0 ? 'leave' : 'previous',
    previous: at === 0 ? null : categories[at - 1],
    primary: last ? 'begin' : 'next',
    next: last ? null : categories[at + 1],
    actions: 2,
  });
}

/**
 * creationRailItems({ categories, current, labels, values }) → one entry per
 * category: its label, the value it currently holds (the chosen class, the
 * name, the hands, the seed) and whether it is the active one.
 */
export function creationRailItems({ categories, current, labels = {}, values = {} }) {
  if (!categories.includes(current)) throw new Error(`creationRailItems: '${current}' is not a creation category`);
  return Object.freeze(categories.map((id) => Object.freeze({
    id,
    label: labels[id] ?? id,
    value: values[id] ?? '',
    selected: id === current,
  })));
}

/**
 * creationAttributeColumns({ hostWidthPx, rootFontPx }, config) → how many
 * columns the attribute grid takes in a pane of that width: the wide count
 * from sizing.attributeNarrowBelowRem up, the narrow count under it. An
 * unmeasured host (0 or missing) takes the narrow count: one column is never
 * wrong, only slower to read.
 */
export function creationAttributeColumns({ hostWidthPx = 0, rootFontPx = 0 } = {}, config = CONFIG) {
  const { attributeColumnsWide: wide, attributeColumnsNarrow: narrow, attributeNarrowBelowRem: below } = config.sizing;
  for (const [name, value] of Object.entries({ attributeColumnsWide: wide, attributeColumnsNarrow: narrow })) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`creation sizing.${name} must be a whole number ≥ 1, got ${value}`);
  }
  if (!(below > 0)) throw new Error(`creation sizing.attributeNarrowBelowRem must be > 0, got ${below}`);
  if (!(hostWidthPx > 0) || !(rootFontPx > 0)) return narrow;
  return hostWidthPx / rootFontPx >= below ? wide : narrow;
}

/** The header portrait's size, in rem, from config. */
export function creationPortraitRem(config = CONFIG) {
  const rem = config.sizing.headPortraitRem;
  if (!(rem > 0)) throw new Error(`creation sizing.headPortraitRem must be > 0, got ${rem}`);
  return rem;
}

/** How many lines a choice card's description keeps before it clips (sizing.choiceDescriptionLines). */
export function creationChoiceLines(config = CONFIG) {
  const lines = config.sizing.choiceDescriptionLines;
  if (!Number.isInteger(lines) || lines < 1) throw new Error(`creation sizing.choiceDescriptionLines must be a whole number ≥ 1, got ${lines}`);
  return lines;
}

/**
 * creationCssProperties(config) → every `--creation-*` custom property the
 * screen writes on its root, from config: the portrait, the description
 * lines, the attribute grid's resting column count (the narrow one, until the
 * pane is measured) and each spacing the W1c CSS block reads. kit.css names
 * no number of its own for this screen; a missing or non-positive value is a
 * config error, not a silent default.
 */
export function creationCssProperties(config = CONFIG) {
  const s = config.sizing;
  const positive = (name) => {
    const value = s[name];
    if (!(value > 0)) throw new Error(`creation sizing.${name} must be > 0, got ${value}`);
    return value;
  };
  return Object.freeze({
    '--creation-portrait': `${creationPortraitRem(config)}rem`,
    '--creation-choice-lines': String(creationChoiceLines(config)),
    '--creation-attribute-columns': String(creationAttributeColumns({}, config)),
    '--creation-rail-gap': `${positive('railGapPx')}px`,
    '--creation-rail-value-scale': String(positive('railValueScale')),
    '--creation-attribute-gap': `${positive('attributeGapPx')}px`,
    '--creation-review-pad': `${positive('reviewPadRem')}rem`,
    '--creation-head-tools-gap': `${positive('headToolsGapRem')}rem`,
    '--creation-portrait-gap': `${positive('portraitGapRem')}rem`,
    '--creation-view-switch-pad': `${positive('viewSwitchPadRem')}rem`,
    '--creation-view-switch-glyph': `${positive('viewSwitchGlyphRem')}rem`,
    '--creation-choice-compact-pad': `${positive('choiceCompactPadRem')}rem`,
    '--creation-choice-compact-gap': `${positive('choiceCompactGapRem')}rem`,
    '--creation-choice-bare-pad': `${positive('choiceBarePadRem')}rem`,
    '--creation-choice-bare-gap': `${positive('choiceBareGapRem')}rem`,
    ...(creationClassPreview(config) === 'unfold' ? (() => {
      const unfold = creationUnfoldGeometry(config);
      return {
        '--creation-unfold-portrait': `${unfold.portraitShare}fr`,
        '--creation-unfold-summary': `${unfold.summaryShare}fr`,
        '--creation-unfold-height': `${unfold.heightVh}vh`,
      };
    })() : {}),
  });
}

const CLASS_PREVIEWS = Object.freeze(['column', 'unfold']);

/**
 * creationClassPreview(config) → where the chosen class's portrait and
 * summary live: 'column' (a preview pane beside the choices) or 'unfold'
 * (the chosen card itself opens to hold them; owner, 2026-09-19).
 */
export function creationClassPreview(config = CONFIG) {
  const mode = config.behavior.classPreview ?? 'column';
  if (!CLASS_PREVIEWS.includes(mode)) throw new Error(`creation behavior.classPreview must be one of ${CLASS_PREVIEWS.join(', ')}, got ${mode}`);
  return mode;
}

/**
 * creationUnfoldGeometry(config) → the unfolded card: the portrait's and the
 * summary's shares of its width (the drawing's 30vw / 70vw, which together
 * are the whole card) and the card's height in vh.
 */
export function creationUnfoldGeometry(config = CONFIG) {
  const { unfoldPortraitShare: portraitShare, unfoldSummaryShare: summaryShare, unfoldHeightVh: heightVh } = config.sizing;
  for (const [name, value] of Object.entries({ unfoldPortraitShare: portraitShare, unfoldSummaryShare: summaryShare, unfoldHeightVh: heightVh })) {
    if (!(value > 0)) throw new Error(`creation sizing.${name} must be > 0, got ${value}`);
  }
  if (portraitShare + summaryShare !== 100) throw new Error(`creation sizing.unfoldPortraitShare + unfoldSummaryShare must be 100, got ${portraitShare + summaryShare}`);
  return Object.freeze({ portraitShare, summaryShare, heightVh });
}

/** Whether the class choices are fitted to the pane (descriptions folded, then the preview stepped aside). */
export function creationFitsChoices(config = CONFIG) {
  return config.behavior.fitChoicesToPane === true;
}
