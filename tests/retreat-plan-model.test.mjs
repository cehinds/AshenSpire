// Owner, 2026-11-18 section 22 (amended 2026-11-19) and section 23: Retreat is one Advance per stack with no cap; a throw replaces the distance Advance but
// never a Retreat Advance; a frozen plan of any size validates (pending reaction quotes read it back through rangePlanProblems).
import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeActionPlan, rangePlanProblems } from '../src/model/combatEngagement.js';
import { bandsFight } from './helpers/bands-fight.mjs';

const fight = () => bandsFight({ enemyIds: ['wanderingSoldier'] });
const contact = (extra = {}) => ({ targetKey: 'enemy:e1', coverage: 0, weapon: true, sourceWeaponId: 'sword', ...extra });

test('plans of 3 and 4 Advances validate against their frozen quote (no missingBands cap)', () => {
  const { rangeState } = fight();
  for (const n of [3, 4, 9]) {
    const plan = rangeActionPlan(rangeState, 'player:player', [contact({ retreatBands: n })]);
    assert.equal(plan.advanceSp, n);
    assert.deepEqual(rangePlanProblems(plan, rangeState), [], `${n} Advances`);
  }
});

test('stacks on the contact price one Advance per stack: enemy stacks beyond the band, plus the player\'s', () => {
  const { rangeState } = fight(); // wanderingSoldier stands in front: band 0
  assert.equal(rangeActionPlan(rangeState, 'player:player', [contact({ enemyStacks: 3 })]).advanceSp, 3);
  assert.equal(rangeActionPlan(rangeState, 'player:player', [contact({ enemyStacks: 2, playerStacks: 1 })]).advanceSp, 3);
  assert.equal(rangeActionPlan(rangeState, 'player:player', [contact({ coverage: 1, enemyStacks: 3, playerStacks: 3 })]).advanceSp, 0, 'Reach ignores them');
  assert.equal(rangeActionPlan(rangeState, 'player:player', [contact({ bypass: true, enemyStacks: 3 })]).advanceSp, 0, 'a bypass (status-only) contact ignores them');
});

test('a throw pays its Retreat Advances and not a distance Advance', () => {
  const { rangeState } = fight();
  const throwing = (extra, route) => rangeActionPlan(rangeState, 'player:player', [contact({ throwCapable: true, ...extra })], { route });
  assert.equal(throwing({ retreatBands: 2 }, 'throw').advanceSp, 2, 'at band 0, 2 Retreat Advances still cost 2 SP');
  assert.equal(throwing({ retreatBands: 2 }, 'advance').advanceSp, 2);
  assert.equal(throwing({}, 'throw').advanceSp, 0, 'no Retreat: a throw is free of Advances');
  const plan = throwing({ retreatBands: 2 }, 'throw');
  assert.deepEqual(rangePlanProblems(plan, rangeState), []);
});
