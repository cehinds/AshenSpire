// Silenced raises SP prices (owner, 2026-10-13, expanded combat; #1896's spellCostSurcharge): each Silenced stack adds
// 1 SP to a spell-camp action of the entity that carries it. A player's spell card pays it through the one card pricing
// (resolvedCardPlayCosts); an enemy's spell move pays it through the move price its SP pool reads (moveSp →
// enemyMoveSpOf), in normal combat's plan and in the rounds-mode queue alike (SPEC §4.6a, §4.11). A physical move and a
// legacy (version 1) fight pay nothing extra.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { cardPlayCosts, dispatch } from '../src/engine/combat.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { enemyMoveSpOf } from '../src/model/actionCosts.js';
import { COMBAT_ROUNDS_KEY } from '../src/model/combatRounds.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';

// The Grave Wisp's moves are both spell-camp; the fixture gives it a fixed pool of 4 so the plan's length shows the price.
const WISP = 'graveWisp';
const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === WISP ? { ...e, spPool: 4 } : e)) });
const wispDef = registries.enemies.get(WISP);
const silence = (entity, stacks) => { entity.statuses = { ...(entity.statuses || {}), silenced: { stacks, duration: 9 } }; };

function fight({ rounds = false, classId = 'reaver', enemyIds = [WISP] } = {}) {
  const settings = rounds ? { [COMBAT_ROUNDS_KEY]: true } : {};
  const run = createRunState({ seed: 5, classId, registries, profileMeta: { settings } });
  return createRunCombat({ registries, rng: createRng(5), run, enemyIds, settings: {} });
}

test('fixture: both Grave Wisp moves are spell-camp and cost 2 SP unsilenced; the Wandering Soldier slash is physical', () => {
  for (const id of Object.keys(wispDef.moves)) {
    assert.equal(combatProfileFor({ ...wispDef.moves[id], enemyId: WISP, moveId: id }).camp, 'spell', id);
    assert.equal(Rounds.moveSp(wispDef.moves[id]), 2, id);
  }
  const soldier = registries.enemies.get('wanderingSoldier');
  assert.equal(combatProfileFor({ ...soldier.moves.slash, enemyId: 'wanderingSoldier', moveId: 'slash' }).camp, 'physical');
});

test('a spell move costs 1 more SP per Silenced stack in expanded combat; a physical move and a legacy fight pay nothing extra', () => {
  const v2 = { combatExpansionVersion: 2 };
  for (const stacks of [0, 1, 2, 3]) {
    const enemy = { enemyId: WISP, statuses: {} };
    if (stacks) silence(enemy, stacks);
    assert.equal(Rounds.moveSp(wispDef.moves.drain, { enemy, moveId: 'drain', combat: v2 }), 2 + stacks, `${stacks} stacks`);
    assert.equal(Rounds.moveSp(wispDef.moves.drain, { enemy, moveId: 'drain', combat: { combatExpansionVersion: 1 } }), 2, `v1, ${stacks} stacks`);
    // The model helper takes the paying entity directly.
    assert.equal(enemyMoveSpOf(wispDef.moves.drain, 'attack', 1, { entity: enemy, enemyId: WISP, moveId: 'drain' }), 2 + stacks);
  }
  const soldier = { enemyId: 'wanderingSoldier', statuses: {} };
  silence(soldier, 2);
  const slash = registries.enemies.get('wanderingSoldier').moves.slash;
  assert.equal(Rounds.moveSp(slash, { enemy: soldier, moveId: 'slash', combat: v2 }), Rounds.moveSp(slash), 'a physical move pays no surcharge');
});

test('normal combat: a Silenced enemy plans its spell moves at the surcharged price, so its pool holds fewer', () => {
  for (const [stacks, length] of [[0, 2], [1, 1], [2, 1]]) {
    const c = fight();
    assert.equal(c.combatExpansionVersion, 2, 'fixture: a new run is expanded');
    assert.equal('combatRounds' in c, false, 'fixture: rounds mode is off');
    const enemy = c.enemies[0];
    if (stacks) silence(enemy, stacks);
    enemy.plannedMoves = [];
    const head = Rounds.takePlannedMove(c, enemy, wispDef, { pick: () => 'drain' });
    assert.equal(head, 'drain');
    const plan = [{ moveId: head }, ...enemy.plannedMoves];
    assert.equal(plan.length, length, `${stacks} stacks: a pool of 4 holds ${length} drain(s) at ${2 + stacks} SP`);
    for (const entry of enemy.plannedMoves) assert.equal(entry.sp, 2 + stacks);
  }
});

test('normal combat: the live weighted pick reads the surcharged price for what the pool can still afford', () => {
  const followUps = (stacks) => {
    const c = fight();
    const enemy = c.enemies[0];
    if (stacks) silence(enemy, stacks);
    dispatch(c, { type: 'endTurn' });
    while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
    assert.ok(enemy.alive && !c.result, 'fixture: the fight goes on');
    return enemy.plannedMoves ?? [];
  };
  // A pool of 4: at 2 SP a move one follow-up fits beside the head; at 3 SP (one stack) none does.
  assert.equal(followUps(0).length, 1, 'unsilenced: one follow-up');
  assert.deepEqual(followUps(1), [], 'one stack: no follow-up fits beside a 3-SP head');
});

test('rounds mode: a Silenced enemy queues its spell moves at the surcharged price', () => {
  for (const [stacks, length] of [[0, 2], [1, 1], [2, 1]]) {
    const c = fight({ rounds: true });
    assert.ok(c.combatRounds, 'fixture: rounds mode is on');
    const enemy = c.enemies[0];
    if (stacks) silence(enemy, stacks);
    const queues = Rounds.buildEnemyQueues(c, { pick: () => 'drain', held: () => false });
    const queue = queues[enemy.id];
    assert.equal(queue.length, length, `${stacks} stacks`);
    for (const entry of queue) assert.equal(entry.sp, 2 + stacks, `${stacks} stacks: each queued drain costs ${2 + stacks} SP`);
  }
});

test('a player spell card costs 1 more SP per Silenced stack, in normal combat and when queued in rounds mode', () => {
  for (const rounds of [false, true]) {
    for (const stacks of [0, 1, 2]) {
      const c = fight({ rounds, classId: 'starseer', enemyIds: ['wanderingSoldier'] });
      const p = c.player;
      p.energy = p.stamina = 10;
      p.mana = 10;
      c.piles.hand.push({ instanceId: 'spell', cardId: 'mindSpike', upgraded: false });
      c.piles.hand.push({ instanceId: 'strike', cardId: 'strike', upgraded: false });
      const base = cardPlayCosts(c, 'spell').stamina;
      const strike = cardPlayCosts(c, 'strike').stamina;
      if (stacks) silence(p, stacks);
      const priced = cardPlayCosts(c, 'spell');
      assert.equal(priced.stamina, base + stacks, `${rounds ? 'rounds' : 'normal'}, ${stacks} stacks: the shown price`);
      assert.equal(cardPlayCosts(c, 'strike').stamina, strike, 'a physical card pays no surcharge');
      const before = p.energy;
      dispatch(c, { type: 'playCard', cardInstanceId: 'spell', targetId: c.enemies[0].id });
      assert.equal(before - p.energy, base + stacks, `${rounds ? 'rounds: queued' : 'normal: played'} at the surcharged SP`);
    }
  }
});
