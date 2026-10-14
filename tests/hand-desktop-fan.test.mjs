// The desktop and widescreen hand (owner, 2026-10-13: "the hand on desktop is way
// too big; it should have more battlefield and larger sprites"). The wide form
// factors no longer have a desktop fan: they take the one hand plan every form
// factor uses, with the card sized by the hand band (30% of the viewport) and
// the shared 11.5rem cap, not the retired 15rem desktop cap. The battlefield
// gets the reclaimed height.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMBAT_TOOLS_HEIGHT_PX, handLayout } from '../src/ui/models/HandLayout.js';
import { uiConfig } from '../src/config/generated/ui.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

// A wide host's hand as hand.js plans it: the band is `bandPx` physical px tall,
// and with its tool row in the corners (desktop) no row is reserved above the cards.
const wide = ({ width, zoom, bandPx, count = 5, controlsHeight = 0 }) => {
  const rem = Math.max(16 / zoom, 10);
  return {
    zoom, rem,
    plan: handLayout({ width: width / zoom, height: bandPx / zoom, count, rem, zoom, controlsHeight, headroom: 0 }),
  };
};
const hosts = [[1280, .99, 216], [1440, 1.2, 270], [1920, 1.48, 324]];

test('the desktop fan is retired: handLayout has no desktop flag and hand.js sends none', () => {
  const layoutSource = readFileSync(new URL('../src/ui/models/HandLayout.js', import.meta.url), 'utf8');
  assert.doesNotMatch(layoutSource, /desktop\s*=\s*false|DESKTOP_FAN|fan = desktop/);
  const handSource = readFileSync(new URL('../src/ui/components/hand.js', import.meta.url), 'utf8');
  assert.doesNotMatch(handSource, /wideFan|isWideFormFactor/);
  assert.match(handSource, /headroom: compact \? toolsHeight : 0 \}\);/);
  assert.match(handSource, /const toolsRow = desktop \? /, 'the desktop tool-row check stays where it was');
});

test('below the cap the wide card fills the hand band in the phone proportion, and scales with it', () => {
  // 1280x720 and 1440x900 hands are under the cap: the card height is the same share of the band.
  const a = wide({ width: 1280, zoom: .99, bandPx: 216 }).plan;
  const b = wide({ width: 1440, zoom: 1.2, bandPx: 270 }).plan;
  const shareA = a.cardHeight / (216 / .99), shareB = b.cardHeight / (270 / 1.2);
  assert.ok(Math.abs(shareA - shareB) / shareB < .1, `card share of band ${shareA} vs ${shareB}`);
  assert.ok(shareA > .7 && shareA < 1, `card fills most of its band: ${shareA}`);
});

test('no wide card reaches the retired 15rem cap, and the shared 11.5rem cap still applies', () => {
  for (const [width, zoom, bandPx] of hosts) {
    const { plan, rem } = wide({ width, zoom, bandPx });
    assert.ok(plan.cardWidth <= wireframeUi.hand.maxWidthRem * rem + 1e-6, `${width}: card under the shared 11.5rem cap`);
    assert.ok(plan.cardWidth < 15 * rem, `${width}: no 15rem card`);
    assert.equal(uiConfig.scenes.w4a.sizing.hand.desktopMaxWidthRem, undefined, 'the desktop cap key is retired');
  }
});

// Retired desktop cards measured on origin/dev at the same two sizes (the
// 38% desktop band): 155x225 px at 1280x720 and 249x361 px at 1920x1080.
test('the wide card is smaller than the retired desktop card, and the battlefield gets the height', () => {
  const small = wide({ width: 1280, zoom: .99, bandPx: 216 }).plan;
  const large = wide({ width: 1920, zoom: 1.48, bandPx: 324 }).plan;
  assert.ok(small.cardWidth * .99 < 155 && small.cardHeight * .99 < 225, `1280 card ${small.cardWidth * .99}x${small.cardHeight * .99}`);
  assert.ok(large.cardWidth * 1.48 < 249 && large.cardHeight * 1.48 < 361, `1920 card ${large.cardWidth * 1.48}x${large.cardHeight * 1.48}`);
  assert.ok(large.cardHeight * 1.48 <= 324 + 1e-6, 'the card fits inside the new 30% band');
});

test('a seven-card wide hand still fits the width', () => {
  for (const [width, zoom, bandPx] of hosts) {
    const { plan } = wide({ width, zoom, bandPx, count: 7 });
    assert.equal(plan.cards.length, 7);
    assert.ok(plan.cards[0].x * zoom >= -1e-9, `${width}: left edge inside`);
    assert.ok((plan.cards.at(-1).x + plan.cardWidth) * zoom <= width + 1e-6, `${width}: right edge inside`);
  }
});

test('the phone and tablet hands are unchanged by the retirement', () => {
  // The non-wide path is the one the tablet always took; compact is the phone's.
  const tablet = handLayout({ width: 1000, height: 260, count: 5, rem: 16, zoom: 1, headroom: 0 });
  assert.ok(tablet.cardWidth <= wireframeUi.hand.maxWidthRem * 16 + 1e-6, 'tablet cards keep the 11.5rem cap');
  const phone = handLayout({ width: 390, height: 230, count: 5, rem: 16, zoom: 1, compact: true, headroom: 34 });
  assert.ok(phone.cardWidth <= uiConfig.scenes.w4a.sizing.compactCombat.cardMaxWidthPx + 1e-6, 'phone cards keep the compact cap');
});
