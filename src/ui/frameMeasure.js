// Frame-scoped layout measurement for the combat screen's hot paths.
//
// Reading a box right after a style write forces the browser to flush style
// and layout on the spot, and a beat of combat does that dozens of times
// (every float, word and overhead read what the previous one just changed).
// Two tools stop that:
//
//   measure(el)               one getBoundingClientRect per element until the
//                             task (and its microtasks) ends or the owner of a
//                             geometry write calls invalidateMeasures().
//   measureThenMutate(k, fn)  runs fn in a microtask with every other queued
//                             job: all the reads first (fn returns its
//                             writes), then all the writes. Several floats or
//                             words made in one task cost one flush, not one
//                             each. A later job with the same key replaces the
//                             earlier one. The jobs run before the next paint.
//
// Headless-safe: nothing here touches the DOM beyond the element it is given.
const rects = new Map();
let rectsLive = false;

const snapshot = (live) => ({ left: live.left, top: live.top, width: live.width, height: live.height, right: live.right, bottom: live.bottom });

export function invalidateMeasures() { rects.clear(); }

export function measure(el) {
  let rect = rects.get(el);
  if (!rect) {
    rect = snapshot(el.getBoundingClientRect());
    rects.set(el, rect);
    if (!rectsLive) { rectsLive = true; queueMicrotask(() => { rectsLive = false; rects.clear(); }); }
  }
  return rect;
}

const jobs = new Map();
let flushQueued = false;
function flushJobs() {
  flushQueued = false;
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
  if (!flushQueued) { flushQueued = true; queueMicrotask(flushJobs); }
}

/** Run any queued jobs now (an instrument or test that needs the settled boxes). */
export function flushMeasureJobs() { if (flushQueued) flushJobs(); }
