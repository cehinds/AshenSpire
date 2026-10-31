// The card-upgrade picker offers every upgradable owned card: the deck first, then the sideboard (inDeck flags which).
import test from 'node:test';
import '../src/engine/runCombat.js';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { commitCardUpgrade, planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { upgradeCount } from '../src/model/cardUpgrade.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
// Move one Strike out of the deck into the sideboard (a separate instance of the same card as the remaining deck Strikes).
const withSideboardStrike = () => {
  const run = newRun(); run.smithingStones = 5;
  const i = run.deck.findIndex((c) => c.cardId === 'core.strike');
  const [moved] = run.deck.splice(i, 1);
  run.sideboard = [moved];
  return { run, moved };
};

test('rows: a sideboard card is offered, after the deck rows, with inDeck false', () => {
  const { run, moved } = withSideboardStrike();
  const { rows } = cardUpgradeModel(registries, run);
  const side = rows.find((r) => r.instanceIds.includes(moved.instanceId));
  assert.ok(side, 'sideboard Strike is listed');
  assert.equal(side.inDeck, false);
  assert.ok(rows.some((r) => r.inDeck === true));
  const firstSide = rows.findIndex((r) => !r.inDeck);
  assert.equal(rows.slice(firstSide).every((r) => !r.inDeck), true, 'deck rows come before sideboard rows');
  // Same card id in deck and sideboard stays separate rows.
  assert.ok(rows.filter((r) => r.cardId === 'core.strike').length >= 2);
  assert.equal(rows.filter((r) => r.inDeck).every((r) => r.instanceIds.every((id) => run.deck.some((c) => c.instanceId === id))), true);
});

test('upgrading a sideboard instance upgrades that instance and persists', () => {
  const { run, moved } = withSideboardStrike();
  const row = cardUpgradeModel(registries, run).rows.find((r) => r.instanceIds.includes(moved.instanceId));
  commitCardUpgrade(run, registries, row.plan);
  assert.equal(upgradeCount(run.sideboard[0]), 1);
  assert.equal(run.sideboard[0].instanceId, moved.instanceId);
  assert.equal(run.deck.some((c) => upgradeCount(c) > 0), false);
  assert.equal(planCardUpgrade(run, registries, moved.instanceId).n, 2);
});
