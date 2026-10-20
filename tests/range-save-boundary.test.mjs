import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
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
  for (const [entity, key] of actors) entity.rangeActorKey = key;
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
  combat.gameProfile = profile; // The historical co-op adapter ignores this constructor option.
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
