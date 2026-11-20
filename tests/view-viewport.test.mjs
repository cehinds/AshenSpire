import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_PRESETS, resolveViewViewport, matchViewMedia, logicalViewport, viewScale, viewViewportBox } from '../src/ui/viewViewport.js';

test('named views fit their logical aspect inside every host', () => {
  for (const preset of Object.keys(VIEW_PRESETS)) for (const [width, height] of [[1440, 900], [390, 844], [1920, 1080], [320, 568]]) {
    const view = resolveViewViewport(preset, width, height);
    const portraitTablet = preset === 'tablet' && height > width;
    assert.equal(view.width, portraitTablet ? VIEW_PRESETS[preset].height : VIEW_PRESETS[preset].width);
    assert.equal(view.height, portraitTablet ? VIEW_PRESETS[preset].width : VIEW_PRESETS[preset].height);
    assert.ok(view.left >= -1e-9 && view.top >= -1e-9);
    assert.ok(view.width * view.scale <= width + 1e-9);
    assert.ok(view.height * view.scale <= height + 1e-9);
    assert.ok(Math.abs(view.left * 2 + view.width * view.scale - width) < 1e-9);
    assert.ok(Math.abs(view.top * 2 + view.height * view.scale - height) < 1e-9);
  }
});

test('Auto and unknown values restore native geometry with no fit', () => {
  for (const preset of ['auto', 'old-profile-value', null]) {
    assert.deepEqual(resolveViewViewport(preset, 390, 844), {
      preset: 'auto', width: 390, height: 844, scale: 1, left: 0, top: 0,
    });
  }
});

test('geometric queries read the view while browser capabilities stay outside the helper', () => {
  const root = { dataset: { viewPreset: 'mobile' } };
  const win = { document: { documentElement: root }, innerWidth: 1440, innerHeight: 900 };
  const phone = matchViewMedia('(max-width: 600px) and (orientation: portrait)', win);
  assert.equal(phone.matches, true);
  root.dataset.viewPreset = 'desktop';
  assert.equal(phone.matches, false);
  root.dataset.viewPreset = 'auto';
  win.innerWidth = 390; win.innerHeight = 844;
  assert.equal(phone.matches, true);
  assert.throws(() => matchViewMedia('(pointer: coarse)', win).matches, /Unsupported/);
});


test('headless coordinate helpers retain zero origin and unit scale without a window', () => {
  assert.deepEqual(logicalViewport(), { width: 0, height: 0 });
  assert.equal(viewScale(), 1);
  assert.deepEqual(viewViewportBox(), { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 });
  assert.deepEqual(logicalViewport({ innerWidth: 390, innerHeight: 844 }), { width: 390, height: 844 });
});

test('the tablet canvas follows orientation and logicalViewport reads it', () => {
  assert.deepEqual(VIEW_PRESETS.tablet, { width: 1180, height: 820 });
  assert.deepEqual(VIEW_PRESETS.widescreen, { width: 2560, height: 1080 });
  const portrait = resolveViewViewport('tablet', 820, 1180);
  assert.equal(portrait.preset, 'tablet');
  assert.deepEqual([portrait.width, portrait.height], [820, 1180]);
  const root = { dataset: { viewPreset: 'tablet', viewWidth: '820', viewHeight: '1180' } };
  assert.deepEqual(logicalViewport({ document: { documentElement: root } }), { width: 820, height: 1180 });
});

test('CanvasBox and CanvasRect read the combat canvas and convert real px to canvas px', async () => {
  const { CanvasBox, CanvasRect, applyViewViewport } = await import('../src/ui/viewViewport.js');
  const style = { setProperty() {}, removeProperty() {} };
  const root = { dataset: {}, style };
  const win = { document: { documentElement: root }, innerWidth: 2000, innerHeight: 1225 };
  applyViewViewport('desktop', 2000, 1225, root);
  const box = CanvasBox(win);
  assert.equal(box.preset, 'desktop');
  assert.deepEqual([box.width, box.height], [1440, 900]);
  assert.ok(Math.abs(box.scale - 1225 / 900) < 1e-9);
  assert.ok(Math.abs(box.left - (2000 - 1440 * box.scale) / 2) < 1e-9 && box.top === 0);
  // A rect drawn at canvas (100, 200, 50 x 40) lands at offset + canvas * scale in the window.
  const real = { left: box.left + 100 * box.scale, top: 200 * box.scale, width: 50 * box.scale, height: 40 * box.scale };
  const canvas = CanvasRect(real, win);
  for (const [key, value] of Object.entries({ left: 100, top: 200, width: 50, height: 40, right: 150, bottom: 240 }))
    assert.ok(Math.abs(canvas[key] - value) < 1e-9, key);
  // An element is measured through its own getBoundingClientRect.
  assert.ok(Math.abs(CanvasRect({ getBoundingClientRect: () => real }, win).left - 100) < 1e-9);
  // Two windows of one form factor give the same canvas and scale-only differences.
  applyViewViewport('desktop', 1440, 900, root);
  assert.deepEqual(CanvasBox(win), { preset: 'desktop', width: 1440, height: 900, scale: 1, left: 0, top: 0 });
  // Without a canvas the box is the window and the conversion is identity.
  applyViewViewport('auto', 800, 600, root);
  win.innerWidth = 800; win.innerHeight = 600;
  assert.deepEqual(CanvasBox(win), { preset: 'auto', width: 800, height: 600, scale: 1, left: 0, top: 0 });
  assert.deepEqual(CanvasRect({ left: 5, top: 6, width: 7, height: 8 }, win), { left: 5, top: 6, width: 7, height: 8, right: 12, bottom: 14, x: 5, y: 6 });
});
