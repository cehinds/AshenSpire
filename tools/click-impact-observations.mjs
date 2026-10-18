// Opt-in observations in the native probe's own play, never a second drive.
// No browser/DOM work is performed by importing this module in Node tests.
export function installImpactObservations() {
  let active = null;
  const append = (record, key, value, cap) => {
    if (record[key].length < cap) record[key].push(value);
    else record.dropped[key]++;
  };
  const nativeTimeout = window.setTimeout;
  window.setTimeout = function (callback, delay, ...args) {
    const record = active;
    // String callbacks keep the browser's exact native behavior.
    if (!record || typeof callback !== 'function' || !(typeof delay === 'number' && Number.isFinite(delay) && delay >= 20)) return Reflect.apply(nativeTimeout, this, [callback, delay, ...args]);
    if (record.scheduledTimers++ >= 400) { record.dropped.timers++; return Reflect.apply(nativeTimeout, this, [callback, delay, ...args]); }
    const timer = { scheduled: performance.now(), delay, name: callback.name.slice(0, 80) };
    return Reflect.apply(nativeTimeout, this, [function (...values) {
      timer.fired = performance.now();
      try { return Reflect.apply(callback, this, values); }
      finally { timer.ended = performance.now(); append(record, 'timers', timer, 400); }
    }, delay, ...args]);
  };
  const receive = entries => {
    if (!active) return;
    for (const e of entries) append(active, 'longtasks', { start: e.startTime, duration: e.duration }, 80);
  };
  let observer = null;
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    observer = new PerformanceObserver(list => receive(list.getEntries()));
    observer.observe({ entryTypes: ['longtask'] });
  }
  window.__impactObservation = {
    start() {
      const record = active = { start: performance.now(), scheduledTimers: 0, timers: [], frames: [], longtasks: [], dropped: { timers: 0, frames: 0, longtasks: 0, resources: 0, beats: 0 } };
      record.previousTrace = window.__fx?.trace;
      if (window.__fx) window.__fx.trace = [];
      const frame = time => { if (active !== record) return; append(record, 'frames', time, 500); if (record.frames.length < 500) requestAnimationFrame(frame); else record.dropped.frames++; };
      requestAnimationFrame(frame);
    },
    finish() {
      if (!active) return null;
      if (observer) receive(observer.takeRecords());
      const record = active;
      active = null;
      record.beats = (window.__fx?.trace || []).slice(0, 100).map(([time, step, detail]) => ({ time, step: String(step).slice(0, 60),
        detail: typeof detail === 'string' ? detail.slice(0, 80) : detail && typeof detail === 'object' ? { impactMs: detail.impactMs, totalMs: detail.totalMs } : null }));
      record.dropped.beats = Math.max(0, (window.__fx?.trace?.length || 0) - 100);
      if (window.__fx) { if (record.previousTrace === undefined) delete window.__fx.trace; else window.__fx.trace = record.previousTrace; }
      delete record.previousTrace;
      record.resources = [];
      for (const e of performance.getEntriesByType('resource')) {
        if (e.startTime < record.start) continue;
        try {
          const url = new URL(e.name);
          if (url.origin !== location.origin || !/\.(webp|png|jpe?g|avif|svg|woff2?)$/i.test(url.pathname)) continue;
          append(record, 'resources', { pathname: url.pathname.slice(0, 200), start: e.startTime, duration: e.duration, transferSize: e.transferSize, decodedBodySize: e.decodedBodySize }, 100);
        } catch { /* Only sanitized local resource metadata is eligible. */ }
      }
      return record;
    },
  };
}

export function summarizeImpactObservation(card, sample, observation) {
  const round = value => Math.round(value * 1000) / 1000;
  const overlaps = (start, duration, low, high) => start < high && start + duration > low;
  const phase = (name, start, end) => ({ name, start: round(start), end: round(end), duration: round(end - start),
    availableCounts: { beats: observation.beats.filter(x => x.time >= start && x.time <= end).length,
      longtasks: observation.longtasks.filter(x => overlaps(x.start, x.duration, start, end)).length,
      timers: observation.timers.filter(x => overlaps(x.fired, Math.max(.001, x.ended - x.fired), start, end)).length,
      resources: observation.resources.filter(x => overlaps(x.start, x.duration, start, end)).length },
    beats: observation.beats.filter(x => x.time >= start && x.time <= end).slice(0, 15),
    longtasks: observation.longtasks.filter(x => overlaps(x.start, x.duration, start, end)).slice(0, 8),
    timers: observation.timers.filter(x => overlaps(x.fired, Math.max(.001, x.ended - x.fired), start, end))
      .map(x => ({ ...x, due: round(x.scheduled + x.delay), overdue: round(x.fired - x.scheduled - x.delay), callbackMs: round(x.ended - x.fired) }))
      .sort((a,b) => b.overdue - a.overdue).slice(0, 10),
    frameGaps: observation.frames.slice(1).map((end, i) => ({ start: observation.frames[i], duration: round(end - observation.frames[i]) }))
      .filter(x => overlaps(x.start, x.duration, start, end)).sort((a,b) => b.duration - a.duration).slice(0, 6),
    resources: observation.resources.filter(x => overlaps(x.start, x.duration, start, end)).slice(0, 6),
  });
  const result = { card, clock: 'page performance.now milliseconds', limits: 'Rows are capped; availableCounts precede row truncation. ResourceTiming may be limited by the browser buffer. Only completed numeric-delay timers >=20ms are recorded; no stacks or GC/decode attribution.', contact: sample.contact, number: sample.number, dropped: observation.dropped,
    phases: [phase('pointerup→contact', sample.up, sample.contactAt), phase('contact→number', sample.contactAt, sample.numberAt)] };
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output) > 12 * 1024) throw Error('Impact observation exceeds 12KiB bound');
  return output;
}
