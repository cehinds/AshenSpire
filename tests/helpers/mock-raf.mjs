// requestAnimationFrame for node tests that drive a mocked clock (t.mock.timers with 'setTimeout' and 'Date').
// Call after t.mock.timers.enable(): a frame fires every 16 ms of mocked time and gets the mocked time as its
// timestamp; performance.now() reads the same clock. Everything is restored when the test ends.
export function installMockRaf(t) {
  const saved = ['requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globalThis[key]]);
  const perf = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  globalThis.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 16);
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, 'performance', { value: { now: () => Date.now() }, configurable: true, writable: true });
  t.after(() => {
    for (const [key, value] of saved) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
    if (perf) Object.defineProperty(globalThis, 'performance', perf);
  });
}

/** Advance the mocked clock by ms in 16 ms steps, so each mocked frame sees the time it fires at. */
export function tickFrames(t, ms) {
  for (let left = ms; left > 0; left -= 16) t.mock.timers.tick(Math.min(16, left));
}
