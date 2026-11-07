// Owner 2026-11-07: on a phone the hand's cards fill the full width (no count-based overlap rule).
import test from 'node:test';
import assert from 'node:assert/strict';
import { handLayout, responsiveHandLayout, RESPONSIVE_HAND } from '../src/ui/models/HandLayout.js';

const plan = (formFactor, width, height, count, compact = false) => {
  const input = { width, height, count, rem: 16, zoom: 1, compact, controlsHeight: 0, headroom: 0, formFactor };
  return responsiveHandLayout(input, handLayout(input));
};

test('mobile fan touches both side insets whenever the full-width step fits within one card', () => {
  for (const count of [3, 5, 8, 12]) {
    const p = plan('mobile', 412, 260, count, true);
    const edge = p.start - p.restLeft; // rotated-corner overhang; side = max(2, edge + 2)
    const inset = Math.max(2, edge + 2);
    const fill = (412 - p.cardWidth - inset * 2) / (count - 1);
    if (fill <= p.cardWidth) {
      assert.ok(Math.abs(p.start - inset) <= 1, `count ${count}: start ${p.start} vs ${inset}`);
      assert.ok(Math.abs(p.start + p.span - (412 - inset)) <= 1, `count ${count}: right edge ${p.start + p.span}`);
    } else {
      assert.equal(p.step, p.cardWidth, `count ${count}: capped at one card width`);
      assert.ok(Math.abs(p.start - (412 - p.span) / 2) <= 1e-9, `count ${count}: centred`);
    }
  }
});

test('a short mobile hand is capped at one card width apart and stays centred', () => {
  for (const count of [2, 3]) {
    const p = plan('mobile', 412, 260, count, true);
    assert.equal(p.step, p.cardWidth);
    assert.ok(Math.abs(p.start - (412 - p.span) / 2) <= 1e-9);
  }
});

test('mobile no longer carries a count-based spread', () => {
  assert.equal(RESPONSIVE_HAND.mobile.spread, undefined);
});

test('tablet, desktop and widescreen eight-card fans are unchanged', () => {
  const pins = {
    tablet: [820, 300, 137.76000000000002, 69.70165927436737, 97.16419253971418],
    desktop: [1280, 216, 117.33333333333333, 63.07689839482528, 360.56418895144486],
    widescreen: [1920, 324, 184, 98.91604521006691, 521.7938417647658],
  };
  for (const [ff, [w, h, cw, step, start]] of Object.entries(pins)) {
    const p = plan(ff, w, h, 8);
    assert.ok(Math.abs(p.cardWidth - cw) < 1e-6, `${ff} cardWidth ${p.cardWidth}`);
    assert.ok(Math.abs(p.step - step) < 1e-6, `${ff} step ${p.step}`);
    assert.ok(Math.abs(p.start - start) < 1e-6, `${ff} start ${p.start}`);
  }
});
