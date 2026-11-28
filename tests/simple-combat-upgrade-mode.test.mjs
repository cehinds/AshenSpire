// progression.upgradeMode (docs/design/SIMPLE-COMBAT-PLAN.md step 1): "authored" gives a card one
// upgrade, its own block, and no rolled or rank-up options; "rolled" (Core today) keeps them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { rankUpBonusOn, rankUpBonusOptions } from '../src/model/rankUpBonus.js';
import { RankUpBlock } from '../src/model/rankUpService.js';
import {
  SimpleCombatFixture,
  SimpleCombatRegistries,
  SimpleCombatRun,
} from './helpers/simple-combat.mjs';

const AUTHORED_UPGRADES = 'authoredUpgrades';
const AUTHORED_KIND = 'authored';
const CHOICES = SimpleCombatFixture.upgradeProbe.choices;
const RANKED = SimpleCombatFixture.upgradeProbe.rank;

function upgradeProbe(overrideName)
{
  const registries = SimpleCombatRegistries(overrideName);
  const run = SimpleCombatRun(registries);
  const instance = run.deck.find(card => registries.cards.get(card.cardId)?.upgrade);
  const definition = registries.cards.get(instance.cardId);
  const upgraded = {
    ...instance,
    upgraded: true,
    upgradeSteps: [
      {
        k: AUTHORED_KIND,
      },
    ],
  };
  const rankedUpgraded = {
    ...upgraded,
    rank: RANKED,
  };
  return {
    rankUpBlock: RankUpBlock(run, rankedUpgraded, registries),
    first: nextUpgradeOptions(run, instance, definition, registries, CHOICES),
    second: nextUpgradeOptions(run, upgraded, definition, registries, CHOICES),
    rankUpOn: rankUpBonusOn(run),
    rankUp: rankUpBonusOptions(registries, run, instance),
  };
}

test('progression.upgradeMode rolled: the authored block plus rolled options and rank-up picks', () =>
{
  const probe = upgradeProbe(null);
  assert.equal(probe.first[0].k, AUTHORED_KIND, 'the authored block is offered first');
  assert.ok(probe.first.length > 1, 'a rolled alternative is offered too');
  assert.ok(probe.second.length > 0, 'a second upgrade rolls');
  assert.equal(probe.rankUpOn, true);
  assert.ok(probe.rankUp.length > 0, 'a rank-up offers bonus picks');
  assert.notEqual(probe.rankUpBlock, '', 'a ranked card with one upgrade still has slots to fill');
});

test('progression.upgradeMode authored: one upgrade, the authored block only', () =>
{
  const probe = upgradeProbe(AUTHORED_UPGRADES);
  assert.deepEqual(probe.first, [{ k: AUTHORED_KIND }]);
  assert.deepEqual(probe.second, [], 'nothing after the authored upgrade');
  assert.equal(probe.rankUpOn, false);
  assert.deepEqual(probe.rankUp, []);
  assert.equal(probe.rankUpBlock, '', 'the authored upgrade fills the card, so it may rank up');
});
