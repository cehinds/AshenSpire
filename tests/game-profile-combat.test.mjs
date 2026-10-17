import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, resolvedCardPlayCosts } from '../src/engine/combat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { profileDamageReceipt, profileCardCosts, setProfileStance } from '../src/engine/gameProfileCombat.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const author = modules => ({ formatVersion: 1, core: 'ashen.core@1.0.0', modules });
const profile = modules => resolveGameProfile(author(modules || {}));
const carrier = maneuver => ({ combatProfile: { maneuver, camp: 'physical' } });
function world(modules = {}) {
  const gameProfile = profile(modules);
  const events = [];
  return { gameProfile, turn: 1, rng: createRng(17), emit: (type, payload) => events.push({ type, ...payload }), events };
}
const fighter = (id, extra = {}) => ({ id, kind: id === 'player' ? 'player' : 'enemy', hp: 80, maxHp: 80,
  alive: true, block: 0, statuses: {}, ratings: { ar: 2, dr: 1, poise: 0 }, ...extra });
function live(modules = {}, selectedProfile = null, moves = null) {
  const gameProfile = selectedProfile || profile(modules);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(moves ? { ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, id: 'profileTestSoldier', firstMove: 'slash', attributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 }, moves } : enemy) } : contentBundle, gameProfile)), gameProfile);
  const deck = Array.from({ length: 10 }, (_, i) => ({ instanceId: `core-${i}`, cardId: i < 6 ? 'core.strike' : 'core.defend', upgraded: false }));
  const combat = createCombat({ registries, rng: createRng(311), gameProfile, enemyIds: [moves ? 'profileTestSoldier' : 'wanderingSoldier'],
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxStamina: 10, stamina: 10, maxMana: 5, mana: 5,
      energyMax: 10, drawPerTurn: 5, poiseMax: 4, attributes: { intelligence: 1, strength: 2, dexterity: 1 }, deck } });
  return { combat, registries };
}

test('unified Block then pure Poise receipts agree in live application and preview', () => {
  const ctx = world(), source = fighter('player'), target = fighter('foe', { block: 3, gameProfilePoise: 8 });
  const before = structuredClone(target), rngBefore = ctx.rng.getCounters();
  const expected = profileDamageReceipt(ctx, source, target, 10, carrier('attack'));
  assert.equal(expected.hpLoss, 6); // (10+2 AR-3 Block)*.75 floored
  const preview = previewDamageHits(ctx, source, target, 10, [], carrier('attack'));
  assert.equal(preview.hpLoss, expected.hpLoss);
  assert.deepEqual(target, before); assert.deepEqual(ctx.rng.getCounters(), rngBefore);
  applyAttackDamage(ctx, source, target, 10, [], carrier('attack'));
  assert.equal(target.hp, before.hp - expected.hpLoss);
  assert.equal(target.block, expected.blockRemaining);
  assert.equal(target.gameProfilePoise, 8, 'Poise never depletes into a legacy break');
});

test('zero input remains zero; full Block never resurrects damage at Poise floor', () => {
  const ctx = world({ effects: { attackRatingWeight: 0 } });
  const source = fighter('player'), target = fighter('foe', { block: 20, gameProfilePoise: 10 });
  assert.equal(profileDamageReceipt(ctx, source, target, 0, carrier('attack')).hpLoss, 0);
  assert.equal(profileDamageReceipt(ctx, source, target, 1, carrier('attack')).hpLoss, 0);
});

test('defense order is selected JSON policy; defenses off passes damage through', () => {
  const source = fighter('player'), target = fighter('foe', { block: 3, gameProfilePoise: 5 });
  const a = world({ effects: { attackRatingWeight: 0 } });
  const b = world({ effects: { attackRatingWeight: 0 }, defenses: { order: ['poise', 'block'] } });
  assert.equal(profileDamageReceipt(a, source, target, 10).hpLoss, 5);
  assert.equal(profileDamageReceipt(b, source, target, 10).hpLoss, 4);
  assert.equal(profileDamageReceipt(world({ defenses: false, effects: { attackRatingWeight: 0 } }), source, target, 10).hpLoss, 10);
});

test('Evade uses probability and supplied roll, preview exposes bounds without RNG consumption', () => {
  const ctx = world(), source = fighter('player'), target = fighter('foe', { combatStance: { maneuver: 'evade' } });
  const counters = ctx.rng.getCounters();
  const preview = previewDamageHits(ctx, source, target, 5, [], carrier('attack'));
  assert.equal(preview.uncertain, true); assert.ok(preview.hitChance > 0 && preview.hitChance < 1);
  assert.deepEqual(preview.hpLossBounds, [0, 14]);
  assert.deepEqual(ctx.rng.getCounters(), counters);
  assert.equal(profileDamageReceipt(ctx, source, target, 5, carrier('attack'), { roll: 0.999 }).hpLoss, 0);
  assert.equal(profileDamageReceipt(ctx, source, target, 5, carrier('attack'), { roll: 0 }).hpLoss, 14);
});

test('stance relation comes from JSON and disabled stances remain neutral', () => {
  const ctx = world(), target = fighter('foe', { combatStance: { maneuver: 'defend' } });
  assert.equal(profileDamageReceipt(ctx, fighter('player'), target, 5, carrier('smash')).advantage, true);
  const off = world({ stances: false });
  assert.equal(profileDamageReceipt(off, fighter('player'), target, 5, carrier('smash')).advantage, false);
  setProfileStance(off, target, carrier('smash')); assert.equal(target.combatStance.maneuver, 'neutral');
});

test('authored resource variants are selected before pricing, including resource-off', () => {
  for (const include of [[], ['sp'], ['mp'], ['sp', 'mp']]) {
    const ctx = world({ resources: { include } });
    const def = projectGameCard(ctx, 'core.strike');
    const costs = profileCardCosts(ctx, def);
    assert.equal(costs.stamina, include.includes('sp') ? def.staminaCost : 0);
    assert.equal(costs.mana, include.includes('mp') ? def.manaCost : 0);
    if (!include.includes('sp')) assert.throws(() => profileCardCosts(ctx, { id: 'unsafe', cost: 3, manaCost: 0 }), /authored disabled-resource variant/);
  }
});

test('configured live combat permits multiple SP-priced cards then refreshes whole pool', () => {
  const { combat } = live();
  assert.equal(combat.piles.hand.length, 5);
  const targetId = combat.enemies[0].id;
  for (const card of combat.piles.hand.slice(0, 2)) dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId });
  assert.equal(combat.player.stamina, 8); assert.equal(combat.piles.discard.length, 2);
  const ids = Object.values(combat.piles).flat().map(card => card.instanceId).sort();
  dispatch(combat, { type: 'endTurn' });
  while (combat.pendingReaction) answerReaction(combat);
  assert.equal(combat.piles.hand.length, 5); assert.equal(combat.piles.discard.length, 0);
  assert.deepEqual(Object.values(combat.piles).flat().map(card => card.instanceId).sort(), ids);
});

test('card preview and executed configured damage share one receipt path', () => {
  const { combat } = live();
  const card = combat.piles.hand.find(card => card.cardId === 'core.strike');
  const target = combat.enemies[0]; target.hp = target.maxHp = 200; target.block = 3; target.gameProfilePoise = 3;
  const preview = previewCard(combat, card.instanceId, target.id);
  const before = target.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target.id });
  const damage = out.events.find(event => event.type === 'damageDealt' && event.targetId === target.id);
  assert.equal(preview.values.find(effect => effect.op === 'damage').value, damage.amount);
  assert.equal(before - target.hp, damage.hpLoss);
});

test('configured snapshot resumes pinned rules and refuses a different run profile', () => {
  const { combat, registries } = live();
  const snapshot = serializeCombatSnapshot(combat);
  const restored = restoreCombatSnapshot({ registries, snapshot, rng: createRng(combat.rng.seed), expectedGameProfile: combat.gameProfile });
  assert.equal(restored.gameProfile.hash, combat.gameProfile.hash);
  assert.deepEqual(serializeCombatSnapshot(restored), snapshot);
  assert.throws(() => restoreCombatSnapshot({ registries, snapshot, rng: createRng(combat.rng.seed), expectedGameProfile: profile({ stances: false }) }), /profile.*match/);
});

test('cards-off fallback attacks once then yields even with all optional resource pools off', () => {
  const { combat } = live({ cards: false, resources: false, defenses: false, stances: false });
  assert.equal(combat.piles.hand.length, 0);
  const turn = combat.turn;
  dispatch(combat, { type: 'basicAttack', targetId: combat.enemies[0].id });
  assert.ok(combat.turn > turn || combat.result);
  assert.equal(combat.player.stamina, 0);
});

test('actual core run hands the same pin and derived AR/DR to the live combat factory', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { deriveStat } = await import('../src/model/derivedStats.js');
  const gameProfile = profile();
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const run = createRunState({ registries, seed: 729, classId: 'reaver' });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.gameProfile.hash, run.gameProfile.hash);
  for (const id of ['ar', 'dr']) assert.equal(combat.player.ratings[id], deriveStat(run.derivedStatRuleSnapshot.rules, id,
    { attributes: run.attributes, classDef: registries.classes.get(run.class), level: run.level.level }).value);
  assert.equal(combat.piles.hand.length, 5);
  const card = combat.piles.hand[0], targetId = combat.enemies[0].id;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId });
  assert.equal(combat.player.counters.cardsPlayedThisTurn, 1);
  assert.deepEqual(combat.skillXp, {}, 'configured core does not gain legacy skill XP');
});

test('current profile uses right-first placement while legacy combat keeps absent occupancy and identical combat traces', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const current = resolveGameProfile('current');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ registries, seed: 177, classId: 'reaver' });
  const absentRun = structuredClone(run); delete absentRun.gameProfile;
  const selectedRun = structuredClone(run); selectedRun.gameProfile = current;
  const absent = createRunCombat({ registries, run: absentRun, rng: createRng(177), enemyIds: ['wanderingSoldier'] });
  const selected = createRunCombat({ registries, run: selectedRun, rng: createRng(177), enemyIds: ['wanderingSoldier'] });
  const assertParity = () => {
    const selectedSnapshot = serializeCombatSnapshot(selected), absentSnapshot = serializeCombatSnapshot(absent);
    assert.deepEqual(selectedSnapshot.formationPolicy, current.modules.formation);
    assert.equal(selectedSnapshot.player.formationCell, 'C1');
    assert.deepEqual(selectedSnapshot.enemies.map(enemy => enemy.formationCell), ['C4'], 'profile-backed fresh enemies start at back right');
    // Legacy fights have no authoritative occupancy; they do not acquire the new default order.
    assert.equal(absentSnapshot.formationPolicy, undefined);
    assert.equal(absentSnapshot.player.formationCell, undefined);
    assert(absentSnapshot.enemies.every(enemy => enemy.formationCell === undefined));
    // Remove exactly the profile pin and its asserted positional metadata.
    // Every combat value, pile, receipt and event remains an exact comparison.
    const { gameProfile, gameProfileCommands, gameProfileInterrupts, formationPolicy, ...state } = selectedSnapshot;
    const { formationCell, ...player } = state.player;
    const enemies = state.enemies.map(({ formationCell, ...enemy }) => enemy);
    assert.deepEqual({ ...state, player, enemies }, absentSnapshot);
    assert.deepEqual(selected.rng.getCounters(), absent.rng.getCounters());
  };
  assertParity();
  assert.deepEqual(dispatch(selected, { type: 'endTurn' }), dispatch(absent, { type: 'endTurn' }));
  assertParity();
});

test('a real run with only cards disabled gets attack/pass rather than stale starter cards', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const gameProfile = profile({ cards: false });
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const run = createRunState({ registries, seed: 142, classId: 'reaver' });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  assert.equal(run.deck.length, 0); assert.equal(combat.piles.hand.length, 0);
  dispatch(combat, { type: 'basicAttack', targetId: combat.enemies[0].id });
  assert.ok(combat.turn === 2 || combat.result);
});

test('live Evade uses seeded candidate RNG while card preview exposes only chance and bounds', () => {
  const { combat } = live();
  const card = combat.piles.hand.find(card => card.cardId === 'core.strike'), target = combat.enemies[0];
  target.hp = target.maxHp = 200; target.combatStance = { maneuver: 'evade' };
  const counters = combat.rng.getCounters();
  const shown = previewCard(combat, card.instanceId, target.id).values.find(effect => effect.op === 'damage');
  assert.equal(shown.uncertain, true); assert.ok(shown.hitChance > 0 && shown.hitChance < 1);
  assert.deepEqual(combat.rng.getCounters(), counters);
  const roll = createRng(combat.rng.seed, counters).float('combatAvoidance');
  const expected = profileDamageReceipt(combat, combat.player, target, 6, carrier('attack'), { roll });
  const before = target.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target.id });
  assert.equal(before - target.hp, expected.hpLoss);
  assert.notDeepEqual(combat.rng.getCounters(), counters);
});

test('failed configured transaction rolls back a consumed accuracy draw and HP', () => {
  const { combat } = live();
  combat.player.combatStance = { maneuver: 'evade' };
  const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
  const source = combat.enemies[0];
  combat.enqueue({ effect: { op: 'damage', target: 'player', amount: 9 }, source, target: combat.player, card: carrier('attack'), meta: {} });
  combat.enqueue({ effect: { op: 'unknown-test-op' }, source, target: combat.player, meta: {} });
  assert.throws(() => dispatch(combat, { type: 'endTurn' }), /Unknown opcode/);
  assert.deepEqual(combat.rng.getCounters(), counters); assert.equal(combat.player.hp, before.player.hp);
  assert.deepEqual(combat.piles, before.piles);
  assert.equal(combat.turn, before.turn);
});

test('work budget rejects another free card atomically while End Turn remains legal', () => {
  const { combat } = live({ resources: false, cards: { freeCommandLimit: 1 }, reactions: false });
  const targetId = combat.enemies[0].id;
  dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId, targetId });
  const before = serializeCombatSnapshot(combat);
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId, targetId }), /work budget/);
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.turn > before.turn || combat.result);
});

test('DR Block weight changes authored protection and its card face and live gain together', () => {
  for (const weight of [0, 1]) {
    const { combat } = live({ effects: { defenseRatingWeight: weight } });
    combat.player.ratings.dr = 3;
    const inst = { instanceId: 'weight-defend', cardId: 'core.defend', upgraded: false };
    combat.piles.hand.push(inst);
    const shown = previewCard(combat, inst.instanceId).values.find(value => value.op === 'block').value;
    const before = combat.player.block;
    const out = dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId });
    const gained = out.events.find(event => event.type === 'blockGained' && event.targetId === combat.player.id);
    assert.equal(shown, 5 + 3 * weight);
    assert.equal(gained.amount, shown); assert.equal(combat.player.block - before, shown);
  }
});

test('configured attack card faces match executed receipts across Block Poise and stance contexts', () => {
  for (const context of [
    { block: 0, poise: 0, maneuver: 'neutral' },
    { block: 3, poise: 5, maneuver: 'defend' },
    { block: 100, poise: 5, maneuver: 'defend' },
    { block: 0, poise: 5, maneuver: 'prepared' },
  ]) {
    for (const cardId of ['core.strike', 'core.smash', 'core.sweep']) {
      const { combat } = live();
      combat.player.ratings.ar = 2;
      const target = combat.enemies[0]; target.hp = target.maxHp = 1000;
      target.block = context.block; target.gameProfilePoise = context.poise;
      target.combatStance = { maneuver: context.maneuver };
      const inst = { instanceId: 'matrix-action', cardId, upgraded: false }; combat.piles.hand.push(inst);
      const shown = previewCard(combat, inst.instanceId, target.id).values.find(value => value.op === 'damage');
      const before = target.hp;
      const out = dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: target.id });
      const actual = out.events.find(event => event.type === 'damageDealt' && event.targetId === target.id);
      assert.equal(shown.value, actual.amount, `${cardId} ${JSON.stringify(context)}`);
      assert.equal(shown.perTarget[target.id], actual.amount);
      assert.equal(before - target.hp, actual.hpLoss);
    }
  }
});

test('configured Counter keeps damage deferred and targets its support', async () => {
  const { immediateCardEffects } = await import('../src/model/combatCardEffects.js');
  const { cardTargetPlan } = await import('../src/model/cardTargets.js');
  const def = projectGameCard(profile(), 'core.counter');
  const enemy = fighter('e1'), player = fighter('player');
  assert.equal(immediateCardEffects(def).some(effect => effect.op === 'damage'), false);
  assert.equal(cardTargetPlan(def, player.id, [enemy], [player], { solo: true }).mode, 'friendly');
});

const counterMoves = {
  slash: { intent: 'attack', damage: 1, hits: 2, weight: 1,
    tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'] },
};
const answerReaction = (combat, cardId = null) => dispatch(combat, { type: 'chooseReaction',
  offerId: combat.pendingReaction.id,
  optionId: cardId ? combat.pendingReaction.options.find(option => option.cardId === cardId)?.id : null });
const addCounter = combat => combat.piles.hand.push({ instanceId: 'deferred-counter', cardId: 'core.counter', upgraded: false });

test('core Counter arms on play, then returns once after a fully blocked attack', () => {
  const { combat } = live({ reactions: false }, null, counterMoves);
  addCounter(combat);
  const enemy = combat.enemies[0], hp = enemy.hp;
  const played = dispatch(combat, { type: 'playCard', cardInstanceId: 'deferred-counter' });
  assert.ok(combat.player.combatCounter);
  assert.equal(enemy.hp, hp);
  assert.equal(played.events.filter(event => event.type === 'damageDealt').length, 0);
  const ended = dispatch(combat, { type: 'endTurn' });
  const replies = ended.events.filter(event => event.type === 'damageDealt' && event.sourceId === 'player');
  assert.equal(replies.length, 1, 'the prepared reply is neither immediate nor duplicated for multiple contacts');
  assert.equal(ended.events.filter(event => event.type === 'combatCounterTriggered').length, 1);
  assert.equal(ended.events.filter(event => event.type === 'damageDealt' && event.sourceId === enemy.id).length, 2);
  assert.ok(enemy.hp < hp);
  const incoming = ended.events.filter(event => event.type === 'damageDealt' && event.sourceId === enemy.id);
  assert.ok(incoming.every(event => event.amount === 0 && event.blocked === 0),
    'the positive one-point contacts mitigate to zero but still trigger the prepared Counter');
});

test('an authored zero-damage contact cannot fabricate a Counter trigger', () => {
  const zeroMoves = { slash: { ...counterMoves.slash, damage: 0 } };
  const { combat } = live({ reactions: false }, null, zeroMoves);
  addCounter(combat);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'deferred-counter' });
  const ended = dispatch(combat, { type: 'endTurn' });
  assert.equal(ended.events.filter(event => event.type === 'combatCounterTriggered').length, 0);
  assert.equal(ended.events.filter(event => event.type === 'damageDealt' && event.sourceId === 'player').length, 0);
});

test('core incoming attacks offer paid Counter reactions and save/resume the same contact plan', () => {
  const { combat, registries } = live({}, null, counterMoves);
  addCounter(combat);
  const hp = combat.enemies[0].hp;
  const begun = dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction?.options.some(option => option.cardId === 'core.counter'));
  assert.equal(begun.events.filter(event => event.type === 'damageDealt').length, 0);
  const snapshot = serializeCombatSnapshot(combat);
  const restored = restoreCombatSnapshot({ registries, snapshot, rng: createRng(combat.rng.seed, combat.rng.getCounters()), expectedGameProfile: combat.gameProfile });
  const a = answerReaction(combat, 'core.counter');
  const b = answerReaction(restored, 'core.counter');
  assert.deepEqual(a, b);
  while (combat.pendingReaction) {
    const next = answerReaction(combat), replay = answerReaction(restored);
    assert.deepEqual(next, replay);
    a.events.push(...next.events);
  }
  assert.deepEqual(serializeCombatSnapshot(combat), serializeCombatSnapshot(restored));
  assert.equal(a.events.filter(event => event.type === 'combatCounterTriggered').length, 1);
  assert.equal(a.events.filter(event => event.type === 'damageDealt' && event.sourceId === 'player').length, 1);
  assert.equal(combat.player.stamina, 10, 'next player turn refreshes the paid reaction resource');
  assert.ok(combat.enemies[0].hp < hp);
});

test('reactions module off suppresses windows and preferences while prepared Counter still works', () => {
  for (const modules of [{ reactions: false }, { reactions: { chainLimit: 0 } }]) {
    const { combat } = live(modules, null, counterMoves);
    addCounter(combat);
    const out = dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.pendingReaction, undefined);
    assert.equal(combat.reactionStack, undefined);
    assert.equal(out.events.filter(event => event.type === 'damageDealt' && event.sourceId === 'player').length, 0);
    assert.throws(() => dispatch(combat, { type: 'setReactions', enabled: true }), /unavailable/);
  }
});

test('core reaction chains obey the authored chain limit and preserve paid resources', () => {
  for (const chainLimit of [1, 2]) {
    const { combat } = live({ reactions: { chainLimit } }, null, counterMoves);
    combat.piles.hand = [0, 1, 2].map(i => ({ instanceId: `reaction-defend-${i}`, cardId: 'core.defend', upgraded: false }));
    dispatch(combat, { type: 'endTurn' });
    let reactions = 0;
    const events = [];
    while (combat.pendingReaction) {
      assert.ok(reactions < 4, 'the saved cap ends the stack');
      events.push(...answerReaction(combat, 'core.defend').events);
      reactions++;
    }
    assert.equal(reactions, chainLimit);
    assert.equal(events.filter(event => event.type === 'cardPlayed' && event.cardId === 'core.defend').length, chainLimit);
    assert.equal(events.filter(event => event.type === 'damageDealt' && event.sourceId === combat.enemies[0].id).length, 2);
  }
});

test('configured enemy reaction triggers pause a player root and resolve it once', () => {
  const moves = { ...counterMoves, riposte: { intent: 'attack', damage: 1,
    reaction: { on: ['playerAction'], minIncoming: 1, chance: 1 },
    tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'] } };
  const { combat } = live({}, null, moves);
  addCounter(combat);
  const strike = combat.piles.hand.find(card => card.cardId === 'core.strike');
  const before = combat.enemies[0].hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: combat.enemies[0].id });
  assert.equal(out.events.filter(event => event.type === 'combatEnemyReactionStacked').length, 1);
  assert.ok(combat.pendingReaction);
  const end = answerReaction(combat);
  assert.equal(end.events.filter(event => event.type === 'damageDealt' && event.sourceId === 'player').length, 1);
  assert.ok(combat.enemies[0].hp < before);
  assert.equal(combat.pendingReaction, undefined);
});

test('core Counter loses coverage after changing stance while stances-off keeps the card mechanic', () => {
  for (const cardId of ['core.strike', 'core.defend']) {
    const { combat } = live({ reactions: false }, null, counterMoves);
    addCounter(combat);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'deferred-counter' });
    const next = combat.piles.hand.find(card => card.cardId === cardId);
    dispatch(combat, { type: 'playCard', cardInstanceId: next.instanceId, ...(cardId === 'core.strike' ? { targetId: combat.enemies[0].id } : {}) });
    const out = dispatch(combat, { type: 'endTurn' });
    assert.equal(out.events.filter(event => event.type === 'combatCounterTriggered').length, 0);
  }
  const { combat } = live({ reactions: false, stances: false }, null, counterMoves);
  addCounter(combat);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'deferred-counter' });
  const out = dispatch(combat, { type: 'endTurn' });
  assert.equal(out.events.filter(event => event.type === 'combatCounterTriggered').length, 1);
});

test('configured Counter face shows its eventual unified return receipt', () => {
  const { combat } = live({ reactions: false }, null, counterMoves);
  addCounter(combat);
  combat.player.ratings.ar = 2;
  const enemy = combat.enemies[0];
  const shown = previewCard(combat, 'deferred-counter', enemy.id).values.find(value => value.op === 'damage').value;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'deferred-counter' });
  const out = dispatch(combat, { type: 'endTurn' });
  const reply = out.events.find(event => event.type === 'damageDealt' && event.sourceId === 'player');
  assert.equal(shown, reply.amount);
});
