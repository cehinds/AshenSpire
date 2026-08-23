// View helpers for the stable ids owned by Presentation Models.
import { UI_COMPONENTS, isUiComponentId } from '../models/UiComponentId.js';
export { UI_COMPONENTS } from '../models/UiComponentId.js';

export function uiComponentAttrs(component, variant = '') {
  if (!isUiComponentId(component)) throw new Error(`Unknown UI component: ${component}`);
  return `data-ui-component="${component}"${variant ? ` data-ui-variant="${variant}"` : ''}`;
}

export function markUiComponent(element, component, variant = '') {
  if (!element) throw new Error(`Cannot mark missing UI component: ${component}`);
  if (!isUiComponentId(component)) throw new Error(`Unknown UI component: ${component}`);
  element.dataset.uiComponent = component;
  if (variant) element.dataset.uiVariant = variant;
  return element;
}
