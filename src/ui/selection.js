// @ts-check
/**
 * @import {
 *     KeyActivator,
 *     RovingNavigator,
 *     SelectionMarker,
 * } from './contracts.js'
 */

const ACTIVATION_KEYS = new Set([
    'Enter',
    ' ',
]);

const FORWARD_KEYS = {
    vertical: new Set(['ArrowDown']),
    horizontal: new Set(['ArrowRight']),
    both: new Set([
        'ArrowDown',
        'ArrowRight',
    ]),
};

const BACKWARD_KEYS = {
    vertical: new Set(['ArrowUp']),
    horizontal: new Set(['ArrowLeft']),
    both: new Set([
        'ArrowUp',
        'ArrowLeft',
    ]),
};

const ROW_KEYS = new Set([
    'ArrowDown',
    'ArrowUp',
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

function readStep(key, orientation, columns)
{
    const forward = FORWARD_KEYS[orientation].has(key);
    const backward = BACKWARD_KEYS[orientation].has(key);
    if (!forward && !backward)
    {
        return 0;
    }
    const isRowStep = orientation === 'both'
        && columns > 1
        && ROW_KEYS.has(key);
    const size = isRowStep
        ? columns
        : 1;
    return forward
        ? size
        : -size;
}

function findTarget(items, currentIndex, key, step)
{
    if (key === 'Home')
    {
        return items[0];
    }
    if (key === 'End')
    {
        return items.at(-1);
    }
    const count = items.length;
    return items[(((currentIndex + step) % count) + count) % count];
}

function focusNearest(target)
{
    target.focus?.({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
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

/**
 * RovingList(listElement, options) moves focus between `items()` with the arrow keys (and
 * Home/End when `hasHomeEnd`), wrapping at the ends. Returns disarm().
 * `orientation` is 'vertical', 'horizontal' or 'both' (or a function returning one); in 'both' a
 * grid of `columns` moves a whole row on ArrowUp/ArrowDown. A key from outside every item is
 * ignored unless `startIndex` names the item to move from. `onMove(target, event)` replaces the
 * default focus.
 * @type {RovingNavigator}
 */
export function RovingList(
    listElement,
    {
        items = () => [...listElement.children],
        orientation = 'both',
        columns = 1,
        hasHomeEnd = false,
        startIndex = null,
        shouldStopPropagation = false,
        onMove = focusNearest,
    } = {},
)
{
    const readOrientation = typeof orientation === 'function'
        ? orientation
        : () => orientation;
    const handleKeydown = (event) =>
    {
        const step = readStep(
            event.key,
            readOrientation() || 'both',
            columns,
        );
        const isEdgeKey = hasHomeEnd
            && (event.key === 'Home' || event.key === 'End');
        if (!step && !isEdgeKey)
        {
            return;
        }
        const liveItems = items();
        const foundIndex = liveItems.findIndex(item =>
            item === event.target || item.contains(event.target)
        );
        const currentIndex = foundIndex < 0
            ? startIndex
            : foundIndex;
        if (currentIndex == null || !liveItems.length)
        {
            return;
        }
        const target = findTarget(
            liveItems,
            currentIndex,
            event.key,
            step,
        );
        if (!target)
        {
            return;
        }
        event.preventDefault();
        if (shouldStopPropagation)
        {
            event.stopPropagation();
        }
        onMove(
            target,
            event,
        );
    };
    listElement.addEventListener(
        'keydown',
        handleKeydown,
    );
    return () =>
        listElement.removeEventListener(
            'keydown',
            handleKeydown,
        );
}
