// The upgrade picker shows each option's rarity and its exact size (owner, 2026-11-19), and what it shows is what the card then does.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/engine/runCombat.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { cardUpgradeModel, UpgradeStepLook } from '../src/ui/models/CardUpgradeModel.js';
import { commitCardUpgrade, planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { rarityOfStep } from '../src/model/cardUpgradeSteps.js';

const newRun = (seed) => Object.assign(createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } }), { itemUpgradeLevels: { 'armament/greatsword': 9 } });
const damageOf = (def) => (def.effects || []).find((e) => e.op === 'damage')?.amount ?? 0;

test('every option carries its rarity and a size, for a rest-site row and a Blacksmith row alike', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed += 1) {
    const run = newRun(seed); run.smithingStones = 9;
    for (const blacksmith of [false, true]) {
      const model = cardUpgradeModel(registries, run, null, { blacksmith });
      for (const row of model.rows) {
        if (!row.plan.step) { assert.equal(row.look, null, 'a row with no step names no rarity'); continue; }
        assert.equal(row.look.rarity, rarityOfStep(row.plan.step), 'the row names the rarity of its step');
        for (const option of row.options) {
          assert.equal(option.look.rarity, rarityOfStep(option.step));
          assert.equal(option.look.rarityLabel, { common: 'Common upgrade', uncommon: 'Uncommon upgrade', rare: 'Rare upgrade' }[option.look.rarity]);
          seen.add(option.look.rarity);
          if (['dmg', 'blk'].includes(option.step.k)) assert.match(option.look.size, /^\+\d+ (damage|Block)$/);
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['common', 'rare', 'uncommon'], 'the three rarities all show up');
});

test('the size shown is the change the card then has (preview equals live)', () => {
  let checked = 0;
  for (let seed = 1; seed <= 60 && checked < 30; seed += 1) {
    const run = newRun(seed); run.smithingStones = 9;
    const card = run.deck.find((c) => c.cardId === 'core.strike');
    const quote = planCardUpgrade(run, registries, card.instanceId, { choices: 3, vendor: 'blacksmith' });
    const model = cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true });
    const row = model.rows.find((r) => r.instanceId === card.instanceId);
    row.options.forEach((option, i) => {
      const live = planCardUpgrade(run, registries, card.instanceId, { choices: 3, vendor: 'blacksmith' }).options[i];
      assert.deepEqual(option.step, live.step, 'the picker lists the steps the plan commits');
      const look = UpgradeStepLook(registries, live.step, quote.before, live.after);
      assert.deepEqual(option.look, look);
      const n = Number((look.size.match(/^\+(\d+)/) || [])[1]);
      if (live.step.k === 'dmg') { assert.equal(n, live.step.n); assert.equal(damageOf(live.after) - damageOf(quote.before), n, 'the damage the card shows rises by the size'); checked += 1; }
      if (live.step.k === 'tag' && live.step.packet) { assert.equal(n, live.step.packet); assert.equal(damageOf(live.after) - damageOf(quote.before), n, 'a packet adds exactly its size'); checked += 1; }
    });
    const chosen = row.options[row.options.length - 1];
    const receipt = commitCardUpgrade(run, registries, { ...quote, step: chosen.step });
    assert.deepEqual(receipt.step, chosen.step, 'committing the last option applies the one that was shown');
  }
  assert.ok(checked >= 10, `checked ${checked} sized options`);
});
