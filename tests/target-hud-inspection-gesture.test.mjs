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
  function click(id, detail = 1, at = name) { const ev = event(id, { detail, target: at }); shell.fire('click', ev); return ev; }
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
  f.advance(100); f.down(2); f.up(2); f.click(2, 2); f.dblclick();
  assert.equal(f.reads.length, 1, 'the first tap inspected; the second press of the series and its dblclick are swallowed');
  f.arm(); f.down(3); f.up(3); f.click(3); assert.deepEqual(f.plays, ['e1']);
});

test('a single tap anywhere on a non-target panel inspects once; an armed target tap still confirms', () => {
  const f = fixture({ armed: false }); f.down(); f.up(); f.click(1);
  assert.equal(f.reads.length, 1); assert.deepEqual(f.plays, []);
  f.advance(1000); f.down(2); f.up(2); const ev = f.click(2); assert.equal(f.reads.length, 2); assert.equal(ev.immediate, true);
  f.arm(); f.down(3); f.up(3); f.click(3); assert.equal(f.reads.length, 2); assert.deepEqual(f.plays, ['e1']);
});

test('an assistive-technology click (detail 0) on the unarmed panel button inspects once', () => {
  const f = fixture({ armed: false });
  const panel = { classList: { contains: c => c === 'target-hud-panel' }, closest: () => null, matches: () => true };
  const ev = f.click(null, 0, panel);
  assert.equal(f.reads.length, 1); assert.equal(ev.immediate, true);
  f.click(null, 0); assert.equal(f.reads.length, 1, 'a detail-0 click on a child is not the button activation');
  f.ready(false); f.click(null, 0, panel); assert.equal(f.reads.length, 1);
  f.ready(true); f.arm(); f.click(null, 0, panel); assert.equal(f.reads.length, 1, 'armed, the panel still confirms rather than inspects');
});

test('a press that drags past the slop is not a tap', () => {
  const f = fixture({ armed: false }); f.down(); f.move(); f.up(); f.click(1);
  assert.deepEqual(f.reads, []);
});

test('a tap is not an inspection while the inspector cannot open', () => {
  const f = fixture({ armed: false }); f.ready(false); f.down(); f.up(); f.click(1);
  assert.deepEqual(f.reads, []);
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
  const f = fixture({ armed: false });
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

test('Enter on a focused target HUD panel is left to the panel; the cursor card is not pressed', async () => {
  const { initInput, focusElement, clearFocus } = await import('../src/ui/input.js');
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  withKitDom(({ document, Event }, _window, listeners) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const previousStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [] } });
    globalThis.getComputedStyle = () => ({ visibility: 'visible', display: 'block' });
    try {
      const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
      const cursorCard = document.createElement('button'); cursorCard.className = 'card'; app.append(cursorCard);
      let cardClicks = 0; cursorCard.addEventListener('click', () => { cardClicks += 1; });
      focusElement(cursorCard);
      initInput();
      const panel = document.createElement('div'); panel.className = 'target-hud-panel';
      panel.setAttribute('role', 'button'); panel.tabIndex = 0;
      const name = document.createElement('span'); name.className = 'target-hud-name'; panel.append(name);
      app.append(panel); panel.focus();
      for (const target of [panel, name]) {
        const enter = new Event('keydown', { key: 'Enter', target, bubbles: true });
        for (const handler of listeners.get('keydown').slice(0, 2)) handler(enter);
        assert.equal(enter.defaultPrevented, false, 'global confirm leaves Enter to the panel');
      }
      for (const handler of listeners.get('keyup') || []) handler(new Event('keyup', { key: 'Enter', target: panel, bubbles: true }));
      assert.equal(cardClicks, 0, 'the cursor card is never pressed by Enter on the panel');
      const arrow = new Event('keydown', { key: 'ArrowRight', target: panel, bubbles: true, cancelable: true });
      for (const handler of listeners.get('keydown').slice(0, 2)) handler(arrow);
      assert.equal(arrow.defaultPrevented, true, 'arrows on the focused panel still drive the game cursor');
      clearFocus();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator;
      if (previousStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = previousStyle;
    }
  });
});

test('an inspection-door panel holds no focusable intent row and keeps its content as its name', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  withKitDom(({ document }) => {
    const shell = document.createElement('section'); shell.className = 'target-hud-detail';
    shell.setAttribute('aria-label', 'Hound details');
    const panel = document.createElement('div'); panel.className = 'target-hud-panel';
    const name = document.createElement('div'); name.className = 'target-hud-name';
    const intent = document.createElement('div'); intent.className = 'target-hud-intent'; intent.tabIndex = 0;
    panel.append(name, intent); shell.append(panel); document.body.append(shell);
    const scope = { document: target(), window: target(), gestures: new AbortController(), eligible: [], onActivate: () => {}, canInspect: () => true, entries: new Map(), hideTooltip() {}, setTimeout, clearTimeout, performance };
    const { syncActivation } = runInNewContext(`${source.slice(begin, end)}\n({ syncActivation });`, scope);
    syncActivation(shell, 'e1');
    assert.equal(panel.getAttribute('role'), 'button');
    assert.equal(panel.getAttribute('tabindex'), '0');
    assert.equal(intent.hasAttribute('tabindex'), false, 'no interactive descendant inside a role=button panel');
    assert.equal(panel.hasAttribute('aria-label'), false, 'the name, HP and intent text name the button');
    scope.eligible = ['e1']; syncActivation(shell, 'e1');
    assert.equal(panel.hasAttribute('role'), false); assert.equal(panel.hasAttribute('tabindex'), false);
    assert.equal(intent.getAttribute('tabindex'), '0', 'an armed panel keeps the intent row reachable for its tooltip');
    assert.equal(name.getAttribute('role'), 'button');
  });
});
