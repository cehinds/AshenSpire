import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { initGalleryZoom, GALLERY_ZOOM_KEYS } from '../tools/score-studio/galleryZoom.js';

function fixture(dom, saved = new Map(), storageOverride) {
  const { document: doc } = dom;
  doc.body.innerHTML = '<div id="outside"></div><div id="cards-grid"><div class="studio-card-tile"></div></div><div id="items-grid"><div class="item-grid-tile"></div></div><input id="card-scale-slider"><output id="card-zoom-value"></output><button id="card-zoom-reset"></button><input id="item-scale-slider"><output id="item-zoom-value"></output><button id="item-zoom-reset"></button>';
  doc.body.scrollTop = doc.body.scrollLeft = 0;
  const widths = { cards: new Map(), items: new Map() }, calls = [];
  for (const kind of ['cards', 'items']) {
    const grid = doc.getElementById(`${kind}-grid`);
    grid.style.setProperty = (key, value) => widths[kind].set(key, value);
  }
  const storage = storageOverride || { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const api = initGalleryZoom({ document: doc, storage, onCardsResize: n => calls.push(['cards', n]), onItemsResize: n => calls.push(['items', n]) });
  return { api, doc, widths, saved, calls };
}

test('gallery zoom defaults, limits and reset update only the addressed gallery', () => withKitDom(dom => {
  const { api, doc, widths, calls } = fixture(dom);
  assert.equal(api.getSize('cards'), 185); assert.equal(api.getSize('items'), 185);
  assert.equal(doc.getElementById('card-zoom-value').textContent, '100%');
  assert.equal(api.setSize('cards', 900), 360); assert.equal(api.getSize('items'), 185);
  assert.equal(widths.cards.get('--card-tile-width'), '360px'); assert.equal(widths.items.get('--item-tile-width'), '185px');
  assert.equal(doc.getElementById('card-zoom-value').textContent, '195%');
  assert.equal(api.setSize('cards', 1), 110); assert.equal(api.setSize('cards', NaN), 185);
  assert.equal(api.setSize('items', 244.7), 245);
  doc.getElementById('item-zoom-reset').click(); assert.equal(api.getSize('items'), 185);
  assert.ok(calls.some(([kind, size]) => kind === 'items' && size === 245));
  assert.throws(() => api.getSize('inspector'), /Unknown gallery/);
}));

test('Cards and Items persist independent sizes and invalid or unavailable storage is harmless', () => withKitDom(dom => {
  const saved = new Map([[GALLERY_ZOOM_KEYS.cards, '300'], [GALLERY_ZOOM_KEYS.items, 'not a width']]);
  const { api, doc } = fixture(dom, saved);
  assert.equal(api.getSize('cards'), 300); assert.equal(api.getSize('items'), 185);
  api.setSize('items', 150);
  assert.equal(saved.get(GALLERY_ZOOM_KEYS.cards), '300'); assert.equal(saved.get(GALLERY_ZOOM_KEYS.items), '150');
  const slider = doc.getElementById('item-scale-slider'); slider.value = '220'; slider.dispatchEvent(new dom.Event('input'));
  assert.equal(api.getSize('items'), 220); assert.equal(slider.min, '110'); assert.equal(slider.max, '360');
  assert.equal(slider.getAttribute('aria-valuetext'), '119%');
  const broken = fixture(dom, new Map(), { getItem() { throw Error('disabled'); }, setItem() { throw Error('disabled'); } });
  assert.equal(broken.api.getSize('cards'), 185); assert.equal(broken.api.setSize('cards', 230), 230);
}));

test('normal wheel stays scrolling and Ctrl/Cmd wheel affects only the gallery under the pointer', () => withKitDom(dom => {
  const { api, doc } = fixture(dom);
  const wheel = (target, options) => { const event = new dom.Event('wheel', { bubbles: true, cancelable: true, deltaY: 100, deltaMode: 0, clientX: 30, clientY: 30, ...options }); target.dispatchEvent(event); return event; };
  const cards = doc.querySelector('#cards-grid .studio-card-tile'), items = doc.querySelector('#items-grid .item-grid-tile');
  assert.equal(wheel(cards).defaultPrevented, false); assert.equal(api.getSize('cards'), 185);
  assert.equal(wheel(doc.getElementById('outside'), { ctrlKey: true }).defaultPrevented, false);
  assert.equal(api.getSize('cards'), 185); assert.equal(api.getSize('items'), 185);
  assert.equal(wheel(cards, { ctrlKey: true, deltaY: -100 }).defaultPrevented, true);
  assert.ok(api.getSize('cards') > 185); assert.equal(api.getSize('items'), 185);
  assert.equal(wheel(items, { metaKey: true }).defaultPrevented, true);
  assert.ok(api.getSize('items') < 185);
  const before = api.getSize('cards'); assert.equal(wheel(cards, { ctrlKey: true, deltaY: 0 }).defaultPrevented, false); assert.equal(api.getSize('cards'), before);
  api.setSize('cards', 360); assert.equal(wheel(cards, { ctrlKey: true, deltaY: -200 }).defaultPrevented, true); assert.equal(api.getSize('cards'), 360);
}));

test('line and pixel wheel modes produce the same normalized gallery step', () => withKitDom(dom => {
  const { api, doc } = fixture(dom), grid = doc.getElementById('cards-grid');
  grid.dispatchEvent(new dom.Event('wheel', { ctrlKey: true, deltaY: -2, deltaMode: 1, cancelable: true }));
  const lines = api.getSize('cards'); api.reset('cards');
  grid.dispatchEvent(new dom.Event('wheel', { ctrlKey: true, deltaY: -32, deltaMode: 0, cancelable: true }));
  assert.equal(api.getSize('cards'), lines);
}));

test('fractional wheel input accumulates and bounds reverse without a dead zone', () => withKitDom(dom => {
  const { api, doc } = fixture(dom), grid = doc.getElementById('cards-grid');
  const wheel = deltaY => grid.dispatchEvent(new dom.Event('wheel', { ctrlKey: true, deltaY, deltaMode: 0, cancelable: true }));
  for (let i = 0; i < 20; i++) wheel(-.2);
  assert.ok(api.getSize('cards') > 185);
  api.setSize('cards', 360);
  for (let i = 0; i < 20; i++) wheel(-100);
  wheel(2); assert.ok(api.getSize('cards') < 360);
  api.setSize('cards', 110);
  for (let i = 0; i < 20; i++) wheel(100);
  wheel(-3); assert.ok(api.getSize('cards') > 110);
}));

test('anchoring a short gallery never requests computed styles for Document', () => withKitDom(dom => {
  const { api, doc } = fixture(dom), tile = doc.querySelector('#cards-grid .studio-card-tile');
  doc.defaultView = { getComputedStyle(node) { assert.notEqual(node, doc); return { overflowY: 'visible' }; } };
  tile.getBoundingClientRect = () => ({ left: 0, top: 0, width: 185, height: 280 });
  assert.doesNotThrow(() => tile.dispatchEvent(new dom.Event('wheel', { bubbles: true, ctrlKey: true, deltaY: -100, clientX: 30, clientY: 30, cancelable: true })));
  assert.ok(api.getSize('cards') > 185);
}));
