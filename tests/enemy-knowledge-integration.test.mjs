import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat, runCombatEnd } from '../src/engine/runCombat.js';
import { dispatch, previewIntent } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dealPoiseDamage } from '../src/engine/actions.js';
import { runCombatPlayer } from '../src/engine/runCombat.js';
import { createCoopCombat, previewCoopIntent, predictCoopIntent, endTurn, joinCombat } from '../src/engine/coopCombat.js';
import { serializeCoopCombatSnapshot, decodeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';
import { openRunEnemyKnowledge } from '../src/model/enemyKnowledgeRun.js';
import { previewCard } from '../src/engine/combat.js';
import { skillTracks, awardSkillXp, bankSkillXp, claimBankedSkillLevel } from '../src/model/skills.js';
import { skillProgressRows, staleSkillTracks } from '../src/model/progression.js';
import { characterSheetModel } from '../src/ui/models/CharacterSheetModel.js';
import { combatEnemyKnowledgeProblems } from '../src/model/enemyKnowledgeCombat.js';
import { commitExpansionCandidate } from '../src/engine/combatExpansionSave.js';
import { createSaveManager } from '../src/engine/save.js';

function skipReactions(combat) {
  let skipped = 0;
  while (combat.pendingReaction) {
    assert.ok(skipped++ < 64, 'reaction continuation is bounded');
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  return skipped;
}

test('knowledge opted-in predictions stay unsaved, pauses write exactly, resolved XP banks without moving the checkpoint', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ registries, seed: 11, classId: 'reaver' });
  Object.assign(run.enemyKnowledgeRules.reads, { minimumExact: 0, maximumExact: 0, minimumClue: 0, maximumClue: 0 });
  openRunEnemyKnowledge(run, { bankable: true, receiptId: 'knowledge-checkpoint-owned-run' });
  const nodeId = 'n1_4', encounterId = 'patrol';
  run.combatEntered = { nodeId, encounterId };
  const rng = createRng(run.seed), entries = new Map();
  const saves = createSaveManager({ getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) });
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  let refused = false, writes = 0, checkpointWrites = 0, checkpointCounters = null;
  const durable = candidate => commitExpansionCandidate({ run, candidate, nodeId, encounterId,
    saveCandidate: (next, committedRng) => {
      if (refused) return { ok: false, error: 'Knowledge checkpoint refused' };
      writes++;
      if (committedRng) { checkpointWrites++; checkpointCounters = committedRng.getCounters(); }
      return saves.saveRun(next, committedRng);
    } });
  durable(combat); combat.beforeCombatCommit = durable;
  const opening = saves.loadRun(registries).combatEntered.snapshot;
  // SPEC §3.12/§9: an accepted prediction is an ordinary action. It earns
  // nothing until the action executes, so nothing is written and abandoning
  // still restarts the fight from its entry checkpoint.
  dispatch(combat, { type: 'predictIntent', enemyInstanceId: 'e1', actionSerial: combat.enemies[0].knowledgeAction.serial,
    maneuver: combat.enemies[0].knowledgeAction.category });
  assert.equal(writes, 1, 'an accepted prediction does not replace the entry checkpoint');
  assert.deepEqual(saves.loadRun(registries).combatEntered.snapshot, opening);
  // A reaction pause is persisted exactly (combat-reaction contract); a refused
  // write rolls the whole command back.
  const before = serializeCombatSnapshot(combat), beforeRun = structuredClone(run), beforeRng = rng.getCounters();
  refused = true;
  assert.throws(() => dispatch(combat, { type: 'endTurn' }), /Knowledge checkpoint refused/);
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  assert.deepEqual(run, beforeRun); assert.deepEqual(rng.getCounters(), beforeRng);
  refused = false; dispatch(combat, { type: 'endTurn' });
  assert.equal(writes, 2, 'the paused incoming turn writes its exact continuation');
  assert.ok(combat.pendingReaction, 'new rules offer a real defensive reaction before execution');
  assert.equal(run.skills.perception.xp, 0, 'a paused action has not earned prediction credit');
  skipReactions(combat);
  assert.equal(run.skills.perception.xp, 1);
  const loaded = saves.loadRun(registries);
  // Resolved learning is banked to the run, but neither the checkpoint snapshot
  // nor its RNG counters move past the last exact write.
  assert.deepEqual(loaded.skills.perception, run.skills.perception);
  assert.deepEqual(loaded.enemyKnowledgeState, run.enemyKnowledgeState);
  assert.ok(writes > checkpointWrites, 'resolved XP was banked without a checkpoint write');
  assert.equal(loaded.combatEntered.snapshot.turn, 1);
  assert.deepEqual(loaded.streamCounters, checkpointCounters);
});

function fixture({ registries = createRegistries(contentBundle), enemyId = 'wanderingSoldier', counter = false, responseCard = 'shieldBash', exact = false } = {}) {
  const run = createRunState({ registries, seed: 11, classId: 'reaver' });
  Object.assign(run.enemyKnowledgeRules.reads, { minimumExact: 0, maximumExact: 0, minimumClue: 0, maximumClue: 0 });
  if (exact) Object.assign(run.enemyKnowledgeRules.reads, { minimumExact: 1, maximumExact: 1 });
  if (counter) {
    openRunEnemyKnowledge(run, { bankable: true, receiptId: 'actual-response-owned-run' });
    run.deck.unshift({ instanceId: 'knowledge-counter', cardId: responseCard, upgraded: false });
  }
  const rng = createRng(run.seed);
  const combat = createRunCombat({ registries, run, rng, enemyIds: [enemyId], settings: { playInDeckOrder: true } });
  return { registries, run, rng, combat };
}
const predict = combat => dispatch(combat, { type: 'predictIntent', enemyInstanceId: 'e1',
  actionSerial: combat.enemies[0].knowledgeAction.serial, maneuver: combat.enemies[0].knowledgeAction.category });

test('real Counter preparation and previews are inert; executed return pays one XP and one definition bonus', () => {
  for (const withPrediction of [false, true]) {
    const { combat, run } = fixture({ counter: true });
    const owner = combat.enemyKnowledge.owners.player, enemy = combat.enemies[0];
    const receiptId = combat.enemyKnowledge.encounter.id;
    for (let i = 0; i < 5; i++) previewCard(combat, 'knowledge-counter');
    assert.equal(owner.earnedXp, 0);
    if (withPrediction) predict(combat);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'knowledge-counter' });
    assert.equal(owner.earnedXp, 0, 'arming a response is not a mechanical success');
    assert.equal(owner.pending.enemies[enemy.enemyId].receipts[receiptId].bonus, false);
    dispatch(combat, { type: 'endTurn' });
    skipReactions(combat);
    assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 1);
    assert.equal(combat.enemyKnowledge.owners.player.pending.enemies[enemy.enemyId].receipts[receiptId].bonus, true);
    runCombatEnd(run, combat); runCombatEnd(run, combat);
    assert.equal(run.skills.perception.xp, 1, 'prediction and response share the action credit');
    assert.equal(run.enemyKnowledgeState.pending.enemies[enemy.enemyId].receipts[receiptId].bonus, true);
  }
});

test('real tactical replies earn definition learning at any visibility, but exact reads earn no Perception', () => {
  const { combat } = fixture({ counter: true, exact: true });
  const enemy = combat.enemies[0], receiptId = combat.enemyKnowledge.encounter.id;
  assert.equal(enemy.knowledgeAction.reads.player.visibility, 'exact');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'knowledge-counter' });
  dispatch(combat, { type: 'endTurn' });
  skipReactions(combat);
  const owner = combat.enemyKnowledge.owners.player;
  assert.equal(owner.earnedXp, 0);
  assert.equal(owner.pending.enemies[enemy.enemyId].receipts[receiptId].bonus, true);
});

test('a committed successful evade against a multi-hit wholly unknown action credits once', () => {
  const base = contentBundle.enemies.find(row => row.id === 'wanderingSoldier');
  const attack = Object.values(base.moves).find(move => move.damage != null);
  const enemy = { ...base, id: 'knowledgeMultiFixture', hp: [1000, 1000], poiseMax: 1000,
    firstMove: 'triple', moves: { triple: { ...attack, damage: 10, hits: 3 } } };
  const registries = createRegistries({ ...contentBundle, enemies: [...contentBundle.enemies, enemy] });
  const { combat } = fixture({ registries, enemyId: enemy.id, counter: true, responseCard: 'evasiveGuard' });
  combat.player.attributes.dexterity = combat.attributes.dexterity = 100;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'knowledge-counter' });
  assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 0);
  const prepared = structuredClone(combat.player.combatEvade);
  dispatch(combat, { type: 'endTurn' });
  skipReactions(combat);
  assert.ok(combat.eventLog.some(event => event.type === 'combatAvoidanceResolved' && event.evade?.success), JSON.stringify({ prepared, events: combat.eventLog.slice(-22) }));
  assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 1);
  const owner = combat.enemyKnowledge.owners.player;
  assert.equal(owner.pending.enemies[enemy.id].receipts[combat.enemyKnowledge.encounter.id].bonus, true);
});

test('Perception is visible only on opted-in runs and cannot be manually trained or grant rewards', () => {
  const { registries, run } = fixture();
  assert.equal(skillTracks(registries).some(track => track.id === 'perception'), false);
  assert.equal(skillProgressRows(registries, run).some(track => track.id === 'perception'), true);
  assert.deepEqual(staleSkillTracks(registries, run), []);
  const track = characterSheetModel(registries, run).tracks.find(track => track.id === 'perception');
  assert.equal(track.maxLevel, run.enemyKnowledgeRules.perception.maxLevel);
  assert.ok(track.rows.every(row => row.grants.length === 0));
  const before = structuredClone(run.skills);
  assert.throws(() => awardSkillXp(registries, run, 'perception', 100));
  assert.throws(() => bankSkillXp(registries, run, 'perception', 100));
  assert.equal(claimBankedSkillLevel(registries, run, 'perception'), null);
  assert.deepEqual(run.skills, before);
  const legacy = createRunState({ registries, seed: 11, classId: 'reaver', enemyKnowledgeVersion: null });
  assert.equal(skillProgressRows(registries, legacy, { includeUntouched: true }).some(track => track.id === 'perception'), false);
});

test('hidden card previews cannot reveal selected defend/counter stance through numeric matchup benefits', () => {
  const { combat, rng } = fixture();
  const enemy = combat.enemies[0], card = combat.piles.hand[0].instanceId;
  const counters = rng.getCounters(), state = structuredClone(combat.enemyKnowledge);
  const original = previewCard(combat, card, enemy.id);
  for (const maneuver of ['defend', 'counter', 'smash']) {
    enemy.combatStance = { camp: 'physical', maneuver, expiresOnOwnerCycle: 100 };
    enemy.combatCounter = { damage: 999, poiseDamage: 999 };
    enemy.intent = { kind: 'attack', moveId: 'secret', damage: 999, combatProfile: { camp: 'physical', maneuver } };
    assert.deepEqual(previewCard(combat, card, enemy.id), original);
  }
  assert.deepEqual(rng.getCounters(), counters);
  assert.deepEqual(combat.enemyKnowledge, state);
});

test('actual solo dispatch awards only executed predictions and reconciles cloned Perception once', () => {
  const { registries, run, rng, combat } = fixture();
  const projected = previewIntent(combat, 'e1');
  assert.deepEqual(Object.keys(projected).sort(), ['actionSerial', 'hidden', 'kind', 'knowledgeRead', 'label', 'moveId', 'revealed', 'stance']);
  assert.equal(projected.label, '?');
  const before = JSON.stringify(serializeCombatSnapshot(combat)), counters = rng.getCounters();
  assert.throws(() => dispatch(combat, { type: 'predictIntent', enemyInstanceId: 'e1', actionSerial: 999, maneuver: 'Attack' }));
  assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), before);
  assert.deepEqual(rng.getCounters(), counters);
  predict(combat);
  assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 0);
  for (let i = 0; i < 10; i++) previewIntent(combat, 'e1');
  assert.deepEqual(rng.getCounters(), counters);
  dispatch(combat, { type: 'endTurn' });
  skipReactions(combat);
  assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 1);
  assert.equal(run.skills.perception.xp, 0, 'combat owns its cloned ledger');
  runCombatEnd(run, combat); runCombatEnd(run, combat);
  assert.equal(run.skills.perception.xp, 1);
  assert.deepEqual(validateRunShape(run), []);
  const snapshot = serializeCombatSnapshot(combat);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(run.seed, rng.getCounters()), snapshot });
  assert.deepEqual(serializeCombatSnapshot(restored).enemyKnowledge, snapshot.enemyKnowledge);
  runCombatEnd(run, restored);
  assert.equal(run.skills.perception.xp, 1);
});

test('actual stagger cancels an accepted prediction without XP or duplicate feedback', () => {
  const { combat } = fixture();
  predict(combat);
  dealPoiseDamage(combat, combat.enemies[0], 100000);
  assert.equal(combat.enemies[0].knowledgeAction.cancelled, true);
  assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 0);
  assert.equal(combat.enemyKnowledge.owners.player.feedback.length, 1);
  assert.equal(combat.enemyKnowledge.owners.player.feedback[0].outcome, 'cancelled');
  assert.equal(previewIntent(combat, 'e1').label, 'Staggered');
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 0);
});

test('run saves bind active and terminal learning snapshots to their accepted encounter', () => {
  const { run, combat } = fixture();
  run.combatEntered = { nodeId: 'combat', encounterId: 'wanderingSoldier', snapshot: serializeCombatSnapshot(combat) };
  assert.deepEqual(validateRunShape(run), []);
  for (const corrupt of [snapshot => { snapshot.enemyKnowledge.encounter.id = 'unrelated-encounter'; },
    snapshot => { delete snapshot.enemyKnowledge; }, snapshot => { snapshot.enemyKnowledge.rules.reads.maximumExact = 0.5; },
    snapshot => { snapshot.enemyKnowledge.bankable = true; }]) {
    const damaged = structuredClone(run);
    corrupt(damaged.combatEntered.snapshot);
    assert.ok(validateRunShape(damaged).some(problem => problem.includes('combatEntered.snapshot.enemyKnowledge')));
  }
  const terminal = structuredClone(run);
  terminal.combatEntered = null;
  const snapshot = serializeCombatSnapshot(combat);
  snapshot.phase = 'ended'; snapshot.result = 'victory';
  terminal.combatPendingOutcome = { nodeId: 'combat', encounterId: 'wanderingSoldier', result: 'victory', snapshot };
  assert.deepEqual(validateRunShape(terminal), []);
  snapshot.enemyKnowledge.encounter.id = 'unrelated-encounter';
  assert.ok(validateRunShape(terminal).some(problem => problem.includes('combatPendingOutcome.snapshot.enemyKnowledge.encounter')));
});

test('damaged enemy containers return save diagnostics instead of throwing through knowledge validation', () => {
  const { run, combat } = fixture();
  const snapshot = serializeCombatSnapshot(combat);
  for (const enemies of [{}, null, [null]]) {
    const damaged = structuredClone(run);
    damaged.combatEntered = { nodeId: 'combat', encounterId: 'wanderingSoldier', snapshot: { ...snapshot, enemies } };
    let problems;
    assert.doesNotThrow(() => { problems = validateRunShape(damaged); });
    assert.ok(problems.some(problem => /enemies|enemy/.test(problem)));
    assert.doesNotThrow(() => { problems = combatEnemyKnowledgeProblems(snapshot.enemyKnowledge, enemies); });
    assert.ok(problems.some(problem => /enemies/.test(problem)));
  }
  const damaged = structuredClone(snapshot.enemyKnowledge);
  damaged.encounter.enemyIds = {};
  assert.doesNotThrow(() => combatEnemyKnowledgeProblems(damaged, snapshot.enemies));
  assert.ok(combatEnemyKnowledgeProblems(damaged, snapshot.enemies).some(problem => /encounter receipt/.test(problem)));
});

test('actual delayed move retains its serial and read through charge, snapshot and release', () => {
  const base = contentBundle.enemies.find(row => row.id === 'wanderingSoldier');
  const attack = Object.values(base.moves).find(move => move.damage != null);
  const enemy = { ...base, id: 'knowledgeDelayFixture', hp: [1000, 1000], poiseMax: 1000,
    firstMove: 'held', moves: { held: { ...attack, damage: 1, delay: { turns: 1 } } } };
  const registries = createRegistries({ ...contentBundle, enemies: [...contentBundle.enemies, enemy] });
  const { run, rng, combat } = fixture({ registries, enemyId: enemy.id });
  assert.equal(combat.enemies[0].knowledgeAction.category, 'Casting');
  predict(combat);
  const original = structuredClone(combat.enemies[0].knowledgeAction);
  dispatch(combat, { type: 'endTurn' });
  assert.deepEqual(combat.enemies[0].knowledgeAction, original);
  assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 0);
  assert.equal(rng.getCounters().enemyIntentVisibility, 1);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(run.seed, rng.getCounters()), snapshot: serializeCombatSnapshot(combat) });
  assert.deepEqual(restored.enemies[0].knowledgeAction, original);
  dispatch(restored, { type: 'endTurn' });
  assert.equal(restored.enemyKnowledge.owners.player.earnedXp, 1);
  assert.equal(restored.enemyKnowledge.owners.player.feedback[0].actionSerial, original.serial);
  assert.equal(restored.enemyKnowledge.owners.player.feedback[0].correct, true);
  assert.equal(restored.enemies[0].knowledgeAction.serial, original.serial + 1);
});

test('actual co-op uses host-private draws, owner predictions, exact restore and inert reconnect', () => {
  const registries = createRegistries(contentBundle);
  const runs = ['z', 'a'].map(id => ({ id, run: createRunState({ registries, seed: 11, classId: 'reaver' }) }));
  const rules = structuredClone(runs[0].run.enemyKnowledgeRules);
  Object.assign(rules.reads, { minimumExact: 0, maximumExact: 0, minimumClue: 0, maximumClue: 0 });
  const players = runs.map(({ id, run }) => ({ id, ...runCombatPlayer(run), combatExpansionVersion: 2 }));
  const options = { registries, players, enemyIds: ['wanderingSoldier'], knowledge: {
    rules, privateSeed: 0x13579bdf, encounter: { id: 'co-op-unique-room/1/node/encounter', enemyIds: ['wanderingSoldier'] }, bankable: true } };
  const rng = createRng(11), combat = createCoopCombat({ ...options, rng });
  assert.deepEqual(Object.keys(combat.enemies[0].knowledgeAction.reads), ['a', 'z']);
  assert.equal(rng.getCounters().enemyIntentVisibility, 0, 'public map seed carries no private read draws');
  assert.deepEqual(combat.enemyKnowledge.readCounters, { enemyIntentVisibility: 2, enemyIntentClue: 2 });
  assert.equal(previewCoopIntent(combat, 'a', 'e1').label, '?');
  const before = JSON.stringify(serializeCoopCombatSnapshot(combat));
  assert.throws(() => predictCoopIntent(combat, 'foreign', 'e1', 1, 'Attack'));
  assert.equal(JSON.stringify(serializeCoopCombatSnapshot(combat)), before);
  predictCoopIntent(combat, 'a', 'e1', 1, combat.enemies[0].knowledgeAction.category);
  assert.equal(combat.enemies[0].knowledgeAction.reads.z.prediction, null);
  const predicted = structuredClone(combat.enemies[0].knowledgeAction);
  joinCombat(combat, players.find(player => player.id === 'a'));
  assert.deepEqual(combat.enemies[0].knowledgeAction, predicted);
  assert.equal(combat.enemyKnowledge.readCounters.enemyIntentVisibility, 2);
  const snapshot = serializeCoopCombatSnapshot(combat);
  const restored = createCoopCombat({ ...options, rng: createRng(11, rng.getCounters()), snapshot });
  assert.deepEqual(restored.enemyKnowledge, combat.enemyKnowledge);
  assert.deepEqual(restored.enemies[0].knowledgeAction, predicted);
  endTurn(restored, 'a'); endTurn(restored, 'z');
  assert.equal(restored.enemyKnowledge.owners.a.earnedXp, 1);
  assert.equal(restored.enemyKnowledge.owners.z.earnedXp, 0);
  assert.equal(restored.enemyKnowledge.readCounters.enemyIntentVisibility, 4);
  const malformed = structuredClone(snapshot);
  const cursor = malformed.nodes.find(node => node.kind === 'object' && node.entries?.some(([key]) => key === 'enemyIntentClue'));
  cursor.entries = cursor.entries.map(([key]) => [key, 0]);
  assert.throws(() => decodeCoopCombatSnapshot(malformed), /private seed|carried visibility/);
  restored.result = 'victory'; restored.phase = 'ended';
  const terminalKnowledge = structuredClone(restored.enemyKnowledge);
  assert.doesNotThrow(() => joinCombat(restored, players.find(player => player.id === 'a')));
  assert.deepEqual(restored.enemyKnowledge, terminalKnowledge);
});
