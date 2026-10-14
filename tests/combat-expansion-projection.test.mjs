import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { stampDeck } from '../src/model/loadout.js';
import { playerPoiseThresholdReceipt } from '../src/model/statProjection.js';
import { createRng } from '../src/engine/rng.js';
import { runCombatPlayer } from '../src/engine/runCombat.js';
import { createCoopCombat, playCard, chooseBlightFeat, joinCombat } from '../src/engine/coopCombat.js';
import { serializeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';
import { payAshenBlight } from '../src/engine/ashenBlight.js';
import { refreshExpandedLoadout } from '../src/engine/combatExpansionProjection.js';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { createSession, restoreSession } from '../tools/session.mjs';

const registries = createRegistries(contentBundle);
const cardsOf = seat => ['draw', 'hand', 'discard', 'exhaust'].flatMap(pile => seat.piles[pile]);
const positions = seat => Object.fromEntries(Object.entries(seat.piles).map(([pile, cards]) => [pile, cards.map(card => card.instanceId)]));
const currentPools = actor => Object.fromEntries(['hp', 'mana', 'energy', 'block'].map(key => [key, actor[key]]));
function pending(run) {
  payAshenBlight({ combatExpansionVersion: 2 }, run, { amount: 25, receiptId: 'prior', combatKey: 'previous' });
}
function input(run, id) {
  return { ...runCombatPlayer(run), id, combatExpansionVersion: 2, orderedDraw: true,
    attributes: run.attributes, poiseMax: playerPoiseThresholdReceipt(registries, run).value };
}
function assertReceipts(seat, run, scoped = registries) {
  const expected = structuredClone(run);
  expected.ashenBlight = structuredClone(seat.entity.ashenBlight);
  stampDeck(scoped, expected, undefined, { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
  for (const card of cardsOf(seat).filter(card => card.equipmentRole)) {
    const source = expected.deck.find(row => row.instanceId === card.instanceId);
    assert.ok(source, 'the original equipment instance is still owned');
    assert.equal(card.equipmentAttackSlotId, source.equipmentAttackSlotId);
    assert.equal(card.sourceArmamentId, source.sourceArmamentId);
    assert.equal(card.profileId, source.profileId);
    assert.deepEqual(card.profileReceipt, source.profileReceipt);
    assert.equal(card.ratingValue, source.ratingValue);
    assert.deepEqual(card.mods, source.mods);
  }
}

test('co-op Survivor claim projects only its owner and preserves paid Counter, pools, piles and RNG', () => {
  const a = createRunState({ registries, seed: 11, classId: 'reaver' });
  const b = createRunState({ registries, seed: 12, classId: 'herald' });
  const scopedA = registriesForClassMastery(registries, a), scopedB = registriesForClassMastery(registries, b);
  const combat = createCoopCombat({ registries, rng: createRng(11), ratingsRules: null,
    combatExpansionVersion: 2, players: [{ ...input(a, 'a'), registries: scopedA }, { ...input(b, 'b'), registries: scopedB }],
    enemyIds: ['wanderingSoldier'] });
  const opening = combat.players.get('a');
  const counter = opening.piles.hand.find(card => card.cardId === 'shieldBash');
  assert.ok(counter);
  playCard(combat, 'a', counter.instanceId, 'a');
  const before = combat.players.get('a'), other = structuredClone(combat.players.get('b'));
  payAshenBlight(combat, before.entity, { amount: 25, receiptId: 'after-counter', combatKey: combat.combatKey });
  const paidCounter = structuredClone(before.entity.counter), pools = currentPools(before.entity), piles = positions(before);
  const counters = combat.rng.getCounters(), poise = before.entity.poiseMeter.max;
  chooseBlightFeat(combat, 'a', { threshold: 25, path: 'survivor' });
  const after = combat.players.get('a');
  assert.equal(after.allocatedAttributes.constitution, a.attributes.constitution);
  assert.equal(after.attributes.constitution, a.attributes.constitution + 1);
  assert.equal(after.entity.poiseMeter.max, poise + 1);
  assert.deepEqual(currentPools(after.entity), pools);
  assert.deepEqual(after.entity.counter, paidCounter);
  assert.deepEqual(positions(after), piles);
  assert.deepEqual(combat.players.get('b'), other);
  assert.deepEqual(combat.rng.getCounters(), counters);
  assert.equal(combat.registries, scopedA, 'projection uses the acting owner catalog');
  assertReceipts(after, a, scopedA);
  const snapshot = serializeCoopCombatSnapshot(combat);
  refreshExpandedLoadout(combat, after.entity);
  assert.deepEqual(serializeCoopCombatSnapshot(combat), snapshot, 'reprojection is idempotent, including paid payloads');
});

test('production co-op member projection carries equipment rules and reloads the exact Survivor state', () => {
  let saved;
  const session = createSession({ registries, seedString: 'GOLDBOUGH', saveSession: data => { saved = structuredClone(data); return true; } });
  session.addMember({ id: 'a', name: 'Ash', classId: 'reaver', playInDeckOrder: true });
  session.start();
  const run = session.session.members.get('a').run;
  while (run.classMasteryState.initialTreeTiers.length) session.chooseMasteryNode('a', initialClassTreeChoices(registriesForClassMastery(registries, run), run)[0]);
  pending(run);
  assert.equal(session.chooseNode('a', session.session.reachableIds[0]).ok, true);
  const before = session.live.combat.players.get('a');
  assert.deepEqual(before.equipmentProfileRuleSnapshot, run.equipmentProfileRuleSnapshot);
  assert.equal(before.equipmentAttackSlotCount, run.equipmentAttackSlotCount);
  assert.deepEqual(before.itemMounts, run.itemMounts || {});
  const pools = currentPools(before.entity), piles = positions(before), counters = session.live.combat.rng.getCounters();
  assert.equal(session.combatBlightFeat('a', { threshold: 25, path: 'survivor' }).ok, true);
  const live = session.live.combat.players.get('a');
  assert.deepEqual(currentPools(live.entity), pools);
  assert.deepEqual(positions(live), piles);
  assert.deepEqual(session.live.combat.rng.getCounters(), counters);
  assertReceipts(live, run, registriesForClassMastery(registries, run));
  const restored = restoreSession(registries, JSON.parse(JSON.stringify(saved)), { saveSession: () => true });
  const restoredSeat = restored.live.combat.players.get('a');
  // Reconnection intentionally marks members disconnected; compare the whole
  // saved gameplay seat independently of that transport-presence flag.
  const gameplaySeat = ({ connected, ...seat }) => JSON.parse(JSON.stringify(seat));
  assert.equal(restoredSeat.connected, false);
  assert.deepEqual(gameplaySeat(restoredSeat), gameplaySeat(live));
  assert.deepEqual(JSON.parse(JSON.stringify(restored.live.combat.eventLog)), JSON.parse(JSON.stringify(session.live.combat.eventLog)));
  assert.deepEqual(restored.live.combat.rng.getCounters(), session.live.combat.rng.getCounters());
});

for (const phase of ['player', 'enemy']) for (const alive of [true, false]) {
  test(`v2 ${phase}-phase join restores the previous owner even when joining alive=${alive}`, () => {
    const a = createRunState({ registries, seed: 11, classId: 'reaver' });
    const b = createRunState({ registries, seed: 12, classId: 'herald' });
    const c = createRunState({ registries, seed: 13, classId: 'starseer' });
    if (!alive) payAshenBlight({ combatExpansionVersion: 2, draw: () => 0 }, c, { amount: 100, receiptId: 'terminal', combatKey: 'previous' });
    const combat = createCoopCombat({ registries, rng: createRng(11), ratingsRules: null,
      combatExpansionVersion: 2, players: [input(a, 'a'), input(b, 'b')], enemyIds: ['wanderingSoldier'] });
    combat.phase = phase;
    const previous = combat.playerKey;
    assert.ok(previous);
    const original = structuredClone(combat.players.get(previous));
    joinCombat(combat, input(c, 'c'));
    const joined = combat.players.get('c');
    assert.equal(joined.entity.alive, alive);
    assert.equal(combat.playerKey, previous);
    assert.equal(combat.player, combat.players.get(previous).entity);
    assert.equal(combat.piles, combat.players.get(previous).piles);
    assert.equal(combat.loadout, combat.players.get(previous).loadout);
    assert.equal(combat.equipmentProfileRuleSnapshot, combat.players.get(previous).equipmentProfileRuleSnapshot);
    assert.deepEqual(combat.players.get(previous), original);
    assert.equal(joined.piles.hand.length > 0, phase === 'player' && alive);
  });
}

test('older co-op seat restores missing equipment context from its saved member, preserving retired slots and host rules', () => {
  const run = createRunState({ registries, seed: 11, classId: 'reaver' });
  run.equipmentProfileRuleSnapshot.profiles.bladeAttack.baseValue += 7;
  run.removedAttackSlotIds = ['attack:0'];
  run.deck = run.deck.filter(card => card.equipmentAttackSlotId !== 'attack:0');
  stampDeck(registries, run, undefined, { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
  pending(run);
  const member = input(run, 'a');
  const combat = createCoopCombat({ registries, rng: createRng(11), ratingsRules: null,
    combatExpansionVersion: 2, players: [member], enemyIds: ['wanderingSoldier'] });
  const seat = combat.players.get('a');
  for (const key of ['equipmentProfileRuleSnapshot', 'equipmentAttackSlotCount', 'removedAttackSlotIds', 'itemMounts']) delete seat[key];
  const counters = combat.rng.getCounters();
  const restored = createCoopCombat({ registries, rng: createRng(11, counters), players: [member], enemyIds: [],
    snapshot: serializeCoopCombatSnapshot(combat) });
  const before = restored.players.get('a');
  assert.deepEqual(before.equipmentProfileRuleSnapshot, run.equipmentProfileRuleSnapshot);
  assert.equal(before.equipmentAttackSlotCount, 1, 'the original birth quota is independent of the retired active slot');
  assert.deepEqual(before.removedAttackSlotIds, ['attack:0']);
  const piles = positions(before), pools = currentPools(before.entity);
  chooseBlightFeat(restored, 'a', { threshold: 25, path: 'survivor' });
  const after = restored.players.get('a');
  assert.deepEqual(positions(after), piles);
  assert.deepEqual(currentPools(after.entity), pools);
  assert.equal(cardsOf(after).some(card => card.equipmentAttackSlotId === 'attack:0'), false);
  assertReceipts(after, run);
  assert.deepEqual(restored.rng.getCounters(), counters);
});
