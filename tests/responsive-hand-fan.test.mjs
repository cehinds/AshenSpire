import test from 'node:test';
import assert from 'node:assert/strict';
import { responsiveHandLayout, handLayout } from '../src/ui/models/HandLayout.js';
import { desktopHandLayout } from '../src/ui/models/DesktopCombatFooter.js';
for (const [formFactor, width, height] of [['mobile',390,250],['tablet',820,300],['desktop',1440,340]]) {
  test(`${formFactor}: 3/5/7 cards fit and centre rises above the outer cards`, () => {
    const plans = [3,5,7].map(count => {
      const input = { formFactor, width, height, count, compact: formFactor === 'mobile' };
      const plan = responsiveHandLayout(input, handLayout(input));
      assert.ok(plan.cards[0].x >= 0);
      assert.ok(plan.cards.at(-1).x + plan.cardWidth <= width);
      assert.ok(plan.cards[Math.floor(count/2)].y < plan.cards[0].y);
      // Owner 2026-11-07: a phone's cards fill the full width, spaced up to one card width apart (touching, never a
      // gap); the other form factors keep their overlap.
      if (formFactor === 'mobile') assert.ok(plan.step <= plan.cardWidth + 1e-9, 'no gaps between cards');
      else assert.ok(plan.step < plan.cardWidth, 'cards overlap');
      assert.equal(plan.capacity, count, 'all cards remain in the same viewport');
      // The 66 px tool-row reserve holds on every handLayout path, desktop with the footer off included;
      // only the desktop footer plan (desktopHandLayout) docks the fan to the bottom, tested below.
      assert.ok(plan.top + plan.cardHeight + plan.cards[0].y < height - 30, 'tool row stays below resting fan');
      return plan;
    });
    assert.ok(plans[0].step > plans[1].step);
    assert.ok(plans[1].step > plans[2].step);
  });
}
// Wave 2 (sizes): the phone profile is 154 px (cap 158) and the tablet 150 to 160, so rules type reads at 13 px; a short hand band still bounds the face.
test('phone and tablet use independent physical card profiles', () => {
  for (const [formFactor,width,height,expected] of [['mobile',390,250,140],['tablet',820,300,160],['tablet',1024,210,113.333333]]) {
    const input={formFactor,width,height,count:5};
    const plan=responsiveHandLayout(input,handLayout(input));
    assert.ok(Math.abs(plan.cardWidth-expected)<.1, `${formFactor} ${width}: ${plan.cardWidth}`);
  }
});

test('desktop footer plan docks the fan to the hand box bottom; the classic desktop path keeps its reserve', () => {
  const input = { formFactor: 'desktop', width: 1440, height: 160, count: 5, zoom: 1 };
  const footer = responsiveHandLayout(input, desktopHandLayout(input));
  const classic = responsiveHandLayout(input, handLayout(input));
  const bottom = (plan) => plan.top + plan.cardHeight + plan.cards[0].y;
  // The outer cards' tilt leaves a few px; nothing else is reserved.
  assert.ok(bottom(footer) > 160 - 5, `footer fan reaches the bottom: ${bottom(footer)}`);
  assert.ok(bottom(classic) < 160 - 30, `classic fan keeps the tool-row reserve: ${bottom(classic)}`);
});
