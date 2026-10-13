// Desktop and widescreen combat bands (owner, 2026-10-13: "should be mobile
// placement"). The wide form factors no longer have a band table of their own:
// they take the phone's sizing.bands (10 / 55 / 30 / 5), scaled to the viewport,
// so the battlefield is the same share of the screen on every form factor and the
// hand is 30%, not the 38% the retired sizing.desktopBands gave it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';
import { footerArtHeight, footerArtWidth } from '../src/ui/models/FooterLayoutModel.js';
import { uiConfig } from '../src/config/generated/ui.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;
const w4a = uiConfig.scenes.w4a.sizing;

test('the retired desktopBands table is gone; the wide form factors read sizing.bands', () => {
  assert.equal('desktopBands' in w4a, false, 'no desktop band table');
  assert.deepEqual(w4a.bands, { hud: 10, scene: 55, context: 30, footer: 5 });
  assert.equal(Object.values(w4a.bands).reduce((sum, value) => sum + value, 0), 100);
});

test('the stacked plan on a tall host takes the phone shares, the footer at its 56px floor', () => {
  const bands = allocateCombatBands({ height: 1000 });
  assert.ok(near(bands.hud, 100) && near(bands.hand, 300) && near(bands.footer, 56), JSON.stringify(bands));
  assert.ok(near(bands.battlefield, 544));
  assert.equal(bands.supported, true);
});

test('at 1280x720 (UI zoom 0.99) the hud and hand take the phone shares of the viewport', () => {
  const zoom = 0.99, width = 1280 / zoom, height = 720 / zoom, rem = 16 / zoom;
  const footerArtPx = footerArtHeight(width, zoom, 'desktop') * zoom;
  const bands = allocateCombatBands({ width, height, zoom, rem, footerArtPx });
  assert.ok(near(bands.hud, height * .10), `hud ${bands.hud}`);
  assert.ok(near(bands.hand, height * .30), `hand ${bands.hand}`);
  assert.ok(bands.battlefield >= height * .55 - 92 / zoom, `battlefield ${bands.battlefield}`);
  assert.equal(bands.supported, true);
});

test('at 1920x1080 (UI zoom 1.48) the battlefield is the scene band, larger than the retired 50%', () => {
  const zoom = 1.48, width = 1920 / zoom, height = 1080 / zoom, rem = 16 / zoom;
  const footerArtPx = footerArtHeight(width, zoom, 'widescreen') * zoom;
  const bands = allocateCombatBands({ width, height, zoom, rem, footerArtPx });
  assert.ok(near(bands.hud, height * .10), `hud ${bands.hud}`);
  assert.ok(near(bands.hand, height * .30), `hand ${bands.hand}`);
  assert.ok(bands.battlefield / height > .5, `battlefield share ${bands.battlefield / height}`);
  assert.equal(bands.supported, true);
});

test('the hand keeps its physical minimum on every desktop size', () => {
  for (const [w, h, zoom] of [[1280, 720, 0.99], [1440, 900, 1.2], [1920, 1080, 1.48]]) {
    const width = w / zoom, height = h / zoom, rem = 16 / zoom;
    const footerArtPx = footerArtHeight(width, zoom, 'desktop') * zoom;
    const bands = allocateCombatBands({ width, height, zoom, rem, footerArtPx });
    assert.ok(bands.hand * zoom >= 208 - 1e-9, `hand at ${w}x${h}`);
    assert.ok(near(bands.hud + bands.battlefield + bands.hand + bands.footer, height), `sum at ${w}x${h}`);
    assert.equal(bands.supported, true, `${w}x${h} stays supported`);
  }
});

test('a desktop footer keeps the 92px footer height the phone footer floors at', () => {
  const zoom = 1.2, width = 1440 / zoom;
  assert.ok(near(footerArtWidth(width, zoom, 'desktop') * zoom, 450), 'width');
  assert.ok(Math.abs(footerArtHeight(width, zoom, 'desktop') * zoom - 92) < 0.5, `height ${footerArtHeight(width, zoom, 'desktop') * zoom}`);
});

test('widescreen footer art keeps the desktop 450px width and the same 92px height', () => {
  for (const zoom of [1, 1.2]) {
    const width = 1440 / zoom;
    assert.ok(near(footerArtWidth(width, zoom, 'widescreen') * zoom, 450), `widescreen width at zoom ${zoom}`);
    assert.ok(near(footerArtHeight(width, zoom, 'widescreen'), footerArtHeight(width, zoom, 'desktop')), 'widescreen footer height matches desktop');
  }
});

test('tablet and phone footer art keeps the 600px maximum', () => {
  assert.ok(near(footerArtWidth(1024, 1, 'tablet'), 600));
  assert.ok(near(footerArtWidth(1200, 1, 'mobile'), 600));
  assert.ok(near(footerArtWidth(1200, 1, null), 600));
});
