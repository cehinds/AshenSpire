// An upgrade cannot raise the weighted price to play a card. The cost-swap
// step trades 1 MP for 2 SP. Other steps cannot raise Stamina spent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { resolvedCardPlayCosts } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { planCardUpgrade, commitCardUpgrade } from '../src/model/cardUpgradeService.js';
import { multiHitSpFloor } from '../src/model/actionCosts.js';
import { core2MultiHitRulesEnabled } from '../src/model/core2ActionPolicy.js';
import { FlatSteps } from '../src/model/cardUpgrade.js';

const newRun = (seed) => createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const price = (def) => Math.max(def.staminaCost ?? def.cost ?? 0, multiHitSpFloor(def, { mana: def.manaCost ?? 0 }));
const weightedPrice = (def) => price(def) + 2 * (def.manaCost ?? 0);

test('every step of every Core card in the deck, over many seeds, leaves the play price no higher', () => {
  let steps = 0, exchanges = 0;
  for (let seed = 1; seed <= 30; seed += 1) {
    const run = newRun(seed); run.smithingStones = 99;
    for (const card of run.deck) {
      if (card.sourceArmamentId || card.grantedBy) continue;
      card.rank = 3;
      for (let i = 0; i < 6; i += 1) {
        const quote = planCardUpgrade(run, registries, card.instanceId);
        if (!quote.step) break;
        const where = `${card.cardId} seed ${seed} step ${JSON.stringify(quote.step)}`;
        assert.ok(weightedPrice(quote.after) <= weightedPrice(quote.before), `${where}: weighted price rose`);
        if (FlatSteps([quote.step]).some((step) => step.k === 'costSwap')) exchanges += 1;
        else assert.ok(price(quote.after) <= price(quote.before), `${where}: Stamina price rose`);
        commitCardUpgrade(run, registries, quote); steps += 1;
      }
    }
  }
  assert.ok(steps > 200);
  assert.ok(exchanges > 0, 'the seeded service quotes include cost swaps');
});

test('real combat: the SP an upgraded Strike spends is never above the base Strike', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const run = newRun(seed); run.smithingStones = 99;
    const card = run.deck.find((c) => c.cardId === 'core.strike');
    const spend = () => {
      const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
      const inst = [...combat.piles.hand, ...combat.piles.draw, ...combat.piles.discard].find((c) => c.instanceId === card.instanceId);
      return { combat, cost: resolvedCardPlayCosts(combat, resolveCombatCard(combat, inst)) };
    };
    const base = spend();
    assert.equal(core2MultiHitRulesEnabled(base.combat), true, 'the Core 2 multi-hit rule is on in this fight');
    for (let i = 0; i < 4; i += 1) {
      const quote = planCardUpgrade(run, registries, card.instanceId);
      if (!quote.step) break;
      commitCardUpgrade(run, registries, quote);
      const after = spend();
      assert.ok(after.cost.stamina <= base.cost.stamina, `seed ${seed} step ${JSON.stringify(quote.step)}: ${base.cost.stamina} -> ${after.cost.stamina}`);
    }
  }
});
