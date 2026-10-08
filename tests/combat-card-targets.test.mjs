import test from 'node:test';
import assert from 'node:assert/strict';
import { cardTargetPlan, assertCardTarget, forbiddenCardDrop } from '../src/model/cardTargets.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, playCard as playCoopCard } from '../src/engine/coopCombat.js';

const registries = createRegistries(contentBundle);
const enemies = [{ id: 'e1', alive: true }, { id: 'e2', alive: false }, { id: 'e3', alive: true }];
const players = [{ id: 'p1', alive: true, connected: true }, { id: 'p2', alive: true, connected: true }];
const def = (...targets) => ({ effects: targets.map(target => ({ target })) });

test('unarmed combat board projects a safe target plan before any card is selected', () => {
  for (const selectedCard of [null, undefined]) {
    assert.deepEqual(cardTargetPlan(selectedCard, 'p1', enemies, players), {
      mode: 'friendly', legalIds: ['p1'],
    });
  }
});

test('hostile targets stay on living enemies, including mixed source-side effects', () => {
  for (const target of ['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies']) {
    const plan = cardTargetPlan(def(target, 'self'), 'p1', enemies, players);
    assert.equal(plan.mode, 'enemy');
    assert.deepEqual(plan.legalIds, ['e1', 'e3']);
    assert.throws(() => assertCardTarget(plan, 'p1'), /Invalid enemy target/);
    assert.throws(() => assertCardTarget(plan, 'p2'), /Invalid enemy target/);
    assert.throws(() => assertCardTarget(plan, 'e2'), /Invalid enemy target/);
    assert.equal(assertCardTarget(plan, 'e3'), 'e3');
    assert.equal(assertCardTarget(plan, undefined), undefined, 'omitted targets retain automatic engine resolution');
  }
});

test('self, ally and source-only cards expose only their valid friendly destinations', () => {
  assert.deepEqual(cardTargetPlan(def('self'), 'p1', enemies, players).legalIds, ['p1']);
  assert.deepEqual(cardTargetPlan(def('ally'), 'p1', enemies, players).legalIds, ['p2']);
  assert.deepEqual(cardTargetPlan(def('self', 'ally'), 'p1', enemies, players).legalIds, ['p1', 'p2']);
  assert.deepEqual(cardTargetPlan(def(), 'p1', enemies, players).legalIds, ['p1']);
  assert.deepEqual(cardTargetPlan(def('ally'), 'p1', enemies, [players[0]], { solo: true }).legalIds, ['p1']);
  assert.deepEqual(cardTargetPlan(def('self'), 'p1', enemies, [{ ...players[0], alive: false }]).legalIds, []);
  assert.deepEqual(cardTargetPlan(def('ally'), 'p1', enemies, [players[0], { ...players[1], connected: false }]).legalIds, []);
  assert.throws(() => assertCardTarget(cardTargetPlan(def('self'), 'p1', enemies, players), 'e1'), /Invalid friendly target/);
});

test('wrong-side release geometry rejects flicks even when inert frames are skipped by hit testing', () => {
  const figures = [
    { id: 'p1', alive: true, bounds: { left: 0, top: 20, right: 80, bottom: 200 } },
    { id: 'e1', alive: true, bounds: { left: 100, top: 20, right: 180, bottom: 200 } },
    { id: 'e2', alive: false, bounds: { left: 200, top: 20, right: 280, bottom: 200 } },
  ];
  const hostile = cardTargetPlan(def('enemy'), 'p1', enemies, players);
  const friendly = cardTargetPlan(def('self'), 'p1', enemies, players);
  assert.equal(forbiddenCardDrop(hostile, { x: 40, y: 100 }, figures), true);
  assert.equal(forbiddenCardDrop(friendly, { x: 140, y: 100 }, figures), true);
  assert.equal(forbiddenCardDrop(hostile, { x: 140, y: 100 }, figures), false);
  assert.equal(forbiddenCardDrop(friendly, { x: 40, y: 100 }, figures), false);
  assert.equal(forbiddenCardDrop(friendly, { x: 240, y: 100 }, figures), false, 'defeated artwork is never an input destination');
  assert.equal(forbiddenCardDrop(hostile, { x: 90, y: 100 }, figures), false, 'blank field remains a valid flick gesture');
});

const deck = prefix => ['strike', 'defend', 'rallyingBanner'].map((cardId, i) => ({ instanceId: `${prefix}${i}`, cardId, upgraded: false }));
const player = (prefix, id) => ({ id, classId: 'reaver', maxHp: 80, hp: 80, energyMax: 10,
  maxStamina: 10, stamina: 10, drawPerTurn: 5, deck: deck(prefix), relicIds: [], flasks: [] });
const makeCombat = () => createCombat({ registries, rng: createRng(123), player: player('s'), enemyIds: ['blightHound', 'blightHound'] });
const snapshot = combat => JSON.stringify({ player: combat.player, piles: combat.piles, enemies: combat.enemies, log: combat.eventLog, rng: combat.rng.snapshot?.() });
const instance = (hand, cardId) => hand.find(card => card.cardId === cardId).instanceId;

test('solo wrong-side, unknown and defeated targets reject without spending or changing combat', () => {
  const combat = makeCombat();
  for (const [cardId, targetId] of [['strike', 'player'], ['defend', 'e1'], ['strike', 'missing']]) {
    const before = snapshot(combat);
    assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: instance(combat.piles.hand, cardId), targetId }), /Invalid .*target/);
    assert.equal(snapshot(combat), before);
  }
  combat.enemies[0].alive = false;
  combat.enemies[0].hp = 0;
  const before = snapshot(combat);
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: instance(combat.piles.hand, 'strike'), targetId: 'e1' }), /Invalid enemy target/);
  assert.equal(snapshot(combat), before);
  const enemyHp = combat.enemies[1].hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: instance(combat.piles.hand, 'strike'), targetId: 'e2' });
  assert.ok(combat.enemies[1].hp < enemyHp, 'the selected living enemy takes damage');
});

test('solo explicit self and legacy omitted self/ally targets still play', () => {
  for (const [cardId, targetId] of [['defend', 'player'], ['defend', undefined], ['rallyingBanner', undefined]]) {
    const combat = makeCombat();
    dispatch(combat, { type: 'playCard', cardInstanceId: instance(combat.piles.hand, cardId), targetId });
    assert.ok(combat.player.block > 0);
  }
});

test('co-op hostile cards refuse the source and teammates before spending', () => {
  const combat = createCoopCombat({ registries, rng: createRng(123), players: [player('a', 'p1'), player('b', 'p2')], enemyIds: ['blightHound'] });
  const seat = combat.players.get('p1');
  const strike = instance(seat.piles.hand, 'strike');
  for (const targetId of ['p1', 'p2', 'player']) {
    const before = JSON.stringify({ entity: seat.entity, piles: seat.piles, enemies: combat.enemies, log: combat.eventLog });
    assert.throws(() => playCoopCard(combat, 'p1', strike, targetId), /Invalid enemy target/);
    assert.equal(JSON.stringify({ entity: seat.entity, piles: seat.piles, enemies: combat.enemies, log: combat.eventLog }), before);
  }
  const hp = combat.enemies[0].hp;
  playCoopCard(combat, 'p1', strike, 'e1');
  assert.ok(combat.enemies[0].hp < hp);
});
