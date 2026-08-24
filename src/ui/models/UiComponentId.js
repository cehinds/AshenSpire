// Presentation component identifiers are projected from the canonical dev
// component manifest used by the runtime and the developer catalog.
import { UI_COMPONENTS } from './UiComponentDefinition.js';

export { UI_COMPONENTS };

const KNOWN_COMPONENTS = new Set(Object.values(UI_COMPONENTS));

export function isUiComponentId(component) {
  return KNOWN_COMPONENTS.has(component);
}
