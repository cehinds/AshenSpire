import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRunPotion, runPotionPlan, runPotionVerb } from '../src/ui/models/RunPotionModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';
import { t } from '../src/ui/strings.js';

const charge = (count) => ({ key: 'charge:hp', category: 'charge', kind: 'hp', flaskId: null, count, slots: [] });
const carried = (flaskId, count = 1) => ({ key: `carried:${flaskId}`, category: 'carried', kind: null, flaskId, count, slots: [0] });

test('a charge flask is drunk on the map only with the setting on and a charge left, and never dropped', () => {
  const off = runPotionVerb(charge(2), runPotionPlan(charge(2), { drinkOutsideCombat: false }));
  assert.deepEqual([off.id, off.enabled, off.reason], ['use', false, t('potions.run.setting')]);
  const on = runPotionVerb(charge(2), runPotionPlan(charge(2), { drinkOutsideCombat: true }));
  assert.deepEqual([on.id, on.enabled], ['use', true]);
  const dry = runPotionVerb(charge(0), runPotionPlan(charge(0), { drinkOutsideCombat: true }));
  assert.deepEqual([dry.enabled, dry.reason], [false, t('potions.run.empty')]);
  const drop = runPotionPlan(charge(2), { drinkOutsideCombat: true }).actions.find((a) => a.id === 'drop');
  assert.deepEqual([drop.enabled, drop.reason], [false, t('potions.run.keep')]);
});

test('a carried potion is combat-only on the map, and its verb is Drop', () => {
  const plan = runPotionPlan(carried('smoke'), { drinkOutsideCombat: true });
  assert.equal(plan.actions.find((a) => a.id === 'use').enabled, false);
  assert.equal(plan.actions.find((a) => a.id === 'use').reason, t('potions.run.combatOnly'));
  const verb = runPotionVerb(carried('smoke'), plan);
  assert.deepEqual([verb.id, verb.enabled], ['drop', true]);
});

test('Drop removes one potion of that kind, the first slot holding it; nothing else changes the run', () => {
  const run = { flasks: [{ flaskId: 'crimsonFlask' }, { flaskId: 'smoke' }, { flaskId: 'smoke' }] };
  const entry = carried('smoke', 2);
  const plan = runPotionPlan(entry, {});
  assert.equal(applyRunPotion({ registries: null, run, entry, actionId: 'drop', plan }), true);
  assert.deepEqual(run.flasks.map((f) => f.flaskId), ['crimsonFlask', 'smoke']);
  // A refused or mismatched verb is a no-op.
  assert.equal(applyRunPotion({ registries: null, run, entry, actionId: 'use', plan }), false);
  const refused = runPotionPlan(charge(1), { drinkOutsideCombat: false });
  assert.equal(applyRunPotion({ registries: null, run, entry: charge(1), actionId: 'use', plan: refused }), false);
  assert.equal(applyRunPotion({ registries: null, run: { flasks: [] }, entry, actionId: 'drop', plan }), false);
  assert.equal(run.flasks.length, 2);
});

test('the tray timings are one config, and the camera glide outlasts the slide', () => {
  const { openDelayMs, slideMs, fadeMs, cameraMs } = wireframeUi.map.tray;
  for (const ms of [openDelayMs, slideMs, fadeMs, cameraMs]) assert.ok(Number.isFinite(ms) && ms > 0);
  assert.ok(cameraMs >= slideMs);
  assert.ok(Object.isFrozen(wireframeUi.map.tray));
});
