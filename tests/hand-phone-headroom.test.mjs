import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_TOOLS_HEIGHT_PX, handLayout } from '../src/ui/models/HandLayout.js';

// Owner's phone report (2026-10-11): on a ~360x620 game viewport the cards sat
// at the 72px floor under an empty lift band and an empty chooser reserve. On a
// phone the selected card rises over the tool row (the row paints under cards),
// so that row is headroom the fan does not reserve twice.
const phone = ({ zoom = .79, clientHeight = 243, controlsHeight = 64, count = 4 } = {}) => {
  const tools = COMBAT_TOOLS_HEIGHT_PX / zoom;
  return { width: 360 / zoom, height: clientHeight - tools, count, rem: 16 / zoom, zoom, compact: true, controlsHeight, tools };
};

test('no headroom keeps the plan exactly as before (desktop and tablet pass none)', () => {
  for (const controlsHeight of [0, 52, 100]) {
    const input = { width: 1200, height: 270, count: 5, rem: 16, zoom: 1, controlsHeight };
    assert.deepEqual(handLayout({ ...input, headroom: 0 }), handLayout(input));
  }
});

test('phone cards take the tool-row headroom instead of an empty lift band', () => {
  for (const controlsHeight of [0, 64]) {
    const { tools, ...input } = phone({ controlsHeight });
    const before = handLayout(input);
    const after = handLayout({ ...input, headroom: tools });
    assert.ok(after.cardWidth > before.cardWidth + 1, `cards grow (${before.cardWidth} -> ${after.cardWidth})`);
    // The resting fan starts at the inset, right under the row.
    assert.ok(after.top <= Math.max(before.top - before.lift + 1e-9, input.rem * .25 + 2));
    // A selected face, lifted, stays inside the hand (the row's band included).
    for (const card of after.cards) assert.ok(after.top + card.y - after.lift >= -tools - 1e-9);
    // Its chooser fits once the face rises at most to the hand's top edge.
    assert.ok(after.cardHeight + controlsHeight <= input.height + tools + 1e-9, 'face and chooser fit the band');
    assert.ok(after.clearanceTop >= -tools - 1e-9);
  }
});

test('a full phone hand still fits 360px with a finger-sized lane per card', () => {
  const { tools, ...input } = phone({ count: 5 });
  const plan = handLayout({ ...input, headroom: tools });
  assert.ok(plan.step * input.zoom >= 44 - 1e-9);
  assert.ok((plan.start + plan.span) <= input.width + 1e-9, 'the fan ends inside the hand');
  assert.ok(plan.top + plan.cardHeight + plan.controlsReserve <= input.height + 1e-9);
});

test('a short tall-phone hand fills its band past the old 100px card cap, up to the authored cap', async () => {
  const { uiConfig } = await import('../src/config/generated/ui.js');
  const { cardMaxWidthPx } = uiConfig.scenes.w4a.sizing.compactCombat;
  // 390x844 at zoom .9: a 250px hand band, the owner's three-card hand.
  const { tools, ...input } = phone({ zoom: .9, clientHeight: 250 / .9, controlsHeight: 57, count: 3 });
  const plan = handLayout({ ...input, headroom: tools });
  assert.ok(plan.cardWidth * input.zoom > 100, `card ${plan.cardWidth * input.zoom}px`);
  assert.ok(plan.cardWidth * input.zoom <= cardMaxWidthPx + 1e-9);
});

// Coordinator review (2026-10-11): at 112px a 4-card hand on 360x780 hid its
// neighbours' description and type lines, and the outer card touched the edge.
test('a phone fan keeps each card readable past its neighbour and clear of the edges', async () => {
  const { uiConfig } = await import('../src/config/generated/ui.js');
  const { cardVisibleFraction, cardSideGutterPx, cardMinWidthPx } = uiConfig.scenes.w4a.sizing.compactCombat;
  for (const [vw, zoom, clientHeight] of [[360, .79, 243], [360, .83, 291], [390, .9, 278]]) {
    for (const count of [2, 3, 4, 5]) {
      const tools = COMBAT_TOOLS_HEIGHT_PX / zoom;
      const input = { width: vw / zoom, height: clientHeight - tools, count, rem: 16 / zoom, zoom, compact: true, controlsHeight: 64, headroom: tools };
      const plan = handLayout(input);
      const floor = plan.cardWidth * zoom <= cardMinWidthPx + 1e-9;
      if (count > 1 && !floor) assert.ok(plan.step >= plan.cardWidth * cardVisibleFraction - 1e-9,
        `${vw}px ${count} cards: step ${plan.step} for a ${plan.cardWidth} card`);
      // Outer rotated corners keep the gutter on both sides.
      const half = (Math.cos(2.5 * Math.PI / 180) * plan.cardWidth + Math.sin(2.5 * Math.PI / 180) * plan.cardHeight) / 2;
      const left = plan.cards[0].x + plan.cardWidth / 2 - half;
      const right = plan.cards.at(-1).x + plan.cardWidth / 2 + half;
      assert.ok(left >= cardSideGutterPx / zoom - 1e-6, `${vw}px ${count} cards: left edge ${left * zoom}px`);
      assert.ok(right <= input.width - cardSideGutterPx / zoom + 1e-6, `${vw}px ${count} cards: right edge ${(input.width - right) * zoom}px`);
    }
  }
});
