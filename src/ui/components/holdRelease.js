// src/ui/components/holdRelease.js — finish a completed pointer hold on release.

const RELEASE_EVENT = 'pointerup';
const CANCEL_EVENT = 'pointercancel';
const CLICK_EVENT = 'click';
const NEXT_GESTURE_EVENTS = Object.freeze([
  'pointerdown',
  'keydown',
]);
const CAPTURE = true;

const noOperation = () =>
{
};

// A touch release is followed by the browser's own click, hit-tested after the
// next screen mounts. Swallow that one click so it never presses what is new.
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
    window.removeEventListener(CLICK_EVENT, swallow, CAPTURE);
    for (const eventName of NEXT_GESTURE_EVENTS)
    {
      window.removeEventListener(eventName, stop, CAPTURE);
    }
  };
  const swallow = (event) =>
  {
    event.preventDefault();
    event.stopImmediatePropagation();
    stop();
  };
  window.addEventListener(CLICK_EVENT, swallow, CAPTURE);
  for (const eventName of NEXT_GESTURE_EVENTS)
  {
    window.addEventListener(eventName, stop, CAPTURE);
  }
  timer = setTimeout(stop, windowMs);
}

/**
 * Runs `onRelease` once the pointer that started the hold lifts, after the
 * release's trailing click is guarded. A press with no pointer id runs at once.
 * Returns a function that abandons the wait.
 */
export function FinishHoldOnRelease(button, startEvent, { trailingClickMs, onRelease })
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
    setTimeout(onRelease, 0);
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
