import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { handLayout, responsiveHandLayout, handGeometryKey } from '../src/ui/models/HandLayout.js';
import { desktopHandLayout } from '../src/ui/models/DesktopCombatFooter.js';

const source = readFileSync(new URL('../src/ui/components/hand.js', import.meta.url), 'utf8');
const style = () => { const values = new Map(); return { setProperty: (k, v) => values.set(k, v), getPropertyValue: k => values.get(k) || '' }; };
function fixture() {
  let events = 0;
  const root = { dataset: { formFactor: 'mobile' } }, combat = { dataset: { compactCombat: 'true' } };
  const box = { left: 0, top: 500, width: 390, height: 250 }, metrics = { fontSize: '16px' };
  const handEl = { style: style(), dataset: {}, isConnected: true, clientWidth: 390, clientHeight: 250,
    closest: () => combat, getBoundingClientRect: () => ({ ...box }), dispatchEvent: e => { assert.equal(e.type, 'handlayoutchange'); events++; } };
  const card = id => ({ dataset: { instanceId: id }, parentNode: handEl, style: style(), controls: null, lane: null,
    querySelector(selector) { return selector === '.card-upcast-controls' ? this.controls : this.lane; }, appendChild(node) { this.lane = node; } });
  const scope = { handEl, handEls: [card('a'), card('b')], fitFan: true, handLayout, responsiveHandLayout, handGeometryKey, desktopHandLayout,
    layoutMetrics: () => metrics, upcastMeasurements: new WeakMap(), measureHandUpcastHeight: controls => controls.height,
    document: { documentElement: root, createElement: () => ({ setAttribute() {} }) }, Event: class { constructor(type) { this.type = type; } } };
  const start = source.indexOf('  let publishedGeometry ='), end = source.indexOf('\n  // Re-derive when the measured facts move:', start);
  const apply = runInNewContext(source.slice(start, end) + '\napplyHandLayout', scope);
  return { apply, scope, card, root, combat, box, metrics, events: () => events };
}

test('fitted fan publishes once; selection and replacement previews retain geometry without another battlefield fit', () => {
  const f = fixture(); f.apply(); assert.equal(f.events(), 1);
  f.apply(); assert.equal(f.events(), 1, 'same observer delivery is a no-op');
  f.scope.handEls[0].selected = true; f.apply(); assert.equal(f.events(), 1, 'selection alone is not fan geometry');
  f.scope.handEls[0] = f.card('a'); f.apply();
  assert.ok(f.scope.handEls[0].lane, 'a replacement still receives its hit lane');
  assert.ok(f.scope.handEls[0].style.getPropertyValue('--hand-card-width'), 'replacement still gets the authored plan');
  assert.equal(f.events(), 1, 'changed preview/node identity does not refit an unchanged fan');
});

test('fan changes publish once for physical basis, controls, count/order and empty/refill', () => {
  const f = fixture(); f.apply();
  const change = fn => { const before = f.events(); fn(); f.apply(); assert.equal(f.events(), before + 1); f.apply(); assert.equal(f.events(), before + 1); };
  change(() => { f.box.width = f.scope.handEl.clientWidth = 375; });
  change(() => { f.box.height = f.scope.handEl.clientHeight = 230; });
  change(() => { f.box.top += 10; });
  change(() => { f.box.left += 5; });
  change(() => { f.box.width *= 1.2; }); // physical zoom changes without a local-box resize
  change(() => { f.metrics.fontSize = '20px'; });
  change(() => { f.root.dataset.formFactor = 'tablet'; });
  change(() => { f.scope.handEls[0].controls = { height: 24 }; });
  change(() => { f.scope.handEls[0].controls.height = 36; });
  change(() => { f.scope.handEls.push(f.card('c')); });
  change(() => { f.scope.handEls.reverse(); });
  change(() => { f.scope.handEls = []; });
  change(() => { f.scope.handEls = [f.card('d')]; });
  f.scope.handEl.isConnected = false; const before = f.events(); f.box.top++; f.apply(); assert.equal(f.events(), before, 'detached hands do not publish');
});

test('resize subscriptions retain stable nodes and reconcile only additions/removals', () => {
  const a = {}, b = {}, replacement = {}, calls = [];
  const scope = { ro: { observe: n => calls.push(['observe', n]), unobserve: n => calls.push(['unobserve', n]) }, handEls: [a, b] };
  const start = source.indexOf('  const observedCards ='), end = source.indexOf('\n  let layoutFrame', start);
  const sync = runInNewContext(source.slice(start, end) + '\nobserveCards', scope);
  sync(); assert.deepEqual(calls, [['observe', a], ['observe', b]]);
  calls.length = 0; sync(); assert.deepEqual(calls, [], 'unchanged renders do not cause fresh initial ResizeObserver deliveries');
  scope.handEls = [b, a]; sync(); assert.deepEqual(calls, [], 'reorder retains subscriptions');
  scope.handEls = [replacement, b]; sync(); assert.deepEqual(calls, [['unobserve', a], ['observe', replacement]]);
  calls.length = 0; scope.handEls = []; sync(); assert.deepEqual(calls, [['unobserve', b], ['unobserve', replacement]]);
});
