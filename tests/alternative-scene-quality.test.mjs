import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeBackdropHtml, wireAlternativeBackdrop, fitAlternativeBackdrop } from '../src/ui/alternativeArt.js';
import { alternativeArtCatalog as catalog } from '../src/ui/alternativeArtCatalog.js';
import { applyArtTier, displaySceneryTier, resetArtTier } from '../src/ui/artTier.js';
import { ART_QUALITY_KEY, ART_AUTO, ART_LIGHT, ART_HIGH, ART_SOURCE_EVENT } from '../src/ui/highResArt.js';

const noPacks = { pin: {}, inlineMap: {} };
const scene = catalog.scenes['hollow-weald-1'];
const scenePaths = html => [...html.matchAll(/<image[^>]+href="([^"]+)"/g)].map(match => match[1]);

function setup(t) {
  const names = ['document', 'navigator', 'screen', 'matchMedia', 'MutationObserver'];
  const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const doc = new EventTarget();
  doc.documentElement = { dataset: { layout: 'wide', formFactor: 'desktop' },
    getAttribute(name) { return name === 'data-layout' ? this.dataset.layout : null; } };
  doc.body = { classList: { contains: () => false } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { deviceMemory: 8, connection: { saveData: false } } });
  Object.defineProperty(globalThis, 'screen', { configurable: true, value: { width: 1920, height: 1080 } });
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => new EventTarget() });
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: undefined });
  resetArtTier();
  t.after(() => {
    resetArtTier();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return doc;
}

test('display scenery respects quality, desktop eligibility and Auto resource preferences without changing its canvas', async t => {
  const doc = setup(t);
  const settings = { [ART_QUALITY_KEY]: ART_AUTO };
  await applyArtTier(settings, noPacks);
  assert.equal(displaySceneryTier({ defaultTier: 'light' }), 'high', 'common display exports have their own high desktop default');
  const detailed = alternativeBackdropHtml('hollow-weald-1');
  assert(scenePaths(detailed).every(path => !path.endsWith('-mobile.webp')));
  settings[ART_QUALITY_KEY] = ART_LIGHT;
  await applyArtTier(settings, noPacks);
  const light = alternativeBackdropHtml('hollow-weald-1');
  assert(scenePaths(light).every(path => path.endsWith('-mobile.webp')));
  assert.equal(light.replace(/href="[^"]+"/g, 'href=""'), detailed.replace(/href="[^"]+"/g, 'href=""'), 'quality never changes framing or layer geometry');
  for (const factor of ['mobile', 'tablet']) {
    doc.documentElement.dataset.formFactor = factor;
    for (const choice of [ART_AUTO, ART_HIGH]) {
      settings[ART_QUALITY_KEY] = choice;
      await applyArtTier(settings, noPacks);
      assert(scenePaths(alternativeBackdropHtml()).every(path => path.endsWith('-mobile.webp')), `${factor}/${choice}`);
    }
  }
  doc.documentElement.dataset.formFactor = 'widescreen';
  settings[ART_QUALITY_KEY] = ART_AUTO;
  await applyArtTier(settings, noPacks);
  for (const preference of ['saveData', 'lowMemory', 'smallScreen']) {
    navigator.connection.saveData = preference === 'saveData';
    navigator.deviceMemory = preference === 'lowMemory' ? 2 : 8;
    screen.height = preference === 'smallScreen' ? 390 : 1080;
    assert(scenePaths(alternativeBackdropHtml()).every(path => path.endsWith('-mobile.webp')), preference);
  }
  navigator.connection.saveData = false; navigator.deviceMemory = 8; screen.height = 1080;
  delete doc.documentElement.dataset.formFactor;
  assert(scenePaths(alternativeBackdropHtml()).every(path => !path.endsWith('-mobile.webp')), 'legacy wide callers retain desktop detail');
  doc.documentElement.dataset.layout = 'narrow';
  settings[ART_QUALITY_KEY] = ART_HIGH;
  await applyArtTier(settings, noPacks);
  assert(scenePaths(alternativeBackdropHtml()).every(path => path.endsWith('-mobile.webp')), 'legacy narrow callers remain phone-only even on High');
});

test('an already mounted scene switches sources on art preference changes and releases its listener', async t => {
  const doc = setup(t);
  const settings = { [ART_QUALITY_KEY]: ART_AUTO };
  await applyArtTier(settings, noPacks);
  const groups = scene.devices.desktop.layers.filter(layer => catalog.sceneLayers[layer.id].kind !== 'foreground').map(layer => {
    const attrs = { href: catalog.sceneLayers[layer.id].path, x: layer.x, y: layer.y, width: layer.width, height: layer.height };
    return { dataset: { depth: String(layer.depth) }, style: {}, firstElementChild: {
      dataset: { layer: layer.id }, getAttribute: key => attrs[key], setAttribute: (key, value) => { attrs[key] = value; }, attrs,
    } };
  });
  const geometry = () => groups.map(group => { const { href, ...rest } = group.firstElementChild.attrs; return rest; });
  const before = geometry();
  const handlers = new Map();
  const svg = { style: {}, setAttribute() {}, querySelectorAll: () => groups };
  const backdrop = { dataset: { device: 'desktop', scene: 'hollow-weald-1' }, querySelector: () => svg };
  const combat = { clientHeight: 900, querySelectorAll: () => groups,
    querySelector: selector => selector === '.alternative-backdrop' ? backdrop : null,
    addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const release = wireAlternativeBackdrop(combat);
  settings[ART_QUALITY_KEY] = ART_LIGHT;
  await applyArtTier(settings, noPacks);
  assert(groups.every(group => group.firstElementChild.attrs.href.endsWith('-mobile.webp')), 'same settings object can change live');
  fitAlternativeBackdrop(combat, { width: 1200, height: 600, fieldTop: 100, ground: 400, narrow: false });
  assert(groups.every(group => group.firstElementChild.attrs.href.endsWith('-mobile.webp')), 'a layout refit preserves the selected Light sources');
  settings[ART_QUALITY_KEY] = ART_AUTO;
  await applyArtTier(settings, noPacks);
  assert(groups.every(group => !group.firstElementChild.attrs.href.endsWith('-mobile.webp')));
  doc.documentElement.dataset.formFactor = 'tablet';
  doc.dispatchEvent(new Event(ART_SOURCE_EVENT));
  assert(groups.every(group => group.firstElementChild.attrs.href.endsWith('-mobile.webp')), 'source arrival reads current form factor');
  assert.deepEqual(geometry(), before);
  release();
  assert.equal(handlers.size, 0);
  doc.documentElement.dataset.formFactor = 'desktop';
  doc.dispatchEvent(new Event(ART_SOURCE_EVENT));
  assert(groups.every(group => group.firstElementChild.attrs.href.endsWith('-mobile.webp')), 'disposed scene no longer handles source events');
});
