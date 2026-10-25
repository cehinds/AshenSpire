import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { rewardDom } from './helpers/reward-dom.mjs';

// Execute the production gesture handlers with a controlled clock. This fixture
// makes no native hit-testing/capture claims; the paired browser test does that.
function fixture() {
  const source = readFileSync(new URL('../src/ui/components/combatTargetHud.js', import.meta.url), 'utf8');
  const start = source.indexOf('  let holdTimer ='), end = source.indexOf('  const dwell =', start);
  assert.ok(start >= 0 && end > start);
  const dom = rewardDom(), timers = new Map(), plays = [], inspections = [];
  const document = Object.assign(dom.document, { addEventListener: (...args) => dom.document.body.addEventListener(...args) });
  let now = 0, serial = 0;
  const scope = { document, window: dom.window, Event: dom.Event, gestures: { signal: undefined },
    performance: { now: () => now }, hideTooltip() {}, canInspect: () => true, onActivate: id => plays.push(id), eligible: ['e1', 'e2'],
    entries: new Map(['e1', 'e2'].map(id => [id, { inspect: () => inspections.push(id) }])),
    setTimeout: (fn, ms) => { timers.set(++serial, { fn, at: now + ms }); return serial; },
    clearTimeout: id => timers.delete(id),
  };
  const wire = runInNewContext(source.slice(start, end) + '\nwireInspect', scope);
  const targets = new Map(['e1', 'e2'].map(id => {
    const shell = document.createElement('div'), name = document.createElement('div'), hp = document.createElement('div');
    name.className = 'target-hud-name'; hp.className = 'target-hud-meters';
    // DOM click() is a non-pointer activation (detail 0), unlike touch clicks.
    name.click = () => name.dispatchEvent(new dom.Event('click', { bubbles: true, cancelable: true, detail: 0 }));
    const status = document.createElement('span'), intent = document.createElement('span');
    status.className = 'target-hud-statuses'; intent.className = 'target-hud-intent';
    status.setAttribute('data-tip-attached', ''); intent.setAttribute('data-tip-attached', '');
    shell.append(name, hp, status, intent); document.body.append(shell); wire(shell, id);
    return [id, { shell, name, hp, status, intent }];
  }));
  function emit(id, type, fields = {}, part = 'name') {
    const event = new dom.Event(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
      isPrimary: true, button: 0, clientX: 20, clientY: 30, detail: type === 'dblclick' ? 2 : type === 'click' ? 1 : 0, ...fields });
    targets.get(id)[part].dispatchEvent(event); return event;
  }
  function advance(ms) {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  }
  function hold(id = 'e1') { emit(id, 'pointerdown'); advance(500); emit(id, 'pointerup'); }
  function tap(id = 'e1', part = 'name') { emit(id, 'pointerdown', {}, part); emit(id, 'pointerup', {}, part); emit(id, 'click', {}, part); }
  return { emit, advance, hold, tap, plays, inspections, targets, scope };
}

for (const target of ['e1', 'e2']) test(`a fresh ${target} press works immediately after the previous inspection releases`, () => {
  const f = fixture(); f.hold();
  assert.deepEqual(f.inspections, ['e1']);
  assert.equal(f.emit('e1', 'click').defaultPrevented, true, 'the inspection release click is consumed');
  assert.deepEqual(f.plays, []);
  f.advance(10); f.tap(target);
  assert.deepEqual(f.plays, [target], 'one independent gesture confirms exactly once');
});

for (const press of [{ isPrimary: false }, { button: 2 }]) test(`an invalid new press cannot clear hold suppression: ${JSON.stringify(press)}`, () => {
  const f = fixture(); f.hold(); f.emit('e2', 'pointerdown', press); f.emit('e1', 'click');
  assert.deepEqual(f.plays, []);
  f.tap('e2'); assert.deepEqual(f.plays, ['e2']);
});

for (const key of ['Enter', ' ']) test(`${JSON.stringify(key)} activates immediately after held inspection`, () => {
  const f = fixture(); f.hold(); f.advance(10);
  f.emit('e2', 'keydown', { key });
  assert.deepEqual(f.plays, ['e2']);
});

test('unrelated keys, ineligible names and reading surfaces do not clear a held click guard', () => {
  for (const [id, key, part] of [['e1', 'Escape', 'name'], ['e2', 'Enter', 'name'], ['e1', 'Enter', 'status']]) {
    const f = fixture(); f.scope.eligible = ['e1']; f.hold();
    f.emit(id, 'keydown', { key }, part); f.emit('e1', 'click');
    assert.deepEqual(f.plays, []);
  }
});

test('double-touch inspection still consumes its release click, then permits a fresh target press', () => {
  const f = fixture(); f.scope.eligible = [];
  f.tap(); f.advance(100); f.emit('e1', 'pointerdown'); f.emit('e1', 'pointerup');
  assert.deepEqual(f.inspections, ['e1'], 'the first tap inspects; the second press of the series adds nothing');
  f.scope.eligible = ['e1', 'e2'];
  f.emit('e1', 'click', { detail: 2 }); assert.deepEqual(f.plays, [], 'a changing target plan cannot turn the inspection release into a play');
  f.tap('e2'); assert.deepEqual(f.plays, ['e2']);
});

test('status/intent reading remains separate from name and HP activation', () => {
  const f = fixture(); let readings = 0;
  for (const part of ['status', 'intent']) f.targets.get('e2')[part].addEventListener('gpfocus', () => readings++);
  f.hold(); f.tap('e2', 'status'); f.tap('e2', 'intent');
  assert.equal(readings, 2); assert.deepEqual(f.plays, []);
  f.tap('e2', 'hp'); assert.deepEqual(f.plays, ['e2']);
  f.emit('e2', 'dblclick'); assert.deepEqual(f.inspections, ['e1'], 'target confirmation does not become double-click inspection');
});

test('movement and cancellation still abandon inspection timers', () => {
  for (const end of ['pointermove', 'pointercancel']) {
    const f = fixture(); f.emit('e1', 'pointerdown'); f.emit('e1', end, { clientX: 40 }); f.advance(600);
    assert.deepEqual(f.inspections, []); f.tap('e2'); assert.deepEqual(f.plays, ['e2']);
  }
});


test('inspection owns its pointer release even after a very long hold', () => {
  const f = fixture(); f.emit('e1', 'pointerdown'); f.advance(500); f.advance(5000);
  f.emit('e1', 'pointerup'); f.emit('e1', 'click');
  assert.deepEqual(f.plays, []); assert.deepEqual(f.inspections, ['e1']);
  f.tap('e2'); assert.deepEqual(f.plays, ['e2']);
});

test('a press begun while reading is gated cannot activate when the gate opens before release', () => {
  const f = fixture(); f.scope.canInspect = () => false;
  f.emit('e1', 'pointerdown'); f.scope.canInspect = () => true;
  f.advance(500); f.emit('e1', 'pointerup'); f.emit('e1', 'click');
  assert.deepEqual(f.inspections, []); assert.deepEqual(f.plays, []);
  f.tap('e2'); assert.deepEqual(f.plays, ['e2']);
});
