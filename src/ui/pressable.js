// @ts-check
/** @import { Disarm, LongPressOptions } from './contracts.js' */
import { armPress } from './gesture.js';

const PRIMARY_BUTTON = 0;

function isAcceptedPress(origin, isPrimaryOnly)
{
    if (origin.source !== 'pointer')
    {
        return false;
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
 * Starts `onHold` once a pointer press has stayed within `tolerancePx` for `holdMs`.
 * Key and pad presses are declined, so they activate at once.
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

    const finishPress = () =>
    {
        cancelHold();
        element.removeEventListener('pointerleave', onLeave);
        return hasFired;
    };

    const beginPress = (origin, track) =>
    {
        if (!isAcceptedPress(origin, isPrimaryOnly))
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
        if (shouldCancelOnLeave)
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
 * Runs `action` on each click of `button`, refusing a second press
 * while the first is still running.
 *
 * @param {HTMLElement & { disabled: boolean }} button
 * @param {(event: Event) => unknown} action
 * @param {object} [options]
 * @param {ReturnType<typeof CreateBusyLock>} [options.lock]
 * @param {ReadonlyArray<{ disabled: boolean }>} [options.controls]
 * @param {() => void} [options.restore]
 * @returns {Disarm}
 */
export function GuardOnce(button, action, {
    lock = CreateBusyLock(),
    controls = [button],
    restore = undefined,
} = {})
{
    const onClick = (event) =>
        lock.Run(
            controls,
            () => action(event),
            restore,
        );
    button.addEventListener('click', onClick);

    return function DisarmGuard()
    {
        button.removeEventListener('click', onClick);
    };
}
