import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeLineagePlanProblems, rangeLineageProblems, rangeSiteBatchesProblems, rangeOriginProblems } from '../src/model/combatRangeLineageState.js';
import { contentBundle } from '../src/content/index.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { rangePairKey } from '../src/model/combatEngagement.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { gameDigest } from '../engine/kernel/gameConfig.js';
const json = value => JSON.parse(JSON.stringify(value));

const actors = ['player:player', 'enemy:e1', 'enemy:e2'];
const delivery = { coverage: 1, weapon: true, throwCapable: false, bypass: false, sourceWeaponId: 'halberd' };
function receipt() {
  const rangePlan = { rootId: 'root:42', sourceKey: actors[0], targets: [{ contactId: 'return:1', targetKey: actors[2], ...delivery }] };
  const graph = { version: 1, rootId: rangePlan.rootId, sourceKey: actors[0], sites: [
    { id: 'strike', targetKey: actors[1], parentId: null, events: [{ type: 'damageDealt' }], delivery: { ...delivery } },
    { id: 'return', targetKey: actors[2], parentId: 'strike', events: [{ type: 'statusApplied', status: 'vulnerable' }], delivery: { ...delivery } },
  ], edges: [{ id: 'edge:1', parentId: 'strike', event: 'damageDealt', triggerKey: 'status:riposte', effectIndex: 0,
    targets: [{ targetKey: actors[2], siteId: 'return', contactId: 'return:1', batch: 0 }] }] };
  return { graph, rangePlan };
}

test('a frozen lineage binds its paid target, delivery, event and typed actor without consulting live equipment', () => {
  const { graph, rangePlan } = receipt();
  assert.deepEqual(rangeLineagePlanProblems(graph, rangePlan, actors), []);
  const lineage = { version: 1, rootId: graph.rootId, edgeId: 'edge:1' };
  assert.deepEqual(rangeLineageProblems(lineage, graph), []);
  assert.deepEqual(rangeSiteBatchesProblems([[{ id: 'e2', siteId: 'return' }]], graph, { edgeId: lineage.edgeId }), []);
  assert.deepEqual(rangeOriginProblems({ version: 1, rootId: graph.rootId, sourceKey: actors[0], siteId: 'strike' }, { type: 'damageDealt' }, graph, lineage), []);
  for (const mutate of [
    g => { g.version = 2; },
    g => { g.sourceKey = actors[1]; },
    g => { g.sites[1].targetKey = 'player:other'; },
    g => { g.sites[1].delivery.coverage = 2; },
    g => { g.sites[1].parentId = 'return'; },
    g => { g.edges[0].parentId = 'return'; },
    g => { g.edges[0].event = 'hpLost'; },
    g => { g.edges[0].targets[0].contactId = 'unpaid'; },
    g => { g.edges[0].targets[0].targetKey = actors[1]; },
    g => { g.edges[0].targets.push({ ...g.edges[0].targets[0] }); },
    g => { g.edges[0].unrecognized = true; },
  ]) {
    const broken = structuredClone(graph); mutate(broken);
    assert.ok(rangeLineagePlanProblems(broken, rangePlan, actors).length);
  }
  assert.ok(rangeLineageProblems({ ...lineage, edgeId: 'unknown' }, graph).length);
  assert.ok(rangeSiteBatchesProblems([[{ id: 'e1', siteId: 'return' }]], graph, { edgeId: lineage.edgeId }).length);
  assert.ok(rangeSiteBatchesProblems([[{ id: 'player', playerId: 'other', siteId: 'return' }]], graph, { edgeId: lineage.edgeId }).length);
  assert.ok(rangeOriginProblems({ version: 1, rootId: graph.rootId, sourceKey: actors[0], siteId: 'return' }, { type: 'damageDealt' }, graph, lineage).length);
});

test('saved lineage ancestry has a finite depth and malformed data fails without throwing', () => {
  const { graph, rangePlan } = receipt();
  let parent = graph.sites[1];
  for (let i = 0; i < 17; i++) {
    const child = { id: `child:${i}`, targetKey: actors[2], parentId: parent.id, events: [{ type: 'statusApplied', status: 'vulnerable' }], delivery: { ...delivery } };
    graph.sites.push(child);
    graph.edges.push({ id: `chain:${i}`, parentId: parent.id, event: 'statusApplied', status: 'vulnerable', triggerKey: 'status:chain', effectIndex: 0,
      targets: [{ targetKey: actors[2], siteId: child.id, contactId: null, batch: 0 }] });
    parent = child;
  }
  assert.match(rangeLineagePlanProblems(graph, rangePlan, actors).join(' '), /finite ancestry/);
  for (const value of [null, [], {}, { version: 1, sites: [null], edges: [null] }]) {
    assert.ok(rangeLineagePlanProblems(value, rangePlan, actors).length);
  }
});

test('independent weapon and spell contacts keep their own frozen source through a chosen-discard save', () => {
  const profile = structuredClone(resolveGameProfile('core'));
  profile.content.cards.find(card => card.id === 'core.strike').effects = [
    { op: 'discard', target: 'self', choose: true, amount: 1 },
    { op: 'damage', target: 'enemy', amount: 2, attack: { source: 'weapon', hand: 'mainHand' } },
    { op: 'damage', target: 'enemy', amount: 2, attack: { source: 'spell', hand: 'offHand' }, tags: ['camp:spell', 'range:reach', 'maneuver:casting'] },
  ];
  delete profile.hash; profile.hash = gameDigest(profile);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  combat.piles.hand = [
    { cardId: 'core.strike', instanceId: 'mixed-strike', upgraded: false },
    { cardId: 'core.defend', instanceId: 'discard-filler', upgraded: false },
  ];
  combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
  combat.enemies[0].persistentPoise = { value: 0, max: 0 };
  const pair = rangePairKey(combat.player.rangeActorKey, combat.enemies[0].rangeActorKey);
  combat.rangeState.engagements[pair] = 2;
  const quote = previewCard(combat, 'mixed-strike', 'e1');
  assert.deepEqual(quote.range.targets[0].contacts.map(contact => contact.coverage), [0, 1]);
  combat.player.stamina = quote.staminaCost;
  primeAccuracyRolls(combat, { count: 2, drawsPerAttack: 2 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'mixed-strike', targetId: 'e1' });
  assert.ok(combat.pendingAbilityDiscard);
  const sources = combat.queue.filter(action => action.effect.op === 'damage').map(action => json(action.card.resolvedRangeSource));
  assert.deepEqual(sources.map(source => [source.sourceType, source.range]), [['weapon', 'melee'], ['spell', 'reach']]);
  assert.equal(combat.player.stamina, 0);
  combat.rangeState.engagements[pair] = 0;
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  const saves = createSaveManager(createMemoryStorage()); saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  const resumed = restoreCombatSnapshot({ registries, rng: createRng(loaded.seed, loaded.streamCounters),
    snapshot: loaded.combatEntered.snapshot, expectedGameProfile: loaded.gameProfile });
  assert.deepEqual(resumed.queue.filter(action => action.effect.op === 'damage').map(action => action.card.resolvedRangeSource), sources);
  const finish = state => {
    const start = state.eventLog.length;
    dispatch(state, { type: 'chooseDiscard', cardInstanceIds: ['discard-filler'] });
    return { hp: state.enemies[0].hp, stamina: state.player.stamina, range: state.rangeState,
      hits: state.eventLog.filter(event => event.type === 'attackHit').map(event => ({ targetId: event.targetId, range: event.range, d20: event.d20 })),
      damage: state.eventLog.slice(start).filter(event => event.type === 'damageDealt').map(event => ({ amount: event.amount, targetId: event.targetId })),
      spending: state.eventLog.slice(start).filter(event => event.type === 'staminaSpent'), rng: state.rng.getCounters() };
  };
  const uninterrupted = finish(combat), restored = finish(resumed);
  assert.deepEqual(json(restored), json(uninterrupted));
  assert.equal(restored.hits.length, 2);
  assert.equal(restored.damage.length, 2);
  assert.deepEqual(restored.spending, []);
});

const randomRider = { op: 'damage', target: 'randomEnemy', amount: 2, attack: { source: 'spell', hand: 'offHand' }, tags: ['camp:spell', 'range:reach', 'maneuver:casting'] };
function lineageRegistries(profile, effects, statusId = 'precision') {
  const authored = applyGameProfileToContent(contentBundle, profile);
  const bundle = { ...authored, statuses: authored.statuses.map(status => status.id !== statusId ? status : {
    ...status, hooks: [{ on: 'damageDealt', once: true, if: { p: 'eventSourceIsOwner' }, do: effects }],
  }) };
  return bindGameProfileRegistries(createRegistries(bundle), profile);
}
function pausedLineage() {
  // A real owned status hook pauses before its already quoted random rider.
  const registries = lineageRegistries(resolveGameProfile('core'), [{ op: 'discard', target: 'self', choose: true, amount: 1 }, randomRider]);
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  combat.player.statuses.precision = { stacks: 1 };
  combat.piles.hand = [
    { cardId: 'core.strike', instanceId: 'root-strike', upgraded: false },
    { cardId: 'core.defend', instanceId: 'discard-filler', upgraded: false },
  ];
  for (const enemy of combat.enemies) {
    enemy.hp = enemy.maxHp = 1000;
    enemy.persistentPoise = { value: 0, max: 0 };
    combat.rangeState.engagements[rangePairKey(combat.player.rangeActorKey, enemy.rangeActorKey)] = 2;
  }
  const quote = previewCard(combat, 'root-strike', 'e1');
  combat.player.stamina = quote.staminaCost;
  primeAccuracyRolls(combat, { count: 2, drawsPerAttack: 2 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'root-strike', targetId: 'e1' });
  assert.ok(combat.pendingAbilityDiscard, 'the owned hook pauses before its inherited rider');
  const rider = combat.queue.find(action => action.card?.rangeLineage && action.effect.op === 'damage');
  assert.ok(rider, 'the pending rider retains the committed lineage');
  return { combat, run, registries, rider };
}

test('a paid random trigger rider resumes from a real nested SaveManager pause without re-quoting or re-sampling', () => {
  const { combat, run, registries, rider } = pausedLineage();
  const plan = json(rider.card.rangePlan), graph = json(rider.card.rangeLineagePlan);
  assert.equal(plan.paid.stamina, combat.eventLog.filter(event => event.type === 'staminaSpent').reduce((sum, event) => sum + event.amount, 0));
  assert.equal(combat.player.stamina, 0);
  assert.ok(plan.targets.some(contact => contact.contactId.startsWith('rider:') && contact.coverage === 1 && !contact.weapon));
  const targetKeys = rider.meta.rangeSiteBatches.flat().map(ref => graph.sites.find(site => site.id === ref.siteId).targetKey);
  // Persistent movement cannot alter the accepted root or reselect its rider.
  for (const pair of Object.keys(combat.rangeState.engagements)) combat.rangeState.engagements[pair] = 0;
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  for (const mutate of [
    action => { action.card.rangeLineage.edgeId = 'unknown'; },
    action => { action.card.rangeLineagePlan.sourceKey = 'enemy:e1'; },
    action => { action.card.rangeLineagePlan.sites[0].events.push({ type: 'healed' }); },
    action => { action.meta.rangeSiteBatches[0][0].id = 'player'; },
    action => { action.meta.event.rangeOrigin.siteId = 'unknown'; },
    action => { action.meta.rangeEffectIndex = 99; },
    action => { delete action.card.rangeLineage; },
    action => { delete action.card.rangeLineagePlan; },
  ]) {
    const broken = json(run);
    const action = broken.combatEntered.snapshot.abilityQueue.find(action => action.card?.rangeLineage && action.effect.op === 'damage');
    mutate(action);
    const rejected = createSaveManager(createMemoryStorage()); rejected.saveRun(broken, combat.rng);
    assert.equal(rejected.loadRun(registries) === null, true, 'malformed lineage must refuse load');
    assert.equal(rejected.runStatus().state, 'archived');
    assert.match(rejected.runStatus().reason, /range/i);
  }
  const saves = createSaveManager(createMemoryStorage()); saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  const resumed = restoreCombatSnapshot({ registries, rng: createRng(loaded.seed, loaded.streamCounters),
    snapshot: loaded.combatEntered.snapshot, expectedGameProfile: loaded.gameProfile });
  const restoredRider = resumed.queue.find(action => action.card?.rangeLineage && action.effect.op === 'damage');
  assert.deepEqual(restoredRider.card.rangePlan, plan);
  assert.deepEqual(restoredRider.card.rangeLineagePlan, graph);
  assert.deepEqual(restoredRider.meta.rangeSiteBatches, rider.meta.rangeSiteBatches);
  assert.deepEqual(resumed.rng.getCounters(), combat.rng.getCounters());
  const randomSelections = combat.rng.getCounters().misc;
  const finish = state => {
    const start = state.eventLog.length;
    dispatch(state, { type: 'chooseDiscard', cardInstanceIds: ['discard-filler'] });
    return { stamina: state.player.stamina, hp: state.enemies.map(enemy => enemy.hp), range: state.rangeState,
      hits: state.eventLog.slice(start).filter(event => event.type === 'attackHit').map(event => ({ targetId: event.targetId, d20: event.d20 })),
      spending: state.eventLog.slice(start).filter(event => event.type === 'staminaSpent'), rng: state.rng.getCounters() };
  };
  const uninterrupted = finish(combat), restored = finish(resumed);
  assert.deepEqual(json(restored), json(uninterrupted));
  assert.equal(restored.hits.length, 1);
  assert.equal(`enemy:${restored.hits[0].targetId}`, targetKeys[0]);
  assert.deepEqual(restored.spending, []);
  assert.equal(restored.rng.misc, randomSelections, 'the rider never samples its selector again');
});

test('a paid Counter saves its whole reserved trigger graph before the incoming contact and reuses it on return', () => {
  const profile = structuredClone(resolveGameProfile('core'));
  profile.content.cards.find(card => card.id === 'core.counter').effects.unshift({ op: 'discard', target: 'self', choose: true, amount: 1 });
  delete profile.hash; profile.hash = gameDigest(profile);
  const base = lineageRegistries(profile, [randomRider], 'rallyingStandard');
  const registries = { ...base, enemies: { ...base.enemies, get(id) {
    const enemy = base.enemies.get(id), slash = enemy.moves.slash;
    if (id !== 'wanderingSoldier') return enemy;
    return { ...enemy, firstMove: 'slash', moves: { ...enemy.moves, slash: { ...slash, damage: 2, hits: 1, range: 'melee', traits: ['adequateReach'],
      tags: [...(slash.tags || []).filter(tag => !tag.startsWith('range:')), 'range:melee'] } } };
  } } };
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  combat.player.statuses.rallyingStandard = { stacks: 1 };
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  combat.player.stamina = 2; combat.player.block = 100;
  combat.piles.hand = [
    { cardId: 'core.counter', instanceId: 'paid-counter', upgraded: false },
    { cardId: 'core.defend', instanceId: 'discard-filler', upgraded: false },
  ];
  for (const [index, enemy] of combat.enemies.entries()) {
    enemy.hp = enemy.maxHp = 1000;
    enemy.persistentPoise = { value: 0, max: 0 };
    enemy.maxStamina = enemy.stamina = index === 0 ? 1 : 0;
    combat.rangeState.engagements[rangePairKey(combat.player.rangeActorKey, enemy.rangeActorKey)] = 2;
  }
  primeAccuracyRolls(combat, { count: 3, drawsPerAttack: 2 });
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction?.options.find(option => option.cardId === 'core.counter' && option.play.rangeRoute === 'advance');
  assert.ok(option);
  assert.equal(option.staminaCost, 2);
  dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id });
  assert.ok(combat.pendingAbilityDiscard);
  const reserved = json(combat.player.combatCounter.carrier.rangeCounterReservation);
  assert.ok(reserved.rangeLineagePlan);
  assert.equal(reserved.rangePlan.paid.stamina, 2);
  const riders = reserved.rangeLineagePlan.edges.filter(edge => edge.triggerKey === 'status:player:rallyingStandard:0').flatMap(edge => edge.targets);
  assert.ok(riders.length);
  const randomSelections = combat.rng.getCounters().misc;
  for (const pair of Object.keys(combat.rangeState.engagements)) combat.rangeState.engagements[pair] = 0;
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  const broken = json(run);
  broken.combatEntered.snapshot.player.combatCounter.carrier.rangeCounterReservation.rangeLineagePlan.edges[0].parentId = 'unknown';
  const rejected = createSaveManager(createMemoryStorage()); rejected.saveRun(broken, combat.rng);
  assert.equal(rejected.loadRun(registries) === null, true);
  assert.equal(rejected.runStatus().state, 'archived');
  assert.match(rejected.runStatus().reason, /range/i);
  const saves = createSaveManager(createMemoryStorage()); saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  const resumed = restoreCombatSnapshot({ registries, rng: createRng(loaded.seed, loaded.streamCounters),
    snapshot: loaded.combatEntered.snapshot, expectedGameProfile: loaded.gameProfile });
  assert.deepEqual(resumed.player.combatCounter.carrier.rangeCounterReservation, reserved);
  assert.deepEqual(resumed.rng.getCounters(), combat.rng.getCounters());
  const finish = state => {
    const start = state.eventLog.length;
    dispatch(state, { type: 'chooseDiscard', cardInstanceIds: ['discard-filler'] });
    assert.equal(Boolean(state.pendingReaction || state.pendingAbilityDiscard), false);
    return { hp: state.enemies.map(enemy => enemy.hp), stamina: state.player.stamina, range: state.rangeState,
      hits: state.eventLog.slice(start).filter(event => event.type === 'attackHit').map(event => ({ sourceId: event.sourceId, targetId: event.targetId, d20: event.d20 })),
      returns: state.eventLog.slice(start).filter(event => event.type === 'combatCounterTriggered').length,
      outcomes: state.eventLog.slice(start).filter(event => ['damageDealt', 'attackMissed', 'attackOutOfRange', 'combatPlayRefused', 'triggerFired'].includes(event.type)).map(event => ({ type: event.type, sourceId: event.sourceId, targetId: event.targetId, reason: event.reason, amount: event.amount, origin: event.rangeOrigin })),
      spending: state.eventLog.filter(event => event.type === 'staminaSpent').map(event => event.amount), rng: state.rng.getCounters() };
  };
  const uninterrupted = finish(combat), restored = finish(resumed);
  assert.deepEqual(json(restored), json(uninterrupted));
  assert.equal(restored.returns, 1);
  const playerHits = restored.hits.filter(event => event.sourceId === 'player');
  assert.equal(playerHits.length, 2);
  assert.equal(`enemy:${playerHits[1].targetId}`, riders[0].targetKey);
  assert.equal(restored.rng.misc, randomSelections, 'a bound return never re-quotes its random rider');
  assert.equal(restored.spending.reduce((sum, amount) => sum + amount, 0), 2);
});
