import { isUiComponentId } from './UiComponentId.js';
import { isBehaviorModel } from './BehaviorModel.js';

function freezeValue(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeValue));
  if (value && typeof value === 'object') {
    const frozen = {};
    for (const [key, child] of Object.entries(value)) frozen[key] = freezeValue(child);
    return Object.freeze(frozen);
  }
  return value;
}

function serializable(value) {
  if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(serializable);
  return typeof value === 'object'
    && Object.getPrototypeOf(value) === Object.prototype
    && Object.values(value).every(serializable);
}

// Immutable presentation record. It intentionally cannot carry callbacks or
// mutable domain objects; behavior names are resolved later by a View host.
export function componentModel(component, {
  variant = '',
  properties = {},
  tokens = {},
  accessibility = {},
  behaviors = [],
  children = [],
} = {}) {
  if (!isUiComponentId(component)) throw new Error(`Unknown UI component model: ${component}`);
  if (typeof variant !== 'string') throw new Error(`${component} variant must be a string`);
  if (!serializable(properties)) throw new Error(`${component} properties must be serializable`);
  if (!serializable(tokens)) throw new Error(`${component} tokens must be serializable`);
  if (!serializable(accessibility)) throw new Error(`${component} accessibility must be serializable`);
  if (!Array.isArray(behaviors) || behaviors.some((behavior) => !isBehaviorModel(behavior))) {
    throw new Error(`${component} behaviors must be Behavior Models`);
  }
  if (!Array.isArray(children) || children.some((child) => !isComponentModel(child))) {
    throw new Error(`${component} children must be Component Models`);
  }
  return Object.freeze({
    component,
    variant,
    properties: freezeValue(properties),
    tokens: freezeValue(tokens),
    accessibility: freezeValue(accessibility),
    behaviors: Object.freeze([...behaviors]),
    children: Object.freeze([...children]),
  });
}

export function isComponentModel(value) {
  return !!value && typeof value === 'object' && isUiComponentId(value.component)
    && Array.isArray(value.behaviors) && Array.isArray(value.children);
}

export function childModel(parent, component, variant = null) {
  if (!isComponentModel(parent)) throw new Error('Parent must be a Component Model');
  const child = parent.children.find((candidate) => candidate.component === component
    && (variant == null || candidate.variant === variant));
  if (!child) throw new Error(`${parent.component} is missing child ${component}${variant == null ? '' : `:${variant}`}`);
  return child;
}

export function descendantModel(parent, component, variant = null) {
  if (!isComponentModel(parent)) throw new Error('Parent must be a Component Model');
  if (parent.component === component && (variant == null || parent.variant === variant)) return parent;
  for (const child of parent.children) {
    const found = descendantModelOrNull(child, component, variant);
    if (found) return found;
  }
  throw new Error(`${parent.component} is missing descendant ${component}${variant == null ? '' : `:${variant}`}`);
}

function descendantModelOrNull(parent, component, variant) {
  if (parent.component === component && (variant == null || parent.variant === variant)) return parent;
  for (const child of parent.children) {
    const found = descendantModelOrNull(child, component, variant);
    if (found) return found;
  }
  return null;
}
