// Owner, 2026-11-15 (W25-BANDS) rules 1, 2, 4: rows, the +1 melee surcharge on the back row, the timed Advance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { bandsFight, pairOf, registries } from './helpers/bands-fight.mjs';
import { quoteRangeActions, authorizeCounterRange } from '../src/engine/combatEngagement.js';
import { SyncBandRows, SetEnemyRow } from '../src/engine/bandRows.js';

test('enemies stand in rows: a reach starter is back, the rest front; encounter placement wins', () => {
  const combat = bandsFight();
  assert.deepEqual(combat.enemies.map(e => e.row), ['front', 'back']);
  assert.equal(combat.rangeState.engagements[pairOf('e1')], 0);
  assert.equal(combat.rangeState.engagements[pairOf('e2')], 1);
  const placed = bandsFight({ encounter: { id: 'x', rows: ['back', 'front'] } });
  assert.deepEqual(placed.enemies.map(e => e.row), ['back', 'front']);
});

test('a melee card at the front costs its price; at the back it costs +1 and auto-Advances, shown = paid', () => {
  const front = bandsFight({ hand: ['core.strike'] });
  const frontCost = previewCard(front, 'qa0', 'e1').cost;
  const back = bandsFight({ hand: ['core.strike'] });
  const backFace = previewCard(back, 'qa0', 'e2');
  assert.equal(backFace.cost, frontCost + 1);
  const before = back.player.stamina;
  dispatch(back, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
  assert.equal(before - back.player.stamina, backFace.cost);
  assert.ok(back.player.advanced > 0, 'the player is Advanced');
  assert.equal(back.rangeState.engagements[pairOf('e2')], 0);
});

test('the Advance lasts through the enemy phase and the next turn, then the back row is out of reach again', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'graveWisp'], hand: ['core.strike'] });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
  assert.equal(combat.player.advanced, 2);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.player.advanced, 1, 'still Advanced in the next turn');
  assert.equal(combat.rangeState.engagements[pairOf('e2')], 0);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.player.advanced, 0);
});

// Seed 2: the surgeon's roll is the scalpel, planned as its step forward ("advance") because it stands in the back row.
const surgeonMoves = combat => combat.eventLog.filter(e => e.type === 'enemyMoveStarted' && e.sourceId === 'e1').map(e => e.moveId);
const surgeonScalpel = ({ advanced = false } = {}) => {
  const combat = bandsFight({ enemyIds: ['courtSurgeon', 'wanderingSoldier'], seed: 2, hand: advanced ? ['core.advance'] : [] });
  const surgeon = combat.enemies[0];
  assert.equal(surgeon.row, 'back');
  assert.equal(surgeon.intent.moveId, 'advance');
  assert.equal(surgeon.intent.approachFor, 'scalpel');
  surgeon.plannedMoves = []; // no follow-up this turn: the intent is the whole turn
  if (advanced) {
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e1' }); // playing the Advance re-plans the intent: the attack stands
    assert.equal(surgeon.intent.moveId, 'scalpel');
  }
  return { combat, surgeon };
};

test('Engage: a melee move from the back row is spent stepping forward; the attack lands the turn after', () => {
  const { combat, surgeon } = surgeonScalpel();
  dispatch(combat, { type: 'endTurn' });
  assert.equal(surgeon.row, 'front');
  assert.deepEqual(surgeonMoves(combat), ['advance'], 'it approached and did not attack on the approach turn');
});

test('Engage: an Advanced player is in reach, so the back row attacks directly', () => {
  const { combat, surgeon } = surgeonScalpel({ advanced: true });
  dispatch(combat, { type: 'endTurn' });
  assert.equal(surgeon.row, 'back', 'it did not move');
  assert.deepEqual(surgeonMoves(combat), ['scalpel'], 'it hit directly');
});

test('with no front-row enemy left the back row steps forward at the enemy phase', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'graveWisp'] });
  combat.enemies[0].hp = 0; combat.enemies[0].alive = false;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.enemies[1].row, 'front');
  assert.equal(combat.rangeState.engagements[pairOf('e2')], 0);
});

test('a fight made without the bands key plays as before: no rows, no Advanced state, the paid Advance closes the pair for good', () => {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  try {
    const combat = bandsFight({ hand: ['core.strike'] });
    combat.enemies[1].hp = 1; // the halved Strike no longer kills the wisp outright; a living wisp retreats, which grows the pair
    assert.deepEqual(combat.enemies.map(e => e.row), [undefined, undefined]);
    assert.equal(combat.rangeState.engagements[pairOf('e2')], 1);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
    assert.equal(combat.player.advanced, undefined);
    assert.equal(combat.rangeState.engagements[pairOf('e2')], 0);
    dispatch(combat, { type: 'endTurn' }); dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.rangeState.engagements[pairOf('e2')], 0, 'persistent until something grows it');
  } finally { fixCoreMechanics.bands = saved; }
});

test('Approaching: a back-row enemy plans the step forward before any move that needs an Advance', () => {
  let approaches = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const combat = bandsFight({ enemyIds: ['courtSurgeon', 'wanderingSoldier'], seed });
    const surgeon = combat.enemies[0];
    const plan = [surgeon.intent, ...(surgeon.plannedMoves || [])].map(mv => mv?.moveId).filter(Boolean);
    const scalpel = plan.indexOf('scalpel');
    if (scalpel >= 0) assert.ok(plan.indexOf('advance') >= 0 && plan.indexOf('advance') < scalpel, `seed ${seed}: ${plan.join(',')}`);
    if (plan.includes('advance')) approaches++;
  }
  assert.ok(approaches > 0, 'the step forward is planned at least once');
});

test('a melee Counter return across to a back-row attacker costs +1 (a reach return pays normal), none when Advanced', () => {
  const quote = (combat, range) => {
    const card = { cardId: 'x', type: 'skill', tags: [`range:${range}`, 'maneuver:counter'], counterReturnAttack: true,
      combatProfile: { camp: 'physical', maneuver: 'attack', range, targeting: 'single' } };
    const actions = ['damage', 'poiseDamage'].map(op => ({ source: combat.player, owner: combat.player, target: combat.enemies[1], card, effect: { op, amount: 1 }, meta: {} }));
    return quoteRangeActions(combat, combat.player, actions, { route: 'advance', preview: true }).advanceSp;
  };
  const combat = bandsFight();
  assert.equal(quote(combat, 'melee'), 1, 'the melee return reaches the back row for +1');
  assert.equal(quote(combat, 'reach'), 0, 'a reach return pays normal');
  combat.player.advanced = 2; SyncBandRows(combat);
  assert.equal(quote(combat, 'melee'), 0, 'Advanced: the attacker is in reach');
});

test('rows are drawn as ranks: the back row stands in the back column, the front row in the front column, and a step forward moves the cell', () => {
  const combat = bandsFight({ enemyIds: ['graveWisp', 'courtSurgeon', 'wanderingSoldier'] });
  for (const enemy of combat.enemies) assert.equal(enemy.formationCell[1], enemy.row === 'back' ? '4' : '3', `${enemy.id} ${enemy.row} ${enemy.formationCell}`);
  assert.equal(new Set(combat.enemies.map(e => e.formationCell)).size, 3, 'no two enemies share a cell');
  SetEnemyRow(combat, combat.enemies[0], 'front', 'test');
  assert.equal(combat.enemies[0].formationCell[1], '3');
  assert.equal(new Set(combat.enemies.map(e => e.formationCell)).size, 3);
});

test('a card-stack Counter (counter.stackSource "card", batch 5) aimed at a back-row attacker pays +1 for the return; a front-row attacker pays nothing', () => {
  const price = row => {
    const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.counter'] });
    assert.equal(combat.fixCoreRules.counter.stackSource, 'card', 'the shipped Core rules count stacks per card');
    const attacker = combat.enemies[0];
    SetEnemyRow(combat, attacker, row, 'test');
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
    assert.equal(combat.player.counterStacks, 1, 'the card granted its own stack');
    const def = registries.cards.get('core.counter');
    const carrier = { ...def, instanceId: 'qa0', counterReturnAttack: true, tags: [...def.tags, 'range:melee'],
      combatProfile: { camp: 'physical', maneuver: 'counter', range: 'melee', targeting: 'single', traits: [] } };
    return authorizeCounterRange(combat, combat.player, attacker, carrier, { rangePlan: null }).rangeReturnAuthorization.plan.advanceSp;
  };
  assert.equal(price('back'), 1);
  assert.equal(price('front'), 0);
});

// A real fight under the shipped rules (bands.rows, counter.stackSource "card"): the Counter card is played, an enemy attacks, and the return
// goes through the engine's own authorization (combatMatchups, then combatEngagement.acceptRangeActions), not a hand-built carrier.
const counterFight = row => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'], hand: ['core.counter'], seed: 2 });
  assert.equal(combat.fixCoreRules.counter.stackSource, 'card');
  assert.equal(combat.enemies[0].intent.moveId, 'slash', 'seed 2: the first soldier attacks, the second guards');
  SetEnemyRow(combat, combat.enemies[0], row, 'test');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  assert.equal(combat.player.counterStacks, 1, 'the card granted its stack (counter.stacksByCard)');
  const mark = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  return { combat, events: combat.eventLog.slice(mark) };
};
const paid = events => events.filter(e => e.type === 'energySpent').reduce((sum, e) => sum + e.amount, 0);

test('a real Counter return from a front-row attacker costs +0 and its forecast is the damage resolved (shown = dealt)', () => {
  const { events } = counterFight('front');
  const triggered = events.find(e => e.type === 'combatCounterTriggered');
  assert.ok(triggered, 'the Counter answered the attack');
  assert.equal(paid(events), 0, 'no Advance surcharge is paid for the return');
  const dealt = events.find(e => e.type === 'damageDealt' && e.sourceId === 'player');
  assert.equal(dealt.damageReceipt.hits[0].incoming, triggered.amount, 'the forecast amount is the amount that was resolved');
});

test('a back-row melee attacker steps forward before it strikes, so the Counter return that follows is quoted at the front row (+0)', () => {
  const { combat, events } = counterFight('back');
  const moves = events.filter(e => e.type === 'enemyMoveStarted' && e.sourceId === 'e1').map(e => e.moveId);
  assert.deepEqual(moves, ['advance'], 'its turn went on stepping forward; no attack, so nothing to return');
  assert.equal(combat.enemies[0].row, 'front');
  assert.equal(events.some(e => e.type === 'combatCounterTriggered'), false);
  assert.equal(paid(events), 0);
});
