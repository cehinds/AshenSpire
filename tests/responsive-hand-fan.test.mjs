import test from 'node:test';
import assert from 'node:assert/strict';
import { responsiveHandLayout, handLayout } from '../src/ui/models/HandLayout.js';
for (const [formFactor, width, height] of [['mobile',390,250],['tablet',820,300],['desktop',1440,340]]) {
  test(`${formFactor}: 3/5/7 cards fit and centre rises above the outer cards`, () => {
    const plans = [3,5,7].map(count => {
      const input = { formFactor, width, height, count, compact: formFactor === 'mobile' };
      const plan = responsiveHandLayout(input, handLayout(input));
      assert.ok(plan.cards[0].x >= 0);
      assert.ok(plan.cards.at(-1).x + plan.cardWidth <= width);
      assert.ok(plan.cards[Math.floor(count/2)].y < plan.cards[0].y);
      assert.ok(plan.step < plan.cardWidth, 'cards overlap');
      assert.equal(plan.capacity, count, 'all cards remain in the same viewport');
      return plan;
    });
    assert.ok(plans[0].step > plans[1].step);
    assert.ok(plans[1].step > plans[2].step);
  });
}
test('phone and tablet use independent physical card profiles', () => {
  for (const [formFactor,width,height,expected] of [['mobile',390,250,108.03],['tablet',820,300,137.76],['tablet',1024,210,113.333333]]) {
    const input={formFactor,width,height,count:5};
    const plan=responsiveHandLayout(input,handLayout(input));
    assert.ok(Math.abs(plan.cardWidth-expected)<.1, `${formFactor} ${width}: ${plan.cardWidth}`);
  }
});
