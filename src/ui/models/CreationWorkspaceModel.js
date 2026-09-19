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

/** Whether the class choices are fitted to the pane (descriptions folded, then the preview stepped aside). */
export function creationFitsChoices(config = CONFIG) {
  return config.behavior.fitChoicesToPane === true;
}
