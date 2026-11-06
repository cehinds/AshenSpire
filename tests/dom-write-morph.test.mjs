// domWrite.morph rewrites a freshly built node into the live one: the live node survives, only differing text,
// attributes, classes and inline declarations are written, layout-owned writes stay, and a hook (a tooltip's content
// function, an onLive handler) follows the rebuild. Owner, 2026-11-06: HUD nodes are created once at combat mount.
import test from 'node:test';
import assert from 'node:assert/strict';
import { morph, markBuilt, onLive, hooks } from '../src/ui/domWrite.js';

// The few DOM members morph touches, with a count of every structural and attribute write.
class El {
  constructor(tag) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.namespaceURI = 'html'; this.attrs = new Map(); this.childNodes = []; this.styleMap = new Map(); this.writes = []; this.listeners = []; }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  getAttribute(name) { return name === 'style' ? (this.styleMap.size ? [...this.styleMap].map(([k, v]) => `${k}: ${v}`).join('; ') : null) : this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return name === 'style' ? this.styleMap.size > 0 : this.attrs.has(name); }
  setAttribute(name, value) { this.writes.push(`attr:${name}`); this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.writes.push(`rm:${name}`); this.attrs.delete(name); }
  get style() { const map = this.styleMap, writes = this.writes; return { getPropertyValue: name => map.get(name) ?? '', setProperty: (name, value) => { writes.push(`style:${name}`); map.set(name, value); }, removeProperty: name => { writes.push(`rmstyle:${name}`); map.delete(name); } }; }
  appendChild(node) { this.childNodes.push(node); node.parent = this; return node; }
  replaceChild(next, old) { this.childNodes[this.childNodes.indexOf(old)] = next; next.parent = this; return old; }
  removeChild(node) { this.childNodes.splice(this.childNodes.indexOf(node), 1); return node; }
  addEventListener(type, fn) { this.listeners.push([type, fn]); }
  get textContent() { return this.childNodes.map(node => node.nodeType === 3 ? node.nodeValue : node.textContent).join(''); }
}
const text = value => ({ nodeType: 3, nodeValue: value });
const el = (tag, attrs = {}, ...kids) => { const node = new El(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') for (const [n, val] of Object.entries(v)) node.styleMap.set(n, val); else node.attrs.set(k, v); } for (const kid of kids) node.appendChild(typeof kid === 'string' ? text(kid) : kid); return node; };
const hud = (hp, width) => el('div', { class: 'meters', 'data-row': 'hp' }, el('span', { class: 'm-value' }, `${hp}/50`), el('i', { class: 'm-fill', style: { width: `${width}%` } }));

test('a changed value is written in place and no node is replaced', () => {
  const live = markBuilt(hud(50, 100));
  const [value, fill] = live.childNodes;
  const swaps = morph(live, hud(35, 70));
  assert.equal(swaps, 0);
  assert.equal(live.childNodes[0], value); assert.equal(live.childNodes[1], fill);
  assert.equal(value.textContent, '35/50');
  assert.equal(fill.styleMap.get('width'), '70%');
});

test('an unchanged rebuild writes nothing at all', () => {
  const live = markBuilt(hud(50, 100));
  morph(live, hud(50, 100));
  const writes = [live, ...live.childNodes].flatMap(node => node.writes);
  assert.deepEqual(writes, []);
});

test('attributes and classes the builder dropped go; ones another module added stay', () => {
  const live = markBuilt(el('button', { class: 'intent dashed', 'data-a': '1' }));
  live.attrs.set('class', 'intent dashed visible'); // a layout pass added `visible`
  live.styleMap.set('left', '12px'); // a layout pass wrote a position
  morph(live, el('button', { class: 'intent' }));
  assert.equal(live.getAttribute('class'), 'intent visible');
  assert.equal(live.hasAttribute('data-a'), false);
  assert.equal(live.styleMap.get('left'), '12px');
});

test('a child that cannot pair is replaced and counted; extra children are removed', () => {
  const live = markBuilt(el('div', {}, el('span', {}, 'a'), el('b', {}, 'x'), el('i', {}, 'y')));
  const swaps = morph(live, el('div', {}, el('span', {}, 'a'), el('em', {}, 'x')));
  assert.equal(swaps, 2); // b -> em, i removed
  assert.deepEqual(live.childNodes.map(node => node.tagName), ['SPAN', 'EM']);
});

test('controls of another builder class do not pair, so a handler never lands on the wrong control', () => {
  const live = markBuilt(el('button', { class: 'intent' }, 'a'));
  const host = markBuilt(el('div', {}, live));
  assert.equal(morph(host, el('div', {}, el('button', { class: 'player-action-intent' }, 'b'))), 1);
  assert.notEqual(host.childNodes[0], live);
});

test('onLive registers one real listener and a rebuild only swaps the handler it calls', () => {
  const live = markBuilt(el('button', { class: 'intent' }));
  const calls = [];
  onLive(live, 'click', () => calls.push('old'));
  const fresh = el('button', { class: 'intent' });
  onLive(fresh, 'click', () => calls.push('new'));
  morph(live, fresh);
  assert.equal(live.listeners.length, 1);
  live.listeners[0][1]({});
  assert.deepEqual(calls, ['new']);
});

test('a tooltip content hook follows the rebuild', () => {
  const live = markBuilt(el('span', { class: 'tip' }));
  hooks(live).tip = () => 'old';
  const fresh = el('span', { class: 'tip' }); hooks(fresh).tip = () => 'new';
  morph(live, fresh);
  assert.equal(live.__hooks.tip(), 'new');
});

test('reconcileList keeps paired children, appends new ones before the anchor and removes the rest', async () => {
  const { reconcileList } = await import('../src/ui/domWrite.js');
  El.prototype.insertBefore = function insertBefore(node, ref) { const at = ref ? this.childNodes.indexOf(ref) : -1; if (at < 0) this.childNodes.push(node); else this.childNodes.splice(at, 0, node); node.parent = this; return node; };
  const tail = el('footer');
  const a = markBuilt(el('span', {}, '1')), b = markBuilt(el('span', {}, '2'));
  const parent = el('div', {}, a, b, tail);
  assert.equal(reconcileList(parent, [a, b], [el('span', {}, '9')], tail), 1);
  assert.deepEqual(parent.childNodes.map(node => node.tagName), ['SPAN', 'FOOTER']);
  assert.equal(parent.childNodes[0], a); assert.equal(a.textContent, '9');
  assert.equal(reconcileList(parent, [a], [el('span', {}, '1'), el('span', {}, '2')], tail), 1);
  assert.deepEqual(parent.childNodes.map(node => node.tagName), ['SPAN', 'SPAN', 'FOOTER']);
});
