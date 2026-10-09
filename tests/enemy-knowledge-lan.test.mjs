import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { projectLanSnapshot } from '../tools/lan-state.mjs';
import { coopEnemyIntent } from '../src/ui/models/CoopIntentModel.js';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
const registries = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance,
  enemyKnowledge: { ...contentBundle.balance.enemyKnowledge, reads: { ...contentBundle.balance.enemyKnowledge.reads,
    minimumExact: 0, maximumExact: 0, minimumClue: 0, maximumClue: 0 } } } });
function fixture(roomId = 'unique-room-one', commit = () => true) {
  let saved;
  const host = createSession({ registries, seedString: 'GUARD2', knowledgeAuthority: { roomId, privateSeed: 0x24681357 },
    saveSession: data => { if (commit(data) === false) return false; saved = structuredClone(data); return true; } });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const member of host.session.members.values()) while (member.run.classMasteryState?.initialTreeTiers.length) {
    const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
    assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
  }
  for (const id of ['p1', 'p2']) assert.equal(host.chooseNode(id, host.session.mapGraph.startIds[0]).ok, true);
  assert.equal(host.scene.kind, 'combat');
  return { host, saved: () => saved };
}
test('actual LAN authority persists private reads and exposes only owned learning and unknown allowlists', () => {
  const { host, saved } = fixture();
  const enemy = host.live.combat.enemies[0], serial = enemy.knowledgeAction.serial;
  const prior = JSON.stringify(host.serialize());
  assert.equal(host.combatPredict('p1', enemy.id, serial + 100, 'Attack').ok, false);
  assert.equal(JSON.stringify(host.serialize()), prior);
  assert.equal(host.combatPredict('p1', enemy.id, serial, enemy.knowledgeAction.category).ok, true);
  const wire = projectLanSnapshot(host.snapshot(), ['p1']);
  const viewEnemy = wire.scene.enemies[0];
  assert.deepEqual(Object.keys(viewEnemy.knowledgeAction.reads), ['p1']);
  assert.equal(viewEnemy.knowledgeAction.category, undefined);
  assert.equal(viewEnemy.combatStance, undefined);
  assert.deepEqual(Object.keys(wire.scene.enemyKnowledge.owners), ['p1']);
  assert.equal(wire.party.find(member => member.id === 'p2').enemyKnowledgeState, undefined);
  assert.equal(wire.party.find(member => member.id === 'p2').skills.perception, undefined);
  assert.equal(coopEnemyIntent(viewEnemy, 'p1').label, '?');
  assert.equal(coopEnemyIntent(viewEnemy, 'p2').label, '?');
  for (const card of wire.scene.players.find(player => player.id === 'p2').hand) {
    assert.equal(card.combatPreview, undefined);
    assert.equal(card.upcastPreviews, undefined);
    assert.equal(card.values, undefined);
  }
  assert.doesNotMatch(JSON.stringify(wire), /privateSeed|readCounters|knowledgeAuthority/);
  assert.ok(saved().liveCombat, 'accepted prediction crosses the real host save boundary');
  const before = structuredClone(host.live.combat.enemyKnowledge);
  const restored = restoreSession(registries, saved());
  assert.deepEqual(restored.live.combat.enemyKnowledge, before);
  assert.equal(restored.session.members.get('p1').run.enemyKnowledgeState.currentEncounter.id, before.encounter.id);
  const another = fixture('unique-room-two').host;
  assert.notEqual(another.live.combat.enemyKnowledge.encounter.id, before.encounter.id, 'same map seed does not identify a new room encounter');
});

test('host learning acknowledgment commits member and combat once, and refusal adopts neither', () => {
  let writes = 0, refused = false;
  const { host, saved } = fixture('atomic-room', () => { writes++; return !refused; });
  const captured = structuredClone(host.snapshot().party[0].enemyKnowledgeState.pending);
  const before = JSON.stringify(host.serialize());
  refused = true; writes = 0;
  assert.equal(host.acknowledgeEnemyLearning('p1', captured).ok, false);
  assert.equal(writes, 1);
  assert.equal(JSON.stringify(host.serialize()), before);
  refused = false; writes = 0;
  assert.equal(host.acknowledgeEnemyLearning('p1', captured).ok, true);
  assert.equal(writes, 1);
  const restored = restoreSession(registries, saved());
  assert.deepEqual(restored.session.members.get('p1').run.enemyKnowledgeState.pending.enemies, {});
  assert.deepEqual(restored.live.combat.enemyKnowledge.owners.p1.pending.enemies, {});
});

test('actual reaction authority persists offers and hides unowned options', () => {
  const { host, saved } = fixture('reaction-authority');
  const C = host.live.combat;
  assert.equal(C.reactionRulesVersion, 1);
  for (const P of C.players.values()) {
    P.piles.draw.push(...P.piles.hand);
    P.piles.hand = [{ cardId: 'guardCounter', instanceId: `${P.id}:reaction`, upgraded: false }];
    P.entity.energy = 8; P.entity.energyMax = 8; P.entity.block = 100;
  }
  assert.equal(host.combatEndTurn('p1').ok, true);
  assert.equal(host.combatEndTurn('p2').ok, true);
  assert.equal(host.live.combat.pendingReaction.ownerId, 'p1');
  const offer = host.live.combat.pendingReaction;
  const wire = projectLanSnapshot(host.snapshot(), ['p2']);
  assert.equal(wire.scene.players.find(player => player.id === 'p1').pendingReaction, undefined);
  assert.deepEqual(wire.scene.reactionWaiting, { id: offer.id, ownerId: 'p1' });
  assert.ok(wire.scene.enemies.find(enemy => enemy.id === offer.sourceId).actorIntentRevealed);
  const before = JSON.stringify(host.serialize());
  assert.equal(host.combatChooseReaction('p2', { offerId: offer.id }).ok, false);
  assert.equal(JSON.stringify(host.serialize()), before);
  const counters = host.live.combat.rng.getCounters();
  host.setCombatSave(() => false);
  assert.equal(host.combatChooseReaction('p1', { offerId: offer.id }).ok, false);
  assert.equal(JSON.stringify(host.serialize()), before);
  assert.deepEqual(host.live.combat.rng.getCounters(), counters);
  host.setCombatSave(() => true);
  const restored = restoreSession(registries, saved());
  assert.equal(restored.live.combat.pendingReaction.id, offer.id);
  restored.setConnected('p1', true); restored.setConnected('p2', true);
  const liveAnswer = host.combatChooseReaction('p1', { offerId: offer.id });
  assert.equal(liveAnswer.ok, true, JSON.stringify(liveAnswer));
  const restoredAnswer = restored.combatChooseReaction('p1', { offerId: offer.id });
  assert.equal(restoredAnswer.ok, true, JSON.stringify(restoredAnswer));
  assert.deepEqual(host.live.combat.rng.getCounters(), restored.live.combat.rng.getCounters());
  assert.deepEqual(host.live.combat.pendingReaction, restored.live.combat.pendingReaction);
});

test('host reaction switch saves only its owner and a refused durable write adopts nothing', () => {
  let refused = false;
  const { host, saved } = fixture('reaction-switch-authority', () => !refused);
  const before = host.serialize(), counters = host.live.combat.rng.getCounters();
  refused = true;
  assert.equal(host.combatSetReactions('p1', false).ok, false);
  assert.deepEqual(host.serialize(), before);
  assert.deepEqual(host.live.combat.rng.getCounters(), counters);
  refused = false;
  assert.equal(host.combatSetReactions('p1', false).ok, true);
  assert.equal(host.live.combat.players.get('p1').entity.reactionsEnabled, false);
  assert.equal(host.live.combat.players.get('p2').entity.reactionsEnabled, undefined);
  assert.equal(host.combatSetReactions('foreign', false).ok, false);
  const restored = restoreSession(registries, saved());
  assert.equal(restored.live.combat.players.get('p1').entity.reactionsEnabled, false);
  assert.equal(restored.live.combat.players.get('p2').entity.reactionsEnabled, undefined);
  assert.deepEqual(restored.snapshot().scene.combatLog, host.snapshot().scene.combatLog);
});

test('restored room authority refuses malformed ordinal, downgrade and member identity drift', () => {
  const { saved } = fixture();
  for (const ordinal of ['oops', -1, 1.5, Number.MAX_SAFE_INTEGER + 1, undefined, 0, 2]) {
    const corrupt = structuredClone(saved()); corrupt.knowledgeAuthority.visitOrdinal = ordinal;
    assert.throws(() => restoreSession(registries, corrupt), /knowledge|learning|ordinal/i);
  }
  const missing = structuredClone(saved()); delete missing.knowledgeAuthority;
  assert.throws(() => restoreSession(registries, missing), /knowledge|learning/i);
  const mismatch = structuredClone(saved()); mismatch.members[0].run.enemyKnowledgeState.receiptId = 'different-room';
  assert.throws(() => restoreSession(registries, mismatch), /learning|refused/i);
});

test('actual LAN learning bank acknowledges only earned owned receipts and never reopens the encounter', () => {
  const { host } = fixture();
  const before = structuredClone(host.live.combat.enemyKnowledge);
  const player = host.snapshot().party.find(member => member.id === 'p1');
  const captured = structuredClone(player.enemyKnowledgeState.pending);
  assert.equal(host.acknowledgeEnemyLearning('p1', captured).ok, true);
  assert.deepEqual(host.session.members.get('p1').run.enemyKnowledgeState.pending.enemies, {});
  assert.deepEqual(host.live.combat.enemyKnowledge.owners.p1.pending.enemies, {});
  assert.ok(Object.keys(host.live.combat.enemyKnowledge.owners.p2.pending.enemies).length);
  assert.deepEqual(host.live.combat.enemyKnowledge.readCounters, before.readCounters);
  assert.equal(host.live.combat.enemyKnowledge.nextSerial, before.nextSerial);
  assert.equal(host.session.members.get('p1').run.enemyKnowledgeState.visitOrdinal, 1);
  const fake = structuredClone(captured);
  const row = Object.values(fake.enemies)[0]; row.receipts['unearned-encounter'] = { bonus: true };
  assert.equal(host.acknowledgeEnemyLearning('p1', fake).ok, false);
});

test('foreign postcombat progression history omits private Perception while preserving ordinary XP', () => {
  const receipt = { xpBefore: { tracks: { perception: { level: 2, xp: 3 }, 'item:blade': { level: 1, xp: 4 } } },
    xpGains: { tracks: { perception: 1, 'item:blade': 2 } } };
  const source = { party: ['p1', 'p2'].map(id => ({ id, xpProgression: { ...structuredClone(receipt), history: [structuredClone(receipt)] } })), scene: { kind: 'reward' } };
  const view = projectLanSnapshot(source, ['p1']);
  for (const row of [view.party[1].xpProgression, ...view.party[1].xpProgression.history]) {
    assert.equal(row.xpBefore.tracks.perception, undefined);
    assert.equal(row.xpGains.tracks.perception, undefined);
    assert.deepEqual(row.xpBefore.tracks['item:blade'], { level: 1, xp: 4 });
    assert.equal(row.xpGains.tracks['item:blade'], 2);
  }
  assert.deepEqual(view.party[0].xpProgression, source.party[0].xpProgression);
  assert.ok(source.party[1].xpProgression.xpBefore.tracks.perception);
});
