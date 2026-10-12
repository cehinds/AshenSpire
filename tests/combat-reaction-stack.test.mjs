import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createCoopCombat, endTurn, chooseReaction, chooseDiscard, playCard } from '../src/engine/coopCombat.js';
import { serializeCoopCombatSnapshot, decodeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';
import { combatReactionProblems } from '../src/model/combatReactionState.js';

// `strike` is tagged `trait:reaction` in this bundle only (the real projection is separate work).
// `chooseStrike` is a Strike that also makes its player discard a card, a play that pauses.
const strikeDef = contentBundle.cards.find(card => card.id === 'strike');
const chooseStrike = { ...strikeDef, id: 'chooseStrike', name: 'Choose Strike', effects: [...strikeDef.effects, { op: 'discard', amount: 1, choose: true }] };
const strikeTagging = contentBundle.tagging.filter(row => row.family === 'card' && row.objectId === 'strike');
function fixture({ version = 2, cardIds = ['guardCounter', 'sweepingBlow'], enemyCount = 1 } = {}) {
  const registries = createRegistries({ ...contentBundle,
    cards: [...contentBundle.cards, chooseStrike],
    tagging: [...contentBundle.tagging, { family: 'card', scope: '', objectId: 'strike', tagId: 'trait:reaction' },
      ...strikeTagging.map(row => ({ ...row, objectId: 'chooseStrike' })), { family: 'card', scope: '', objectId: 'chooseStrike', tagId: 'trait:reaction' }],
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
      ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'attack', damage: 1, hits: 2, weight: 1,
        tags: ['camp:physical', 'maneuver:attack', 'reach:contact', 'targeting:single'] } } } : enemy) });
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: version,
    enemyIds: Array(enemyCount).fill('wanderingSoldier'), player: { classId: 'reaver', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: cardIds.length,
      deck: cardIds.map((cardId, index) => ({ cardId, instanceId: `r${index}`, upgraded: false })) } });
  combat.player.block = 100;
  for (const enemy of combat.enemies) { enemy.intentRevealed = false; enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 }; }
  return { combat, registries };
}

test('version 2 offers a trait:reaction card by tag, and version 1 does not', () => {
  const v2 = fixture({ cardIds: ['strike'] });
  dispatch(v2.combat, { type: 'endTurn' });
  assert.ok(v2.combat.pendingReaction?.options.some(option => option.cardId === 'strike'));
  const v1 = fixture({ version: 1, cardIds: ['strike'] });
  dispatch(v1.combat, { type: 'endTurn' });
  assert.equal(v1.combat.pendingReaction, undefined);
});

const answer = (combat, optionId = null) => dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId });
const pick = (combat, cardInstanceId) => combat.pendingReaction.options.find(row => row.play.cardInstanceId === cardInstanceId).id;
const offeredInstances = combat => [...new Set(combat.pendingReaction.options.map(row => row.play.cardInstanceId))];
const resources = combat => ({ energy: combat.player.energy, stamina: combat.player.stamina, mana: combat.player.mana });

test('passing with an empty stack matches the version 1 Back outcome', () => {
  const back = version => {
    const { combat } = fixture({ version, cardIds: ['guardCounter'] });
    dispatch(combat, { type: 'endTurn' });
    const out = answer(combat);
    return { types: out.events.map(event => event.type), phase: combat.phase, turn: combat.turn, hp: combat.player.hp };
  };
  assert.deepEqual(back(2), back(1));
});

test('a pushed reaction is not paid, stays in hand, and the seat is offered again at depth 1', () => {
  const { combat } = fixture({ cardIds: ['guardCounter', 'sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  const root = combat.pendingReaction.groupKey, before = resources(combat);
  const out = answer(combat, pick(combat, 'r1'));
  assert.deepEqual(resources(combat), before);
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 0);
  assert.ok(combat.piles.hand.some(inst => inst.instanceId === 'r1'));
  assert.deepEqual(combat.reactionStack.entries.map(entry => entry.cardInstanceId), ['r1']);
  assert.equal(combat.pendingReaction.id, `${root}:player:1`);
  assert.ok(out.events.some(event => event.type === 'combatReactionStacked' && event.depth === 1 && event.cardInstanceId === 'r1'));
});

test('a stacked instance and a second Counter are not offered again', () => {
  const { combat } = fixture({ cardIds: ['guardCounter', 'sweepingBlow', 'whirlingGuard', 'guardCounter'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r1'));
  assert.ok(offeredInstances(combat).includes('r0') && offeredInstances(combat).includes('r3'));
  answer(combat, pick(combat, 'r0'));
  assert.deepEqual(offeredInstances(combat), ['r2']);
  assert.ok(combat.pendingReaction.id.endsWith(':player:2'));
});

test('two stacked reactions resolve last pushed first, both before the enemy hits', () => {
  const { combat } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  const out = answer(combat, pick(combat, 'r1'));
  const played = out.events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'cardPlayed');
  assert.deepEqual(played.map(({ event }) => event.cardInstanceId), ['r1', 'r0']);
  const hits = out.events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'damageDealt' && event.targetId === 'player');
  assert.ok(hits.length > 0 && hits.every(({ index }) => index > played.at(-1).index));
  assert.equal(combat.reactionStack, undefined);
  assert.equal(combat.pendingReaction, undefined);
});

test('a stack entry that is no longer in hand fizzles and pays nothing', () => {
  const { combat } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  combat.piles.hand = combat.piles.hand.filter(inst => inst.instanceId !== 'r0');
  const before = resources(combat);
  const out = answer(combat);
  assert.ok(out.events.some(event => event.type === 'combatReactionFizzled' && event.cardInstanceId === 'r0' && event.reason === 'notInHand'));
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 0);
  assert.equal(combat.reactionStack, undefined);
  assert.equal(combat.turn, 2);
  assert.deepEqual(resources(combat), before);
});

test('a saved stack is validated: side, owner and the offer depth must match', () => {
  const { combat, registries } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restore = snapshot => restoreCombatSnapshot({ registries, rng: createRng(701), snapshot: JSON.parse(JSON.stringify(snapshot)) });
  assert.equal(restore(saved).reactionStack.entries.length, 1);
  const badSide = structuredClone(saved);
  badSide.reactionStack.entries[0].side = 'bogus';
  assert.throws(() => restore(badSide), /Invalid reaction stack/);
  const enemySide = structuredClone(saved);
  enemySide.reactionStack.entries[0].side = 'enemy';
  assert.throws(() => restore(enemySide), /Invalid reaction stack/, 'an enemy entry needs its committed plan');
  const badSeats = structuredClone(saved);
  badSeats.reactionStack.counterSeats = {};
  assert.throws(() => restore(badSeats), /Invalid reaction stack/);
  const dupSeats = structuredClone(saved);
  dupSeats.reactionStack.counterSeats = ['player', 'player'];
  assert.throws(() => restore(dupSeats), /Invalid reaction stack/);
  const overCap = structuredClone(saved);
  overCap.reactionRules.stack.maxDepth = 0;
  assert.throws(() => restore(overCap), /exceeds its per-seat limits/);
  const twoCounters = structuredClone(saved);
  twoCounters.reactionStack.entries.push({ ...twoCounters.reactionStack.entries[0], cardInstanceId: 'rX', play: { ...twoCounters.reactionStack.entries[0].play, cardInstanceId: 'rX' } });
  for (const entry of twoCounters.reactionStack.entries) entry.maneuver = 'counter';
  twoCounters.pendingReaction.id = twoCounters.pendingReaction.id.replace(/:1$/, ':2');
  assert.throws(() => restore(twoCounters), /exceeds its per-seat limits/);
  const badDepth = structuredClone(saved);
  badDepth.pendingReaction.id = badDepth.pendingReaction.id.replace(/:1$/, ':0');
  assert.throws(() => restore(badDepth), /does not match its stack depth/);
});

test('a saved pending offer is refused once its owner already holds the depth cap', () => {
  const { combat, registries } = fixture({ cardIds: ['strike', 'strike', 'strike', 'strike', 'strike'] });
  for (const enemy of combat.enemies) { enemy.hp = 500; enemy.maxHp = 500; }
  dispatch(combat, { type: 'endTurn' });
  for (const id of ['r0', 'r1', 'r2']) answer(combat, pick(combat, id));
  const restore = snapshot => restoreCombatSnapshot({ registries, rng: createRng(701), snapshot: JSON.parse(JSON.stringify(snapshot)) });
  const below = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  assert.equal(below.reactionRules.stack.maxDepth, 4);
  assert.ok(restore(below).pendingReaction.id.endsWith(':player:3'), 'owner at maxDepth - 1 keeps its offer');
  // Owner holds exactly maxDepth entries, yet the saved offer would push entry maxDepth + 1.
  const atCap = structuredClone(below);
  const top = atCap.reactionStack.entries[2];
  atCap.reactionStack.entries.push({ ...top, cardInstanceId: 'r3', play: { ...top.play, cardInstanceId: 'r3' } });
  atCap.pendingReaction.id = atCap.pendingReaction.id.replace(/:3$/, ':4');
  assert.throws(() => restore(atCap), /Reaction choice is past its seat limit/);
});

test('an enemy-side stack entry whose enemy is down fizzles and runs nothing', () => {
  const { combat } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'], enemyCount: 2 });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  const down = combat.enemies.find(enemy => enemy.id !== combat.reactionStack.groupKey && enemy.id !== combat.pendingReaction.sourceId);
  down.alive = false; down.hp = 0;
  combat.reactionStack.entries.push({ side: 'enemy', ownerId: down.id, enemyId: down.enemyId, moveId: 'slash', targetPlayerId: 'player', plan: { group: {}, actions: [] } });
  const out = answer(combat);
  assert.ok(out.events.some(event => event.type === 'combatReactionFizzled' && event.side === 'enemy' && event.reason === 'enemyHalted'));
  assert.equal(out.events.some(event => event.type === 'enemyMoveStarted' && event.reaction), false);
});

test('a saved stack with a depth 1 offer resumes to the same state as an unsaved run', () => {
  const { combat, registries } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  assert.ok(combat.pendingReaction.id.endsWith(':player:1'));
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot });
  const json = value => JSON.parse(JSON.stringify(value));
  assert.deepEqual(json(serializeCombatSnapshot(restored)), json(serializeCombatSnapshot(combat)));
  // The second push leaves the seat with nothing to offer, so the stack resolves in that call.
  const outs = [combat, restored].map(state => [answer(state, pick(state, 'r1'))]);
  assert.deepEqual(json(outs[0].map(out => out.events)), json(outs[1].map(out => out.events)));
  assert.deepEqual(json(serializeCombatSnapshot(restored)), json(serializeCombatSnapshot(combat)));
  assert.deepEqual(restored.rng.getCounters(), combat.rng.getCounters());
});

test('co-op seats answer in order and the whole stack resolves last pushed first across seats', () => {
  const { registries } = fixture();
  const players = ['a', 'b'].map(id => ({ id, classId: 'reaver', maxHp: 100, hp: 100,
    maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, combatExpansionVersion: 2,
    deck: [{ cardId: 'sweepingBlow', instanceId: `${id}:sweep`, upgraded: false }, { cardId: 'whirlingGuard', instanceId: `${id}:guard`, upgraded: false }] }));
  const C = createCoopCombat({ registries, rng: createRng(709), players, enemyIds: ['wanderingSoldier'], reactionRulesVersion: 2 });
  for (const P of C.players.values()) P.entity.block = 100;
  endTurn(C, 'a'); endTurn(C, 'b');
  const pick = (id, instanceId) => C.pendingReaction.options.find(row => row.play.cardInstanceId === instanceId).id;
  chooseReaction(C, 'a', { offerId: C.pendingReaction.id, optionId: pick('a', 'a:sweep') });
  assert.equal(C.pendingReaction.ownerId, 'a');
  // Seat a has no option left after its second push, so seat b is offered next.
  chooseReaction(C, 'a', { offerId: C.pendingReaction.id, optionId: pick('a', 'a:guard') });
  assert.equal(C.pendingReaction.ownerId, 'b');
  assert.equal(C.reactionStack.entries.length, 2);
  chooseReaction(C, 'b', { offerId: C.pendingReaction.id, optionId: pick('b', 'b:sweep') });
  assert.equal(C.pendingReaction.ownerId, 'b');
  const out = chooseReaction(C, 'b', { offerId: C.pendingReaction.id, optionId: pick('b', 'b:guard') });
  const played = out.events.filter(event => event.type === 'cardPlayed').map(event => event.cardInstanceId);
  assert.deepEqual(played, ['b:guard', 'b:sweep', 'a:guard', 'a:sweep']);
  assert.equal(C.reactionStack, undefined);
  assert.equal(C.pendingReaction, undefined);
});

test('co-op instance ids are per seat: seat A stacking rc1 does not hide seat B its own rc1', () => {
  const { registries } = fixture();
  const players = ['a', 'b'].map(id => ({ id, classId: 'reaver', maxHp: 100, hp: 100,
    maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1, combatExpansionVersion: 2,
    deck: [{ cardId: 'sweepingBlow', instanceId: 'rc1', upgraded: false }] }));
  const C = createCoopCombat({ registries, rng: createRng(713), players, enemyIds: ['wanderingSoldier'], reactionRulesVersion: 2 });
  for (const P of C.players.values()) P.entity.block = 100;
  endTurn(C, 'a'); endTurn(C, 'b');
  assert.equal(C.pendingReaction.ownerId, 'a');
  assert.ok(C.pendingReaction.options.some(row => row.play.cardInstanceId === 'rc1'));
  chooseReaction(C, 'a', { offerId: C.pendingReaction.id, optionId: C.pendingReaction.options.find(row => row.play.cardInstanceId === 'rc1').id });
  assert.equal(C.reactionStack.entries.length, 1);
  assert.equal(C.reactionStack.entries[0].ownerId, 'a');
  // Seat A has no card left; seat B's own rc1 must still be offered.
  assert.equal(C.pendingReaction.ownerId, 'b');
  assert.ok(C.pendingReaction.options.some(row => row.play.cardInstanceId === 'rc1'), 'seat B rc1 is offered');
});

test('a co-op seat that disconnects after committing fizzles its entries and pays nothing', () => {
  const { registries } = fixture();
  const players = ['a', 'b'].map(id => ({ id, classId: 'reaver', maxHp: 100, hp: 100,
    maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, combatExpansionVersion: 2,
    deck: [{ cardId: 'sweepingBlow', instanceId: `${id}:sweep`, upgraded: false }, { cardId: 'whirlingGuard', instanceId: `${id}:guard`, upgraded: false }] }));
  const C = createCoopCombat({ registries, rng: createRng(709), players, enemyIds: ['wanderingSoldier'], reactionRulesVersion: 2 });
  for (const P of C.players.values()) P.entity.block = 100;
  endTurn(C, 'a'); endTurn(C, 'b');
  const pick = instanceId => C.pendingReaction.options.find(row => row.play.cardInstanceId === instanceId).id;
  chooseReaction(C, 'a', { offerId: C.pendingReaction.id, optionId: pick('a:sweep') });
  chooseReaction(C, 'a', { offerId: C.pendingReaction.id, optionId: pick('a:guard') });
  assert.equal(C.pendingReaction.ownerId, 'b');
  const seatA = C.players.get('a');
  seatA.connected = false;
  const out = chooseReaction(C, 'b', { offerId: C.pendingReaction.id, optionId: null });
  const fizzled = out.events.filter(event => event.type === 'combatReactionFizzled' && event.ownerId === 'a');
  assert.deepEqual(fizzled.map(event => [event.cardInstanceId, event.reason]), [['a:guard', 'ownerGone'], ['a:sweep', 'ownerGone']]);
  // Payment is the cardPlayed receipt: none for either seat (seat b passed).
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 0);
});

test('a stacked play that pauses for its own discard resumes the rest of the stack', () => {
  // Pushed: a Sweep (r0), then the discarding Strike (r1). The Strike resolves first and pauses,
  // leaving the Sweep on the stack; the discard choice then resumes the Sweep and the attack.
  const { combat, registries } = fixture({ cardIds: ['sweepingBlow', 'chooseStrike', 'strike'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  answer(combat, pick(combat, 'r1'));
  const out = answer(combat);
  assert.deepEqual(out.events.filter(event => event.type === 'cardPlayed').map(event => event.cardInstanceId), ['r1']);
  assert.ok(combat.pendingAbilityDiscard);
  assert.ok(combat.reactionResume);
  assert.deepEqual(combat.reactionStack.entries.map(entry => entry.cardInstanceId), ['r0']);
  const json = value => JSON.parse(JSON.stringify(value));
  const saved = json(serializeCombatSnapshot(combat));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: saved });
  // The Sweep (r0) still waits on the stack: it cannot be chosen as discard fodder.
  assert.throws(() => dispatch(combat, { type: 'chooseDiscard', cardInstanceIds: ['r0'] }), /Choose exactly/);
  const resumed = [combat, restored].map(state => dispatch(state, { type: 'chooseDiscard', cardInstanceIds: ['r2'] }));
  assert.deepEqual(resumed[0].events.filter(event => event.type === 'cardPlayed').map(event => event.cardInstanceId), ['r0']);
  assert.deepEqual(json(resumed[0].events), json(resumed[1].events));
  assert.equal(combat.pendingAbilityDiscard, undefined);
  assert.equal(combat.reactionResume, undefined);
  assert.equal(combat.reactionStack, undefined);
  assert.equal(combat.turn, 2);
});

test('a co-op stack saved at a depth 1 offer resumes to the same state as an unsaved run', () => {
  const { registries } = fixture();
  const players = ['a', 'b'].map(id => ({ id, classId: 'reaver', maxHp: 100, hp: 100,
    maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, combatExpansionVersion: 2,
    deck: [{ cardId: 'sweepingBlow', instanceId: `${id}:sweep`, upgraded: false }, { cardId: 'whirlingGuard', instanceId: `${id}:guard`, upgraded: false }] }));
  const C = createCoopCombat({ registries, rng: createRng(709), players, enemyIds: ['wanderingSoldier'], reactionRulesVersion: 2 });
  for (const P of C.players.values()) P.entity.block = 100;
  endTurn(C, 'a'); endTurn(C, 'b');
  const pick = (state, instanceId) => state.pendingReaction.options.find(row => row.play.cardInstanceId === instanceId).id;
  chooseReaction(C, 'a', { offerId: C.pendingReaction.id, optionId: pick(C, 'a:sweep') });
  const json = value => JSON.parse(JSON.stringify(value));
  const saved = json(serializeCoopCombatSnapshot(C));
  const restored = createCoopCombat({ registries, rng: createRng(709, C.rng.getCounters()), players, enemyIds: [], snapshot: json(saved) });
  const decoded = state => decodeCoopCombatSnapshot(serializeCoopCombatSnapshot(state));
  assert.deepEqual(decoded(restored), decoded(C));
  const outs = [C, restored].map(state => {
    chooseReaction(state, 'a', { offerId: state.pendingReaction.id, optionId: pick(state, 'a:guard') });
    chooseReaction(state, 'b', { offerId: state.pendingReaction.id, optionId: pick(state, 'b:sweep') });
    return chooseReaction(state, 'b', { offerId: state.pendingReaction.id, optionId: pick(state, 'b:guard') });
  });
  assert.deepEqual(json(outs[0].events), json(outs[1].events));
  assert.deepEqual(decoded(restored), decoded(C));
  assert.deepEqual(restored.rng.getCounters(), C.rng.getCounters());
});

test('a seat stops at maxDepth, so the fifth copy is never offered', () => {
  const { combat } = fixture({ cardIds: ['strike', 'strike', 'strike', 'strike', 'strike'] });
  for (const enemy of combat.enemies) { enemy.hp = 500; enemy.maxHp = 500; }
  dispatch(combat, { type: 'endTurn' });
  for (const id of ['r0', 'r1', 'r2']) answer(combat, pick(combat, id));
  assert.ok(combat.pendingReaction.id.endsWith(':player:3'));
  // The fourth push reaches maxDepth, so the seat is done and the four entries resolve at once.
  const out = answer(combat, pick(combat, 'r3'));
  assert.equal(combat.pendingReaction, undefined);
  assert.equal(out.events.filter(event => event.type === 'combatReactionStacked' && event.depth === 4).length, 1);
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 4);
  assert.equal(combat.piles.hand.some(inst => inst.instanceId === 'r4'), true);
  assert.equal(combat.turn, 2);
});

// One enemy at 3 HP: a Strike is lethal, so a second Strike stacked on top kills the root's attacker.
function lowHpFixture(cardIds) {
  const built = fixture({ cardIds });
  for (const enemy of built.combat.enemies) enemy.hp = 3;
  dispatch(built.combat, { type: 'endTurn' });
  return built;
}

test('a lethal entry ends the root: the entry beneath it fizzles rootEnded and pays nothing', () => {
  const { combat } = lowHpFixture(['bindingParry', 'strike']);
  answer(combat, pick(combat, 'r0'));
  assert.ok(offeredInstances(combat).includes('r1'));
  const out = answer(combat, pick(combat, 'r1'));
  const fizzled = out.events.filter(event => event.type === 'combatReactionFizzled');
  assert.deepEqual(fizzled.map(event => [event.cardInstanceId, event.reason]), [['r0', 'rootEnded']]);
  assert.ok(out.events.some(event => event.type === 'enemyDied'));
  assert.equal(out.events.some(event => event.type === 'cardPlayed' && event.cardInstanceId === 'r0'), false);
  assert.equal(combat.reactionStack, undefined);
  // Stamina is only what the lethal Strike itself costs, as if it were played alone.
  const alone = lowHpFixture(['strike']);
  answer(alone.combat, pick(alone.combat, 'r0'));
  assert.equal(combat.player.stamina, alone.combat.player.stamina);
});

test('a second Strike is still offered after the first is stacked, though it would kill the attacker', () => {
  const { combat } = lowHpFixture(['strike', 'strike']);
  answer(combat, pick(combat, 'r0'));
  assert.ok(offeredInstances(combat).includes('r1'), 'r1 is offered on top of r0');
});

test('a versionless state carrying a reaction stack or tuning is refused', () => {
  const stack = { groupKey: 'g', entries: [], resolving: false };
  assert.deepEqual(combatReactionProblems({ reactionStack: stack }), ['Paused reaction requires its carried rules']);
  assert.deepEqual(combatReactionProblems({ reactionRules: {} }), ['Paused reaction requires its carried rules']);
  assert.deepEqual(combatReactionProblems({}), []);
});

test('a second Counter from one seat fizzles at resolution even if its saved entry hides the maneuver', () => {
  const { combat, registries } = fixture({ cardIds: ['guardCounter', 'riposte', 'sweepingBlow'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  // An edited save: a second Counter (r1) pushed with its maneuver marker cleared.
  const first = saved.reactionStack.entries[0];
  saved.reactionStack.entries = [{ ...first, maneuver: null }, { ...first, optionId: 'edited', cardId: 'riposte', cardInstanceId: 'r1', play: { ...first.play, cardInstanceId: 'r1' }, maneuver: null }];
  saved.pendingReaction.id = saved.pendingReaction.id.replace(/:1$/, ':2');
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: saved });
  const out = dispatch(restored, { type: 'chooseReaction', offerId: restored.pendingReaction.id, optionId: null });
  assert.deepEqual(out.events.filter(event => event.type === 'cardPlayed').map(event => event.cardInstanceId), ['r1']);
  assert.ok(out.events.some(event => event.type === 'combatReactionFizzled' && event.cardInstanceId === 'r0' && event.reason === 'secondCounter'));
});

test('discard candidates leave out only the choosing seat\'s own stacked cards', async () => {
  const { discardCandidates } = await import('../src/engine/abilityRiders.js');
  const hand = [{ instanceId: 'x1' }, { instanceId: 'x2' }];
  const reactionStack = { entries: [{ side: 'player', ownerId: 'a', play: { cardInstanceId: 'x1' } }] };
  assert.deepEqual(discardCandidates({ playerKey: 'a', piles: { hand }, reactionStack }).map(card => card.instanceId), ['x2']);
  // Seat b holds its own x1 too: the stack entry belongs to a, so b may still discard it.
  assert.deepEqual(discardCandidates({ playerKey: 'b', piles: { hand }, reactionStack }).map(card => card.instanceId), ['x1', 'x2']);
  // Solo play has no playerKey; its entries are owned by 'player'.
  assert.deepEqual(discardCandidates({ piles: { hand }, reactionStack: { entries: [{ side: 'player', ownerId: 'player', play: { cardInstanceId: 'x2' } }] } }).map(card => card.instanceId), ['x1']);
});
