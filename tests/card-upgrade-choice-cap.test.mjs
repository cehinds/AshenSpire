// A configured choice cap decides how many options a plan may show.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { CardUpgradeRules } from '../src/model/cardUpgradeRules.js';

const ProfileUnlocks = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const RequestedChoices = 4;

function WithOffers(offers)
{
  const rules = CardUpgradeRules(registries);
  return {
    ...registries,
    balance: {
      ...registries.balance,
      cardUpgrades: {
        ...rules,
        offers: {
          ...rules.offers,
          ...offers,
        },
      },
    },
  };
}

test('the configured choice cap limits a plan, and raising it allows more options', () =>
{
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: ProfileUnlocks });
  const strike = run.deck.find(card => card.cardId === 'core.strike');
  const optionCount = (subject) =>
  {
    const plan = planCardUpgrade(run, subject, strike.instanceId, { choices: RequestedChoices });
    return (plan.options || []).length;
  };
  const authoredCap = CardUpgradeRules(registries).offers.maxChoices;
  assert.equal(optionCount(registries), authoredCap);
  assert.equal(optionCount(WithOffers({ maxChoices: RequestedChoices })), RequestedChoices);
});
