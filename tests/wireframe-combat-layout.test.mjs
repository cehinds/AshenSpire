import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCombatBands, packCombatFooter } from '../src/ui/models/CombatLayout.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;

test('tall hosts receive the nominal 10/55/30/5 bands', () => {
  const bands = allocateCombatBands({ height: 2000 });
  assert.ok(near(bands.hud, 200) && near(bands.battlefield, 1100) && near(bands.hand, 600) && near(bands.footer, 100));
  assert.equal(bands.supported, true);
});

test('hand and footer keep physical minimums; the battlefield absorbs them', () => {
  for (const [height, zoom] of [[860, 1], [667, 1], [780, 1], [667, 1.5], [860, 0.67]]) {
    const local = height / zoom;
    const bands = allocateCombatBands({ height: local, zoom, rem: 16 / zoom });
    assert.ok(bands.hand * zoom >= 208 - 1e-9, `hand at ${height}@${zoom}`);
    assert.ok(bands.footer * zoom >= 56 - 1e-9, `footer at ${height}@${zoom}`);
    assert.ok(near(bands.hud + bands.battlefield + bands.hand + bands.footer, local));
  }
  for (const height of [860, 667, 780]) assert.equal(allocateCombatBands({ height }).supported, true, `portrait/wide ${height}`);
});

test('compact landscape is reported, not silently squeezed', () => {
  // 844x390: the minimums leave too little battlefield for one readable actor.
  const bands = allocateCombatBands({ height: 390 });
  assert.equal(bands.supported, false);
  assert.ok(bands.hand >= 208 && bands.footer >= 56);
});

test('band shares must describe the whole host', () => {
  const broken = { ...wireframeUi, combat: { ...wireframeUi.combat, bands: [10, 55, 30, 10] } };
  assert.throws(() => allocateCombatBands({ height: 800 }, broken), /summing to 100/);
});

test('footer tracks respect envelopes, touch targets, and never exceed the host', () => {
  const config = wireframeUi.footer;
  for (const width of [320, 360, 375, 390, 844, 1440, 1920]) for (const zoom of [0.67, 1, 1.5]) {
    const local = width / zoom, rem = 16 / zoom;
    const height = 56 / zoom;
    const plan = packCombatFooter({ width: local, height, zoom, rem });
    const available = local - plan.gap * 4;
    assert.ok(plan.diameter * zoom >= 44 - 1e-9, `circle ${width}@${zoom}`);
    assert.ok(plan.pileWidth * zoom >= 44 - 1e-9 && plan.pileHeight * zoom >= 44 - 1e-9);
    assert.ok(plan.pileWidth >= config.pileMinimumRem * rem - 1e-9, 'pile keeps its readable floor');
    assert.ok(plan.diameter <= Math.max(plan.target, height * config.heightFraction) + 1e-9);
    assert.ok(plan.endWidth <= available * config.endMaxFraction + 1e-9);
    assert.ok(near(plan.endHeight, plan.diameter), 'End Turn shares the circle height');
    if (plan.supported) assert.ok(plan.groupWidth <= local + 1e-6, `group fits ${width}@${zoom}`);
  }
});

test('wide footers stay packed at their envelopes', () => {
  const plan = packCombatFooter({ width: 1440, height: 56, rem: 16 });
  const available = 1440 - plan.gap * 4;
  assert.ok(near(plan.diameter, 56 * 0.95));
  assert.ok(near(plan.pileWidth, available * 0.1) && near(plan.endWidth, available * 0.4));
  assert.ok(plan.groupWidth < 1440, 'leftover width centers the group');
});

test('a host too narrow for the floors is reported, not overflowed', () => {
  // ~260 px physical (a fold cover screen): circles, pile floors and End Turn
  // cannot all keep their minimums, so the packed grid must not apply.
  const plan = packCombatFooter({ width: 260, height: 56, rem: 16 });
  assert.equal(plan.supported, false);
});
