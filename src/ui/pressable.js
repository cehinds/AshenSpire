// @ts-check
/** @import { Disarm, LongPressOptions } from './contracts.js' */
import { armPress } from './gesture.js';

const PRIMARY_BUTTON = 0;

function isAcceptedPress(origin, { isPointerOnly, isPrimaryOnly })
{
    if (origin.source !== 'pointer')
    {
        return !isPointerOnly;
    }
    return !isPrimaryOnly || origin.ev.button === PRIMARY_BUTTON;
}

function hasMovedPast(origin, moveEvent, tolerancePx)
{
    if (!(tolerancePx >= 0))
    {
        return false;
    }
    const distance = Math.hypot(
        moveEvent.clientX - origin.x,
        moveEvent.clientY - origin.y,
    );
    return distance > tolerancePx;
}

function enableControls(controls)
{
    for (const control of controls)
    {
        control.disabled = false;
    }
}

function disableControls(controls)
{
    for (const control of controls)
    {
        control.disabled = true;
    }
}

/**
 * Starts `onHold` once a press has stayed within `tolerancePx` for `holdMs`.
 * A hold that returns true swallows the click its release produces.
 *
 * @param {HTMLElement} element
 * @param {LongPressOptions} options
 * @returns {Disarm}
 */
export function ArmLongPress(element, {
    holdMs,
    tolerancePx,
    onHold,
    onTap = null,
    isPointerOnly = false,
    isPrimaryOnly = true,
    shouldCapturePointer = true,
    shouldCancelOnLeave = false,
})
{
    let holdTimer = null;
    let hasFired = false;
    let shouldSwallowClick = false;

    const cancelHold = () =>
    {
        clearTimeout(holdTimer);
        holdTimer = null;
    };

    const fireHold = (event) =>
    {
        holdTimer = null;
        hasFired = true;
        shouldSwallowClick = onHold(event) === true;
    };

    const onLeave = () =>
    {
        cancelHold();
    };

    const finishPress = (endEvent, { cancelled }) =>
    {
        const wasTap = holdTimer !== null && !cancelled;
        cancelHold();
        element.removeEventListener('pointerleave', onLeave);
        if (wasTap && onTap)
        {
            onTap(endEvent);
        }
        return hasFired;
    };

    const beginPress = (origin, track) =>
    {
        if (!isAcceptedPress(origin, { isPointerOnly, isPrimaryOnly }))
        {
            return false;
        }
        cancelHold();
        hasFired = false;
        shouldSwallowClick = false;
        holdTimer = setTimeout(
            () => fireHold(origin.ev),
            holdMs,
        );
        if (shouldCancelOnLeave && origin.source === 'pointer')
        {
            element.addEventListener('pointerleave', onLeave);
        }
        track({
            onMove: (moveEvent) =>
            {
                if (hasMovedPast(origin, moveEvent, tolerancePx))
                {
                    cancelHold();
                }
            },
            onEnd: finishPress,
        });
        return true;
    };

    const onClick = (event) =>
    {
        if (!shouldSwallowClick)
        {
            return;
        }
        shouldSwallowClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    const disarmPress = armPress(
        element,
        beginPress,
        { capturePointer: shouldCapturePointer },
    );
    element.addEventListener('click', onClick, true);

    return function DisarmLongPress()
    {
        cancelHold();
        disarmPress();
        element.removeEventListener('pointerleave', onLeave);
        element.removeEventListener('click', onClick, true);
    };
}

/**
 * One busy flag shared by a group of controls: while an action runs, the
 * controls are disabled and every other guarded action is refused.
 */
export function CreateBusyLock()
{
    let isBusy = false;

    return {
        IsBusy()
        {
            return isBusy;
        },

        /**
         * @param {ReadonlyArray<{ disabled: boolean }>} controls
         * @param {() => unknown} action
         * @param {() => void} [restore]
         */
        async Run(controls, action, restore = () => enableControls(controls))
        {
            if (isBusy)
            {
                return undefined;
            }
            isBusy = true;
            disableControls(controls);
            try
            {
                return await action();
            }
            finally
            {
                isBusy = false;
                restore();
            }
        },
    };
}

/**
 * Runs `action` on each `eventName` from `button`, refusing a second press
 * while the first is still running.
 *
 * @param {HTMLElement & { disabled: boolean }} button
 * @param {(event: Event) => unknown} action
 * @param {object} [options]
 * @param {ReturnType<typeof CreateBusyLock>} [options.lock]
 * @param {ReadonlyArray<{ disabled: boolean }>} [options.controls]
 * @param {() => void} [options.restore]
 * @param {string} [options.eventName]
 * @returns {Disarm}
 */
export function GuardOnce(button, action, {
    lock = CreateBusyLock(),
    controls = [button],
    restore = undefined,
    eventName = 'click',
} = {})
{
    const onEvent = (event) =>
        lock.Run(
            controls,
            () => action(event),
            restore,
        );
    button.addEventListener(eventName, onEvent);

    return function DisarmGuard()
    {
        button.removeEventListener(eventName, onEvent);
    };
}
