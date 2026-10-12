import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';
import { footerArtHeight, footerArtWidth } from '../src/ui/models/FooterLayoutModel.js';
import { uiConfig } from '../src/config/generated/ui.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;
const desktop = uiConfig.scenes.w4a.sizing.desktopBands;

test('desktop bands are authored as shares summing to 100', () => {
  assert.deepEqual(desktop, { hud: 8, scene: 50, context: 38, footer: 4 });
  assert.equal(Object.values(desktop).reduce((sum, value) => sum + value, 0), 100);
});

test('desktop stacked plan takes the desktop shares on a tall host', () => {
  const bands = allocateCombatBands({ height: 1000, formFactor: 'desktop' });
  // The footer keeps its 56px physical floor (combat.footerMinimumPx) above the 4% share.
  assert.ok(near(bands.hud, 80) && near(bands.hand, 380) && near(bands.footer, 56), JSON.stringify(bands));
  assert.ok(near(bands.battlefield, 484));
  assert.equal(bands.supported, true);
});

test('desktop hud and hand take their shares of a 1440x900 host at UI zoom 1.2', () => {
  // 1440x900 at UI zoom 1.2: 750 local px tall, 92 physical px footer minimum.
  const zoom = 1.2, width = 1440 / zoom, height = 900 / zoom, rem = 16 / zoom;
  const footerArtPx = footerArtHeight(width, zoom, 'desktop') * zoom;
  const bands = allocateCombatBands({ width, height, zoom, rem, footerArtPx, formFactor: 'desktop' });
  assert.ok(near(bands.hud, 60), `hud ${bands.hud}`);
  assert.ok(near(bands.hand, 285), `hand ${bands.hand}`);
  assert.equal(bands.supported, true);
});

test('desktop bands keep the hand at its physical minimum on every desktop size', () => {
  for (const [w, h, zoom] of [[1280, 720, 0.99], [1440, 900, 1.2], [1920, 1080, 1.48]]) {
    const width = w / zoom, height = h / zoom, rem = 16 / zoom;
    const footerArtPx = footerArtHeight(width, zoom, 'desktop') * zoom;
    const bands = allocateCombatBands({ width, height, zoom, rem, footerArtPx, formFactor: 'desktop' });
    assert.ok(bands.hand * zoom >= 208 - 1e-9, `hand at ${w}x${h}`);
    assert.ok(near(bands.hud + bands.battlefield + bands.hand + bands.footer, height), `sum at ${w}x${h}`);
    assert.equal(bands.supported, true, `${w}x${h} stays supported`);
  }
});

test('tablet, mobile and widescreen keep the nominal stacked shares', () => {
  const nominal = allocateCombatBands({ width: 1024, height: 768 });
  for (const formFactor of ['tablet', 'mobile', 'widescreen', null]) {
    assert.deepEqual({ ...allocateCombatBands({ width: 1024, height: 768, formFactor }) }, { ...nominal }, `formFactor ${formFactor}`);
  }
  assert.ok(near(nominal.hud, 76.8) && near(nominal.hand, 230.4), 'nominal 10/55/30/5 at 1024x768');
});

test('desktop footer art is 450 physical px wide, about 92px tall at 1440x900', () => {
  const zoom = 1.2, width = 1440 / zoom;
  assert.ok(near(footerArtWidth(width, zoom, 'desktop') * zoom, 450), 'width');
  assert.ok(Math.abs(footerArtHeight(width, zoom, 'desktop') * zoom - 92) < 0.5, `height ${footerArtHeight(width, zoom, 'desktop') * zoom}`);
});

test('tablet and phone footer art keeps the 600px maximum', () => {
  assert.ok(near(footerArtWidth(1024, 1, 'tablet'), 600));
  assert.ok(near(footerArtWidth(1200, 1, 'mobile'), 600));
  assert.ok(near(footerArtWidth(1200, 1, null), 600));
});
