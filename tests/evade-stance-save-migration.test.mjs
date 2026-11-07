// Owner ruling 2026-11-01: "All the evade stance cards were acting as defend cards so just migrate them all as defend cards".
// A saved combatStance or concurrentStances row with maneuver 'evade' loads as Defend; the retired counterStance hybrid
// loads as Counter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bringStancesForward } from '../src/model/combatSnapshot.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatExpansionEntityProblems } from '../src/model/combatTacticsRules.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { live, registries } from './helpers/fixcore-combat-rules.mjs';
import { createRng } from '../src/engine/rng.js';

test('bringStancesForward maps saved Evade rows to Defend and the hybrid to Counter', () => {
  const snap = { player: { combatStance: { maneuver: 'evade', camp: 'physical', range: 'melee' },
    concurrentStances: [{ maneuver: 'evade', camp: 'spell', range: 'ranged' }, { maneuver: 'attack', camp: 'physical' }] },
  enemies: [{ combatStance: { maneuver: 'evade', counterStance: true, camp: 'physical', range: 'melee' } }] };
  assert.equal(bringStancesForward(snap), true);
  assert.equal(snap.player.combatStance.maneuver, 'defend');
  assert.equal(snap.player.concurrentStances[0].maneuver, 'defend');
  assert.equal(snap.player.concurrentStances[1].maneuver, 'attack');
  assert.equal(snap.enemies[0].combatStance.maneuver, 'counter');
  assert.equal('counterStance' in snap.enemies[0].combatStance, false);
  assert.equal(bringStancesForward(snap), false, 'idempotent');
  assert.equal(stanceOf({ maneuver: 'evade', camp: 'physical' }).maneuver, 'defend', 'stanceOf also reads a legacy row as Defend');
});

test('a saved fight with an Evade stance restores in Defend stance', () => {
  const combat = live();
  combat.player.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  combat.player.concurrentStances = [{ maneuver: 'defend', camp: 'spell', range: 'ranged' }];
  const saved = serializeCombatSnapshot(combat);
  saved.player.combatStance.maneuver = 'evade';
  saved.player.concurrentStances[0].maneuver = 'evade';
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(1), snapshot: saved });
  assert.equal(restored.player.combatStance.maneuver, 'defend');
  assert.equal(restored.player.concurrentStances[0].maneuver, 'defend');
  assert.deepEqual(combatExpansionEntityProblems(restored.player), []);
  assert.equal(saved.player.combatStance.maneuver, 'evade', 'the caller\'s object is left as saved');
});

test('Evade is no longer a valid live stance', () => {
  assert.ok(combatExpansionEntityProblems({ combatStance: { maneuver: 'evade', camp: 'physical', range: 'melee' } }).some(p => p.includes('maneuver')));
});

// Review fixes (2026-11-01): a configured profile plays the Evade cards in Defend; a resumed fight pinning a profile that
// still lists 'evade' never writes or saves an 'evade' row; the run load door migrates a saved Evade row.
import { setProfileStance } from '../src/engine/gameProfileCombat.js';
import { configuredStance } from '../src/model/profileStance.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { commitCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { playingCardDefinition } from '../src/model/playingCard.js';

const coreProfile = resolveGameProfile('core');
const coreReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, coreProfile)), coreProfile);

test('playing core.evade, core.closingDodge and core.backstep lands in Defend, from Idle and from Defend', () => {
  for (const id of ['core.evade', 'core.closingDodge', 'core.backstep']) {
    const carrier = { ...playingCardDefinition(coreReg, { cardId: id }) };
    carrier.combatProfile = carrier.combatProfile || undefined;
    assert.notEqual(configuredStance(carrier), 'evade', id);
    for (const start of [undefined, { maneuver: 'defend', camp: 'physical', range: 'melee' }]) {
      const combat = live();
      if (start) combat.player.combatStance = start; else delete combat.player.combatStance;
      setProfileStance(combat, combat.player, structuredClone(carrier));
      assert.equal(combat.player.combatStance.maneuver, configuredStance(carrier) === 'counter' ? 'counter' : 'defend', `${id} from ${start ? 'Defend' : 'Idle'}`);
      assert.notEqual(combat.player.combatStance.maneuver, 'neutral', id);
    }
  }
  const evade = playingCardDefinition(coreReg, { cardId: 'core.evade' });
  const combat = live(); delete combat.player.combatStance;
  setProfileStance(combat, combat.player, structuredClone(evade));
  assert.equal(combat.player.combatStance.maneuver, 'defend');
});

test('a resumed fight pinning a profile that lists evade never writes or saves an evade row', () => {
  const combat = live();
  const pinned = combat.gameProfile;
  combat.gameProfile = structuredClone(combat.gameProfile);
  combat.gameProfile.modules.stances.include = [...combat.gameProfile.modules.stances.include, 'evade'];
  combat.registries = { ...combat.registries, proposalStatusRules: { weak: { behaviors: [{ kind: 'stanceCapacity', additionalPerStack: 1, maxStances: 2, defensePriority: ['counter', 'defend', 'casting', 'attack', 'smash', 'sweep'] }] } } };
  combat.player.statuses.weak = { stacks: 1 };
  setProfileStance(combat, combat.player, { combatProfile: { maneuver: 'attack', camp: 'physical', range: 'melee' } });
  setProfileStance(combat, combat.player, structuredClone(playingCardDefinition(coreReg, { cardId: 'core.evade' })));
  assert.equal(combat.player.combatStance.maneuver, 'defend');
  assert.ok(combat.player.concurrentStances.length === 2 && combat.player.concurrentStances.every(row => row.maneuver !== 'evade'));
  combat.gameProfile = pinned; // the kernel itself no longer resolves a profile that lists evade; the snapshot digest is checked against the shipped one
  let saved;
  assert.doesNotThrow(() => { saved = serializeCombatSnapshot(combat); });
  assert.ok(saved.player.concurrentStances.some(row => row.maneuver === 'defend'));
  // the remembered row guard itself
  combat.player.combatStance = { maneuver: 'evade', camp: 'physical', range: 'melee' };
  setProfileStance(combat, combat.player, { combatProfile: { maneuver: 'attack', camp: 'physical', range: 'melee' } });
  assert.ok(combat.player.concurrentStances.every(row => row.maneuver !== 'evade'));
});

test('the run load door migrates a saved Evade stance to Defend, and an armed hybrid to Counter', () => {
  const run = createRunState({ registries: coreReg, seed: 511, classId: 'reaver' });
  const combat = createRunCombat({ registries: coreReg, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  run.combatEntered.snapshot.player.combatStance = { maneuver: 'evade', camp: 'physical', range: 'melee' };
  run.combatEntered.snapshot.player.concurrentStances = [{ maneuver: 'evade', camp: 'physical', range: 'melee' }];
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(coreReg);
  assert.ok(loaded, saves.runStatus().reason);
  assert.equal(loaded.combatEntered.snapshot.player.combatStance.maneuver, 'defend');
  assert.equal(loaded.combatEntered.snapshot.player.concurrentStances[0].maneuver, 'defend');
  // A hybrid saved before the counterStance flag has no flag but an armed counter: it loads as Counter.
  const snap = { player: { combatStance: { maneuver: 'evade', camp: 'physical', range: 'melee' }, combatCounter: { charges: 1 } }, enemies: [] };
  bringStancesForward(snap);
  assert.equal(snap.player.combatStance.maneuver, 'counter');
});
