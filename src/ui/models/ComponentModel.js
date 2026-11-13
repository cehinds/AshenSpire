import { isUiComponentId } from './UiComponentId.js';
import { isBehaviorModel } from './BehaviorModel.js';

function freezeValue(value)
{
    if (Array.isArray(value))
    {
        return Object.freeze(value.map(freezeValue));
    }
    if (value && typeof value === 'object')
    {
        const frozen = {};
        for (const [key, child] of Object.entries(value))
        {
            frozen[key] = freezeValue(child);
        }
        return Object.freeze(frozen);
    }
    return value;
}

function serializable(value)
{
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value))
    {
        return true;
    }
    if (Array.isArray(value))
    {
        return value.every(serializable);
    }
    return typeof value === 'object'
        && Object.getPrototypeOf(value) === Object.prototype
        && Object.values(value).every(serializable);
}

/** Creates a frozen, serializable presentation record without callbacks or domain objects. */
export function ComponentModel(component, {
    variant = '',
    properties = {},
    tokens = {},
    accessibility = {},
    behaviors = [],
    children = [],
} = {})
{
    if (!isUiComponentId(component))
    {
        throw new Error(`Unknown UI component model: ${component}`);
    }
    if (typeof variant !== 'string')
    {
        throw new Error(`${component} variant must be a string`);
    }
    if (!serializable(properties))
    {
        throw new Error(`${component} properties must be serializable`);
    }
    if (!serializable(tokens))
    {
        throw new Error(`${component} tokens must be serializable`);
    }
    if (!serializable(accessibility))
    {
        throw new Error(`${component} accessibility must be serializable`);
    }
    if (!Array.isArray(behaviors) || behaviors.some((behavior) => !isBehaviorModel(behavior)))
    {
        throw new Error(`${component} behaviors must be Behavior Models`);
    }
    if (!Array.isArray(children) || children.some((child) => !IsComponentModel(child)))
    {
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

/** @deprecated Use ComponentModel. */
export const componentModel = ComponentModel;

export function IsComponentModel(value)
{
    return !!value && typeof value === 'object' && isUiComponentId(value.component)
        && Array.isArray(value.behaviors) && Array.isArray(value.children);
}

/** @deprecated Use IsComponentModel. */
export const isComponentModel = IsComponentModel;

export function ChildModel(parent, component, variant = null)
{
    const child = OptionalChildModel(parent, component, variant);
    if (!child)
    {
        throw new Error(
            `${parent.component} is missing child ${component}${
                variant == null ? '' : `:${variant}`
            }`,
        );
    }
    return child;
}

/** @deprecated Use ChildModel. */
export const childModel = ChildModel;

/** Returns the requested child or null when its owner filtered it out. */
export function OptionalChildModel(parent, component, variant = null)
{
    if (!IsComponentModel(parent))
    {
        throw new Error('Parent must be a Component Model');
    }
    return parent.children.find((candidate) =>
        candidate.component === component
        && (variant == null || candidate.variant === variant)
    ) || null;
}

/** @deprecated Use OptionalChildModel. */
export const optionalChildModel = OptionalChildModel;

export function DescendantModel(parent, component, variant = null)
{
    if (!IsComponentModel(parent))
    {
        throw new Error('Parent must be a Component Model');
    }
    if (parent.component === component && (variant == null || parent.variant === variant))
    {
        return parent;
    }
    for (const child of parent.children)
    {
        const found = descendantModelOrNull(child, component, variant);
        if (found)
        {
            return found;
        }
    }
    throw new Error(
        `${parent.component} is missing descendant ${component}${
            variant == null ? '' : `:${variant}`
        }`,
    );
}

/** @deprecated Use DescendantModel. */
export const descendantModel = DescendantModel;

function descendantModelOrNull(parent, component, variant)
{
    if (parent.component === component && (variant == null || parent.variant === variant))
    {
        return parent;
    }
    for (const child of parent.children)
    {
        const found = descendantModelOrNull(child, component, variant);
        if (found)
        {
            return found;
        }
    }
    return null;
}
