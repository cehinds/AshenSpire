import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Execute the shipped gesture handlers and teardown with a deterministic clock.
// No substitute activation handler or reimplementation decides suppression.
const source = readFileSync(new URL('../src/ui/components/combatTargetHud.js', import.meta.url), 'utf8');
const begin = source.indexOf('  let holdTimer ='), end = source.indexOf('  const dwell =', begin);
const releaseBegin = source.indexOf('    release() {'), releaseEnd = source.indexOf('\n  };', releaseBegin);
assert.ok(begin >= 0 && end > begin && releaseBegin >= 0 && releaseEnd > releaseBegin);
function target() {
  const handlers = new Map();
  return {
    isConnected: true,
    addEventListener(type, fn, options = {}) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push({ fn, capture: options === true || !!options.capture });
      options.signal?.addEventListener('abort', () => this.removeEventListener(type, fn), { once: true });
    },
    removeEventListener(type, fn) { handlers.set(type, (handlers.get(type) || []).filter(handler => handler.fn !== fn)); },
    fire(type, event, captureOnly = false) { for (const handler of [...(handlers.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture))) { if (captureOnly && !handler.capture) continue; handler.fn(event); if (event.immediate) break; } },
  };
}
function fixture({ armed = true } = {}) {
  const document = target(), window = target(), shell = target(), timers = new Map(), plays = [], reads = [];
  let time = 0, serial = 0, ready = true;
  const name = {
    closest(selector) { return selector.includes('.target-hud-name') ? this : null; },
    matches() { return false; },
    click() { click(null, 0); },
  };
  const scope = {
    document, window, entries: new Map([['e1', { inspect: () => reads.push(time) }]]), eligible: armed ? ['e1'] : [],
    canInspect: () => ready, onActivate: id => plays.push(id), hideTooltip() {}, performance: { now: () => time },
    setTimeout(fn) { const id = ++serial; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    gestures: new AbortController(), disposed: false, dwell: { dispose() {} }, raf: null, cancelAnimationFrame() {},
    layer: { querySelectorAll: () => [], remove() {} }, cells: { remove() {} },
    combat: { dataset: {}, removeEventListener() {} }, field: { removeEventListener() {} },
    pointer() {}, focus() {}, focusOut() {}, scheduleGeometry() {}, resized() {}, observer: { disconnect() {} }, resize: { disconnect() {} }, clearPanels() {},
  };
  const api = runInNewContext(`${source.slice(begin, end)}\n({ wireInspect, ${source.slice(releaseBegin, releaseEnd)} hasSuppressed: () => !!inspectionPointer });`, scope);
  api.wireInspect(shell, 'e1');
  const event = (id, extras = {}) => ({ pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, clientX: 10, clientY: 10, target: name, detail: 1,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.immediate = true; }, stopPropagation() {}, ...extras });
  function click(id, detail = 1) { const ev = event(id, { detail }); shell.fire('click', ev); return ev; }
  return { plays, reads, timers, api,
    resourceDown(id = 1) { shell.fire('pointerdown', event(id), true); },
    capturedUp(id = 1) { document.fire('pointerup', event(id), true); },
    down(id = 1) { shell.fire('pointerdown', event(id)); }, up(id = 1) { document.fire('pointerup', event(id)); }, click,
    dblclick(id = null) { const ev = event(id, { detail: 2 }); shell.fire('dblclick', ev); return ev; },
    hold() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    ready(value) { ready = value; }, disarm() { scope.eligible = []; },
    advance(ms) { time += ms; }, arm() { scope.eligible = ['e1']; },
    cancel(id = 1) { document.fire('pointercancel', event(id)); }, blur() { window.fire('blur', {}); },
    move(id = 1) { document.fire('pointermove', event(id, { clientX: 40 })); },
    keyboard() { shell.fire('keydown', event(null, { key: 'Enter', detail: 0 })); },
  };
}

test('a held inspection blocks its originating release click even after 700ms', () => {
  const f = fixture(); f.down(); f.advance(500); f.hold(); f.advance(2000); f.up();
  assert.equal(f.reads.length, 1); assert.equal(f.click(1).prevented, true); assert.deepEqual(f.plays, []);
});

test('a new press after release can target immediately after inspection closes', () => {
  const f = fixture(); f.down(); f.advance(500); f.hold(); f.up();
  assert.equal(f.click(1).prevented, true); assert.deepEqual(f.plays, []);
  f.advance(10); f.down(1); f.up(1); f.click(1);
  assert.deepEqual(f.plays, ['e1'], 'mouse/pen pointer ID reuse is a new gesture, not a 700ms dead zone');
});

test('legacy click events without a pointer ID retain release protection but allow a new press', () => {
  const f = fixture(); f.down(); f.hold(); f.up();
  assert.equal(f.click(null).prevented, true); assert.deepEqual(f.plays, []);
  f.down(2); f.up(2); f.click(null); assert.deepEqual(f.plays, ['e1']);
});

test('the same double-tap cannot open inspection again through a trailing dblclick', () => {
  const f = fixture({ armed: false }); f.down(1); f.up(1); f.click(1);
  f.advance(100); f.down(2); f.up(2); f.click(2); f.dblclick();
  assert.equal(f.reads.length, 1);
  f.arm(); f.down(3); f.up(3); f.click(3); assert.deepEqual(f.plays, ['e1']);
});

test('keyboard detail-zero activation is never swallowed by pointer suppression', () => {
  const f = fixture(); f.down(); f.hold(); f.up(); f.keyboard();
  assert.deepEqual(f.plays, ['e1']);
});

test('movement cancels a pending hold; cancel, blur and teardown clear gesture state', () => {
  const moved = fixture(); moved.down(); moved.move(); moved.hold(); assert.deepEqual(moved.reads, []);
  moved.cancel(); assert.equal(moved.api.hasSuppressed(), false); assert.deepEqual(moved.plays, []);
  for (const finish of ['cancel', 'blur']) {
    const f = fixture(); f.down(); f.hold(); f[finish](); assert.equal(f.api.hasSuppressed(), false); assert.deepEqual(f.plays, []);
  }
  const disposed = fixture(); disposed.down(); disposed.hold(); disposed.api.release();
  assert.equal(disposed.api.hasSuppressed(), false); assert.equal(disposed.timers.size, 0);
  disposed.up(); assert.deepEqual(disposed.plays, []);
});

test('resource descendants that stop pointer bubbling still reset released inspection ownership', () => {
  const f = fixture(); f.down(); f.hold(); f.capturedUp();
  assert.equal(f.click(null).prevented, true);
  f.resourceDown(); f.capturedUp(); f.click(null);
  assert.deepEqual(f.plays, ['e1']);
  assert.equal(f.reads.length, 1);
});


test('a target press begun during playback cannot inspect or activate after unlock', () => {
  const f = fixture(); f.down(); f.up(); f.click(1); f.disarm();
  f.ready(false); f.resourceDown(2); f.advance(900); f.ready(true); f.capturedUp(2); f.click(null); f.dblclick();
  assert.equal(f.reads.length, 0); assert.deepEqual(f.plays, ['e1']);
  f.arm(); f.down(3); f.up(3); f.click(3); assert.deepEqual(f.plays, ['e1', 'e1']);
});

test('busy-start hold and double-tap stay rejected while a fresh ready inspection works', () => {
  const f = fixture({ armed: false }); f.down(); f.up(); f.click(1);
  f.ready(false); f.down(2); f.advance(900); f.ready(true); f.hold(); f.up(2); f.click(2); f.dblclick();
  assert.equal(f.reads.length, 0);
  f.down(3); f.hold(); assert.equal(f.reads.length, 1);
});

test('an accepted activation owns its trailing dblclick without a timeout', () => {
  const f = fixture(); f.down(); f.up(); f.click(1); f.advance(1500); f.disarm(); f.dblclick();
  assert.equal(f.reads.length, 0);
  f.arm(); f.keyboard(); assert.deepEqual(f.plays, ['e1', 'e1']);
});


test('a full native double-click series stays owned by its first accepted activation', () => {
  const f = fixture(); f.down(1); f.up(1); f.click(1, 1); f.disarm();
  f.advance(100); f.down(2); f.up(2); f.click(2, 2); f.dblclick();
  assert.equal(f.reads.length, 0); assert.deepEqual(f.plays, ['e1']);
  f.advance(400); f.down(3); f.up(3); f.click(3, 1);
  f.advance(100); f.down(4); f.up(4); f.click(4, 2); f.dblclick();
  assert.equal(f.reads.length, 1, 'a fresh unarmed reading series remains available');
});


test('an independently eligible target keeps precedence within an accepted click series', () => {
  const f = fixture(); f.down(1); f.up(1); f.click(1, 1);
  f.down(2); f.up(2); f.click(2, 2); f.dblclick();
  assert.deepEqual(f.plays, ['e1', 'e1']); assert.equal(f.reads.length, 0);
});
