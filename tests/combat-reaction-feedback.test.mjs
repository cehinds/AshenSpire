// SPEC §4.10: when a seat holds a Counter or defensive Sweep but is offered no
// reaction, the engine says why (combatReactionUnavailable), once per root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, endTurn, chooseReaction, setReactions, leaveCombat } from '../src/engine/coopCombat.js';
import { beforeReactionAction } from '../src/engine/combatReactions.js';

const SLASH = { intent: 'attack', damage: 1, hits: 2, weight: 1 };
const SWEEP = ['camp:physical', 'maneuver:sweep', 'reach:contact', 'targeting:single'];

function registriesWith(move = {}) {
  return createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
    ? { ...enemy, firstMove: 'slash', moves: { slash: { ...SLASH, ...move } } } : enemy) });
}
const seatStats = { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20 };

function solo({ cardIds = ['guardCounter'], move } = {}) {
  const registries = registriesWith(move);
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: 1,
    enemyIds: ['wanderingSoldier'], player: { ...seatStats, drawPerTurn: cardIds.length,
      deck: cardIds.map((cardId, index) => ({ cardId, instanceId: `r${index}`, upgraded: false })) } });
  combat.player.block = 100;
  for (const enemy of combat.enemies) enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  return combat;
}

function coop({ cardIds = ['guardCounter'], move, seats = ['a'] } = {}) {
  const players = seats.map(id => ({ id, ...seatStats, drawPerTurn: cardIds.length, combatExpansionVersion: 2,
    deck: cardIds.map((cardId, index) => ({ cardId, instanceId: `${id}:${index}`, upgraded: false })) }));
  const C = createCoopCombat({ registries: registriesWith(move), rng: createRng(701), players,
    enemyIds: ['wanderingSoldier'], reactionRulesVersion: 1 });
  for (const P of C.players.values()) P.entity.block = 100;
  for (const enemy of C.enemies) enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  return C;
}

const unavailable = events => events.filter(event => event.type === 'combatReactionUnavailable')
  .map(({ type, ...payload }) => payload);
const soloEnd = combat => dispatch(combat, { type: 'endTurn' }).events;

test('a melee Counter facing a Sweep reports notCovered with the attack kind', () => {
  const combat = solo({ move: { cardTags: SWEEP } });
  assert.deepEqual(unavailable(soloEnd(combat)), [{ ownerId: 'player', sourceId: 'e1', reason: 'notCovered',
    cardIds: ['guardCounter'], attackKind: 'sweep' }]);
  assert.equal(combat.pendingReaction, undefined);
});

test('a Counter the seat cannot pay for reports cost with need and have', () => {
  const combat = solo();
  combat.player.energy = 0;
  assert.deepEqual(unavailable(soloEnd(combat)), [{ ownerId: 'player', sourceId: 'e1', reason: 'cost',
    cardIds: ['guardCounter'], attackKind: 'attack', resource: 'stamina', need: 1, have: 0 }]);
});

test('the Reaction switch off reports switchOff only to a seat holding a candidate', () => {
  const combat = solo();
  combat.player.reactionsEnabled = false;
  assert.deepEqual(unavailable(soloEnd(combat)).map(row => row.reason), ['switchOff']);
  const empty = solo({ cardIds: ['strike'] });
  empty.player.reactionsEnabled = false;
  assert.deepEqual(unavailable(soloEnd(empty)), []);
});

test('no candidate in hand emits nothing, and an offer emits no unavailable receipt', () => {
  assert.deepEqual(unavailable(soloEnd(solo({ cardIds: ['strike'] }))), []);
  const offered = solo();
  const events = soloEnd(offered);
  assert.ok(offered.pendingReaction);
  assert.deepEqual(unavailable(events), []);
  assert.equal(events.filter(event => event.type === 'combatReactionOffered').length, 1);
});

test('a staggered or controlled attacker reports the halt once per root', () => {
  // The offer check runs before the root's first action, so a halt between
  // planning and that action is set up directly: reopen the root, halt its source.
  for (const [reason, halt] of [['attackerStaggered', enemy => { enemy.skipNextTurn = true; }],
    ['attackerControlled', enemy => { enemy.statuses = { ...enemy.statuses, paralysis: { stacks: 1 } }; }]]) {
    const combat = solo();
    soloEnd(combat);
    const action = combat.queue[0];
    delete combat.pendingReaction;
    action.meta.expansionGroup.reactionAnswered = [];
    halt(combat.enemies[0]);
    const start = combat.eventLog.length;
    const hooks = { play: () => { throw new Error('no trial expected'); } };
    assert.equal(beforeReactionAction(combat, action, hooks), false);
    assert.equal(beforeReactionAction(combat, action, hooks), false);
    assert.deepEqual(unavailable(combat.eventLog.slice(start)), [{ ownerId: 'player', sourceId: 'e1', reason,
      cardIds: ['guardCounter'], attackKind: 'attack' }]);
  }
});

test('a status-only root is notCovered, and a seat it control-locks reports controlled', () => {
  const ATTACK = ['camp:physical', 'maneuver:attack', 'reach:contact', 'targeting:single'];
  const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
    ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'debuff', weight: 1,
      effects: [{ op: 'applyStatus', status: 'paralysis', stacks: 2, target: 'player' }] } } }
    : enemy.id === 'blightHound' ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'attack', damage: 1, weight: 1, cardTags: ATTACK } } } : enemy) });
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: 1,
    enemyIds: ['wanderingSoldier', 'blightHound'], player: { ...seatStats, drawPerTurn: 1,
      deck: [{ cardId: 'guardCounter', instanceId: 'r0', upgraded: false }] } });
  combat.player.block = 100;
  for (const enemy of combat.enemies) enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  assert.deepEqual(unavailable(soloEnd(combat)).map(row => [row.sourceId, row.reason, row.attackKind]),
    [['e1', 'notCovered', 'statusOnly'], ['e2', 'controlled', 'attack']]);
});

test('a later action of an answered root reports alreadyAnswered once', () => {
  const combat = solo({ move: { hits: 1, effects: [{ op: 'damage', target: 'player', amount: 1 }] } });
  soloEnd(combat);
  assert.ok(combat.pendingReaction);
  const events = dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }).events;
  assert.deepEqual(unavailable(events), [{ ownerId: 'player', sourceId: 'e1', reason: 'alreadyAnswered',
    cardIds: ['guardCounter'], attackKind: 'attack' }]);
});

test('co-op reports the same reasons through the same offer door', () => {
  const cost = coop();
  cost.players.get('a').entity.energy = 0;
  endTurn(cost, 'a');
  assert.deepEqual(unavailable(cost.eventLog), [{ ownerId: 'a', sourceId: 'e1', reason: 'cost',
    cardIds: ['guardCounter'], attackKind: 'attack', resource: 'stamina', need: 1, have: 0 }]);
  const sweep = coop({ move: { cardTags: SWEEP } });
  endTurn(sweep, 'a');
  assert.deepEqual(unavailable(sweep.eventLog).map(row => [row.ownerId, row.reason, row.attackKind]), [['a', 'notCovered', 'sweep']]);
  const off = coop();
  setReactions(off, 'a', false);
  endTurn(off, 'a');
  assert.deepEqual(unavailable(off.eventLog).map(row => row.reason), ['switchOff']);
  const later = coop({ move: { hits: 1, effects: [{ op: 'damage', target: 'player', amount: 1 }] } });
  endTurn(later, 'a');
  chooseReaction(later, 'a', { offerId: later.pendingReaction.id });
  assert.deepEqual(unavailable(later.eventLog).map(row => row.reason), ['alreadyAnswered']);
  const frozen = coop({ seats: ['a', 'b'] });
  for (const P of frozen.players.values()) P.entity.energy = 0;
  leaveCombat(frozen, 'b');
  endTurn(frozen, 'a');
  assert.ok(unavailable(frozen.eventLog).every(row => row.ownerId !== 'b'), 'a disconnected seat gets no receipt');
});
