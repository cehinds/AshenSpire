import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { dispatch } from '../src/engine/combat.js';
import { commitCombatSnapshot, restoreCombatSnapshot, serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createMemoryStorage, createSaveManager, META_BACKUP_KEY, runKey } from '../src/engine/save.js';
import { combatSnapshotProblems, combatSnapshotReferenceProblems } from '../src/model/combatSnapshot.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { core2Registries, core2Run } from './helpers/core2.mjs';

const seed = 511;
const wire = value => JSON.parse(JSON.stringify(value));

function createFight(encounterId, registries = core2Registries()) {
  const run = core2Run({ registries, seed, runId: `js03-${encounterId}` });
  const encounter = registries.encounters.get(encounterId);
  const combat = createRunCombat({ registries, run, encounter, enemyIds: encounter.enemies, rng: createRng(seed) });
  return { registries, run, combat, encounterId };
}

function pendingReaction() {
  const fight = createFight('a2_knight');
  const { combat } = fight;
  combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
  const strike = combat.piles.hand.find(card => card.cardId === 'core.strike');
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: combat.enemies[0].id });
  assert.ok(combat.pendingReaction);
  assert.ok(combat.reactionStack.entries.some(entry => entry.side === 'enemy'));
  return fight;
}

function pendingScout() {
  const fight = createFight('patrol');
  const { combat } = fight;
  const scout = { instanceId: 'js03-scout', cardId: 'base.scout', upgraded: false };
  combat.piles.hand.push(scout);
  dispatch(combat, { type: 'playCard', cardInstanceId: scout.instanceId, targetId: combat.player.id });
  assert.equal(combat.pendingCardChoice.effect.from, 'draw');
  return fight;
}

function snapshotOf(fight) {
  const snapshot = wire(serializeCombatSnapshot(fight.combat));
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  assert.deepEqual(combatSnapshotReferenceProblems(snapshot, fight.registries), []);
  return snapshot;
}

function expectPath(problems, path) {
  assert.ok(problems.some(problem => problem.includes(path)), `Expected ${path}, got ${JSON.stringify(problems)}`);
}

function assertMalformed(fight, snapshot, path, referencePath) {
  const before = JSON.stringify(snapshot);
  expectPath(combatSnapshotProblems(snapshot), path);
  const references = combatSnapshotReferenceProblems(snapshot, fight.registries);
  if (referencePath) expectPath(references, referencePath);
  const rng = createRng(seed);
  const counters = rng.getCounters();
  assert.throws(() => restoreCombatSnapshot({ registries: fight.registries, rng, snapshot }), error => {
    assert.match(error.message, /^Malformed combat snapshot:/);
    assert.ok(error.message.includes(path), error.message);
    return true;
  });
  assert.equal(JSON.stringify(snapshot), before, 'validation and restore leave the input unchanged');
  assert.deepEqual(rng.getCounters(), counters, 'refused restore does not draw RNG');
}

test('malformed Scout choices report the choice or pile field', async t => {
  const fight = pendingScout();
  const valid = snapshotOf(fight);
  for (const [path, edit, referencePath] of [
    ['pendingCardChoice', s => { s.pendingCardChoice = null; }],
    ['pendingCardChoice.candidateIds', s => { s.pendingCardChoice.candidateIds = {}; }],
    ['piles.draw', s => { s.piles.draw = {}; }, 'piles.draw'],
    ['piles.draw[0]', s => { s.piles.draw[0] = null; }, 'piles.draw[0]'],
  ]) {
    await t.test(path, () => {
      const snapshot = wire(valid);
      edit(snapshot);
      assertMalformed(fight, snapshot, path, referencePath);
    });
  }
});

test('malformed combat collections report their field or row instead of throwing', async t => {
  const fight = pendingReaction();
  const valid = snapshotOf(fight);
  for (const [path, edit, referencePath] of [
    ['hiddenCards', s => { s.hiddenCards = {}; }, 'hiddenCards'],
    ['hiddenCards[0]', s => { s.hiddenCards = [null]; }, 'hiddenCards[0]'],
    ['abilityQueue', s => { s.abilityQueue = {}; }],
    ['abilityQueue[0]', s => { s.abilityQueue[0] = null; }],
    ['pendingReaction', s => { s.pendingReaction = null; }],
    ['reactionResume.queue[0]', s => { s.reactionResume = { queue: [null] }; }],
    ['enemies', s => { s.enemies = {}; }, 'enemies'],
    ['enemies[0]', s => { s.enemies[0] = null; }, 'enemies[0]'],
    ['enemies[0].burdenPiles.draw[0]', s => { s.enemies[0].burdenPiles = { draw: [null], hand: [], discard: [], exhaust: [] }; }, 'enemies[0].burdenPiles.draw[0]'],
    ['loadout', s => { delete s.loadout; }, 'loadout'],
    ['gameProfile', s => { s.gameProfile.content.cards = {}; }, 'gameProfile'],
    ['player.relicIds', s => { s.player.relicIds = {}; }, 'player.relicIds'],
    ['player.flasks', s => { s.player.flasks = {}; }, 'player.flasks'],
    ['player.flasks[0]', s => { s.player.flasks = [null]; }, 'player.flasks[0]'],
  ]) {
    await t.test(path, () => {
      const snapshot = wire(valid);
      edit(snapshot);
      assertMalformed(fight, snapshot, path, referencePath);
    });
  }
});

test('snapshot roots must be objects; an absent reference input stays allowed', () => {
  const fight = pendingReaction();
  for (const snapshot of [null, [], 3, 'invalid snapshot']) {
    assertMalformed(fight, snapshot, 'snapshot must be an object', snapshot === null ? undefined : 'snapshot');
  }
  assert.deepEqual(combatSnapshotReferenceProblems(null, fight.registries), []);
});

test('multiple malformed collections report together without cascading exceptions', () => {
  const fight = pendingReaction();
  const snapshot = snapshotOf(fight);
  snapshot.hiddenCards = {};
  snapshot.abilityQueue[0] = null;
  snapshot.enemies[0] = null;
  snapshot.player.flasks = {};
  const before = JSON.stringify(snapshot);
  const problems = combatSnapshotProblems(snapshot);
  for (const path of ['hiddenCards', 'abilityQueue[0]', 'enemies[0]', 'player.flasks']) expectPath(problems, path);
  const references = combatSnapshotReferenceProblems(snapshot, fight.registries);
  for (const path of ['hiddenCards', 'enemies[0]', 'player.flasks']) expectPath(references, path);
  assert.equal(JSON.stringify(snapshot), before);
});

test('malformed numeric objects cannot trigger coercion during validation or restore', async t => {
  const fight = pendingReaction();
  const valid = snapshotOf(fight);
  const invalidNumber = { valueOf: null, toString: null };
  const item = 'armament/' + fight.registries.equipment.armaments[0].id;
  for (const [path, edit, referencePath] of [
    [`itemUpgradeLevels.${item}`, s => { s.itemUpgradeLevels[item] = invalidNumber; }, `itemUpgradeLevels.${item}`],
    ['enemyKnowledge.perception', s => { s.enemyKnowledge.rules.perception.correctPredictionXp = invalidNumber; }, 'enemyKnowledge.perception'],
    ['maxDepth', s => { s.reactionRules.stack.maxDepth = invalidNumber; }],
    ['player.counterStacks', s => { s.player.counterStacks = invalidNumber; }],
    ['combatExpansionRules.statuses.sleep.hpCombatCap', s => { s.combatExpansionRules.statuses.sleep.hpCombatCap = invalidNumber; }],
    ['player.statusControl.ownerCycle', s => { s.player.statusControl.ownerCycle = invalidNumber; }],
  ]) {
    await t.test(path, () => {
      const snapshot = wire(valid);
      edit(snapshot);
      assertMalformed(fight, snapshot, path, referencePath);
    });
  }
});

test('a well-shaped missing card reference is refused by the registry check', () => {
  const fight = pendingReaction();
  const snapshot = snapshotOf(fight);
  const missing = 'js03.nonexistentCard';
  snapshot.piles.hand[0].cardId = missing;
  const before = JSON.stringify(snapshot);
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  const references = combatSnapshotReferenceProblems(snapshot, fight.registries);
  expectPath(references, 'piles.hand');
  expectPath(references, missing);
  assert.equal(JSON.stringify(snapshot), before);
});

test('historical Core 2 snapshots still admit optional hidden cards and null loadout', () => {
  const json = gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url)));
  const profile = resolveGameProfile(JSON.parse(json));
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const fight = createFight('a3_bossAshheartDragon', registries);
  for (const hiddenCards of [undefined, null]) {
    const snapshot = snapshotOf(fight);
    if (hiddenCards === null) snapshot.hiddenCards = null;
    else delete snapshot.hiddenCards;
    snapshot.loadout = null;
    const before = JSON.stringify(snapshot);
    assert.deepEqual(combatSnapshotProblems(snapshot), []);
    assert.deepEqual(combatSnapshotReferenceProblems(snapshot, registries), []);
    const counters = fight.combat.rng.getCounters();
    const restored = restoreCombatSnapshot({
      registries, rng: createRng(seed, counters), snapshot, expectedGameProfile: profile,
    });
    assert.equal(restored.gameProfile.hash, profile.hash);
    assert.equal(restored.core2ActionRulesVersion, 1);
    assert.equal(restored.loadout, null);
    assert.deepEqual(restored.rng.getCounters(), counters);
    assert.equal(JSON.stringify(snapshot), before);
  }
});

test('malformed slots are archived with a field diagnostic and original bytes', async t => {
  const { registries, run, combat, encounterId } = pendingReaction();
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId });
  for (const [path, edit] of [
    ['hiddenCards[0]', snapshot => { snapshot.hiddenCards = [null]; }],
    ['abilityQueue', snapshot => { snapshot.abilityQueue = {}; }],
  ]) {
    await t.test(path, () => {
      const storage = createMemoryStorage();
      const manager = createSaveManager(storage);
      manager.saveRun(run, combat.rng, 1);
      manager.saveRun(run, combat.rng, 2);
      const saved = JSON.parse(storage.getItem(runKey(1)));
      edit(saved.combatEntered.snapshot);
      const damaged = ` \n${JSON.stringify(saved)}\n `;
      storage.setItem(runKey(1), damaged);
      const otherSlot = storage.getItem(runKey(2));
      const mirror = storage.getItem(META_BACKUP_KEY);

      assert.equal(manager.loadRun(registries, 1), null);
      const status = manager.runStatus();
      assert.equal(status.state, 'archived');
      assert.match(status.reason, /^Malformed (?:combat snapshot references|run save):/);
      assert.ok(status.reason.includes(path), status.reason);
      assert.equal(manager.getArchive(status.archiveId).save, damaged);
      assert.equal(storage.getItem(runKey(1)), null);
      assert.equal(storage.getItem(runKey(2)), otherSlot);
      assert.equal(storage.getItem(META_BACKUP_KEY), mirror);
      assert.ok(manager.loadRun(registries, 2), manager.runStatus().reason);
    });
  }
});