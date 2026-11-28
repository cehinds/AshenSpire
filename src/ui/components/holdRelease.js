// src/ui/components/holdRelease.js — finish a completed pointer hold on release.

const RELEASE_EVENT = 'pointerup';
const CANCEL_EVENT = 'pointercancel';
const CLICK_EVENT = 'click';
const NEXT_GESTURE_EVENTS = Object.freeze([
  'pointerdown',
  'keydown',
]);
const CAPTURE = true;
const NEXT_TASK_DELAY_MS = 0;

const noOperation = () =>
{
};

function listenOnWindow(eventName, handler)
{
  window.addEventListener(
    eventName,
    handler,
    CAPTURE,
  );
}

function forgetOnWindow(eventName, handler)
{
  window.removeEventListener(
    eventName,
    handler,
    CAPTURE,
  );
}

// Keyboard, controller and script clicks are untrusted or have no pointer type.
// Only the browser's own pointer click can be the trailing one.
function isPointerClick(event)
{
  const pointerType = event.pointerType;
  const hasPointerType = typeof pointerType === 'string' && pointerType !== '';
  return event.isTrusted && hasPointerType;
}

// The browser clicks after a touch release, and hits whatever screen is new by then.
// Swallow that one click so it never presses the next screen.
function swallowTrailingClick(windowMs)
{
  if (!Number.isFinite(windowMs) || windowMs <= 0)
  {
    return;
  }
  let timer = 0;
  const stop = () =>
  {
    clearTimeout(timer);
    forgetOnWindow(CLICK_EVENT, swallow);
    for (const eventName of NEXT_GESTURE_EVENTS)
    {
      forgetOnWindow(eventName, stop);
    }
  };
  const swallow = (event) =>
  {
    if (!isPointerClick(event))
    {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    stop();
  };
  listenOnWindow(CLICK_EVENT, swallow);
  for (const eventName of NEXT_GESTURE_EVENTS)
  {
    listenOnWindow(eventName, stop);
  }
  timer = setTimeout(stop, windowMs);
}

/**
 * Runs `onRelease` when the pointer that started the hold lifts.
 * The release's trailing click is swallowed first.
 * A press with no pointer id runs at once.
 * @returns {() => void} Abandons the wait.
 */
export function FinishHoldOnRelease(
  button,
  startEvent,
  {
    trailingClickMs,
    onRelease,
  },
)
{
  const pointerId = startEvent?.pointerId;
  if (!Number.isInteger(pointerId))
  {
    onRelease();
    return noOperation;
  }
  const clear = () =>
  {
    button.removeEventListener(RELEASE_EVENT, release);
    button.removeEventListener(CANCEL_EVENT, cancel);
  };
  const release = (endEvent) =>
  {
    if (endEvent.pointerId !== pointerId)
    {
      return;
    }
    clear();
    swallowTrailingClick(trailingClickMs);
    setTimeout(onRelease, NEXT_TASK_DELAY_MS);
  };
  const cancel = (endEvent) =>
  {
    if (endEvent.pointerId === pointerId)
    {
      clear();
    }
  };
  button.addEventListener(RELEASE_EVENT, release);
  button.addEventListener(CANCEL_EVENT, cancel);
  return clear;
}
