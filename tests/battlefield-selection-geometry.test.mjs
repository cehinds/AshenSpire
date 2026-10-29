import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('rebuilding detailed HUD racks preserves reserved artwork headroom', () => {
  const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const start = source.indexOf('      const racked = ');
  const end = source.indexOf('\n      return { slot,', start);
  assert.ok(start >= 0 && end > start, 'the actor headroom calculation exists');
  let rackMounted = true;
  const scope = { hudWide: true, targetHud: true,
    frame: { classList: { contains: () => false }, querySelector: () => rackMounted ? {} : null },
    miniHudGroupHeight: () => 70,
    hudGrid: { miniHudSpriteGapPx: 8, desktopMiniHudBandOverlapPx: 7 } };
  const reserve = () => runInNewContext(source.slice(start, end) + '\nracked', { ...scope });
  assert.equal(reserve(), 77);
  rackMounted = false;
  assert.equal(reserve(), 77, 'a rack removed during frame rendering retains its artwork envelope');
  rackMounted = true;
  assert.equal(reserve(), 77, 'reattaching controls cannot invalidate the settled fit');
  scope.targetHud = false;
  assert.equal(reserve(), 0, 'leaving detailed HUD mode releases its reserved headroom');
  scope.targetHud = true; scope.hudWide = false;
  assert.equal(reserve(), 0, 'phone fitting keeps its existing envelope');
  scope.hudWide = true; scope.frame.classList.contains = () => true;
  assert.equal(reserve(), 0, 'the player keeps its separate artwork envelope');
});

test('a detailed HUD rack rebuild cannot temporarily position a legacy leading host', () => {
  const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function centerTargetOverheads() {');
  const end = source.indexOf('\n  function placePlayerHud(', start);
  assert.ok(start >= 0 && end > start, 'the overhead placement pass exists');
  const style = { left: '0px', top: 'var(--combat-elev, 0px)', translate: 'none' };
  const leading = { style, getBoundingClientRect: () => ({}) };
  const sprite = {};
  const combat = { dataset: { targetHud: 'true' }, querySelector: () => null };
  const frame = { dataset: {}, querySelector: selector => selector === '.sprite' ? sprite : selector === '.combatant-leading' ? leading : null };
  const field = { querySelectorAll: () => [frame], closest: () => combat };
  const place = runInNewContext(source.slice(start, end) + '\ncenterTargetOverheads', {
    field, invalidateSpriteRects() {}, uiZoom: () => 1, readHitBadges: () => null,
    uiConfig: { presentation: { combatFormationModel: { positioning: { perspectiveGrid: {} } } } },
    separateRackedIntents() {}, currentSpriteArtBounds: () => ({}), schedule() {},
    targetOverheadPlacement: () => ({ dx: 25, dy: -60 }),
  });
  place(); place();
  assert.equal(style.translate, 'none', 'missing rebuilt racks do not run legacy placement');
  combat.dataset.targetHud = 'false';
  place();
  assert.equal(style.translate, '25px -60px', 'the legacy placement remains available outside detailed HUD mode');
});

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
