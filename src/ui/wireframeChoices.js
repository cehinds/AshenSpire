// src/ui/wireframeChoices.js — the player's wireframe choices, on the document.
//
// The choices themselves are WireframeChoiceModel's (Settings → Advanced →
// Wireframes). This is the one adapter between that model and the page: the
// settings bag is written onto the root element as one data attribute per
// choice, and the four components that answer to a choice read it back from
// there. Same shape as `cardMotif` and `handLayout` in main.js, and for the
// same reason — a modal shell, a scene fitter and a kit control cannot each be
// handed the settings store, and none of them should know where it lives.
//
// A choice is a WORD, never a number or a flag: `data-wireframe-modal-width`
// reads 'auto', 'narrow' or 'wide', so the state is legible in the inspector
// and an instrument can assert on it.
import { WIREFRAME_CHOICE_KEYS, wireframeChoice, wireframeChoices } from './models/WireframeChoiceModel.js';

const rootOf = (root) => root || (typeof document === 'undefined' ? null : document.documentElement);

/**
 * applyWireframeChoices(settings, root) → the words now on the root.
 *
 * Called from applyDisplaySettings, so it runs at boot and again on every
 * settings change. Values are validated by the model on the way in, so a
 * rotted stored word lands on 'auto' here rather than reaching a component.
 */
export function applyWireframeChoices(settings = {}, root = rootOf()) {
  const resolved = wireframeChoices(settings);
  if (root) for (const key of WIREFRAME_CHOICE_KEYS) root.dataset[key] = resolved[key];
  return resolved;
}

/** activeWireframeChoice(key, root) → the word a component should draw by. */
export function activeWireframeChoice(key, root = rootOf()) {
  return wireframeChoice(root?.dataset, key);
}

/** Every word at once, for a caller that needs more than one (the scene fitter). */
export function activeWireframeChoices(root = rootOf()) {
  return wireframeChoices(root?.dataset);
}
