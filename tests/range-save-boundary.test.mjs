import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot, commitCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { serializeCoopCombatSnapshot, decodeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRangeState, rangeActionPlan, rangePairKey, RANGE_POLICY_DEFAULTS } from '../src/model/combatEngagement.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { live, registries, profile } from './helpers/fixcore-combat-rules.mjs';
const json = value => JSON.parse(JSON.stringify(value));
function stamp(combat, startingRange = 'ranged') {
  const players = combat.players instanceof Map ? [...combat.players].map(([id, seat]) => [seat.entity, `player:${id}`]) : [[combat.player, 'player:player']];
  const actors = [...players, ...combat.enemies.map(enemy => [enemy, `enemy:${enemy.id}`])];
  for (const [entity, key] of actors) {
    entity.rangeActorKey = key;
    if (entity.kind === 'enemy') Object.assign(entity, { maxStamina: 3, stamina: 3 });
  }
  combat.rangeState = createRangeState(RANGE_POLICY_DEFAULTS, actors.map(([, key]) => ({ key, startingRange })));
  return combat;
}
const restore = (combat, snapshot) => restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot });

test('new Core runs pin explicit settings while historical profiles keep their shape', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 1, profileMeta: { settings: { rangeMechanics: false, rangeAdvanceSpPerBand: 3, rangeReachPrecisionBonus: 2, rangeThrowPrecisionPenalty: 4 } } });
  assert.deepEqual(run.rangePolicy, { version: 1, enabled: false, advanceSpPerBand: 3, reachPrecisionBonus: 2, throwPrecisionPenalty: 4 });
  assert.deepEqual(deserializeRun(serializeRun(run)).rangePolicy, run.rangePolicy);
  const legacy = createRunState({ registries: createRegistries(contentBundle), classId: 'reaver', seed: 1 });
  assert.equal(Object.hasOwn(legacy, 'rangePolicy'), false);
  assert.ok(validateRunShape({ ...legacy, rangePolicy: run.rangePolicy }).some(p => /requires Core/.test(p)));
  for (const change of [{ version: 2 }, { enabled: 1 }, { advanceSpPerBand: -1 }, { unexpected: true }]) {
    assert.ok(validateRunShape({ ...run, rangePolicy: { ...run.rangePolicy, ...change } }).some(p => /range policy/i.test(p)));
  }
});

test('solo snapshots retain inert dead pairs and do not share mutable saved state', () => {
  const combat = stamp(live());
  combat.enemies[0].alive = false; combat.enemies[0].hp = 0;
  const saved = json(serializeCombatSnapshot(combat)), restored = restore(combat, saved);
  assert.deepEqual(json(serializeCombatSnapshot(restored)), saved);
  const pair = Object.keys(restored.rangeState.engagements)[0];
  restored.rangeState.engagements[pair] = 0;
  assert.equal(saved.rangeState.engagements[pair], 2);
  assert.equal(combat.rangeState.engagements[pair], 2);
});

test('old active Core snapshots stay policy-free through restore and resave', () => {
  const combat = live();
  delete combat.rangeState;
  for (const actor of [combat.player, ...combat.enemies]) delete actor.rangeActorKey;
  const saved = json(serializeCombatSnapshot(combat)), restored = restore(combat, saved);
  assert.equal(Object.hasOwn(restored, 'rangeState'), false);
  assert.equal(Object.hasOwn(serializeCombatSnapshot(restored), 'rangeState'), false);
  assert.deepEqual(restored.rng.getCounters(), combat.rng.getCounters());
});

test('malformed pairs, actors and range policy are refused at the solo load door', () => {
  const combat = stamp(live()), saved = json(serializeCombatSnapshot(combat));
  const pair = Object.keys(saved.rangeState.engagements)[0];
  const changes = [
    s => { s.rangeState.version = 2; },
    s => { s.rangeState.policy.enabled = 'yes'; },
    s => { s.rangeState.engagements[pair] = 3; },
    s => { delete s.rangeState.engagements[pair]; },
    s => { s.rangeState.engagements[rangePairKey('player:other', `enemy:${s.enemies[0].id}`)] = 1; },
    s => { s.rangeState.engagements[JSON.stringify(JSON.parse(pair).reverse())] = 2; },
    s => { s.player.rangeActorKey = s.enemies[0].rangeActorKey; },
    s => { delete s.rangeState; },
  ];
  for (const change of changes) {
    const broken = structuredClone(saved); change(broken);
    assert.throws(() => restore(combat, broken), /range|engagement/i);
  }
});

test('co-op duplicate player entity ids retain distinct seat-owned pairs', () => {
  const player = id => ({ id, classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 3, stamina: 3, energyMax: 3, drawPerTurn: 1, deck: [{ cardId: 'core.counter', instanceId: 'same-card-id' }] });
  const combat = stamp(createCoopCombat({ registries, rng: createRng(4), gameProfile: profile, combatExpansionVersion: 2, players: [player('a'), player('b')], enemyIds: ['wanderingSoldier'] }));
  assert.equal(combat.players.get('a').entity.id, combat.players.get('b').entity.id);
  const enemyKey = combat.enemies[0].rangeActorKey;
  combat.rangeState.engagements[rangePairKey('player:a', enemyKey)] = 0;
  const saved = json(serializeCoopCombatSnapshot(combat));
  const decoded = decodeCoopCombatSnapshot(saved);
  assert.equal(decoded.rangeState.engagements[rangePairKey('player:a', enemyKey)], 0);
  assert.equal(decoded.rangeState.engagements[rangePairKey('player:b', enemyKey)], 2);
  for (const wrong of ['player:player', 'player:a', enemyKey]) {
    const broken = decodeCoopCombatSnapshot(saved);
    broken.players.get('b').entity.rangeActorKey = wrong;
    assert.throws(() => serializeCoopCombatSnapshot(broken), /range actor identity/i);
  }
});

test('a paused reaction preserves a paid mixed-source quote after persistent movement', () => {
  const combat = stamp(live());
  combat.piles.hand = [{ instanceId: 'counter', cardId: 'core.counter', upgraded: false }];
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction);
  const group = combat.queue.find(action => action.meta?.expansionGroup)?.meta.expansionGroup;
  const sourceKey = combat.enemies[0].rangeActorKey, targetKey = combat.player.rangeActorKey;
  const plan = rangeActionPlan(combat.rangeState, sourceKey, [
    { contactId: 'bow', targetKey, coverage: 'ranged', weapon: true, sourceWeaponId: 'fixture-bow' },
    { contactId: 'dagger', targetKey, coverage: 'melee', weapon: true, sourceWeaponId: 'fixture-dagger' },
  ]);
  plan.rootId = group.key; plan.paid = { energy: 0, stamina: plan.advanceSp, mana: 0 };
  group.carrier.rangePlan = plan;
  combat.rangeState.engagements[rangePairKey(sourceKey, targetKey)] = 0;
  const saved = json(serializeCombatSnapshot(combat)), restored = restore(combat, saved);
  assert.deepEqual(json(serializeCombatSnapshot(restored)), saved);
  assert.equal(restored.queue[0].meta.expansionGroup.carrier.rangePlan.targets[1].actualBand, 2);
  assert.deepEqual(restored.rng.getCounters(), combat.rng.getCounters());
  for (const change of [
    p => { p.version = 2; }, p => { p.route = 'teleport'; }, p => { p.advanceSp = 0; },
    p => { p.paid.stamina = 0; }, p => { delete p.paid; }, p => { p.available = false; },
    p => { p.targets[1].sourceWeaponId = 12; }, p => { p.targets[1].precisionDelta = 100; },
    p => { p.targets[1].targetKey = 'player:unknown'; }, p => { p.targets[1].contactId = p.targets[0].contactId; },
  ]) {
    const broken = structuredClone(saved);
    change(broken.abilityQueue[0].meta.expansionGroup.carrier.rangePlan);
    assert.ok(combatSnapshotProblems(broken).some(p => /range/i.test(p)));
  }
});

test('a paid Counter reservation is bound to one incoming contact and cannot reload consumed', () => {
  const combat = stamp(live());
  combat.piles.hand = [{ instanceId: 'counter', cardId: 'core.counter', upgraded: false }];
  dispatch(combat, { type: 'endTurn' });
  const group = combat.queue[0].meta.expansionGroup;
  const sourceKey = combat.enemies[0].rangeActorKey, targetKey = combat.player.rangeActorKey;
  const paid = (source, target, rootId) => ({ ...rangeActionPlan(combat.rangeState, source,
    [{ contactId: 'contact-0', targetKey: target, coverage: 'melee' }]), rootId, paid: { energy: 0, stamina: 2, mana: 0 } });
  group.carrier.rangePlan = paid(sourceKey, targetKey, group.key);
  Object.values(group.targets)[0].contacts[0].rangeContactId = 'contact-0';
  group.carrier.rangeCounterReservation = { version: 1, sourceKey: targetKey, targetKey: sourceKey,
    incomingRootId: group.key, contactId: 'contact-0', rangePlan: paid(targetKey, sourceKey, 'counter-return-0'), consumed: false };
  const saved = json(serializeCombatSnapshot(combat));
  assert.deepEqual(json(serializeCombatSnapshot(restore(combat, saved))), saved);
  for (const change of [r => { r.consumed = true; }, r => { r.incomingRootId = 'different-root'; },
    r => { r.contactId = 'later-hit'; }, r => { [r.sourceKey, r.targetKey] = [r.targetKey, r.sourceKey]; },
    r => { r.rangePlan.paid.stamina = 0; }, r => { r.refundable = true; }, r => { r.rangePlan.targets = [null]; }]) {
    const broken = structuredClone(saved);
    change(broken.abilityQueue[0].meta.expansionGroup.carrier.rangeCounterReservation);
    assert.throws(() => restore(combat, broken), /range/i);
  }
});

test('serialized copies cannot disagree about one accepted root receipt', () => {
  const combat = stamp(live());
  combat.piles.hand = [{ instanceId: 'counter', cardId: 'core.counter', upgraded: false }];
  dispatch(combat, { type: 'endTurn' });
  const group = combat.queue[0].meta.expansionGroup;
  group.carrier.rangePlan = { ...rangeActionPlan(combat.rangeState, combat.enemies[0].rangeActorKey,
    [{ targetKey: combat.player.rangeActorKey, coverage: 'melee' }]), rootId: group.key,
    paid: { energy: 0, stamina: 2, mana: 0 } };
  const saved = json(serializeCombatSnapshot(combat));
  assert.ok(saved.abilityQueue.length > 1);
  saved.abilityQueue[1].meta.expansionGroup.carrier.rangePlan.paid.stamina = 3;
  assert.throws(() => restore(combat, saved), /Conflicting range receipts/);
});

test('queued source snapshots retain committed weapon coverage and reject source tampering', () => {
  const combat = stamp(live());
  combat.piles.hand = [{ instanceId: 'counter', cardId: 'core.counter', upgraded: false }];
  dispatch(combat, { type: 'endTurn' });
  const action = combat.queue[0], group = action.meta.expansionGroup;
  const plan = { ...rangeActionPlan(combat.rangeState, combat.enemies[0].rangeActorKey,
    [{ targetKey: combat.player.rangeActorKey, coverage: 'reach', weapon: true, sourceWeaponId: 'committed-spear', throwCapable: true }]),
    rootId: group.key, paid: { energy: 0, stamina: 1, mana: 0 } };
  group.carrier.rangePlan = plan;
  action.card = { ...action.card, rangePlan: plan,
    resolvedRangeSource: { sourceType: 'weapon', itemId: 'committed-spear', range: 'reach', propertyTags: ['throw'] } };
  const saved = json(serializeCombatSnapshot(combat));
  const loaded = restore(combat, saved);
  assert.deepEqual(loaded.queue[0].card.resolvedRangeSource, action.card.resolvedRangeSource);
  for (const change of [s => { s.sourceType = 'teleport'; }, s => { s.itemId = null; }, s => { s.range = 'ranged'; },
    s => { s.propertyTags = ['throw', 'throw']; }, s => { s.propertyTags = ['rangeBypass']; }, s => { s.hidden = true; }]) {
    const broken = structuredClone(saved);
    change(broken.abilityQueue[0].card.resolvedRangeSource);
    assert.throws(() => restore(combat, broken), /range source/i);
  }
});

test('a real paid three-hit approach resumes through SaveManager without repeat charge or RNG draws', () => {
  const run = createRunState({ registries, seed: 511, classId: 'reaver' });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  combat.player.block = 100;
  combat.piles.hand.push({ instanceId: 'resume-counter', cardId: 'core.counter', upgraded: false });
  Object.assign(combat.enemies[0], { maxStamina: 3, stamina: 3 });
  const pair = rangePairKey(combat.player.rangeActorKey, combat.enemies[0].rangeActorKey);
  combat.rangeState.engagements[pair] = 2;
  primeAccuracyRolls(combat, { count: 3, drawsPerAttack: 2 });
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction);
  assert.equal(combat.enemies[0].stamina, 0, 'base 1 SP and two-band Advance have already been paid');
  const plan = combat.queue[0].meta.expansionGroup.carrier.rangePlan;
  assert.equal(plan.advanceSp, 2);
  assert.equal(plan.targets.length, 3);
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  const resumed = restoreCombatSnapshot({ registries, rng: createRng(loaded.seed, loaded.streamCounters),
    snapshot: loaded.combatEntered.snapshot, expectedGameProfile: loaded.gameProfile });
  assert.deepEqual(resumed.rangeState, combat.rangeState);
  assert.deepEqual(resumed.queue[0].meta.expansionGroup.carrier.rangePlan, plan);
  assert.deepEqual(resumed.rng.getCounters(), combat.rng.getCounters());
  const played = state => {
    let pauses = 0;
    while (state.pendingReaction) {
      assert.ok(++pauses <= 3, 'each incoming hit completes once');
      dispatch(state, { type: 'chooseReaction', offerId: state.pendingReaction.id, optionId: null });
    }
    return { pauses, phase: state.phase, turn: state.turn, hp: state.player.hp, block: state.player.block,
      enemySp: state.enemies[0].stamina, pair: state.rangeState.engagements[pair],
      hits: state.eventLog.filter(event => event.type === 'attackHit').map(event => ({ sourceId: event.sourceId, targetId: event.targetId, d20: event.d20 })),
      spent: state.eventLog.filter(event => ['staminaSpent', 'enemyMoveStarted'].includes(event.type)),
      counters: state.rng.getCounters() };
  };
  const uninterrupted = played(combat), restored = played(resumed);
  assert.deepEqual(restored, uninterrupted);
  assert.equal(restored.pauses, 3);
  assert.equal(restored.hits.length, 3);
  assert.equal(restored.enemySp, 0, 'resuming later hits cannot charge another approach');
  assert.equal(restored.pair, 2, 'temporary Advance never moves the persistent pair');
});
