import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, playCard, recoverControl, chooseBlightFeat, endTurn, joinCombat, leaveCombat } from '../src/engine/coopCombat.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { serializeCoopCombatSnapshot, decodeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';
import { payAshenBlight, chooseAshenBlightFeat } from '../src/engine/ashenBlight.js';
import { createAshenBlightState } from '../src/model/ashenBlight.js';
import { corruptedCards } from '../src/content/cards/corrupted.js';
import { candidateState } from '../src/engine/combatRules.js';
import { mountCombatCombo } from '../src/engine/combatExpansionCombos.js';

const registries = createRegistries({ ...contentBundle, cards: [...contentBundle.cards,
  ...corruptedCards.filter(card => !contentBundle.cards.some(row => row.id === card.id))] });

test('co-op birth defaults to expanded rules and restored older sessions keep new seats on their saved version', () => {
  const current = createSession({ registries, seedString: 'BIRTH2' });
  const expanded = current.addMember({ id: 'a', name: 'A', classId: 'reaver' });
  assert.equal(expanded.run.combatExpansionVersion, 2);
  assert.equal(current.serialize().advancedConfigSnapshot.breakMeterVersion, 2);
  const legacy = createSession({ registries, seedString: 'BIRTH1', combatExpansionVersion: 1 });
  const original = legacy.addMember({ id: 'a', name: 'A', classId: 'reaver' });
  assert.equal(original.run.combatExpansionVersion, 1);
  assert.equal(original.run.ashenBlight, undefined);
  legacy.start();
  const restored = restoreSession(registries, legacy.serialize());
  assert.deepEqual(restored.refusedMembers(), []);
  const joined = restored.addMember({ id: 'b', name: 'B', classId: 'herald' });
  assert.equal(joined.run.combatExpansionVersion, 1);
  assert.equal(joined.run.ashenBlight, undefined);
  assert.equal(restored.serialize().advancedConfigSnapshot.breakMeterVersion, 1);
});

function player(id, cardId = 'blightedTransmute') {
  return { id, classId: 'herald', combatExpansionVersion: 2, maxHp: 80, hp: 70,
    maxStamina: 30, stamina: 30, energyMax: 30, maxMana: 30, mana: 30, drawPerTurn: 3,
    attributes: { strength: 4, dexterity: 4, constitution: 4, intelligence: 4, wisdom: 4 },
    relicIds: [], orderedDraw: true, deck: [{ instanceId: `${id}-native`, cardId },
      ...Array.from({ length: 5 }, (_, index) => ({ instanceId: `${id}-${index}`, cardId: 'strike' }))] };
}
function fight(seed = 123, players = [player('a'), player('b', 'defend')]) {
  return createCoopCombat({ registries, rng: createRng(seed), players, enemyIds: ['wanderingSoldier'],
    ratingsRules: null, combatKey: 'run:fight1', combatExpansionVersion: 2 });
}

test('co-op accepted play saves exact piles/resources/Blight/RNG and restores without replay', () => {
  const combat = fight(); let snapshot, counters;
  combat.beforeCombatCommit = candidate => { snapshot = serializeCoopCombatSnapshot(candidate); counters = candidate.rng.getCounters(); };
  playCard(combat, 'a', 'a-native');
  assert.equal(combat.players.get('a').entity.ashenBlight.value, 12);
  assert.equal(combat.players.get('b').entity.ashenBlight.value, 0);
  const restored = createCoopCombat({ registries, rng: createRng(combat.rng.seed, counters), players: [player('a'), player('b', 'defend')], enemyIds: [], snapshot: JSON.parse(JSON.stringify(snapshot)) });
  assert.deepEqual(serializeCoopCombatSnapshot(restored), snapshot);
  assert.equal(restored.players.get('a').piles.exhaust[0].instanceId, 'a-native');
  assert.equal(restored.players.get('a').entity.counters.cardsPlayedThisCombat, 1);
  assert.deepEqual(restored.rng.getCounters(), counters);
  assert.throws(() => playCard(restored, 'a', 'a-native'), /not in hand/);
});

test('durable failure rejects the whole co-op candidate including irreversible payment', () => {
  const combat = fight();
  const before = serializeCoopCombatSnapshot(combat), counters = combat.rng.getCounters();
  combat.beforeCombatCommit = () => { throw new Error('disk unavailable'); };
  assert.throws(() => playCard(combat, 'a', 'a-native'), /disk unavailable/);
  assert.deepEqual(serializeCoopCombatSnapshot(combat), before);
  assert.deepEqual(combat.rng.getCounters(), counters);
});

test('per-character terminal Blight saves before effects and never revives when another seat wins', () => {
  const native = player('a'), seed = Array.from({ length: 50 }, (_, index) => index + 1).find(value => createRng(value).float('ashenBlight') < .9);
  native.ashenBlight = createAshenBlightState();
  payAshenBlight({ combatExpansionVersion: 2, draw: () => .5 }, native, { amount: 88, receiptId: 'prior', combatKey: 'run:fight0' });
  for (const threshold of [25, 50, 75]) chooseAshenBlightFeat({ combatExpansionVersion: 2 }, native, { threshold, path: 'martial' });
  const combat = fight(seed, [native, player('b', 'defend')]); let saved;
  combat.beforeCombatCommit = candidate => { saved = serializeCoopCombatSnapshot(candidate); };
  mountCombatCombo(combat, combat.players.get('a').entity, { ...registries.cards.get('emberCovenant'), cardId: 'emberCovenant' });
  const barrierBefore = combat.players.get('a').entity.wardBarrier;
  const cardsBefore = combat.players.get('a').piles.hand.length;
  playCard(combat, 'a', 'a-native');
  const actor = combat.players.get('a').entity;
  assert.equal(actor.hp, 0); assert.equal(actor.alive, false); assert.equal(actor.blightTerminal, true);
  assert.equal(actor.wardBarrier, barrierBefore, 'terminal accepted payment grants no Covenant protection');
  assert.equal(combat.queue.length, 0, 'the surviving seat can proceed without an unresolved bonus');
  assert.equal(actor.counters.cardsPlayedThisCombat, 0, 'card effects/play hooks did not run');
  assert.equal(combat.players.get('a').piles.hand.length, cardsBefore - 1, 'accepted card exhausted while its draw effect did not run');
  assert.equal(combat.players.get('a').piles.exhaust.some(card => card.instanceId === 'a-native'), true);
  assert.equal(combat.result, null, 'the other character can finish the fight');
  assert.equal(decodeCoopCombatSnapshot(saved).players.get('a').entity.ashenBlight.thresholdOutcome, 'lost');
});

test('locked co-op actor may recover while ordinary cards are rejected without spending', () => {
  const combat = fight(); const actor = combat.players.get('a').entity;
  actor.statuses.sleep = { stacks: 1 }; const old = actor.energy;
  assert.throws(() => playCard(combat, 'a', 'a-native'), /Recover/);
  assert.equal(actor.energy, old); assert.equal(actor.ashenBlight.value, 0);
  recoverControl(combat, 'a', [{ status: 'sleep', stacks: 1 }]);
  assert.equal(actor.statuses.sleep, undefined); assert.equal(actor.energy, old - 2);
  assert.doesNotThrow(() => playCard(combat, 'a', 'a-native'));
});

test('co-op milestone budgets and stamina drawbacks belong only to the acting seat', () => {
  const combat = fight(); const actor = combat.players.get('a').entity;
  payAshenBlight(combat, actor, { amount: 25, receiptId: 'stage', combatKey: combat.combatKey });
  assert.throws(() => playCard(combat, 'a', 'a-native'), /pending Ashen/);
  chooseBlightFeat(combat, 'a', { threshold: 25, path: 'spell' });
  assert.equal(actor.maxStamina, 29); assert.equal(actor.energy, 29);
  assert.equal(combat.players.get('a').attributes.intelligence, 5);
  assert.equal(combat.players.get('b').attributes.intelligence, 4);
  assert.equal(combat.players.get('b').entity.maxStamina, 30);
});

test('graph snapshot preserves paused source/ally references and refuses malicious graph keys', () => {
  const combat = fight(); const source = combat.players.get('a').entity, target = combat.players.get('b').entity;
  combat.pendingAbilityDiscard = { playerId: 'a' };
  combat.queue.push({ effect: { op: 'heal', amount: 2 }, source, owner: source, target });
  const snapshot = serializeCoopCombatSnapshot(combat), decoded = decodeCoopCombatSnapshot(snapshot);
  assert.equal(decoded.queue[0].source, decoded.players.get('a').entity);
  assert.equal(decoded.queue[0].target, decoded.players.get('b').entity);
  const bad = structuredClone(snapshot); bad.nodes[bad.root.ref].entries.push(['__proto__', null]);
  assert.throws(() => decodeCoopCombatSnapshot(bad), /object key/);
});

test('suspended expanded combat resumes existing pools, owner cycle and spent family budget', () => {
  const combat = fight(123, [player('a')]), actor = combat.players.get('a').entity;
  actor.energy = 1; actor.ashenBlightCombat.used.martial = true;
  const cycle = actor.combatOwnerCycle, hand = structuredClone(combat.piles.hand);
  leaveCombat(combat, 'a'); assert.equal(combat.phase, 'suspended');
  joinCombat(combat, player('a'));
  assert.equal(actor.energy, 1); assert.equal(actor.combatOwnerCycle, cycle);
  assert.equal(actor.ashenBlightCombat.used.martial, true);
  assert.deepEqual(combat.piles.hand, hand); assert.equal(combat.players.get('a').ended, false);
});

test('later combat entry resolves one saved five-percent death roll before any opening play', () => {
  const seed = Array.from({ length: 1000 }, (_, index) => index + 1).find(value => createRng(value).float('ashenBlight') < .05);
  const native = player('a'); native.ashenBlight = createAshenBlightState();
  payAshenBlight({ combatExpansionVersion: 2, draw: () => .95 }, native, { amount: 100, receiptId: 'converted', combatKey: 'run:fight0' });
  for (const threshold of [25, 50, 75]) chooseAshenBlightFeat({ combatExpansionVersion: 2 }, native, { threshold, path: 'martial' });
  const combat = fight(seed, [native]);
  assert.equal(combat.result, 'defeat'); assert.equal(combat.turn, 0);
  assert.equal(combat.players.get('a').piles.hand.length, 0);
  assert.equal(combat.players.get('a').entity.ashenBlight.entries.length, 1);
  const counters = combat.rng.getCounters(), snapshot = serializeCoopCombatSnapshot(combat);
  const restored = createCoopCombat({ registries, rng: createRng(seed, counters), players: [native], enemyIds: [], snapshot });
  assert.equal(restored.result, 'defeat'); assert.deepEqual(restored.rng.getCounters(), counters);
  assert.equal(restored.players.get('a').entity.ashenBlight.entries.length, 1);
  joinCombat(restored, native);
  assert.equal(restored.players.get('a').entity.alive, false, 'reconnect cannot revive a Blight loss');
});

function host(saveSession) {
  const session = createSession({ registries, seedString: 'GOLDBOUGH', saveSession });
  session.addMember({ id: 'a', name: 'Ash', classId: 'herald', playInDeckOrder: true });
  session.start();
  const run = session.session.members.get('a').run;
  while (run.classMasteryState.initialTreeTiers.length) session.chooseMasteryNode('a', initialClassTreeChoices(registriesForClassMastery(registries, run), run)[0]);
  run.deck.unshift({ instanceId: 'host-native', cardId: 'blightedTransmute', upgraded: false });
  return session;
}

test('host disk restore retains accepted card/resources/RNG and reconnect does not rerun the opening', () => {
  let saved; const session = host(data => { saved = structuredClone(data); return true; });
  assert.equal(session.chooseNode('a', session.session.reachableIds[0]).ok, true);
  assert.equal(saved.liveCombat.snapshot.version, 1, 'entry was saved before its scene was presented');
  assert.equal(session.combatPlay('a', 'host-native').ok, true);
  const before = session.live.combat.players.get('a');
  const restored = restoreSession(registries, JSON.parse(JSON.stringify(saved)), { saveSession: data => true });
  const after = restored.live.combat.players.get('a');
  assert.equal(after.entity.ashenBlight.value, 12);
  assert.equal(after.piles.exhaust.some(card => card.instanceId === 'host-native'), true);
  assert.equal(after.entity.energy, before.entity.energy);
  assert.deepEqual(restored.live.combat.rng.getCounters(), session.live.combat.rng.getCounters());
  const hand = structuredClone(after.piles.hand), cycle = after.entity.combatOwnerCycle;
  restored.setConnected('a', true);
  assert.deepEqual(after.piles.hand, hand); assert.equal(after.entity.combatOwnerCycle, cycle);
  assert.equal(restored.combatPlay('a', 'host-native').ok, false);
});

test('host rejects failed combat entry save and retry uses identical room/RNG inputs', () => {
  let refuse = true;
  const session = host(data => { if (refuse) throw new Error('save destination unavailable'); return true; });
  const counters = session.serialize().rng;
  const node = session.session.reachableIds[0];
  assert.equal(session.chooseNode('a', node).ok, false);
  assert.equal(session.live, null); assert.deepEqual(session.serialize().rng, counters);
  assert.equal(session.scene.kind, 'map');
  refuse = false;
  assert.equal(session.chooseNode('a', node).ok, true); assert.equal(session.scene.kind, 'combat');
});

test('host presence save refusal leaves both member connection and combat state unchanged', () => {
  let refuse = false;
  const session = host(() => { if (refuse) throw new Error('presence save refused'); return true; });
  assert.equal(session.chooseNode('a', session.session.reachableIds[0]).ok, true);
  const before = serializeCoopCombatSnapshot(session.live.combat);
  refuse = true;
  assert.throws(() => session.setConnected('a', false), /presence save refused/);
  assert.equal(session.session.members.get('a').connected, true);
  assert.deepEqual(serializeCoopCombatSnapshot(session.live.combat), before);
});

test('candidate ally draw obeys the recipient ordered deck without mutating the live fight', () => {
  const combat = fight(), seat = combat.players.get('b');
  const cards = [...seat.piles.hand, ...seat.piles.draw];
  seat.piles.hand = []; seat.piles.draw = []; seat.piles.discard = cards.reverse();
  const counters = combat.rng.getCounters(), clone = candidateState(combat), recipient = clone.players.get('b');
  const originalOwner = clone.playerKey;
  clone.drawCardsFor(recipient.entity, 1);
  assert.equal(recipient.piles.hand[0].instanceId, 'b-native');
  assert.equal(clone.playerKey, originalOwner);
  assert.equal(seat.piles.hand.length, 0);
  assert.deepEqual(clone.rng.getCounters(), counters, 'ordered ally draws do not shuffle');
});

test('co-op one-turn Retain grants expire at the following owner start', () => {
  const combat = fight(123, [player('a', 'defend')]);
  const actor = combat.players.get('a').entity;
  actor.combatRetainedCards = [combat.piles.hand[0].instanceId];
  actor.block = 100;
  endTurn(combat, 'a');
  assert.equal(combat.turn, 2);
  assert.equal(actor.combatRetainedCards, undefined);
});
