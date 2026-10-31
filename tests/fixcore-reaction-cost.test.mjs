import test from 'node:test';
import { COOP_TESTS_ENABLED, COOP_TEST_SKIP_REASON } from './feature-scopes.js';
import assert from 'node:assert/strict';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardPlayCosts, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard as playCoopCard, endTurn as endCoopTurn } from '../src/engine/coopCombat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { profileCardCosts } from '../src/engine/gameProfileCombat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { live, registries, baseRegistries, profile } from './helpers/fixcore-combat-rules.mjs';

test('enemy 5 × 3 deals three hits of 5, with 15 total HP loss', () => {
  const ctx = live(), enemy = ctx.enemies[0];
  // The contact fixture needs the three SP its repeated-hit move now costs.
  Object.assign(enemy, { maxStamina: 3, stamina: 3 });
  enemy.intent = { ...enemy.intent, moveId: 'slash' };
  enemy.plannedMoves = [];
  primeAccuracyRolls(ctx, { count: 3 });
  const accuracyStart = ctx.rng.getCounters().combatAvoidance;
  dispatch(ctx, { type: 'setReactions', enabled: false });
  const start = ctx.eventLog.length;
  dispatch(ctx, { type: 'endTurn' });
  const damage = ctx.eventLog.slice(start).filter(row => row.type === 'damageDealt' && row.sourceId === enemy.id && row.targetId === ctx.player.id);
  const hits = ctx.eventLog.slice(start).filter(row => row.type === 'attackHit' && row.sourceId === enemy.id && row.targetId === ctx.player.id);
  assert.deepEqual(hits.map(row => row.d20), [20, 20, 20]);
  assert.equal(ctx.rng.getCounters().combatAvoidance - accuracyStart, 3, 'each contact owns one attacker roll');
  assert.deepEqual(damage.map(row => row.amount), [5, 5, 5]);
  assert.deepEqual(damage.map(row => row.hpLoss), [5, 5, 5]);
  assert.equal(ctx.player.hp, 85);
});

test('matching stance cannot reduce a multi-hit hound lunge below two SP', () => {
  const run = createRunState({ registries: baseRegistries, classId: 'reaver', seed: 511 });
  const ctx = createRunCombat({ registries: baseRegistries, run, rng: createRng(511), enemyIds: ['blightHound'] });
  const enemy = ctx.enemies[0];
  enemy.intent = { ...enemy.intent, moveId: 'lunge' };
  enemy.plannedMoves = [];
  enemy.combatStance = { camp: 'physical', maneuver: 'smash', range: 'melee' };
  Object.assign(enemy, { basePrecisionBonus: 1000, maxStamina: 1, stamina: 1 });
  ctx.player.block = 100;
  dispatch(ctx, { type: 'setReactions', enabled: false });
  primeAccuracyRolls(ctx, { count: 3 });
  const start = ctx.eventLog.length;
  dispatch(ctx, { type: 'endTurn' });
  const events = ctx.eventLog.slice(start);
  assert.ok(!events.some(row => row.type === 'enemyMoveStarted' && row.moveId === 'lunge'));
  assert.equal(events.filter(row => row.type === 'damageDealt' && row.sourceId === enemy.id && row.targetId === ctx.player.id).length, 0);
  const refused = events.find(row => row.type === 'enemyMoveUnavailable' && row.moveId === 'lunge');
  assert.ok(refused);
  assert.equal(refused.sourceId, enemy.id);
  assert.equal(refused.required, 2); assert.equal(refused.available, 1);
  assert.equal(refused.resource, 'sp');
});

test('Martial Adept discounts matching nonspell SP on both turns, with a zero floor only for reactions', () => {
  const ctx = live();
  const reaction = { id: 'fixture', staminaCost: 3, manaCost: 0, cardTags: ['trait:reaction'], combatProfile: { maneuver: 'counter', camp: 'physical', range: 'melee' } };
  const cost = def => profileCardCosts(ctx, def).stamina;
  ctx.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  ctx.phase = 'player'; assert.equal(cost(reaction), 2);
  ctx.phase = 'enemy'; assert.equal(cost(reaction), 2);
  assert.equal(cost({ ...reaction, cardTags: [] }), 2);
  assert.equal(cost({ ...reaction, staminaCost: 1 }), 0);
  assert.equal(cost({ ...reaction, staminaCost: 0 }), 0);
  assert.equal(cost({ ...reaction, manaCost: 2 }), 2, 'MP cost does not disable the conditional SP discount');
  ctx.player.combatStance.maneuver = 'defend'; assert.equal(cost(reaction), 3);
  delete ctx.player.combatStance; assert.equal(cost(reaction), 3);
});

test('real Counter preview, affordability and own-turn payment use authored SP', () => {
  const ctx = live(); ctx.piles.hand.push({ instanceId: 'counter', cardId: 'core.counter' });
  assert.equal(cardPlayCosts(ctx, 'counter').stamina, 1);
  assert.equal(previewCard(ctx, 'counter', ctx.enemies[0].id).costShift || 0, 0);
  ctx.player.stamina = 1;
  dispatch(ctx, { type: 'playCard', cardInstanceId: 'counter' });
  assert.equal(ctx.player.stamina, 0);
  assert.ok(ctx.player.combatCounter);
});

test('an actual enemy-turn matching Counter remains affordable and pays the discounted price', () => {
  const ctx = live();
  Object.assign(ctx.enemies[0], { maxStamina: 3, stamina: 3 });
  ctx.enemies[0].intent = { ...ctx.enemies[0].intent, moveId: 'slash' };
  ctx.enemies[0].plannedMoves = [];
  ctx.piles.hand = [{ instanceId: 'counter', cardId: 'core.counter' }];
  ctx.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  ctx.player.stamina = 0;
  dispatch(ctx, { type: 'endTurn' });
  const option = ctx.pendingReaction?.options.find(row => row.cardId === 'core.counter');
  assert.ok(option, 'the affordability probe offers the zero-SP reaction');
  assert.equal(cardPlayCosts(ctx, 'counter').stamina, 0);
  const result = dispatch(ctx, { type: 'chooseReaction', offerId: ctx.pendingReaction.id, optionId: option.id });
  assert.ok(result.events.some(row => row.type === 'cardPlayed' && row.cardId === 'core.counter'));
  assert.ok(!result.events.some(row => row.type === 'staminaSpent' && row.amount > 0));
});

test('co-op pays authored own-turn SP and expires only the acting owner Precision', { skip: !COOP_TESTS_ENABLED && COOP_TEST_SKIP_REASON }, () => {
  const player = id => ({ id, classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, mana: 10,
    maxStamina: 3, stamina: 3, energyMax: 3, drawPerTurn: 1,
    deck: [{ cardId: 'core.counter', instanceId: `${id}-counter` }] });
  const ctx = createCoopCombat({ registries, rng: createRng(511), gameProfile: profile, combatExpansionVersion: 2,
    players: [player('a'), player('b')], enemyIds: ['wanderingSoldier'] });
  const a = ctx.players.get('a').entity, b = ctx.players.get('b').entity;
  a.stamina = 1; b.stamina = 1;
  playCoopCard(ctx, 'a', 'a-counter', 'a');
  assert.equal(a.stamina, 0);
  applyStatus(ctx, b, 'precision', 3, b);
  endCoopTurn(ctx, 'a');
  assert.equal(a.statuses.precision, undefined);
  assert.equal(b.statuses.precision.stacks, 3);
});
