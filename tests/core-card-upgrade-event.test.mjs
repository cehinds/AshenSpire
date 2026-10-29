// Card upgrades UI 4/5: an event's `upgradeCard` reward in a Core run appends a step through the service rules
// (free, capped at 10, nothing for a maxed card); Legacy keeps its single authored upgrade.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { executeAction } from '../src/engine/actions.js';
import { upgradeCount } from '../src/model/cardUpgrade.js';
import { nextUpgradeStep } from '../src/model/cardUpgradeLimits.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const strike = run => run.deck.find(c => c.cardId === 'core.strike');
// Pick the card candidate the test names (armaments may also be offered in a Core run).
const play = (run, target, seen = []) => executeAction({ registries, run, emit: () => {},
  rng: { float: () => 0.5, pick: (_s, list) => { seen.push(...list); return list.find(row => row.kind === 'card' && row.card === target) || list[0]; } } },
{ effect: { op: 'upgradeCard', random: true } });

test('Core event: a free upgrade appends the planned step and costs no stone', () => {
  const run = newRun(); run.smithingStones = 0;
  const card = strike(run);
  const expected = nextUpgradeStep(run, card, registries.cards.get('core.strike'), registries);
  play(run, card);
  assert.deepEqual(card.upgradeSteps, [expected]);
  assert.equal(card.upgraded, true);
  assert.equal(run.smithingStones, 0);
});

test('Core event: an already upgraded card can be upgraded again (Legacy would skip it)', () => {
  const run = newRun();
  const card = strike(run);
  play(run, card); play(run, card);
  assert.equal(upgradeCount(card), 2);
});

test('Core event: a card at the 10-upgrade cap is not a candidate and never grows past 10', () => {
  const run = newRun();
  const card = strike(run);
  card.upgraded = true; card.upgradeSteps = Array.from({ length: 10 }, () => ({ k: 'dmg', n: 1 }));
  const seen = [];
  play(run, card, seen);
  assert.ok(!seen.some(row => row.kind === 'card' && row.card === card), 'the capped card is not offered');
  assert.equal(upgradeCount(card), 10);
});
