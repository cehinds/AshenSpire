// tests/art-restore.test.mjs — the art placeholders a failed load leaves are put
// back by one pass (docs/EXTERNAL-ASSETS-PLAN.md step 5, src/ui/artFallback.js):
// relicIcon, classSprite and enemySprite are built, made to fail, and restored
// in a small fake DOM, and what comes back is checked (review 5394761200).
import { test } from 'node:test';
import assert from 'node:assert/strict';

function installFakeDom() {
  class El {
    constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {}; this.dataset = {}; this.style = { cssText: '', setProperty() {}, removeProperty() {} }; this.listeners = {}; this._text = ''; this.className = '';
      this.classList = { add: (...c) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...c])].join(' '); }, remove() {}, toggle() {}, contains: (c) => this.className.split(' ').includes(c) }; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === doc.body || n === doc; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'src') this.src = String(v); }
    getAttribute(k) { return k === 'src' ? (this.src ?? this.attrs.src ?? null) : (this.attrs[k] ?? null); }
    hasAttribute(k) { return k in this.attrs; } removeAttribute(k) { delete this.attrs[k]; }
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
    append(...cs) { for (const c of cs) if (c && typeof c === 'object') this.appendChild(c); }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; }
    remove() { this.parentNode?.removeChild(this); }
    replaceWith(o) { const p = this.parentNode; if (!p) return; const i = p.children.indexOf(this); if (o.parentNode) o.parentNode.removeChild(o); p.children[i] = o; o.parentNode = p; this.parentNode = null; }
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } removeEventListener() {}
    dispatch(t) { for (const f of this.listeners[t] || []) f({ target: this, type: t }); }
    set innerHTML(v) { this.children = []; this._text = String(v); } get innerHTML() { return this._text; }
    set textContent(v) { this.children = []; this._text = String(v); } get textContent() { return this._text + this.children.map((c) => c.textContent || '').join(''); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) { const out = []; const want = sel.startsWith('[') ? (n) => n.hasAttribute?.(sel.slice(1, -1)) : sel.startsWith('.') ? (n) => n.classList?.contains(sel.slice(1)) : (n) => n.tagName === sel.toUpperCase();
      const walk = (n) => { for (const c of n.children || []) { if (want(c)) out.push(c); walk(c); } }; walk(this); return out; }
    cloneNode() { const c = new El(this.tagName); Object.assign(c.attrs, this.attrs); c.src = this.src; c.className = this.className; return c; }
    getBoundingClientRect() { return { width: 0, height: 0 }; }
    insertAdjacentHTML() {} focus() {}
  }
  const doc = { createElement: (t) => new El(t), createElementNS: (_, t) => new El(t), createTextNode: (t) => Object.assign(new El('#text'), { _text: t }), body: null, documentElement: null, addEventListener() {}, querySelector: () => null, querySelectorAll: (s) => doc.body.querySelectorAll(s) };
  doc.body = new El('body'); doc.body.parentNode = doc; doc.documentElement = new El('html');
  globalThis.document = doc;
  globalThis.window ??= globalThis;
  globalThis.CustomEvent ??= class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
  return doc;
}

const doc = installFakeDom();
const { relicIcon, enemySprite, classSprite } = await import('../src/ui/assets.js');
const { restoreArtPlaceholders } = await import('../src/ui/artFallback.js');
const imgOf = (el) => (el?.tagName === 'IMG' ? el : el?.querySelector('img'));
const mount = (el) => { doc.body.appendChild(el); return el; };

test('relicIcon: a failed icon becomes its glyph, and the restore draws the icon again', () => {
  const relic = { id: 'forsakenMedallion', icon: '◈' };
  const icon = mount(relicIcon(relic));
  imgOf(icon).dispatch('error');
  const glyph = doc.body.children.at(-1);
  assert.equal(glyph.textContent, '◈', 'the glyph stands in');
  assert.ok(glyph.hasAttribute('data-art-placeholder'));
  assert.equal(restoreArtPlaceholders(doc.body), 1);
  const back = doc.body.children.at(-1);
  assert.notEqual(back, glyph, 'a fresh icon in its place');
  assert.match(imgOf(back).getAttribute('src'), /assets\/relics\/forsakenMedallion\.webp$/);
  assert.equal(back.className, 'og relic-art');
});

test('enemySprite: a failed sprite becomes its placeholder, and the restore builds the sprite again', () => {
  const def = { id: 'testShade', name: 'Test Shade', size: 'medium', art: '☠' };
  const sprite = mount(enemySprite(def, { hp: 5, maxHp: 9 }));
  imgOf(sprite).dispatch('error');
  assert.equal(sprite.textContent, '☠', 'the placeholder recipe');
  assert.ok(sprite.hasAttribute('data-art-placeholder'));
  assert.equal(restoreArtPlaceholders(doc.body), 1);
  const back = doc.body.children.at(-1);
  assert.notEqual(back, sprite);
  assert.equal(back.dataset.enemyId, 'testShade');
  assert.match(imgOf(back).getAttribute('src'), /assets\/sprites\/enemy_testShade\.webp$/);
});

test('classSprite: a failed figure falls back to its SVG, and the restore draws the same figure again', () => {
  const figure = mount(classSprite('reaver', '#c9a227', null, 'gold', 'flat', null));
  const src = imgOf(figure).getAttribute('src');
  assert.match(src, /assets\/sprites\/reaver_gold\.webp$/);
  imgOf(figure).dispatch('error');
  assert.ok(figure.hasAttribute('data-art-placeholder'), 'the SVG fallback is marked');
  assert.equal(restoreArtPlaceholders(doc.body), 1);
  const back = doc.body.children.at(-1);
  assert.notEqual(back, figure);
  assert.equal(imgOf(back).getAttribute('src'), src, 'the same class, tint and outfit');
  assert.equal(restoreArtPlaceholders(doc.body), 0, 'each placeholder is restored once');
});
