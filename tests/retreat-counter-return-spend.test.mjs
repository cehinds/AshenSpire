// SPEC §22: each Advance paid spends one Retreat stack. A Counter return played as a reaction is prepaid (paidCounterRange prices it at the play, one
// band per stack on the attacker), so acceptRangeActions must spend those stacks too; it used to skip the commit and the enemy kept them.
// The reaction window needs a prompt flow, so the test drives the engine's own pricing/authorization/acceptance functions on a real fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SetEnemyRow, RetreatStacks } from '../src/engine/bandRows.js';
import { applyStatus } from '../src/engine/statuses.js';
import { paidCounterRange, authorizeCounterRange, acceptRangeActions } from '../src/engine/combatEngagement.js';
import { bandsFight, registries } from './helpers/bands-fight.mjs';

const KEY = 'enemy:e1';
function prepaidReturn({ row = 'back', stacks = 2, retreatRulesVersion = null } = {}) {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'], hand: ['core.counter'], stamina: 8 });
  if (retreatRulesVersion !== null) combat.fixCoreRules.retreatRulesVersion = retreatRulesVersion;
  const attacker = combat.enemies[0], other = combat.enemies[1];
  SetEnemyRow(combat, attacker, row, 'test');
  if (stacks) applyStatus(combat, attacker, 'retreat', stacks, null);
  if (stacks) applyStatus(combat, other, 'retreat', stacks, null);
  const def = registries.cards.get('core.counter');
  const carrier = { ...def, instanceId: 'qa0', counterReturnAttack: true, tags: [...def.tags, 'range:melee'],
    combatProfile: { camp: 'physical', maneuver: 'counter', range: 'melee', targeting: 'single', traits: [] } };
  // The incoming attack's plan, as the engine hands it to the reaction.
  const incomingPlan = { rootId: 'incoming', sourceKey: KEY, targets: [{ contactId: '0', targetKey: 'player:player' }] };
  combat._rangeIncoming = { sourceKey: KEY, rootId: 'incoming', contactId: '0' };
  combat._reactionPlaying = true;
  const priced = paidCounterRange(combat, combat.player, carrier, { energy: 0, stamina: 0, mana: 0 });
  delete combat._rangeIncoming; delete combat._reactionPlaying;
  carrier.rangeCounterReservation = priced.reservation;
  const authorized = authorizeCounterRange(combat, combat.player, attacker, carrier, { rangePlan: incomingPlan, rangeContactId: '0' });
  const before = { attacker: RetreatStacks(attacker), other: RetreatStacks(other), player: combat.player.stamina };
  const prepaid = !!authorized.rangeReturnAuthorization.paid;
  const accepted = acceptRangeActions(combat, combat.player, [], authorized, 'return-root');
  return { combat, attacker, other, priced, prepaid, accepted, before };
}

test('a prepaid Counter return from a back-row attacker with 2 Retreat stacks spends them: stacks spent equal Advances paid', () => {
  const { combat, attacker, other, priced, prepaid, accepted, before } = prepaidReturn();
  assert.ok(prepaid, 'the return is prepaid');
  assert.equal(priced.costs.stamina, 2, 'the quote: distance 1 plus 1 more band for the second stack');
  assert.equal(accepted.advanceSp, priced.costs.stamina, 'the accepted plan is the quoted one (shown = paid)');
  assert.equal(before.attacker, 2);
  assert.equal(RetreatStacks(attacker), 0, 'the attacker spent both stacks the return paid for');
  assert.equal(RetreatStacks(other), 0, 'every other enemy loses one stack per Advance paid (2 held, 2 paid)');
  assert.equal(combat.player.stamina, before.player, 'the return charged nothing more at acceptance (it was prepaid)');
});

test('a prepaid return from a front-row attacker with no stacks spends nothing and changes no stacks', () => {
  const { attacker, other, priced, accepted } = prepaidReturn({ row: 'front', stacks: 0 });
  assert.equal(priced.costs.stamina, 0);
  assert.equal(accepted.advanceSp, 0);
  assert.equal(RetreatStacks(attacker), 0);
  assert.equal(RetreatStacks(other), 0);
});

test('a prepaid return from a front-row attacker holding 1 stack pays 1 and spends that 1 stack', () => {
  const { attacker, priced, accepted } = prepaidReturn({ row: 'front', stacks: 1 });
  assert.equal(accepted.advanceSp, priced.costs.stamina);
  assert.equal(RetreatStacks(attacker), Math.max(0, 1 - accepted.advanceSp));
});
