// src/ui/models/WireframeChoiceModel.js — the player's wireframe choices, DOM-free.
//
// FRONTEND-WIREFRAMES hands every surface a wireframe: W1 for a modal window,
// W1's category navigation for a menu, W4's painted plate for a scene. Several
// of those drawings leave a decision open — which width rung a door takes, how
// wide its footer buttons run, whether the navigation is a rail or a selector,
// whether a scene draws its skyline (WGS6) and its floor band (WGS7) — and the
// build has always answered each of them one way. This file is the one place
// those answers are re-asked, per family, by the player: Settings → Advanced →
// Wireframes, one dropdown per choice under a Modals / Menus / Scenes topic.
//
// EVERY CHOICE DEFAULTS TO 'auto', which means "as the wireframe was drawn".
// `auto` resolves to precisely what each caller did before this file existed,
// so the shipped look is untouched until a player picks something else. That is
// also why each resolver takes the AUTHORED value as its first argument rather
// than inventing one: the choice shifts a decision the surface already made, it
// does not take the decision away from it.
//
// Nothing here reads the document or a settings store. `src/ui/wireframeChoices.js`
// is the one adapter that does: it writes each resolved word onto the root as a
// data attribute and reads it back for the four components below.
import { CATEGORY_NAV_MODES } from './CategoryNavModel.js';
import { uiConfig } from '../../config/generated/ui.js';

/** The word every choice starts on: draw it the way the wireframe draws it. */
export const AS_DESIGNED = 'auto';

const option = (id, label) => Object.freeze({ id, label });
const asDesigned = (label = 'As designed') => option(AS_DESIGNED, label);

/**
 * The catalogue, grouped exactly as the Wireframes tab draws it: one topic per
 * family of surfaces, one dropdown per open decision. `key` is both the setting
 * and — camelCased into a data attribute — the word on the root element, so a
 * choice has one name from the row a player touches to the component that reads
 * it.
 */
export const WIREFRAME_CHOICE_GROUPS = Object.freeze([
  Object.freeze({
    id: 'Modals',
    label: 'Modals',
    choices: Object.freeze([
      Object.freeze({
        key: 'wireframeModalWidth',
        label: 'Modal window width',
        note: 'A window opens at the narrowest of four widths that holds what is in it. This moves every window one step along that ladder — narrower to see more of the game behind it, wider for fewer wrapped lines. Windows already open change with it, and a window at either end of the ladder stays there.',
        def: AS_DESIGNED,
        options: Object.freeze([
          asDesigned(),
          option('narrow', 'One step narrower'),
          option('wide', 'One step wider'),
        ]),
      }),
      Object.freeze({
        key: 'wireframeModalFooter',
        label: 'Modal footer buttons',
        note: 'How far the buttons along the bottom of a window run: Short is about a third of a wide window, Long about two thirds, and Full width gives them the whole footer — which is what a phone already does. Each window picks its own today; this asks every one of them for the same.',
        def: AS_DESIGNED,
        options: Object.freeze([
          asDesigned(),
          option('short', 'Short'),
          option('medium', 'Medium'),
          option('long', 'Long'),
          option('fill', 'Full width'),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: 'Menus',
    label: 'Menus',
    choices: Object.freeze([
      Object.freeze({
        key: 'wireframeMenuNav',
        label: 'Category navigation',
        note: 'Every menu with categories — Shop, Armoury, Compendium, Profile, character creation — lists them down the left when they fit and folds them into one [Category ▾] button above the page when they do not. Rail and Selector answer for the screen instead, on every menu, including a narrow one that would not have chosen the list itself.',
        def: AS_DESIGNED,
        options: Object.freeze([
          asDesigned('Fit to the screen'),
          option('rail', 'Always the rail'),
          option('selector', 'Always the selector'),
        ]),
      }),
      Object.freeze({
        key: 'wireframeMenuFrame',
        label: 'Workspace frame',
        note: 'How much of the screen a workspace menu takes — the Compendium, your Profile, the Smith and the stable. Fill the screen removes the margin around it; Inset pulls it in. Menus already open change with it.',
        def: AS_DESIGNED,
        options: Object.freeze([
          asDesigned(),
          option('full', 'Fill the screen'),
          option('inset', 'Inset'),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: 'Scenes',
    label: 'Scenes',
    choices: Object.freeze([
      Object.freeze({
        key: 'wireframeSceneSkyline',
        label: 'Scene backdrop',
        note: 'The painted place behind a fight or a conversation (the drawings call it WGS6). Never drawn leaves the scene on its plain background, which is the least a scene can draw. A fight or a conversation on screen takes it at once.',
        def: AS_DESIGNED,
        options: Object.freeze([
          asDesigned(),
          option('on', 'Always drawn'),
          option('off', 'Never drawn'),
        ]),
      }),
      Object.freeze({
        key: 'wireframeSceneFloor',
        label: 'Scene ground line',
        note: 'How the painting is cropped to the ground band at the bottom of a scene (the drawings call it WGS7). Aligned puts its painted ground line exactly on that band; the plain crop centres the painting instead. Where the fighters stand is set by the formation and does not move either way.',
        def: AS_DESIGNED,
        options: Object.freeze([
          asDesigned(),
          option('on', 'Aligned to the ground line'),
          option('off', 'Plain cover crop'),
        ]),
      }),
    ]),
  }),
]);

/** Every choice, flat, in the order the tab draws them. */
export const WIREFRAME_CHOICES = Object.freeze(
  WIREFRAME_CHOICE_GROUPS.flatMap((group) => group.choices.map((choice) => Object.freeze({ ...choice, group: group.id }))));

export const WIREFRAME_CHOICE_KEYS = Object.freeze(WIREFRAME_CHOICES.map((choice) => choice.key));

const BY_KEY = new Map(WIREFRAME_CHOICES.map((choice) => [choice.key, choice]));

/** The declaration behind a key. Unknown keys throw: a typo is not a default. */
export function wireframeChoiceSpec(key) {
  const spec = BY_KEY.get(key);
  if (!spec) throw new Error(`Unknown wireframe choice '${key}'`);
  return spec;
}

/**
 * wireframeChoice(source, key) → the word in force.
 *
 * `source` is any bag keyed by choice key — the settings store, or the root's
 * dataset. A value outside the choice's own options is the default, because a
 * bag written by an older build (or a hand-edited settings file) must not put a
 * surface into a state no dropdown can name.
 */
export function wireframeChoice(source, key) {
  const spec = wireframeChoiceSpec(key);
  const stored = source?.[key];
  return spec.options.some((entry) => entry.id === stored) ? stored : spec.def;
}

/** Every choice at once, defaults included. */
export function wireframeChoices(source) {
  return Object.freeze(Object.fromEntries(WIREFRAME_CHOICE_KEYS.map((key) => [key, wireframeChoice(source, key)])));
}

/**
 * resolveModalRung(authored, choice, rungs) → the width rung a door draws at.
 *
 * The door still picks the rung that holds its body; this steps that answer
 * along the ladder and STOPS at either end rather than wrapping — a player who
 * asked for narrower and got the widest door in the game would rightly read it
 * as a bug. An authored rung the ladder does not contain throws, because the
 * shell's own guard is what that mistake belongs to.
 */
export function resolveModalRung(authored, choice, rungs) {
  const at = rungs.indexOf(authored);
  if (at < 0) throw new Error(`Unknown modal size '${authored}'`);
  const step = choice === 'narrow' ? -1 : choice === 'wide' ? 1 : 0;
  return rungs[Math.min(rungs.length - 1, Math.max(0, at + step))];
}

/** resolveFooterSize(authored, choice, sizes) → the button-row step a footer takes. */
export function resolveFooterSize(authored, choice, sizes) {
  return sizes.includes(choice) ? choice : authored;
}

/**
 * resolveCategoryNavMode(planned, choice) → rail or selector.
 *
 * `planned` is CategoryNavModel's measured answer. A named mode overrides it
 * outright: the model stays the authority on what FITS, and the player stays
 * the authority on what they want to look at.
 */
export function resolveCategoryNavMode(planned, choice) {
  return CATEGORY_NAV_MODES.includes(choice) ? choice : planned;
}

// The one authored number this file needs, and it is authored where every other
// layout number is (content/config/ui/components/workspace.json). wireframeUi is
// a frozen pre-migration snapshot, so a new key goes to uiConfig directly.
const WORKSPACE_INSET = uiConfig.components.workspace.sizing.insetScale;

/**
 * resolveWorkspaceSpec(spec, choice) → the W1 frame shares to paint.
 *
 * `full` is the whole host, not a bigger number than the drawing allows:
 * workspaceFrameVars refuses anything outside (0, 1], and 1 is the top of that
 * range. `inset` scales both shares by the authored inset.
 */
export function resolveWorkspaceSpec(spec, choice) {
  if (choice === 'full') return { ...spec, frameWidth: 1, frameHeight: 1 };
  if (choice === 'inset') {
    return { ...spec, frameWidth: spec.frameWidth * WORKSPACE_INSET, frameHeight: spec.frameHeight * WORKSPACE_INSET };
  }
  return spec;
}

/**
 * resolveSceneConfig(config, choices) → the scene config SceneLayerModel reads.
 *
 * Only the two layer switches are touched, and only when a choice names one:
 * the dialogue hands the fitter its own floor fraction, and a player's answer
 * about WGS6 must not overwrite it.
 */
export function resolveSceneConfig(config, { wireframeSceneSkyline = AS_DESIGNED, wireframeSceneFloor = AS_DESIGNED } = {}) {
  const resolved = { ...config };
  if (wireframeSceneSkyline !== AS_DESIGNED) resolved.skyline = wireframeSceneSkyline === 'on';
  if (wireframeSceneFloor !== AS_DESIGNED) resolved.floor = wireframeSceneFloor === 'on';
  return resolved;
}
