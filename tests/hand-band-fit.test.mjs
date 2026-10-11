import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';
import { COMBAT_TOOLS_HEIGHT_PX, handLayout, compactHandBandHeight, requestedHandCapacity } from '../src/ui/models/HandLayout.js';
import { uiConfig } from '../src/config/generated/ui.js';

// Owner (2026-10-11): on taller phones a width-bound fan (4-5 cards) left a
// 49-81px empty strip under the cards because the band kept a full-size
// card's height. The band now holds the readable fan and no more.
const phones = [[360, 620, .79], [360, 780, .83], [390, 844, .9]];
const { upcastReservePx, handMinimumPx } = uiConfig.scenes.w4a.sizing.compactCombat;

test('a phone band leaves no empty strip under a full readable fan', () => {
  for (const [vw, vh, zoom] of phones) {
    const width = vw / zoom, height = vh / zoom, rem = 16 / zoom;
    const bands = allocateCombatBands({ width, height, zoom, rem, compact: true });
    const tools = COMBAT_TOOLS_HEIGHT_PX / zoom;
    for (const count of [3, 4, 5, 7]) {
      const plan = handLayout({ width, height: bands.hand - tools, count, rem, zoom, compact: true,
        controlsHeight: upcastReservePx / zoom, headroom: tools });
      // Below the resting fan: at most the arc, rotation, inset and the
      // Upcast chooser's reserve, never a spare card's worth of height.
      const below = (bands.hand - tools - plan.top - plan.cardHeight) * zoom;
      assert.ok(below <= 34, `${vw}x${vh} ${count} cards: ${below.toFixed(1)}px under the cards`);
      // The selected face and its chooser still fit once it rises to the hand top.
      assert.ok(plan.cardHeight + upcastReservePx / zoom <= bands.hand + 1e-6, `${vw}x${vh} chooser fits`);
    }
  }
});

test('the band is the same for every hand size, so playing a card never moves the battlefield', () => {
  for (const [vw, vh, zoom] of phones) {
    const input = { width: vw / zoom, height: vh / zoom, zoom, rem: 16 / zoom, compact: true };
    const a = allocateCombatBands(input), b = allocateCombatBands(input);
    assert.deepEqual(a, b);
    // The band reads only the host: one card size for every count up to capacity.
    const tools = COMBAT_TOOLS_HEIGHT_PX / zoom;
    const widths = [1, 2, 3, 4, 5, 7].map(count => handLayout({ width: input.width, height: a.hand - tools, count, rem: input.rem, zoom,
      compact: true, controlsHeight: upcastReservePx / zoom, headroom: tools }).cardWidth);
    const capacity = requestedHandCapacity(input.width, input.rem);
    assert.ok(Math.max(...widths) - Math.min(...widths) < 4 / zoom, `${vw}x${vh} card widths ${widths.map(x => (x * zoom).toFixed(1))} (capacity ${capacity})`);
  }
});

test('the taller phone gives the reclaimed height to the battlefield', () => {
  const zoom = .83, input = { width: 360 / zoom, height: 780 / zoom, zoom, rem: 16 / zoom, compact: true };
  const bands = allocateCombatBands(input);
  assert.ok(bands.hand * zoom < 242 - 40, `hand ${bands.hand * zoom}px`);
  assert.ok(bands.hand * zoom >= handMinimumPx - 1e-6);
  assert.ok(Math.abs(bands.hud + bands.battlefield + bands.hand + bands.footer - input.height) < 1e-6);
  assert.ok(Math.abs(bands.hand - Math.max(handMinimumPx / zoom, compactHandBandHeight(input))) < 1e-6);
});
