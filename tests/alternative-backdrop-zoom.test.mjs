// The combat backdrop is framed `scene.backdropZoom` farther out than the pure cover fit
// (owner 2026-11-01: the art looked too close and pixelated), about the ground anchor,
// and the bare edges are filled by a blurred copy of the closer framing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitAlternativeBackdrop } from '../src/ui/alternativeArt.js';
import { alternativeArtCatalog as catalog } from '../src/ui/alternativeArtCatalog.js';
import { uiConfig } from '../src/config/generated/ui.js';

const framing = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.scene;
const device = catalog.scenes['hollow-weald-1'].devices.desktop;

function fixture(t) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: { layout: 'wide' } } } });
  t.after(() => saved ? Object.defineProperty(globalThis, 'document', saved) : delete globalThis.document);
  const element = (extra = {}) => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; },
    getAttribute(k) { return this.attrs[k] ?? null; }, ...extra });
  const fillImages = ['far', 'ground'].map(kind => {
    const layer = device.layers.find(l => catalog.sceneLayers[l.id].kind === kind);
    return element({ dataset: { fillLayer: layer.id } });
  });
  const fill = element({ querySelectorAll: () => fillImages });
  const main = element(), edge = element(), blur = element();
  const svg = element({ style: {}, querySelectorAll: () => [],
    querySelector: sel => sel.includes('alternative-scene-fill') ? fill : sel.includes('alternative-scene-main') ? main
      : sel.includes('alternative-scene-edge') && !sel.includes('blur') ? edge : sel.includes('blur') ? blur : null });
  const backdrop = element({ dataset: { scene: 'hollow-weald-1' }, querySelector: () => svg });
  const combat = { clientHeight: 1080, querySelector: sel => sel === '.alternative-backdrop' ? backdrop : null, querySelectorAll: () => [] };
  return { combat, svg, fill, main, edge };
}

test('the zoom factor is authored config, below 1 and within the owner\'s 15-20% window', () => {
  assert.ok(framing.backdropZoom >= 0.8 && framing.backdropZoom <= 0.85, `backdropZoom ${framing.backdropZoom}`);
});

test('combat frames the art backdropZoom smaller than the cover fit, about the ground anchor', t => {
  const { combat, svg, fill, main } = fixture(t);
  const width = 1920, height = 900, fieldTop = 180;
  const previewTop = combat.clientHeight * framing.topHeightFraction;
  const cover = Math.max(width / device.width, (fieldTop + height - previewTop) / device.height);
  fitAlternativeBackdrop(combat, { width, height, fieldTop, ground: 600, narrow: false, coverFloor: true });
  const scale = cover * framing.backdropZoom;
  assert.ok(Math.abs(parseFloat(svg.style.cssText.match(/width:([\d.]+)px/)[1]) - device.width * scale) < 1e-6);
  const top = parseFloat(svg.style.cssText.match(/top:(-?[\d.]+)px/)[1]);
  // The ground anchor stays on the screen line the cover fit gave it.
  assert.ok(Math.abs((top + device.groundAnchor * device.height * scale) - (previewTop + device.groundAnchor * device.height * cover)) < 1e-6);
  assert.equal(fill.attrs.display, '', 'the blurred fill is shown once the art is smaller than the screen');
  assert.match(fill.attrs.transform, new RegExp(`scale\\(${1 / framing.backdropZoom}`));
  assert.equal(main.attrs.mask, 'url(#alternative-scene-edge)', 'the sharp layers feather into the fill where an edge shows');
});

test('callers without coverFloor (dialogue) keep the pure cover fit and show no fill', t => {
  const { combat, svg, fill, main } = fixture(t);
  fitAlternativeBackdrop(combat, { width: 1200, height: 600, fieldTop: 100, ground: 400, narrow: false });
  const cover = Math.max(1200 / device.width, 600 / device.height);
  assert.ok(Math.abs(parseFloat(svg.style.cssText.match(/width:([\d.]+)px/)[1]) - device.width * cover) < 1e-6);
  assert.equal(fill.attrs.display, 'none');
  assert.equal(main.attrs.mask, undefined);
});
