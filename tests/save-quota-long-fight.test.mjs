// A long boss fight must keep the saved run under the browser quota (the owner's 2026-11-01
// "autosave refused: browser storage is full" after ~25 turns), and a save written without the
// per-event evaluation context must resume the fight identically.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, runKey } from '../src/engine/save.js';
import { RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { compactRun, expandStoredRun } from '../src/model/runStorage.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

// Bytes the long fight's save may take at turn 40, as stored (the profile is a reference). The
// pre-fix log alone was ~3.6 MB there; a 5 MB quota holds the slot, its backup and the profile.
const LONG_FIGHT_BYTE_BUDGET = 700000;

function startFight(seed = 7) {
  const run = createRunState({ registries, seed, classId: 'reaver' });
  const rng = createRng(seed);
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: {} });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { run, rng, combat };
}
// One turn of the same greedy bot; the fight's HP is padded so it lasts.
function playTurn(combat) {
  combat.enemies.forEach(e => { e.hp = e.maxHp = 100000; });
  combat.player.hp = combat.player.maxHp = 100000;
  for (let pass = 0; pass < 6; pass++) for (const card of [...combat.piles.hand]) {
    if (combat.result) return;
    try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies.find(e => e.alive)?.id }); } catch { /* unplayable */ }
  }
  if (!combat.result && combat.phase === 'player') dispatch(combat, { type: 'endTurn', discardIds: [] });
}
const state = (c, rng) => JSON.stringify({ turn: c.turn, phase: c.phase, result: c.result, player: c.player, enemies: c.enemies, piles: c.piles, counters: rng.getCounters() });

test('a 40-turn fight saves under the byte budget and no saved row carries the ability evaluation context', () => {
  const { run, combat } = startFight();
  const sizes = {};
  for (let turn = 1; turn <= 40 && !combat.result; turn++) {
    playTurn(combat);
    if ([15, 40].includes(turn)) {
      const liveBefore = structuredClone(combat.eventLog);
      const snapshot = serializeCombatSnapshot(combat);
      assert.deepEqual(combat.eventLog, liveBefore, 'serializing leaves the live rows unchanged');
      assert.equal(snapshot.eventLog.length, combat.eventLog.length);
      assert.deepEqual(snapshot.eventLog, liveBefore.map(({ abilityBefore, abilityEntities, ...rest }) => rest), 'saved log = live log minus the two fields');
      const stored = JSON.stringify({ ...compactRun({ ...run, combatEntered: { snapshot } }) });
      sizes[turn] = stored.length;
      assert.ok(snapshot.eventLog.length > 0);
      assert.ok(snapshot.eventLog.every(e => !('abilityEntities' in e) && !('abilityBefore' in e)), 'no row carries the clone');
    }
  }
  assert.ok(sizes[40], 'the fight reached turn 40');
  assert.ok(sizes[40] < LONG_FIGHT_BYTE_BUDGET, `turn-40 save is ${sizes[40]} chars (${JSON.stringify(sizes)})`);
  assert.ok((sizes[40] - sizes[15]) / 25 < 20000, 'growth per turn stays small');
  assert.ok(combat.eventLog.some(e => e.abilityEntities), 'the live log keeps its context');
});

test('a mid-fight save restored continues identically', () => {
  const { rng, combat } = startFight(9);
  for (let i = 0; i < 8; i++) playTurn(combat);
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const rng2 = createRng(9, rng.getCounters());
  const restored = restoreCombatSnapshot({ registries, rng: rng2, snapshot });
  assert.equal(state(restored, rng2), state(combat, rng));
  for (let i = 0; i < 6; i++) { playTurn(combat); playTurn(restored); assert.equal(state(restored, rng2), state(combat, rng), `turn +${i + 1}`); }
});

test('an old save whose log still carries the full context loads and continues', () => {
  const { rng, combat } = startFight(11);
  for (let i = 0; i < 4; i++) playTurn(combat);
  const snapshot = JSON.parse(JSON.stringify({ ...serializeCombatSnapshot(combat), eventLog: combat.eventLog }));
  assert.ok(snapshot.eventLog.some(e => e.abilityEntities), 'the legacy shape carries it');
  const rng2 = createRng(11, rng.getCounters());
  const restored = restoreCombatSnapshot({ registries, rng: rng2, snapshot });
  for (let i = 0; i < 3; i++) { playTurn(combat); playTurn(restored); }
  assert.equal(state(restored, rng2), state(combat, rng));
});

test('a knowledge-only autosave of a legacy checkpoint stores it lean and it restores identically', () => {
  const { run, rng, combat } = startFight(13);
  for (let i = 0; i < 10; i++) playTurn(combat);
  const legacy = JSON.parse(JSON.stringify({ ...serializeCombatSnapshot(combat), eventLog: combat.eventLog }));
  assert.ok(legacy.eventLog.some(e => e.abilityEntities));
  const held = { ...run, combatEntered: { nodeId: 'n', encounterId: 'e', snapshot: legacy } };
  const before = JSON.stringify(held);
  const stored = compactRun(held);
  assert.equal(JSON.stringify(held), before, 'the run in memory is not touched');
  const lean = stored.combatEntered.snapshot;
  assert.ok(lean.eventLog.every(e => !('abilityEntities' in e) && !('abilityBefore' in e)));
  assert.deepEqual(lean.eventLog, legacy.eventLog.map(({ abilityBefore, abilityEntities, ...rest }) => rest));
  assert.ok(JSON.stringify(stored.combatEntered).length < JSON.stringify(held.combatEntered).length / 2, 'stored size drops');
  const a = createRng(13, rng.getCounters()), b = createRng(13, rng.getCounters());
  const full = restoreCombatSnapshot({ registries, rng: a, snapshot: JSON.parse(JSON.stringify(legacy)) });
  const trimmed = restoreCombatSnapshot({ registries, rng: b, snapshot: expandStoredRun(JSON.parse(JSON.stringify(stored))).combatEntered.snapshot });
  assert.equal(state(trimmed, b), state(full, a));
  for (let i = 0; i < 3; i++) { playTurn(full); playTurn(trimmed); assert.equal(state(trimmed, b), state(full, a)); }
});

test('an older inline slot whose checkpoint log carries the context is still recompacted when the store is full', () => {
  const { run, rng, combat } = startFight(17);
  for (let i = 0; i < 6; i++) playTurn(combat);
  const legacy = JSON.parse(JSON.stringify({ ...serializeCombatSnapshot(combat), eventLog: combat.eventLog }));
  assert.ok(legacy.eventLog.some(e => e.abilityEntities || e.abilityBefore));
  const old = JSON.stringify({ ...JSON.parse(JSON.stringify(run)), combatEntered: { nodeId: 'n', encounterId: 'e', snapshot: legacy }, schemaVersion: RUN_SCHEMA_VERSION - 1 });
  assert.ok(old.includes('"gameProfile"') && !old.includes('gameProfileRef'));
  const map = new Map();
  const quota = () => Object.assign(new Error('quota'), { name: 'QuotaExceededError', code: 22 });
  const store = {
    map, budget: Infinity,
    getItem: k => (map.has(k) ? map.get(k) : null),
    removeItem: k => map.delete(k),
    key: i => [...map.keys()][i] ?? null,
    get length() { return map.size; },
    used: () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0),
    setItem(k, v) {
      const next = store.used() - (map.has(k) ? k.length + map.get(k).length : 0) + k.length + String(v).length;
      if (next > store.budget) throw quota();
      map.set(k, String(v));
    },
  };
  map.set(runKey(2), old);
  store.budget = store.used() + 665000; // room for the shared profile copy, not for a slot after it
  const save = createSaveManager(store);
  const fresh = createRunState({ registries, seed: 18, classId: 'reaver' });
  save.saveRun(fresh, createRng(18), 1);
  const stored = map.get(runKey(2));
  assert.ok(stored.length < old.length / 2, `slot 2 was recompacted (${old.length} -> ${stored.length})`);
  const parsed = JSON.parse(stored);
  assert.ok(parsed.gameProfileRef && !parsed.gameProfile, 'the profile is a reference');
  assert.ok(parsed.combatEntered.snapshot.eventLog.every(e => !('abilityEntities' in e) && !('abilityBefore' in e)));
  const loaded = save.loadRun(registries, 2);
  assert.ok(loaded, save.runStatus().reason);
  assert.equal(loaded.combatEntered.snapshot.eventLog.length, legacy.eventLog.length);
});
