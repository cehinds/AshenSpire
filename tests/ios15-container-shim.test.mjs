// src/ui/containerShim.js: the runtime half of the container query fallback. docs/qa/IOS15-COMPAT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContainerOf, EvaluateCondition, StartContainerShim, TokensFor } from '../src/ui/containerShim.js';
import { Cq, CqStyle, ForceCqFallback } from '../src/ui/cqCompat.js';
import { ColorMix, ForceColorMixFallback } from '../src/ui/colorMixCompat.js';
import { CollectVars, CreateContext, DownlevelCss, FLAGS, ParseCondition } from '../src/ui/legacyCss.js';

const m = (over = {}) => ({ type: 'size', width: 400, height: 800, rem: 10, em: 14, vw: 400, vh: 800, ...over });
const cond = (text) => ParseCondition(text);

test('width and height features compare in px, rem, em and viewport units', () => {
  assert.equal(EvaluateCondition(cond('(max-width: 600px)'), m()), true);
  assert.equal(EvaluateCondition(cond('(min-width: 401px)'), m()), false);
  assert.equal(EvaluateCondition(cond('(min-width: 400px)'), m()), true, 'min is inclusive');
  assert.equal(EvaluateCondition(cond('(width > 400px)'), m()), false, 'range > is exclusive');
  assert.equal(EvaluateCondition(cond('(max-width: 40rem)'), m()), true, '40rem = 400px at a 10px root');
  assert.equal(EvaluateCondition(cond('(max-width: 39rem)'), m()), false);
  assert.equal(EvaluateCondition(cond('(max-width: 4em)'), m({ width: 56 })), true, '4em = 56px at a 14px font');
  assert.equal(EvaluateCondition(cond('(max-height: 500px)'), m()), false);
  assert.equal(EvaluateCondition(cond('(max-width: 100vw)'), m()), true);
  assert.equal(EvaluateCondition(cond('(max-width: 600px) and (orientation: portrait)'), m()), true);
  assert.equal(EvaluateCondition(cond('(max-width: 600px) and (orientation: landscape)'), m()), false);
  assert.equal(EvaluateCondition(cond('(max-width: 100px) or (max-height: 900px)'), m()), true);
  assert.equal(EvaluateCondition(cond('not (max-width: 100px)'), m()), true);
  assert.equal(EvaluateCondition(cond('(400px <= width <= 700px)'), m()), true);
});

test('an inline-size container cannot answer a height or orientation query', () => {
  const inline = m({ type: 'inline-size' });
  assert.equal(EvaluateCondition(cond('(max-height: 5000px)'), inline), false);
  assert.equal(EvaluateCondition(cond('(orientation: portrait)'), inline), false);
  assert.equal(EvaluateCondition(cond('(max-width: 5000px)'), inline), true);
});

test('tokens: named queries reach only containers of that name; exclude queries record their failures', () => {
  const queries = [
    { name: 'game-viewport', condition: cond('(max-width: 600px)'), exclude: false },
    { name: 'map-tray', condition: cond('(max-width: 600px)'), exclude: false },
    { name: null, condition: cond('(min-width: 651px)'), exclude: true },
    { name: null, condition: cond('(max-width: 650px)'), exclude: false },
  ];
  assert.deepEqual(TokensFor(queries, ['game-viewport'], m()), { cq: [0, 3], no: [2] });
  assert.deepEqual(TokensFor(queries, [], m({ width: 700 })), { cq: [2], no: [] });
  assert.deepEqual(TokensFor(queries, ['map-tray'], m()), { cq: [1, 3], no: [2] });
});

test('ContainerOf applies the recorded rules in order, then the element', () => {
  const el = (selectors, attrs = {}) => ({ matches: (s) => selectors.includes(s), getAttribute: (k) => attrs[k] ?? null });
  const rules = [
    { selector: 'html', names: ['game-viewport'], type: 'size' },
    { selector: '.btn', type: 'inline-size' },
    { selector: '.btn.reset', type: 'normal' },
  ];
  assert.deepEqual(ContainerOf(el(['html']), rules), { type: 'size', names: ['game-viewport'] });
  assert.deepEqual(ContainerOf(el(['.btn']), rules), { type: 'inline-size', names: [] });
  assert.equal(ContainerOf(el(['.btn', '.btn.reset']), rules), null, 'a later container-type: normal cancels it');
  assert.equal(ContainerOf(el(['.other']), rules), null);
  assert.deepEqual(ContainerOf(el([], { style: 'position:absolute;container-type:size' }), rules), { type: 'size', names: [] }, 'inline style');
  assert.deepEqual(ContainerOf(el([], { 'data-container': 'size' }), rules), { type: 'size', names: [] }, 'the marker a script sets');
  assert.deepEqual(ContainerOf(el([], { style: 'container: foo / inline-size' }), rules), { type: 'inline-size', names: ['foo'] });
});

// A DOM small enough to run the observer wiring: one tree, sizes by element, ResizeObserver driven by hand.
function makeWorld() {
  class El {
    constructor(name, parent = null) { this.name = name; this.parentElement = parent; this.attrs = new Map(); this.kids = []; this.nodeType = 1; this.isConnected = true; this.styleProps = new Map();
      this.style = { setProperty: (k, v) => this.styleProps.set(k, v) }; parent?.kids.push(this); this.box = { width: 100, height: 100 }; }
    matches(sel) { return sel.split(',').map((s) => s.trim()).includes(this.name) || (sel.includes('[data-container]') && this.attrs.has('data-container')); }
    querySelectorAll(sel) { const out = []; const walk = (n) => n.kids.forEach((k) => { if (k.matches(sel)) out.push(k); walk(k); }); walk(this); return out; }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    setAttribute(k, v) { this.attrs.set(k, String(v)); }
    removeAttribute(k) { this.attrs.delete(k); }
    hasAttribute(k) { return this.attrs.has(k); }
  }
  const html = new El('html');
  const observed = new Set();
  const callbacks = {};
  const win = {
    document: { documentElement: html },
    innerWidth: 400, innerHeight: 800,
    ResizeObserver: class { constructor(cb) { callbacks.resize = cb; } observe(e) { observed.add(e); } unobserve(e) { observed.delete(e); } disconnect() { observed.clear(); } },
    MutationObserver: class { constructor(cb) { callbacks.mutate ??= cb; } observe() {} disconnect() {} },
    getComputedStyle: (e) => ({ width: `${e.box.width}px`, height: `${e.box.height}px`, boxSizing: 'content-box', fontSize: '10px', paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0', borderLeftWidth: '0', borderRightWidth: '0', borderTopWidth: '0', borderBottomWidth: '0' }),
    requestAnimationFrame: (f) => { f(); return 1; },
    addEventListener() {}, removeEventListener() {},
  };
  return { El, html, win, observed, callbacks };
}

test('the shim writes data-cq, data-cq-no and --cqw/--cqh, only when they change', () => {
  const { El, html, win, observed, callbacks } = makeWorld();
  const viewport = html; viewport.box = { width: 400, height: 800 };
  const panel = new El('.panel', html); panel.box = { width: 700, height: 300 };
  const queries = [
    { name: 'game-viewport', condition: cond('(max-width: 600px)'), exclude: false },
    { name: null, condition: cond('(min-width: 651px)'), exclude: true },
  ];
  const containers = [{ selector: 'html', names: ['game-viewport'], type: 'size' }, { selector: '.panel', type: 'inline-size' }];
  const shim = StartContainerShim({ win, queries, containers });
  assert.deepEqual([...observed].map((e) => e.name).sort(), ['.panel', 'html']);
  callbacks.resize([{ target: panel }, { target: html }]);
  assert.equal(html.getAttribute('data-cq'), '0');
  assert.equal(html.getAttribute('data-cq-no'), '1', 'the viewport fails the min-width query, so its descendants are excluded');
  assert.equal(html.styleProps.get('--cqw'), '4px');
  assert.equal(html.styleProps.get('--cqh'), '8px');
  assert.equal(panel.getAttribute('data-cq'), '1');
  assert.equal(panel.getAttribute('data-cq-no'), null);
  assert.equal(panel.styleProps.get('--cqw'), '7px');
  assert.equal(panel.styleProps.has('--cqh'), false, 'an inline-size container has no --cqh');
  // Resize the panel: tokens follow; an unchanged container is not rewritten.
  panel.box = { width: 500, height: 300 }; html.styleProps.clear();
  callbacks.resize([{ target: panel }, { target: html }]);
  assert.equal(panel.getAttribute('data-cq'), null);
  assert.equal(panel.getAttribute('data-cq-no'), '1');
  assert.equal(html.styleProps.size, 0, 'nothing written for an unchanged container');
  // A node added later is picked up; one removed is forgotten.
  const added = new El('.panel', html); added.box = { width: 800, height: 100 };
  callbacks.mutate([{ addedNodes: [added], removedNodes: [] }]);
  assert.equal(observed.has(added), true);
  added.isConnected = false;
  callbacks.mutate([{ addedNodes: [], removedNodes: [added] }]);
  assert.equal(observed.has(added), false);
  shim.stop();
});

test('inline style text with cq units is repaired when the node arrives', () => {
  const { El, html, win, callbacks } = makeWorld();
  StartContainerShim({ win, queries: [], containers: [{ selector: 'html', type: 'size' }] });
  const el = new El('.x', html);
  el.attrs.set('style', 'position:absolute;width:min(100cqw,80cqh);container-type:size');
  el.matches = (sel) => sel.includes('[style*="cq"]') || sel.includes('container');
  el.querySelectorAll = () => [];
  callbacks.mutate([{ addedNodes: [el], removedNodes: [] }]);
  assert.equal(el.getAttribute('style'), 'position:absolute;width:min(calc(100 * var(--cqw, 1%)),calc(80 * var(--cqh, 1%)));container-type:size');
  assert.equal(el.getAttribute('data-container'), 'size', 'the container-type survives a later style rewrite as a marker');
});

test('Cq()/CqStyle() rewrite only where the browser lacks cq units; ColorMix() likewise', () => {
  ForceCqFallback(true); ForceColorMixFallback(true);
  try {
    assert.equal(Cq('7.8cqw'), 'calc(7.8 * var(--cqw, 1%))');
    assert.equal(Cq('12px'), '12px');
    assert.deepEqual(CqStyle({ fontSize: '2cqh', color: 'red' }), { fontSize: 'calc(2 * var(--cqh, 1%))', color: 'red' });
    assert.equal(ColorMix('0 0 4px color-mix(in srgb, #fff 50%, transparent)'), '0 0 4px rgba(255, 255, 255, 0.5)');
    assert.equal(ColorMix('red'), 'red');
  } finally { ForceCqFallback(false); ForceColorMixFallback(false); }
  // Node has no CSS.supports: both helpers read that as "supported" and hand the value back.
  assert.equal(Cq('7.8cqw'), '7.8cqw');
  assert.equal(ColorMix('color-mix(in srgb, red, blue)'), 'color-mix(in srgb, red, blue)');
});

test('the rewritten rules and the shim agree end to end on a small sheet', () => {
  const css = ':root{--panel:#111}\nhtml{container:game-viewport/size}.card{container-type:inline-size}\n@container game-viewport (max-width:600px){.hud{font-size:12px}}\n.face{font-size:7.8cqw;background:color-mix(in srgb,var(--panel) 50%,transparent)}';
  const ctx = CreateContext(); CollectVars(css, ctx);
  const out = DownlevelCss(css, Object.fromEntries(FLAGS.map((f) => [f, true])), ctx);
  assert.match(out, /:where\(\[data-cq~="0"\]\) \.hud\{font-size:12px\}/);
  assert.match(out, /\.face\{font-size:calc\(7\.8 \* var\(--cqw, 1%\)\);background:rgba\(17, 17, 17, 0\.5\)\}/);
  assert.deepEqual(ctx.containers.map((c) => c.selector), ['html', '.card']);
});
