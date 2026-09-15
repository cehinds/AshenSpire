import test from 'node:test';
import assert from 'node:assert/strict';
import { planCombatantStack } from '../src/ui/models/CombatantStackModel.js';
import { planIconTray } from '../src/ui/models/IconTrayModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const { maxRows } = wireframeUi.combatantStack;

test('HP stands alone when nothing else is active', () => {
  const plan = planCombatantStack({ resources: ['hp'] });
  assert.deepEqual(plan.rows, ['hp']);
  assert.deepEqual([plan.bars, plan.promoted, plan.hidden], [[], [], []]);
  assert.throws(() => planCombatantStack({ resources: ['poise'] }), /requires an HP row/);
});

test('order is HP, resources, buildup, stance, icons, and excess buildup becomes icons', () => {
  const plan = planCombatantStack({ resources: ['hp', 'poise', 'arcaneExposure'], buildups: ['bleed', 'frost', 'insanity'], icons: 2 });
  assert.deepEqual(plan.rows, ['hp', 'poise', 'arcaneExposure', 'bleed', 'icons']);
  assert.deepEqual(plan.promoted, ['frost', 'insanity']);
  assert.equal(plan.rows.length, maxRows);
});

test('buildup stays a bar while it fits, and overflow opens an icon row', () => {
  const fits = planCombatantStack({ resources: ['hp', 'poise'], buildups: ['bleed', 'frost', 'insanity'] });
  assert.deepEqual(fits.rows, ['hp', 'poise', 'bleed', 'frost', 'insanity']);
  assert.deepEqual(fits.promoted, []);
  const over = planCombatantStack({ resources: ['hp', 'poise'], buildups: ['bleed', 'frost', 'insanity', 'blight'] });
  assert.deepEqual(over.rows, ['hp', 'poise', 'bleed', 'frost', 'icons']);
  assert.deepEqual(over.promoted, ['insanity', 'blight']);
});

test('stance and the icon row are reserved before optional bars', () => {
  const plan = planCombatantStack({ resources: ['hp', 'mana', 'stamina', 'poise'], stance: true, icons: 1 });
  assert.deepEqual(plan.rows, ['hp', 'mana', 'stamina', 'stance', 'icons']);
  assert.deepEqual(plan.hidden, ['poise']);
});

test('no combination exceeds the row budget or drops HP', () => {
  for (let r = 0; r < 4; r++) for (let b = 0; b < 5; b++) for (const stance of [false, true]) for (const icons of [0, 3]) {
    const resources = ['hp', ...Array.from({ length: r }, (_, i) => `r${i}`)];
    const buildups = Array.from({ length: b }, (_, i) => `b${i}`);
    const plan = planCombatantStack({ resources, buildups, stance, icons });
    assert.ok(plan.rows.length <= maxRows);
    assert.equal(plan.rows[0], 'hp');
    assert.equal(plan.bars.length + plan.promoted.length + plan.hidden.length, r + b, 'every active row is placed or reported');
  }
});

test('icon tray never wraps: excess collapses into a final +N tile', () => {
  const rem = 16, { iconRem, iconGapRem } = wireframeUi.iconTray;
  const pitch = (iconRem + iconGapRem) * rem;
  const fits = planIconTray({ count: 3, width: pitch * 3, rem });
  assert.deepEqual([fits.shown, fits.hidden], [3, 0]);
  const over = planIconTray({ count: 8, width: pitch * 4, rem });
  assert.deepEqual([over.capacity, over.shown, over.hidden], [4, 3, 5]);
  assert.equal(over.size, iconRem * rem);
  const tiny = planIconTray({ count: 2, width: 4, rem });
  assert.deepEqual([tiny.shown, tiny.hidden], [0, 2]);
});
