// `AbortSignal.any([signal, AbortSignal.timeout(ms)])` without either static:
// AbortSignal.timeout is Safari 16 and AbortSignal.any is Safari 17.4, and
// iOS 15 (the iPhone SE 1st gen's last OS) has neither (docs/qa/IOS15-COMPAT.md).
// The returned signal aborts when `signal` does, or after `ms` with a
// TimeoutError, whichever is first; the timer is cleared once it has aborted.
export function AbortWithin(signal, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const reason = typeof DOMException === 'function' ? new DOMException('The operation timed out.', 'TimeoutError') : new Error('The operation timed out.');
    controller.abort(reason);
  }, ms);
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  return controller.signal;
}
