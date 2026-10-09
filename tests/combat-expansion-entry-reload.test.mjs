import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { immediateCardEffects } from '../src/model/cardTargets.js';
import { commitCombatSnapshot, serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { commitExpansionCandidate } from '../src/engine/combatExpansionSave.js';
import { createSaveManager } from '../src/engine/save.js';
import { payAshenBlight, chooseAshenBlightFeat } from '../src/engine/ashenBlight.js';

const registries = createRegistries(contentBundle);
// The production storage boundary is JSON; omitted optional undefined fields
// must be compared in their persisted representation, not object key presence.
const persisted = snapshot => JSON.parse(JSON.stringify(snapshot));
function fixture(prepare = () => {}) {
  const run = createRunState({ registries, seed: 11, classId: 'reaver', enemyKnowledgeVersion: null });
  // Exercise the historical expanded checkpoint policy, before reaction saves.
  delete run.reactionRulesVersion;
  assert.equal(run.combatExpansionVersion, 2, 'use a real expanded creation receipt');
  assert.equal(run.equipmentProfileRuleSnapshot.snapshotVersion, 2);
  assert.ok(Number.isInteger(run.equipmentAttackSlotCount));
  assert.ok(run.deck.some(card => card.profileId && card.profileReceipt && card.sourceArmamentId),
    'retain creation-minted equipment profile and quota metadata');
  prepare(run);
  const rng = createRng(run.seed), entries = new Map();
  const save = createSaveManager({ getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) });
  run.combatEntered = { nodeId: 'n1_4', encounterId: 'patrol' };
  const combat = createRunCombat({ registries, run, rng,
    enemyIds: ['wanderingSoldier', 'wanderingSoldier'], settings: { playInDeckOrder: true } });
  assert.equal(combat.combatExpansionVersion, run.combatExpansionVersion);
  let writes = 0;
  const durable = candidate => commitExpansionCandidate({ run, candidate, ...run.combatEntered,
    saveCandidate: (next, committedRng) => { writes++; save.saveRun(next, committedRng); return { ok: true }; } });
  durable(combat);
  combat.beforeCombatCommit = durable;
  const load = () => {
    const loaded = save.loadRun(registries);
    assert.ok(loaded, save.runStatus().reason);
    const restored = restoreCombatSnapshot({ registries, rng: createRng(loaded.seed, loaded.streamCounters),
      snapshot: loaded.combatEntered.snapshot });
    return { loaded, restored };
  };
  return { run, rng, save, combat, load, writes: () => writes };
}

function naturalAttack(combat) {
  // Keep the real expanded starter deck: defensive openers draw naturally.
  dispatch(combat, { type: 'endTurn' });
  for (let hand = 0; hand < 3; hand++) {
    for (const card of [...combat.piles.hand]) {
      const definition = resolveCombatCard(combat, card);
      if (!immediateCardEffects(definition).some(effect => effect.op === 'damage' && effect.target === 'enemy')) continue;
      const targetId = combat.enemies.find(enemy => enemy.alive).id;
      const preview = previewCard(combat, card.instanceId, targetId);
      if (combat.player.energy < preview.cost || combat.player.mana < preview.manaCost) continue;
      const { events } = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId });
      assert.ok(events.some(event => event.type === 'cardPlayed' && event.cardInstanceId === card.instanceId));
      return;
    }
    dispatch(combat, { type: 'endTurn' });
  }
  assert.fail('the real starter deck did not provide an affordable attack within three natural hands');
}

test('v2 ordinary natural turns and Attack preserve the original durable entry checkpoint', () => {
  const f = fixture(), opening = persisted(serializeCombatSnapshot(f.combat)), deck = structuredClone(f.run.deck);
  const openingRng = f.rng.getCounters();
  naturalAttack(f.combat);
  assert.ok(f.combat.turn > 1);
  assert.notEqual(f.combat.player.hp, opening.player.hp, 'real enemy turns changed player HP');
  assert.notDeepEqual(f.combat.enemies.map(enemy => enemy.hp), opening.enemies.map(enemy => enemy.hp), 'the accepted attack changed enemy HP');
  assert.notDeepEqual(serializeCombatSnapshot(f.combat), opening);
  assert.equal(f.writes(), 1, 'ordinary actions do not write an implicit Save Game');
  const { loaded, restored } = f.load();
  assert.deepEqual(loaded.deck, deck);
  assert.deepEqual(restored.rng.getCounters(), openingRng);
  assert.deepEqual(persisted(serializeCombatSnapshot(restored)), opening, 'production restore returns turn, HP, enemies, piles and RNG to entry');
});

test('v2 explicit Save Game becomes the exact checkpoint and later ordinary turns leave it intact', () => {
  const f = fixture();
  naturalAttack(f.combat);
  commitCombatSnapshot({ run: f.run, combat: f.combat, nodeId: 'n1_4', encounterId: 'patrol' });
  f.save.saveRun(f.run, f.rng);
  const explicit = persisted(serializeCombatSnapshot(f.combat)), explicitRng = f.rng.getCounters();
  dispatch(f.combat, { type: 'endTurn' });
  assert.ok(f.combat.turn > explicit.turn);
  const { restored } = f.load();
  assert.deepEqual(persisted(serializeCombatSnapshot(restored)), explicit);
  assert.deepEqual(restored.rng.getCounters(), explicitRng);
});

test('v2 milestone selection is durable even though the Blight value does not change', () => {
  const f = fixture(run => payAshenBlight({ combatExpansionVersion: 2 }, run,
    { amount: 25, receiptId: 'prior', combatKey: 'previous' }));
  dispatch(f.combat, { type: 'chooseBlightFeat', threshold: 25, path: 'survivor' });
  assert.equal(f.combat.player.ashenBlight.milestones[0].path, 'survivor');
  assert.equal(f.writes(), 2);
  const { loaded, restored } = f.load();
  assert.equal(loaded.ashenBlight.value, 25);
  assert.equal(loaded.ashenBlight.milestones[0].path, 'survivor');
  assert.deepEqual(persisted(serializeCombatSnapshot(restored)), persisted(serializeCombatSnapshot(f.combat)));
  assert.deepEqual(restored.rng.getCounters(), f.rng.getCounters());
});

test('v2 converted zero-price payment persists its receipt and accepted play at the capped meter', () => {
  const f = fixture(run => {
    payAshenBlight({ combatExpansionVersion: 2, draw: () => .99 }, run,
      { amount: 100, receiptId: 'prior', combatKey: 'previous' });
    for (const threshold of [25, 50, 75]) chooseAshenBlightFeat({ combatExpansionVersion: 2 }, run, { threshold, path: 'survivor' });
  });
  assert.equal(f.combat.result, null, 'the fixed seed survives its recorded combat-entry check');
  const first = f.combat.piles.hand[0];
  const targetId = immediateCardEffects(resolveCombatCard(f.combat, first)).some(effect => effect.target === 'enemy')
    ? f.combat.enemies[0].id : f.combat.player.id;
  const durable = f.combat.beforeCombatCommit;
  const before = persisted(serializeCombatSnapshot(f.combat)), beforeRun = structuredClone(f.run), beforeRng = f.rng.getCounters();
  f.combat.beforeCombatCommit = candidate => commitExpansionCandidate({ run: f.run, candidate,
    nodeId: 'n1_4', encounterId: 'patrol', saveCandidate: () => ({ ok: false, error: 'Zero-price receipt save refused' }) });
  assert.throws(() => dispatch(f.combat, { type: 'playCard', cardInstanceId: first.instanceId, targetId }), /Zero-price receipt save refused/);
  assert.deepEqual(persisted(serializeCombatSnapshot(f.combat)), before, 'even a zero-price irreversible receipt refuses the whole candidate');
  assert.deepEqual(f.run, beforeRun);
  assert.deepEqual(f.rng.getCounters(), beforeRng, 'the refused converted play refunds every RNG stream');
  f.combat.beforeCombatCommit = durable;
  dispatch(f.combat, { type: 'playCard', cardInstanceId: first.instanceId, targetId });
  assert.equal(f.writes(), 2);
  const { loaded, restored } = f.load();
  assert.equal(loaded.ashenBlight.value, 100);
  assert.equal(loaded.ashenBlight.payments.at(-1).amount, 0);
  assert.deepEqual(persisted(serializeCombatSnapshot(restored)), persisted(serializeCombatSnapshot(f.combat)));
  assert.deepEqual(restored.rng.getCounters(), f.rng.getCounters());
});
