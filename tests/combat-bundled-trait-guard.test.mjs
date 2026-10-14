import { primeAccuracyRolls } from './accuracyFixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';

// This must load through main's production import order: native ESM tests keep
// the cyclic Actions/Matchups bindings live and could not catch this failure.
const require = productionBundle({ additionalModules: ['src/engine/coopCombat.js'] });
const { contentBundle } = require('src/content/index.js');
const { createRegistries } = require('src/model/registries.js');
const { createCombat, dispatch } = require('src/engine/combat.js');
const { createRng } = require('src/engine/rng.js');
const { resolveCombatRatings } = require('src/model/combatRatings.js');
const { createCoopCombat, playCard, endTurn, chooseReaction } = require('src/engine/coopCombat.js');

function send(combat, intent) {
  if (!combat.players) return dispatch(combat, intent);
  if (intent.type === 'playCard') return playCard(combat, 'p1', intent.cardInstanceId);
  if (intent.type === 'endTurn') return endTurn(combat, 'p1');
  return chooseReaction(combat, 'p1', intent);
}

function fixture({ reaction = true, coop = false } = {}) {
  const move = { intent: 'attack', damage: 2, hits: 2, weight: 1,
    tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single', 'trait:unavoidable'] };
  const registries = createRegistries({ ...contentBundle,
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
      ? { ...enemy, firstMove: 'slash', spPool: 1, moves: { slash: move } } : enemy),
    enemyMoves: contentBundle.enemyMoves.map(row => row.enemyId === 'wanderingSoldier' && row.id === 'slash'
      ? { ...row, ...move } : row),
  });
  const cardIds = reaction ? ['crystalBarrier', 'quickstep'] : ['crystalBarrier'];
  const player = { classId: 'starseer', maxHp: 100, hp: 100, combatExpansionVersion: 2,
    maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: cardIds.length,
    deck: cardIds.map(cardId => ({ cardId, instanceId: cardId })) };
  const options = { registries, rng: createRng(701), ratingsRules: resolveCombatRatings({}, contentBundle),
    combatExpansionVersion: 2, reactionRulesVersion: 2, enemyIds: ['wanderingSoldier'] };
  const combat = coop ? createCoopCombat({ ...options, players: [{ id: 'p1', ...player }] })
    : createCombat({ ...options, player });
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 500;
  enemy.intentRevealed = false;
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
  enemy.poiseMeter = { value: 0, max: 100000 };
  send(combat, { type: 'playCard', cardInstanceId: 'crystalBarrier' });
  assert.equal(combat.player.combatTraitGuard.poise, 1, 'the real Defend card arms Guard');
  // Crystal Barrier's Barrier absorbs spells; physical Block from another
  // source supplies the reduced physical hit in the ordinary EndTurn case.
  if (!reaction) combat.player.block = 20;
  // Preserve the production bundled engine and real transactional RNG while pinning landed contacts.
  primeAccuracyRolls(combat, { count: reaction ? 2 : 1 });
  return combat;
}

const guardEvents = combat => combat.eventLog.filter(event => event.type === 'ratingImpact' && event.cause === 'trait:guard');
const incomingHits = combat => combat.eventLog.filter(event => event.type === 'damageDealt'
  && event.sourceId === combat.enemies[0].id && event.targetId === combat.player.id);
function passReactions(combat) {
  for (let count = 0; combat.pendingReaction; count++) {
    assert.ok(count < 10, 'passing reactions must finish the enemy phase');
    send(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
}
function assertSettled(combat, turn) {
  assert.equal(combat.phase, 'player');
  assert.equal(combat.turn, turn);
  assert.equal(combat.pendingReaction, undefined);
  assert.equal(combat.reactionStack, undefined);
  assert.equal(combat.queue.length, 0);
}

for (const coop of [false, true]) test(`bundled ${coop ? 'co-op' : 'solo'} Quickstep resolves Defend Guard and leaves the next EndTurn usable`, () => {
  const combat = fixture({ coop });
  send(combat, { type: 'endTurn' });
  const offer = combat.pendingReaction;
  const quickstep = offer.options.find(option => option.play.cardInstanceId === 'quickstep');
  assert.ok(quickstep, 'Quickstep is offered as a defensive reaction');
  assert.doesNotThrow(() => {
    send(combat, { type: 'chooseReaction', offerId: offer.id, optionId: quickstep.id });
    passReactions(combat);
  });
  assertSettled(combat, 2);
  assert.equal(incomingHits(combat).length, 2);
  assert.equal(combat.eventLog.filter(event => event.type === 'cardPlayed' && event.cardId === 'quickstep').length, 1);
  assert.equal(guardEvents(combat).length, 1, 'two incoming hits spend the Defend Guard only once');
  assert.equal(guardEvents(combat)[0].amount, 1);
  assert.equal(combat.player.combatTraitGuard, undefined);
  send(combat, { type: 'endTurn' });
  passReactions(combat);
  assertSettled(combat, 3);
  assert.equal(guardEvents(combat).length, 1);
});

for (const coop of [false, true]) test(`bundled ${coop ? 'co-op' : 'solo'} ordinary EndTurn resolves Defend Guard without a reaction card`, () => {
  const combat = fixture({ reaction: false, coop });
  assert.doesNotThrow(() => send(combat, { type: 'endTurn' }));
  assertSettled(combat, 2);
  assert.equal(incomingHits(combat).length, 2);
  assert.equal(guardEvents(combat).length, 1);
  assert.equal(guardEvents(combat)[0].amount, 1);
  assert.equal(combat.player.combatTraitGuard, undefined);
});

test('bundled rated Counterstrike recalculates the reply rating and queues its expanded return', () => {
  const matchups = require('src/engine/combatMatchups.js');
  const enemy = { id: 'enemy', kind: 'enemy', alive: true, hp: 50, block: 0, statuses: {} };
  const player = { id: 'player', kind: 'player', alive: true, hp: 50, block: 8, statuses: {},
    ratings: { ar: 3, dr: 3, pr: 3 }, counters: { cardsPlayedThisTurn: 0 } };
  const queue = [];
  const combat = { reactionRulesVersion: 2, combatExpansionVersion: 2, player, enemies: [enemy],
    registries: createRegistries(contentBundle), rng: createRng(1), emit() {}, enqueue: action => queue.push(action) };
  const incoming = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', targeting: 'single' } };
  const counter = { cardId: 'riposte', type: 'skill', traitValues: { counterstrike: true }, ratingValue: 2,
    combatProfile: { camp: 'physical', maneuver: 'counter', range: 'melee', targeting: 'single',
      counterPayload: { hp: 2, poise: 2, ward: 0, hpBase: 2, hpRating: 1 } } };
  matchups.setCombatStance(combat, player, counter);
  matchups.armCombatCounter(combat, player, counter);
  const receipt = matchups.beginTacticalAction(combat, enemy, player, incoming, [{ amount: 8 }]);
  matchups.recordTacticalContact(receipt, { blocked: 8 });
  let actions;
  assert.doesNotThrow(() => { actions = matchups.completeTacticalAction(combat, enemy, player, incoming, receipt); });
  assert.equal(actions.find(action => action.effect.op === 'damage').effect.amount, 5, 'scaled base 3 plus rating 2');
  assert.equal(actions.find(action => action.effect.op === 'poiseDamage').effect.amount, 3);
  assert.ok(queue.length > 0, 'the reply reaches enqueueExpandedAction');
  assert.equal(actions[0].meta.expansionGroup.counterReturn.amount, 5);
});
