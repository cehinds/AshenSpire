// Desktop and widescreen combat bands (owner, 2026-10-13: "should be mobile
// placement"). The wide form factors no longer have a band table of their own:
// they use approved sizing.bands (6 / 53 / 27 / 14), with physical hand and
// footer minimums retained as viewport size and UI zoom change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';
import { footerArtHeight, footerArtWidth } from '../src/ui/models/FooterLayoutModel.js';
import { planCombatLayout } from './helpers/combat-layout-plan.mjs';
import { uiConfig } from '../src/config/generated/ui.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;
const w4a = uiConfig.scenes.w4a.sizing;

test('the retired desktopBands table is gone; the wide form factors read sizing.bands', () => {
  assert.equal('desktopBands' in w4a, false, 'no desktop band table');
  assert.deepEqual(w4a.bands, { hud: 6, scene: 53, context: 27, footer: 14 });
  assert.equal(Object.values(w4a.bands).reduce((sum, value) => sum + value, 0), 100);
});

test('the stacked plan on a tall host takes the phone shares, the footer retains its approved share', () => {
  const bands = allocateCombatBands({ height: 1000 });
  assert.ok(near(bands.hud, 60) && near(bands.hand, 270) && near(bands.footer, 140), JSON.stringify(bands));
  assert.ok(near(bands.battlefield, 530));
  assert.equal(bands.supported, true);
});

// Driven through the real caller (wireCombatLayout with data-form-factor), so
// these fail if combatLayout.js still hands a form factor to the band plan.
test('at 1280x720 (UI zoom 0.99) desktop takes the phone shares of the viewport', () => {
  const zoom = 0.99, width = 1280 / zoom, height = 720 / zoom;
  const bands = planCombatLayout({ formFactor: 'desktop', width, height, zoom });
  assert.ok(near(bands.hud, height * .06), `hud ${bands.hud}`);
  assert.ok(near(bands.hand, Math.max(height * .27, 208 / zoom)), `hand ${bands.hand}`);
  assert.ok(bands.battlefield >= height * .53 - 208 / zoom, `battlefield ${bands.battlefield}`);
  assert.equal(bands.supported, true);
});

test('at 1920x1080 (UI zoom 1.48) the desktop battlefield is the scene band, with its approved 53% share', () => {
  const zoom = 1.48, width = 1920 / zoom, height = 1080 / zoom;
  const bands = planCombatLayout({ formFactor: 'desktop', width, height, zoom });
  assert.ok(near(bands.hud, height * .06), `hud ${bands.hud}`);
  assert.ok(near(bands.hand, Math.max(height * .27, 208 / zoom)), `hand ${bands.hand}`);
  assert.ok(near(bands.battlefield / height, .53), `battlefield share ${bands.battlefield / height}`);
  assert.equal(bands.supported, true);
});

test('the hand keeps its physical minimum on every desktop size', () => {
  for (const [w, h, zoom] of [[1280, 720, 0.99], [1440, 900, 1.2], [1920, 1080, 1.48]]) {
    const bands = planCombatLayout({ formFactor: 'desktop', width: w / zoom, height: h / zoom, zoom });
    assert.ok(bands.hand * zoom >= 208 - 1e-9, `hand at ${w}x${h}`);
    assert.ok(bands.battlefield > 0, `battlefield at ${w}x${h}`);
    assert.equal(bands.supported, true, `${w}x${h} stays supported`);
  }
});

test('desktop footer artwork preserves its aspect ratio and 92px physical minimum', () => {
  const zoom = 1.2, width = 1440 / zoom;
  assert.ok(near(footerArtWidth(width, zoom, 'desktop') * zoom, 600), 'width');
  assert.ok(footerArtHeight(width, zoom, 'desktop') * zoom >= 92);
  assert.ok(near(footerArtHeight(width, zoom, 'desktop') * zoom, footerArtHeight(1440, 1, 'desktop')), 'UI zoom does not distort footer art');
});

test('widescreen footer art keeps the desktop 600px maximum and matching artwork height', () => {
  for (const zoom of [1, 1.2]) {
    const width = 1440 / zoom;
    assert.ok(near(footerArtWidth(width, zoom, 'widescreen') * zoom, 600), `widescreen width at zoom ${zoom}`);
    assert.ok(near(footerArtHeight(width, zoom, 'widescreen'), footerArtHeight(width, zoom, 'desktop')), 'widescreen footer height matches desktop');
  }
});

test('tablet and phone footer art keep their 720px maximum', () => {
  assert.ok(near(footerArtWidth(1024, 1, 'tablet'), 720));
  assert.ok(near(footerArtWidth(1200, 1, 'mobile'), 720));
  assert.ok(near(footerArtWidth(1200, 1, null), 720));
});
