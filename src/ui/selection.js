// @ts-check
/**
 * @import {
 *     KeyActivator,
 *     SelectionMarker,
 * } from './contracts.js'
 */

const ACTIVATION_KEYS = new Set([
    'Enter',
    ' ',
]);

function listOf(value)
{
    if (value == null)
    {
        return [];
    }
    return typeof value === 'string'
        ? [value]
        : [...value];
}

function nodesOf(nodes)
{
    return nodes?.classList
        ? [nodes]
        : [...nodes];
}

function markNode(node, isSelected, { classNames, ariaAttributes, ariaCurrent })
{
    for (const className of classNames)
    {
        node.classList.toggle(
            className,
            isSelected,
        );
    }
    for (const ariaAttribute of ariaAttributes)
    {
        node.setAttribute(
            ariaAttribute,
            String(isSelected),
        );
    }
    if (ariaCurrent == null)
    {
        return;
    }
    if (isSelected)
    {
        node.setAttribute(
            'aria-current',
            ariaCurrent,
        );
    }
    else
    {
        node.removeAttribute('aria-current');
    }
}

/**
 * MarkSelected(nodes, isSelected, options) sets the selected class and the selected ARIA state
 * on each node. `isSelected` is a boolean or a predicate called with (node, index).
 * @type {SelectionMarker}
 */
export function MarkSelected(
    nodes,
    isSelected,
    {
        className = 'is-selected',
        ariaAttribute = 'aria-pressed',
        ariaCurrent = null,
    } = {},
)
{
    const marking = {
        classNames: listOf(className),
        ariaAttributes: listOf(ariaAttribute),
        ariaCurrent,
    };
    const readSelected = typeof isSelected === 'function'
        ? isSelected
        : () => isSelected;
    nodesOf(nodes).forEach((node, index) =>
    {
        markNode(
            node,
            Boolean(readSelected(node, index)),
            marking,
        );
    });
}

/**
 * ActivateOnKey(element, onActivate, options) runs `onActivate(event)` (or `element.click()`)
 * on Enter or Space, after preventing the key's default. Returns disarm().
 * @type {KeyActivator}
 */
export function ActivateOnKey(
    element,
    onActivate = null,
    {
        canActivate = null,
        shouldStopPropagation = false,
    } = {},
)
{
    const handleKeydown = (event) =>
    {
        if (
            !ACTIVATION_KEYS.has(event.key)
            || (canActivate && !canActivate(event))
        )
        {
            return;
        }
        event.preventDefault();
        if (shouldStopPropagation)
        {
            event.stopPropagation();
        }
        if (onActivate)
        {
            onActivate(event);
        }
        else
        {
            element.click();
        }
    };
    element.addEventListener(
        'keydown',
        handleKeydown,
    );
    return () =>
        element.removeEventListener(
            'keydown',
            handleKeydown,
        );
}
