import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { equipPiece, ownership, equipmentRequirementReceipt } from '../src/model/loadout.js';
import { attackDescriptor } from '../src/model/attackTags.js';
import { rangePairKey } from '../src/model/combatEngagement.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
const json = value => JSON.parse(JSON.stringify(value));
function fixture({ die = 20, count = 4 } = {}) {
  const profile = structuredClone(resolveGameProfile('core'));
  profile.content.cards.find(card => card.id === 'core.counter').effects.unshift({ op: 'discard', choose: true, amount: 1 });
  delete profile.hash; profile.hash = gameDigest(profile);
  const base = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const registries = { ...base, enemies: { ...base.enemies, get(id) {
    const enemy = base.enemies.get(id);
    if (id !== 'wanderingSoldier') return enemy;
    const slash = enemy.moves.slash;
    return { ...enemy, firstMove: 'slash', moves: { ...enemy.moves, slash: { ...slash, damage: 2, hits: 3,
      range: 'melee', traits: ['adequateReach'], tags: [...(slash.tags || []).filter(tag => !tag.startsWith('range:')), 'range:melee'] } } };
  } } };
  const run = createRunState({ registries, seed: 511, classId: 'reaver' });
  const alternate = registries.equipment.armaments.find(piece => piece.range !== 'melee'
    && attackDescriptor(piece).source === 'weapon' && equipmentRequirementReceipt(registries, piece, run.attributes).ok);
  assert.ok(alternate, 'the fixture has an owned usable alternate weapon with different coverage');
  run.loadout.storage.push(alternate.id);
  assert.equal(equipPiece(registries, run.loadout, 'rightHand', 1, alternate.id,
    ownership(registries, { loadout: run.loadout }), { inCombat: false, classId: run.class, attributes: run.attributes }), true);
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  combat.piles.hand = [
    { instanceId: 'paid-counter', cardId: 'core.counter', upgraded: false },
    { instanceId: 'discard-filler', cardId: 'core.defend', upgraded: false },
    { instanceId: 'retained-defense', cardId: 'core.defend', upgraded: false },
  ];
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  combat.player.stamina = 2; combat.player.block = 100;
  Object.assign(combat.enemies[0], { maxStamina: 1, stamina: 1 });
  combat.rangeState.engagements[rangePairKey(combat.player.rangeActorKey, combat.enemies[0].rangeActorKey)] = 2;
  primeAccuracyRolls(combat, { die, count, drawsPerAttack: 2 });
  dispatch(combat, { type: 'endTurn' });
  return { registries, run, combat, alternate };
}

test('a paid Counter reservation survives a nested choice and SaveManager without double payment', () => {
  const { registries, run, combat, alternate } = fixture();
  const option = combat.pendingReaction?.options.find(row => row.cardId === 'core.counter' && row.play.rangeRoute === 'advance');
  assert.ok(option);
  assert.equal(option.staminaCost, 2, 'matching-stance base zero plus non-discountable two-band return');
  dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id });
  assert.ok(combat.pendingAbilityDiscard);
  assert.ok(combat.reactionResume);
  assert.equal(combat.player.stamina, 0);
  const reservation = combat.player.combatCounter.carrier.rangeCounterReservation;
  assert.ok(reservation);
  assert.equal(reservation.rangePlan.advanceSp, 2);
  assert.equal(reservation.rangePlan.paid.stamina, 2);
  assert.equal(reservation.consumed, false);
  const sourceBefore = json(combat.player.combatCounter.carrier.resolvedRangeSource);
  assert.notEqual(sourceBefore.itemId, alternate.id);
  // A valid alternate set and later movement challenge the frozen transaction.
  combat.loadout.active.rightHand = 1;
  if (combat.loadout.sets.leftHand.length > 1) combat.loadout.active.leftHand = 1;
  combat.rangeState.engagements[rangePairKey(combat.player.rangeActorKey, combat.enemies[0].rangeActorKey)] = 0;
  assert.deepEqual(combat.player.combatCounter.carrier.resolvedRangeSource, sourceBefore);
  const snapshot = commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  const incoming = snapshot.reactionResume.queue.find(action => action.meta?.expansionGroup?.carrier.rangePlan)?.meta.expansionGroup.carrier.rangePlan;
  const laterContact = incoming.targets.find(contact => contact.contactId !== reservation.contactId).contactId;
  for (const mutate of [r => { r.contactId = laterContact; }, r => { r.consumed = true; }, r => { r.rangePlan.paid.stamina = 0; }]) {
    const malformed = structuredClone(run);
    mutate(malformed.combatEntered.snapshot.player.combatCounter.carrier.rangeCounterReservation);
    const rejected = createSaveManager(createMemoryStorage()); rejected.saveRun(malformed, combat.rng);
    assert.equal(rejected.loadRun(registries), null);
    assert.equal(rejected.runStatus().state, 'archived');
    assert.match(rejected.runStatus().reason, /range/i);
  }
  const saves = createSaveManager(createMemoryStorage()); saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  const resumed = restoreCombatSnapshot({ registries, rng: createRng(loaded.seed, loaded.streamCounters),
    snapshot: loaded.combatEntered.snapshot, expectedGameProfile: loaded.gameProfile });
  assert.deepEqual(resumed.player.combatCounter.carrier.rangeCounterReservation, reservation);
  assert.deepEqual(resumed.rangeState, combat.rangeState);
  assert.deepEqual(resumed.rng.getCounters(), combat.rng.getCounters());
  const finish = state => {
    dispatch(state, { type: 'chooseDiscard', cardInstanceIds: ['discard-filler'] });
    let pauses = 0;
    while (state.pendingReaction) {
      assert.ok(++pauses < 4);
      dispatch(state, { type: 'chooseReaction', offerId: state.pendingReaction.id, optionId: null });
    }
    return { energy: state.player.energy, hp: state.player.hp, block: state.player.block,
      range: state.rangeState, counter: state.player.combatCounter,
      spending: state.eventLog.filter(row => row.type === 'staminaSpent').map(row => row.amount),
      returns: state.eventLog.filter(row => ['combatCounterTriggered', 'combatRangeReturnUnavailable'].includes(row.type)),
      hits: state.eventLog.filter(row => row.type === 'attackHit').map(row => ({ sourceId: row.sourceId, targetId: row.targetId, d20: row.d20 })),
      rng: state.rng.getCounters() };
  };
  const uninterrupted = finish(combat), restored = finish(resumed);
  assert.deepEqual(json(restored), json(uninterrupted));
  assert.equal(restored.spending.reduce((sum, n) => sum + n, 0), 2);
  assert.equal(restored.returns.filter(row => row.type === 'combatCounterTriggered').length, 1);
  assert.equal(restored.hits.filter(row => row.sourceId === 'player').length, 1, 'the reserved return resolves its one real seeded hit');
  assert.equal(restored.counter?.carrier.rangeCounterReservation, undefined, 'the first contact retires its nonrefundable reservation');
  assert.equal(snapshot.player.combatCounter.carrier.rangeCounterReservation.consumed, false, 'restoring does not mutate the stored receipt');
});

test('a missed paid contact keeps its cost spent and cannot lend its reservation to a later hit after reload', () => {
  const { registries, run, combat } = fixture({ die: 1, count: 1 });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'core.counter' && row.play.rangeRoute === 'advance');
  assert.equal(option.staminaCost, 2);
  dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id });
  assert.ok(combat.player.combatCounter.carrier.rangeCounterReservation);
  assert.ok(combat.pendingAbilityDiscard);
  assert.equal(combat.player.stamina, 0);
  // Seed one miss followed by two natural hits: later contacts must not reuse
  // the payment attempted on the missed first contact.
  const original = combat.rng.getCounters(), search = createRng(combat.rng.seed, original), window = [];
  let start = null;
  for (let attempts = 0; attempts < 1000000; attempts++) {
    const before = search.getCounters().combatAvoidance || 0;
    const die = search.int('combatAvoidance', 1, 20); search.int('combatAvoidance', 1, 20);
    window.push({ die, before }); if (window.length > 3) window.shift();
    if (window.length === 3 && window[0].die === 1 && window[1].die === 20 && window[2].die === 20) { start = window[0].before; break; }
  }
  assert.notEqual(start, null);
  combat.rng.restoreCounters({ ...original, combatAvoidance: start });
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  const saves = createSaveManager(createMemoryStorage()); saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  const resumed = restoreCombatSnapshot({ registries, rng: createRng(loaded.seed, loaded.streamCounters),
    snapshot: loaded.combatEntered.snapshot, expectedGameProfile: loaded.gameProfile });
  const finish = state => {
    dispatch(state, { type: 'chooseDiscard', cardInstanceIds: ['discard-filler'] });
    let pauses = 0;
    while (state.pendingReaction) {
      assert.ok(++pauses < 3);
      dispatch(state, { type: 'chooseReaction', offerId: state.pendingReaction.id, optionId: null });
    }
    return { stamina: state.player.stamina,
      misses: state.eventLog.filter(row => row.type === 'attackMissed' && row.sourceId === state.enemies[0].id).length,
      hits: state.eventLog.filter(row => row.type === 'attackHit' && row.sourceId === state.enemies[0].id).length,
      spent: state.eventLog.filter(row => row.type === 'staminaSpent').reduce((sum, row) => sum + row.amount, 0),
      unavailable: state.eventLog.filter(row => row.type === 'combatRangeReturnUnavailable'),
      returns: state.eventLog.filter(row => row.type === 'combatCounterTriggered'),
      counter: state.player.combatCounter, rng: state.rng.getCounters() };
  };
  const uninterrupted = finish(combat), restored = finish(resumed);
  assert.deepEqual(json(restored), json(uninterrupted));
  assert.equal(restored.spent, 2);
  assert.equal(restored.misses, 1);
  assert.equal(restored.hits, 2);
  assert.equal(restored.returns.length, 0);
  assert.equal(restored.unavailable.length, 1, 'the lingering defense cannot reuse the first contact payment');
  assert.equal(restored.counter?.carrier.rangeCounterReservation, undefined);
});
