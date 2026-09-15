import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCombatBands, minimumHandHeight, packCombatRails } from '../src/ui/models/CombatLayout.js';
import { handLayout } from '../src/ui/models/HandLayout.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;
// Physical viewport and the --ui-zoom main.js resolves for it; the model works
// in local px with a reference rem of 16 physical px, as the adapter passes.
const plan = (width, height, zoom = 1) =>
  allocateCombatBands({ width: width / zoom, height: height / zoom, zoom, rem: 16 / zoom });

test('short landscape phones plan rails, supported', () => {
  for (const [width, height, zoom] of [[844, 390, 0.62], [915, 412, 0.62], [740, 360, 0.62], [667, 375, 0.62], [844, 390, 1]]) {
    const bands = plan(width, height, zoom);
    const at = `${width}x${height}@${zoom}`;
    assert.equal(bands.arrangement, 'rails', at);
    assert.equal(bands.supported, true, at);
    assert.equal(bands.footer, 0, `${at}: no footer row`);
    assert.ok(near(bands.hud + bands.battlefield + bands.hand, height / zoom), `${at}: bands fill the host`);
    assert.ok(bands.battlefield * zoom >= 92 + 3.5 * 16 - 1e-6, `${at}: one readable combatant`);
    assert.ok(bands.hand * zoom <= 208 + 1e-6, `${at}: hand never grows past its stacked minimum`);
    assert.ok(bands.hand >= minimumHandHeight(16 / zoom) - 1e-6, `${at}: hand keeps a whole minimum card`);
    const rails = bands.rails;
    for (const size of [rails.diameter, rails.pileWidth, rails.pileHeight, rails.endWidth, rails.endHeight]) {
      assert.ok(size * zoom >= 44 - 1e-9, `${at}: every rail control is a 44 px target`);
    }
    assert.ok(rails.pileWidth * zoom >= 64 - 1e-9, `${at}: piles keep the readable floor`);
    assert.ok(rails.height <= bands.hand + 1e-6, `${at}: rails fit the hand band`);
    assert.ok(near(rails.railWidth * 2 + rails.gap * 2 + rails.handWidth, width / zoom), `${at}: rails and hand fill the width`);
  }
});

test('844x390 matches the measured reference numbers', () => {
  const bands = plan(844, 390, 0.62);
  const z = 0.62;
  assert.ok(near(bands.hud * z, 39));
  assert.ok(near(bands.battlefield * z, 148));
  assert.ok(near(bands.hand * z, 203));
  assert.ok(near(bands.rails.diameter * z, 53.2) && near(bands.rails.pileWidth * z, 64));
});

test('the hand between the rails exposes five minimum cards at the touch target', () => {
  for (const [width, height, zoom] of [[844, 390, 0.62], [740, 360, 0.62], [667, 375, 0.62]]) {
    const bands = plan(width, height, zoom);
    const rem = 16 / zoom;
    const hand = handLayout({ width: bands.rails.handWidth, height: bands.hand, count: 5, rem, zoom });
    assert.ok(hand.cardWidth >= wireframeUi.hand.minWidthRem * rem - 1e-6, 'card keeps its minimum width');
    assert.ok(hand.step * zoom >= 44 - 1e-6, 'each card exposes a touch target');
    assert.ok(hand.span <= bands.rails.handWidth + 1e-6, 'five cards fit without a scroller');
    assert.ok(hand.top + hand.cardHeight <= bands.hand + 1e-6, 'the card stays inside the band');
    assert.ok(hand.top >= hand.lift - 1e-6, 'selection lift stays inside the band');
  }
});

test('notch insets narrow the rails plan without breaking it', () => {
  // 47 physical px each side: an iPhone's landscape safe area. The adapter
  // passes the width left between the insets.
  for (const [width, height, zoom] of [[844, 390, 0.62], [915, 412, 0.62], [740, 360, 0.62], [667, 375, 0.62]]) {
    const at = `${width}x${height}`;
    const inner = (width - 47 * 2) / zoom;
    const bands = allocateCombatBands({ width: inner, height: height / zoom, zoom, rem: 16 / zoom });
    const open = plan(width, height, zoom);
    assert.equal(bands.arrangement, 'rails', at);
    assert.equal(bands.supported, true, at);
    assert.ok(near(bands.rails.railWidth * 2 + bands.rails.gap * 2 + bands.rails.handWidth, inner), `${at}: rails and hand fill the safe width`);
    assert.ok(near(open.rails.handWidth - bands.rails.handWidth, 94 / zoom), `${at}: only the hand gives up the insets`);
    assert.deepEqual([bands.hud, bands.battlefield, bands.hand], [open.hud, open.battlefield, open.hand], `${at}: heights unchanged`);
    const rem = 16 / zoom;
    const hand = handLayout({ width: bands.rails.handWidth, height: bands.hand, count: 5, rem, zoom });
    assert.ok(hand.span <= bands.rails.handWidth + 1e-6 && hand.step * zoom >= 44 - 1e-6, `${at}: five cards still fit at the touch target`);
  }
});

test('portrait and desktop plan exactly as before', () => {
  for (const [width, height, zoom] of [[1440, 860, 1.18], [1280, 800, 1.07], [390, 844, 0.9], [375, 667, 0.85], [360, 780, 0.83]]) {
    const withWidth = plan(width, height, zoom);
    const heightOnly = allocateCombatBands({ height: height / zoom, zoom, rem: 16 / zoom });
    assert.deepEqual(withWidth, heightOnly, `${width}x${height}`);
    assert.equal(withWidth.arrangement, 'stacked');
    assert.equal(withWidth.supported, true);
  }
});

test('hosts that still cannot fit are reported, not squeezed', () => {
  // Too short even for rails: the hand would have to drop below one card.
  const short = plan(844, 330, 0.62);
  assert.equal(short.arrangement, 'rails');
  assert.equal(short.supported, false);
  assert.ok(short.hand >= minimumHandHeight(16 / 0.62) - 1e-6, 'the hand is not shrunk to fake a fit');
  // Too narrow for rails plus five exposed cards: stays stacked and unsupported.
  const narrow = plan(440, 390, 1);
  assert.equal(narrow.arrangement, 'stacked');
  assert.equal(narrow.supported, false);
});

test('rails can be switched off in configuration', () => {
  const config = { ...wireframeUi, combat: { ...wireframeUi.combat, shortHostRails: false } };
  const bands = allocateCombatBands({ width: 844, height: 390 }, config);
  assert.equal(bands.arrangement, 'stacked');
  assert.equal(bands.supported, false);
});

test('rail geometry follows the footer configuration', () => {
  const rails = packCombatRails({ width: 844 });
  const footer = wireframeUi.footer;
  assert.ok(near(rails.gap, footer.gapRem * 16));
  assert.ok(near(rails.diameter, wireframeUi.combat.footerMinimumPx * footer.heightFraction));
  assert.ok(near(rails.railWidth, rails.diameter + rails.gap + rails.pileWidth));
  assert.ok(near(rails.endWidth, rails.railWidth) && near(rails.endHeight, rails.diameter));
  assert.ok(near(rails.height, rails.diameter * 2 + rails.gap));
});
