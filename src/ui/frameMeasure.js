// Frame-scoped layout measurement for the combat screen's hot paths.
//
// Reading a box right after a style write forces the browser to flush style
// and layout on the spot, and a beat of combat does that dozens of times
// (every float, word and overhead read what the previous one just changed).
// Two tools stop that:
//
//   measure(el)               one getBoundingClientRect per element for the whole
//                             frame (the animation timeline's frame time), until
//                             the owner of a geometry write calls
//                             invalidateMeasures() or the page resizes, scrolls,
//                             takes input or finishes a transition. Where there is
//                             no timeline it lasts until the task's microtasks end.
//   measureThenMutate(k, fn)  runs fn at the start of the next animation frame
//                             (a microtask where there is no rAF) with every
//                             other queued job: all the reads first (fn returns
//                             its writes), then all the writes. Every float and
//                             word made by the beats of a frame costs one flush,
//                             the one that frame pays anyway, not one each. A
//                             later job with the same key replaces the earlier
//                             one. The jobs run before that frame paints.
//
// Headless-safe: nothing here touches the DOM beyond the element it is given.
const rects = new Map();
let rectsLive = false;
let rectsFrame = null;
let rectsAt = 0;
let wired = false;

const snapshot = (live) => ({ left: live.left, top: live.top, width: live.width, height: live.height, right: live.right, bottom: live.bottom });

export function invalidateMeasures() { rects.clear(); }

// The frame the page is in: constant across every rAF callback and task until
// the next frame starts, so a box read in one stays good for the rest of it.
const frameTime = () => (typeof document !== 'undefined' ? document.timeline?.currentTime ?? null : null);
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
// A frame is 16.7 ms; a page that stops producing frames must not keep serving old boxes.
const FRAME_LIFE_MS = 20;

function watchLayoutChanges() {
  wired = true;
  if (typeof addEventListener !== 'function') return;
  const clear = () => rects.clear();
  for (const type of ['resize', 'scroll', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'click',
    'transitionend', 'animationend', 'transitioncancel', 'animationcancel', 'orientationchange']) {
    addEventListener(type, clear, { capture: true, passive: true });
  }
}

export function measure(el) {
  const frame = frameTime();
  if (frame !== null && (frame !== rectsFrame || now() - rectsAt > FRAME_LIFE_MS)) rects.clear();
  let rect = rects.get(el);
  if (!rect) {
    if (!wired) watchLayoutChanges();
    rect = snapshot(el.getBoundingClientRect());
    if (!rects.size) { rectsFrame = frame; rectsAt = now(); }
    rects.set(el, rect);
    if (frame === null && !rectsLive) { rectsLive = true; queueMicrotask(() => { rectsLive = false; rects.clear(); }); }
  }
  return rect;
}

const jobs = new Map();
let flushQueued = false;
let frameHandle = 0;
function flushJobs() {
  flushQueued = false;
  if (frameHandle) { cancelAnimationFrame(frameHandle); frameHandle = 0; }
  const batch = [...jobs.values()];
  jobs.clear();
  // Boxes read earlier in this task may predate writes made since.
  invalidateMeasures();
  const writes = [];
  for (const read of batch) {
    try { const write = read(); if (typeof write === 'function') writes.push(write); } catch (error) { reportFailure(error); }
  }
  for (const write of writes) {
    try { write(); } catch (error) { reportFailure(error); }
  }
  invalidateMeasures();
}
const reportFailure = (error) => { if (typeof reportError === 'function') reportError(error); else queueMicrotask(() => { throw error; }); };

export function measureThenMutate(key, read) {
  jobs.set(key, read);
  if (flushQueued) return;
  flushQueued = true;
  if (typeof requestAnimationFrame === 'function') frameHandle = requestAnimationFrame(() => { frameHandle = 0; flushJobs(); });
  else queueMicrotask(flushJobs);
}

/** Run any queued jobs now (an instrument or test that needs the settled boxes). */
export function flushMeasureJobs() { if (flushQueued) flushJobs(); }
