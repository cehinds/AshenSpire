import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_PRESETS, resolveViewViewport, matchViewMedia, logicalViewport, viewScale, viewViewportBox } from '../src/ui/viewViewport.js';

test('named views fit their logical aspect inside every host', () => {
  for (const preset of Object.keys(VIEW_PRESETS)) for (const [width, height] of [[1440, 900], [390, 844], [1920, 1080], [320, 568]]) {
    const view = resolveViewViewport(preset, width, height);
    assert.equal(view.width, VIEW_PRESETS[preset].width);
    assert.equal(view.height, VIEW_PRESETS[preset].height);
    assert.ok(view.left >= 0 && view.top >= 0);
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
