import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('glyph-only detailed selection coalesces overhead placement; inspection and legacy still refit', () => {
  const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const start = source.indexOf('  let overheadRequest = 0;'), end = source.indexOf("  combatHost.addEventListener('combatantselectionchange'", start);
  let serial = 0, overhead = 0, refresh = 0, scheduled = 0;
  const frames = new Map(), field = { isConnected: true }, combatHost = { dataset: { targetHud: 'true' } };
  const scope = { field, combatHost, centerTargetOverheads() { overhead++; }, refresh() { refresh++; }, schedule() { scheduled++; },
    requestAnimationFrame(fn) { frames.set(++serial, fn); return serial; }, cancelAnimationFrame(id) { frames.delete(id); } };
  const select = runInNewContext(source.slice(start, end) + '\nselectionChanged', scope);
  const glyph = { detail: { geometry: 'overhead' } };
  select(glyph); select(glyph); assert.equal(frames.size, 1); assert.equal(refresh + scheduled, 0);
  [...frames.values()][0](); frames.clear(); assert.equal(overhead, 1);
  select({}); assert.equal(scheduled, 1, 'reading selection still recomputes target obstruction');
  combatHost.dataset.targetHud = 'false'; select(glyph);
  assert.equal(refresh, 1); assert.equal(scheduled, 2, 'legacy glyph keeps complete placement');
  combatHost.dataset.targetHud = 'true'; select(glyph); field.isConnected = false;
  [...frames.values()][0](); frames.clear(); assert.equal(overhead, 1, 'detached fields cannot settle');
  // Exercise the production release callback against a still-pending overhead frame.
  const releaseStart = source.indexOf('  const release = () => {', end);
  const releaseEnd = source.indexOf('\n  detachObserver.observe', releaseStart);
  const noop = () => {}, observer = { disconnect: noop };
  Object.assign(scope, { releaseBackdrop: noop, releaseLayeredEnvironment: noop, frameRequest: 0, trackingRequest: 0,
    resizeObserver: observer, layoutObserver: observer, poseObserver: observer, reducedMedia: null, reducedSettingObserver: observer,
    reconcileReducedMotion: noop, window: { removeEventListener: noop }, document: {}, fontsLoaded: noop,
    detachObserver: observer, releaseActiveStage: null });
  combatHost.removeEventListener = noop;
  const release = runInNewContext(source.slice(start, end) + source.slice(releaseStart, releaseEnd) + '\n({selectionChanged,release})', { ...scope });
  field.isConnected = true; release.selectionChanged(glyph); assert.equal(frames.size, 1);
  release.release(); assert.equal(frames.size, 0, 'release cancels the overhead RAF');
});
