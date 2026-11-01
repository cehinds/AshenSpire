import { primeAccuracyRolls } from './accuracyFixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewIntent } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatRules } from '../src/content/combatRules.js';
import { createFoundation } from '../src/engine/combatRules.js';
import { armCombatCounter, counterCoverageMatches } from '../src/engine/combatMatchups.js';
import { botControlAction } from '../tools/simbot.mjs';
import { payAshenBlight, chooseAshenBlightFeat } from '../src/engine/ashenBlight.js';

function fixture({ version = 1, cardIds = ['guardCounter', 'sweepingBlow'], enemyCount = 2 } = {}) {
  const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
    ? { ...enemy, firstMove: 'slash', attributes: { strength: 6, dexterity: 4, constitution: 4, wisdom: 2, intelligence: 2 }, equipmentSp: 0, moves: { slash: { intent: 'attack', damage: 1, hits: 2, weight: 1,
      tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'] } } } : enemy) });
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: version,
    enemyIds: Array(enemyCount).fill('wanderingSoldier'), player: { classId: 'reaver', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: cardIds.length,
      deck: cardIds.map((cardId, index) => ({ cardId, instanceId: `r${index}`, upgraded: false })) } });
  combat.player.block = 100;
  for (const enemy of combat.enemies) { enemy.intentRevealed = false; enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 }; }
  return { combat, registries };
}
// These lifecycle fixtures exercise landed contacts; preserve real seeded draws
// and saved counters while putting their ordinary Accuracy threshold below every
// non-fumble result. Dedicated stance-hit tests cover misses and natural ones.
function landedContacts(combat) {
  for (const actor of [combat.player, ...combat.enemies]) { actor.accuracy = 100; actor.evasion = 0; }
}

const answer = (combat, optionId = null) => dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId });

test('incoming plans pause before hits, reveal only the actor, and decline resumes roster order once', () => {
  const { combat } = fixture();
  const out = dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.phase, 'enemy');
  assert.ok(combat.pendingReaction?.options.length >= 2);
  assert.equal(out.events.filter(event => event.type === 'damageDealt').length, 0);
  assert.equal(out.events.filter(event => event.type === 'enemyMoveStarted').length, 0);
  assert.equal(previewIntent(combat, 'e1').hidden, false);
  assert.equal(previewIntent(combat, 'e2').hidden, true);
  const before = serializeCombatSnapshot(combat), rng = combat.rng.getCounters();
  assert.throws(() => dispatch(combat, { type: 'chooseReaction', offerId: 'stale' }));
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  assert.deepEqual(combat.rng.getCounters(), rng);
  // Owner 2026-10-12: each fixture enemy spends a 3-SP stat pool (SPEC §4.6a: Dexterity 4 and Constitution 4), so a 1-SP slash is played three times per
  // enemy turn, and each planned move pauses for its own reaction, in roster order: e1 ×3, then e2 ×3.
  const first = answer(combat);
  assert.deepEqual(first.events.filter(event => event.type === 'enemyMoveStarted').map(event => event.sourceId), ['e1']);
  assert.equal(combat.pendingReaction.sourceId, 'e1', "e1's second planned slash pauses next");
  answer(combat);
  assert.equal(combat.pendingReaction.sourceId, 'e1', "and its third");
  answer(combat);
  assert.equal(combat.pendingReaction.sourceId, 'e2');
  answer(combat);
  answer(combat);
  answer(combat);
  assert.equal(combat.turn, 2);
  assert.equal(combat.phase, 'player');
  assert.deepEqual(combat.enemies.map(enemy => enemy.performedMoves), [['slash', 'slash', 'slash'], ['slash', 'slash', 'slash']]);
});

test('headless bot resolves optional offers before trying ordinary player actions', () => {
  const { combat } = fixture();
  dispatch(combat, { type: 'endTurn' });
  let choices = 0;
  while (combat.pendingReaction) {
    const action = botControlAction(combat);
    assert.equal(action.type, 'chooseReaction'); assert.equal(action.optionId, null);
    dispatch(combat, action); choices++;
  }
  assert.equal(choices, 6, 'two enemies, three planned slashes each (3-SP pool, 1 SP per slash)'); assert.equal(combat.turn, 2); assert.equal(combat.phase, 'player');
  assert.equal(combat.eventLog.filter(event => event.type === 'cardPlayed').length, 0);
});

test('one selected Counter pays once and successful multi-hit return follows the whole incoming action', () => {
  const { combat } = fixture({ enemyCount: 1 });
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  assert.ok(option);
  const out = answer(combat, option.id);
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 1);
  assert.equal(out.events.filter(event => event.type === 'combatCounterTriggered').length, 1);
  const trigger = out.events.findIndex(event => event.type === 'combatCounterTriggered');
  const contacts = out.events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'damageDealt' && event.targetId === 'player');
  // The first slash has two hits, both before the Counter's return. The enemy's second planned slash pauses for its own
  // reaction, so its hits are not in this answer's events yet.
  assert.equal(contacts.length, 2, 'the first slash lands both hits before the return');
  assert.ok(contacts.every(({ index }) => index < trigger));
  assert.equal(combat.pendingReaction?.sourceId, 'e1', "the enemy's second planned slash is offered next");
  answer(combat);
  assert.equal(combat.pendingReaction?.sourceId, 'e1', 'and its third (a 3-SP pool)');
  answer(combat);
  assert.equal(combat.eventLog.filter(event => event.type === 'damageDealt' && event.targetId === 'player').length >= 6, true, 'the later slashes land their hits after their own reactions');
  assert.equal(combat.pendingReaction, undefined);
});

test('reload preserves committed plan and all RNG streams through a paid reaction', () => {
  const { combat, registries } = fixture({ enemyCount: 1 });
  dispatch(combat, { type: 'endTurn' });
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const rng = createRng(combat.rng.seed, combat.rng.getCounters());
  const restored = restoreCombatSnapshot({ registries, rng, snapshot });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  assert.deepEqual(answer(combat, option.id), answer(restored, option.id));
  // Compare the persisted JSON representation: absent optional event fields and
  // undefined fields have identical save semantics after a JSON round trip.
  const persisted = state => JSON.parse(JSON.stringify(serializeCombatSnapshot(state)));
  assert.deepEqual(persisted(combat), persisted(restored));
  assert.deepEqual(combat.rng.getCounters(), restored.rng.getCounters());
});

test('pending enemy reactions reject a missing cursor or hand cleanup on restore', () => {
  const { registries } = fixture();
  const players = ['a'].map(id => ({ id, classId: 'reaver', maxHp: 100, hp: 100,
    maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1,
    combatExpansionVersion: 2, deck: [{ cardId: 'guardCounter', instanceId: `${id}:counter`, upgraded: false }] }));
  const combat = fixture().combat;
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction);
  const saved = serializeCombatSnapshot(combat);
  for (const field of ['reactionCursor', 'reactionHandCleanup']) {
    const broken = structuredClone(saved);
    delete broken[field];
    assert.throws(() => restoreCombatSnapshot({ registries, rng: createRng(701), snapshot: broken }), /reaction requires its/);
  }
});

test('historical combat without carried reaction rules keeps immediate hand cleanup', () => {
  const { combat } = fixture({ version: null, enemyCount: 1 });
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.pendingReaction, undefined);
  assert.equal(combat.phase, 'player');
  assert.equal(combat.turn, 2);
});

test('disabled optional prompts survive reload without disabling an armed Counter', () => {
  const { combat, registries } = fixture({ enemyCount: 1 });
  combat.foundation = createFoundation(combatRules);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'r0' });
  const serial = combat.foundation.actionSerial, counters = combat.rng.getCounters(), events = combat.eventLog.length;
  dispatch(combat, { type: 'setReactions', enabled: false });
  assert.equal(combat.foundation.actionSerial, serial);
  assert.deepEqual(combat.rng.getCounters(), counters);
  assert.equal(combat.eventLog.length, events);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, counters),
    snapshot: JSON.parse(JSON.stringify(serializeCombatSnapshot(combat))) });
  for (const state of [combat, restored]) {
    const out = dispatch(state, { type: 'endTurn' });
    assert.equal(state.player.reactionsEnabled, false);
    assert.equal(state.pendingReaction, undefined);
    assert.equal(out.events.filter(event => event.type === 'combatCounterTriggered').length, 1);
    assert.equal(state.turn, 2);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(serializeCombatSnapshot(combat))), JSON.parse(JSON.stringify(serializeCombatSnapshot(restored))));
});

test('preference changes reject malformed and paused commands atomically', () => {
  const { combat } = fixture();
  for (const enabled of ['false', null, 0]) {
    const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
    assert.throws(() => dispatch(combat, { type: 'setReactions', enabled }));
    assert.deepEqual(serializeCombatSnapshot(combat), before);
    assert.deepEqual(combat.rng.getCounters(), counters);
  }
  dispatch(combat, { type: 'endTurn' });
  const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
  assert.throws(() => dispatch(combat, { type: 'setReactions', enabled: false }));
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  assert.deepEqual(combat.rng.getCounters(), counters);
});

test('unaffordable and offensive-only cards do not offer a defensive reaction', () => {
  for (const cardIds of [['strike'], ['guardCounter', 'sweepingBlow']]) {
    const { combat } = fixture({ enemyCount: 1, cardIds });
    combat.player.energy = 0;
    combat.player.stamina = 0;
    combat.player.mana = 0;
    dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.pendingReaction, undefined);
    assert.equal(combat.turn, 2);
  }
});

test('tampered saved reaction commands are rejected atomically', () => {
  const { combat } = fixture({ enemyCount: 1 });
  combat.piles.hand.push({ cardId: 'strike', instanceId: 'ordinary', upgraded: false });
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  option.play = { type: 'playCard', cardInstanceId: 'ordinary', targetId: 'e1' };
  const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
  assert.throws(() => answer(combat, option.id), /no longer playable/);
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  assert.deepEqual(combat.rng.getCounters(), counters);
});

test('a saved offer with a changed price cannot silently charge the canonical cost', () => {
  const { combat } = fixture({ enemyCount: 1 });
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  option.staminaCost += 1;
  const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
  assert.throws(() => answer(combat, option.id), /no longer playable/);
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  assert.deepEqual(combat.rng.getCounters(), counters);
});

test('a defensive Sweep can cancel its attacker without executing its intent', () => {
  const { combat } = fixture();
  landedContacts(combat);
  combat.enemies[0].hp = 1;
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'sweepingBlow');
  assert.ok(option);
  answer(combat, option.id);
  assert.equal(combat.enemies[0].alive, false);
  assert.deepEqual(combat.enemies[0].performedMoves || [], []);
  assert.equal(combat.eventLog.some(event => event.type === 'enemyMoveStarted' && event.sourceId === 'e1'), false);
});

test('paid Counter reply to an automatic return terminates the chain', () => {
  const { combat } = fixture({ cardIds: ['guardCounter', 'strike'], enemyCount: 1 });
  landedContacts(combat);
  primeAccuracyRolls(combat, { count: 3 });
  const enemy = combat.enemies[0];
  enemy.block = 100;
  enemy.combatStance = { camp: 'physical', maneuver: 'counter', range: 'melee', targeting: 'single' };
  armCombatCounter(combat, enemy, { moveId: 'returnCarrier',
    tags: ['camp:physical', 'maneuver:counter', 'range:melee', 'targeting:single'],
    combatProfile: { ...enemy.combatStance, damageType: 'blunt' } }, { payload: { hp: 1, poise: 0, ward: 0 } });
  const coverage = combat.combatExpansionRules.matchups.counter.defaultCoverage.melee;
  const returnProfile = { camp: 'physical', maneuver: 'counter', range: 'melee', targeting: 'single', counterReturnAttack: true };
  assert.equal(counterCoverageMatches(coverage, returnProfile), true, 'automatic Counter return uses Attack delivery for coverage');
  assert.equal(counterCoverageMatches(coverage, { ...returnProfile, counterReturnAttack: false }), false, 'ordinary Counter identity does not widen coverage');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'r1', targetId: enemy.id });
  assert.ok(combat.pendingReaction?.options.length, 'the automatic return offers a paid Counter reply');
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  const out = answer(combat, option.id);
  assert.deepEqual(out.events.filter(event => event.type === 'combatCounterTriggered').map(event => event.sourceKind), ['enemy', 'player']);
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 1);
  assert.equal(combat.pendingReaction, undefined);
  assert.equal(combat.queue.length, 0);
  assert.equal(combat.pendingExpansionActions, 0);
});

test('nested paid Sweep discard resumes a player-phase Counter return exactly after reload', () => {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'sweepingBlow'
    ? { ...card, effects: [{ op: 'discard', choose: true, amount: 1 }, ...card.effects] } : card) });
  const player = { id: 'a', classId: 'reaver', hp: 100, maxHp: 100, mana: 20, maxMana: 20,
    stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 3, combatExpansionVersion: 2,
    deck: [{ cardId: 'guardCounter', instanceId: 'filler', upgraded: false },
      { cardId: 'strike', instanceId: 'strike', upgraded: false }, { cardId: 'sweepingBlow', instanceId: 'sweep', upgraded: false }] };
  const combat = createCombat({ registries, rng: createRng(701), player, enemyIds: ['wanderingSoldier'], combatExpansionVersion: 2, reactionRulesVersion: 1 });
  landedContacts(combat);
  combat.foundation = createFoundation(combatRules);
  const owner = combat.player;
  owner.block = 100;
  const enemy = combat.enemies[0]; enemy.block = 100;
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  enemy.combatStance = { camp: 'physical', maneuver: 'counter', range: 'melee', targeting: 'single' };
  armCombatCounter(combat, enemy, { moveId: 'returnCarrier',
    tags: ['camp:physical', 'maneuver:counter', 'range:melee', 'targeting:single'],
    combatProfile: { ...enemy.combatStance, damageType: 'blunt' } }, { payload: { hp: 1, poise: 0, ward: 0 } });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'strike', targetId: enemy.id });
  const optionId = combat.pendingReaction.options.find(option => option.cardId === 'sweepingBlow').id;
  answer(combat, optionId);
  assert.ok(combat.reactionResume); assert.ok(combat.pendingAbilityDiscard); assert.equal(combat.reactionCursor, undefined);
  for (const mutate of [context => { context.actionSerial = -1; }, context => { context.eventCount = -1; },
    context => { context.rolls = { invalid: 1 }; }, context => { context.counts = { invalid: -1 }; }]) {
    const original = structuredClone(combat.reactionResume.foundation);
    mutate(combat.reactionResume.foundation);
    assert.throws(() => serializeCombatSnapshot(combat), /reaction foundation context/);
    combat.reactionResume.foundation = original;
  }
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const rng = createRng(701, combat.rng.getCounters());
  const restored = restoreCombatSnapshot({ registries, rng, snapshot });
  const settle = state => dispatch(state, { type: 'chooseDiscard', cardInstanceIds: ['filler'] });
  assert.deepEqual(JSON.parse(JSON.stringify(settle(combat))), JSON.parse(JSON.stringify(settle(restored))));
  const saved = state => serializeCombatSnapshot(state);
  assert.deepEqual(JSON.parse(JSON.stringify(saved(combat))), JSON.parse(JSON.stringify(saved(restored))));
  assert.deepEqual(combat.rng.getCounters(), restored.rng.getCounters());
  assert.equal(combat.queue.length, 0); assert.equal(combat.pendingExpansionActions, 0);
  for (const key of ['pendingReaction', 'reactionResume', 'pendingAbilityDiscard', 'pendingAbilityPlay']) assert.equal(combat[key], undefined);
  assert.equal(combat.phase, 'player');
});

test('terminal reaction victory and defeat retire continuation before durable commit in both engines', () => {
  for (const result of ['victory', 'defeat']) {
    const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
      ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'attack', damage: 100, hits: 1, weight: 1,
        tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'] } } } : enemy) });
    const player = { id: 'a', classId: 'reaver', hp: 100, maxHp: 100, mana: 20, maxMana: 20,
      stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 1, combatExpansionVersion: 2,
      deck: [{ cardId: 'guardCounter', instanceId: 'terminal-counter', upgraded: false }] };
    const combat = createCombat({ registries, rng: createRng(17), player, enemyIds: ['wanderingSoldier'], combatExpansionVersion: 2, reactionRulesVersion: 1 });
    combat.foundation = createFoundation(combatRules);
    // Seed 17 rolls a natural 20 on the first Counter Accuracy check. The
    // real seeded stream survives transactional clones and exact restoration.
    const owner = combat.player;
    owner.block = result === 'victory' ? 10000 : 0;
    if (result === 'defeat') owner.hp = 1;
    else combat.enemies[0].hp = 1;
    const save = state => serializeCombatSnapshot(state);
    let refused = false, terminalSave = null;
    combat.beforeCombatCommit = candidate => {
      const snapshot = save(candidate);
      if (refused) throw new Error('Terminal save refused');
      if (candidate.result) terminalSave = JSON.parse(JSON.stringify(snapshot));
    };
    dispatch(combat, { type: 'endTurn' });
    assert.ok(combat.pendingReaction);
    const before = JSON.parse(JSON.stringify(save(combat))), counters = combat.rng.getCounters();
    const intent = { offerId: combat.pendingReaction.id,
      optionId: result === 'victory' ? combat.pendingReaction.options.find(option => option.cardId === 'guardCounter' && !option.play.upcastTier).id : null };
    const answerTerminal = () => dispatch(combat, { type: 'chooseReaction', ...intent });
    refused = true;
    assert.throws(answerTerminal, /Terminal save refused/);
    assert.deepEqual(JSON.parse(JSON.stringify(save(combat))), before);
    assert.deepEqual(combat.rng.getCounters(), counters);
    refused = false; answerTerminal();
    assert.equal(combat.phase, 'ended', JSON.stringify({ result, hp: owner.hp,
      enemyHp: combat.enemies[0].hp, events: combat.eventLog.slice(-24) })); assert.equal(combat.result, result);
    assert.ok(terminalSave, 'the durable callback can serialize the terminal candidate before adoption');
    for (const field of ['reactionCursor', 'pendingReaction', 'reactionResume', 'reactionHandCleanup']) assert.equal(combat[field], undefined);
    assert.equal(combat.queue.length, 0); assert.equal(combat.pendingExpansionActions, 0);
    assert.equal(combat.eventLog.filter(event => event.type === 'combatEnd').length, 1);
    assert.equal(combat.eventLog.filter(event => event.type === 'enemyActorTurnStarted').length, 1);
    assert.equal(combat.eventLog.filter(event => event.type === 'cardPlayed').length, result === 'victory' ? 1 : 0);
    const restoredRng = createRng(17, combat.rng.getCounters());
    const restored = restoreCombatSnapshot({ registries, rng: restoredRng, snapshot: terminalSave });
    const comparable = state => save(state);
    assert.deepEqual(JSON.parse(JSON.stringify(comparable(restored))), JSON.parse(JSON.stringify(comparable(combat))));
    assert.deepEqual(restored.rng.getCounters(), combat.rng.getCounters());
  }
});

test('a terminal Blight play saves ended combat under the new reaction rules', () => {
  const seed = Array.from({ length: 100 }, (_, index) => index + 1).find(value => createRng(value).float('ashenBlight') < .9);
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'guardCounter'
    ? { ...card, ashenBlightCost: 12 } : card), enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
    ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'attack', damage: 1, hits: 1, weight: 1,
      tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'] } } } : enemy) });
  const combat = createCombat({ registries, rng: createRng(seed), enemyIds: ['wanderingSoldier'], combatExpansionVersion: 2,
    reactionRulesVersion: 1, player: { classId: 'reaver', hp: 100, maxHp: 100, mana: 20, maxMana: 20,
      stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 1,
      deck: [{ cardId: 'guardCounter', instanceId: 'blight-counter', upgraded: false }] } });
  payAshenBlight({ combatExpansionVersion: 2, draw: () => .5 }, combat.player, { amount: 88, receiptId: 'prior', combatKey: 'previous' });
  for (const threshold of [25, 50, 75]) chooseAshenBlightFeat(combat, combat.player, { threshold, path: 'survivor' });
  let terminal;
  combat.beforeCombatCommit = candidate => { if (candidate.result) terminal = JSON.parse(JSON.stringify(serializeCombatSnapshot(candidate))); };
  assert.equal(combat.reactionRulesVersion, 1);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'blight-counter' });
  assert.equal(combat.result, 'defeat'); assert.equal(combat.player.ashenBlight.thresholdOutcome, 'lost');
  assert.ok(terminal); assert.equal(combat.queue.length, 0); assert.equal((terminal.queue || []).length, 0);
  for (const field of ['reactionCursor', 'pendingReaction', 'reactionResume', 'reactionHandCleanup']) assert.equal(terminal[field], undefined);
  assert.equal(combat.eventLog.filter(event => event.type === 'enemyMoveStarted').length, 0);
  const rng = createRng(seed, combat.rng.getCounters());
  const restored = restoreCombatSnapshot({ registries, rng, snapshot: terminal });
  assert.deepEqual(JSON.parse(JSON.stringify(serializeCombatSnapshot(restored))), terminal);
  assert.deepEqual(rng.getCounters(), combat.rng.getCounters());
});

