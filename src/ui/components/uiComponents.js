// View helpers for the stable ids owned by Presentation Models.
import { UI_COMPONENTS as COMPONENT_IDS, isUiComponentId } from '../models/UiComponentId.js';
export const UI_COMPONENTS = COMPONENT_IDS;

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
