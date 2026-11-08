import test from 'node:test';
import assert from 'node:assert/strict';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, validateGameProfileSnapshot, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { coreEvasionCompatibleRuntime } from '../src/model/coreEvasionCompatibility.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRunCombat, withoutWeaknesses } from './withoutWeaknesses.mjs'; // fixtures drop enemy weaknesses (SPEC 5.3)
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager } from '../src/engine/save.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { fixCoreSmashVsDefensiveRules } from '../src/model/fixCoreMechanics.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';

const oldRuntime = 'sha256:0ca590715034b7f075d9ca81ad54ce1734e2d6af951ffd39e202d2148f2c10e9';
const digest = profile => { delete profile.hash; profile.hash = gameDigest(profile); return profile; };
function priorRuntimeEnvelope() {
  const profile = structuredClone(resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} }));
  profile.lock.runtimeHash = oldRuntime;
  profile.lock.artifacts.find(row => row.id === 'ashen.mechanics-runtime').hash = 'sha256:e39c92284fa521a808ac0d306d7dac27dc21f542fc8db4ad069a08a3bc05bb18';
  profile.lock.artifacts.find(row => row.path === 'games/ashenspire/packs/core/cards.json').hash = 'sha256:979184ab67b7007074431b9550e288d5d6319149e386c3d29726c22e705c1e6f';
  profile.content.cards.find(row => row.id === 'core.evade').textTemplate = 'Gain {evade} Evade stacks.';
  // Exercise the prior-runtime contract with a valid integrity digest while
  // allowing current authored content to evolve. Genuine historical-save
  // restoration is verified independently against the original runtime.
  return digest(profile);
}

const restoreStripped = (...args) => withoutWeaknesses(restoreCombatSnapshot(...args)); // a restore refills enemy weaknesses; the fixture drops them again
test('a compatible prior-runtime Core profile resumes without changing its integrity hash', () => {
  const profile = priorRuntimeEnvelope(), before = JSON.stringify(profile), originalHash = profile.hash;
  const validated = validateGameProfileSnapshot(profile);
  assert.equal(validated.hash, originalHash);assert.equal(validated.lock.runtimeHash, oldRuntime);
  assert.equal(JSON.stringify(profile), before);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, validated)), validated);
  const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a','b','c'] } } } });
  const restoredRun = deserializeRun(serializeRun(run));
  assert.equal(restoredRun.gameProfile.hash, originalHash);
  const combat = createRunCombat({ registries, run: restoredRun, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const snapshot = serializeCombatSnapshot(combat);
  snapshot.fixCoreRules.smashVsDefensive.damageMultiplier = 2;
  delete snapshot.fixCoreRules.accuracy.evasionVersion;snapshot.fixCoreRules.accuracy.evadeStackBase = 1;snapshot.fixCoreRules.accuracy.evadeStackDex = 1;
  const restored = restoreStripped({ registries, rng: createRng(511), snapshot, expectedGameProfile: restoredRun.gameProfile });
  assert.equal(restored.gameProfile.hash, originalHash);
  assert.equal(fixCoreSmashVsDefensiveRules(restored.fixCoreRules).damageMultiplier, 2);
  const target = restored.enemies[0];
  Object.assign(target, { block: 0, statuses: {}, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' }, persistentPoise: {value: 20, max: 20} });
  delete target.combatCounter;
  const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
  assert.equal(profileDamageReceipt(restored, restored.player, target, 12, smash).amount, 24);
  assert.equal(restored.fixCoreRules.accuracy.evasionVersion, 2);assert.equal(restored.fixCoreRules.accuracy.evadeStackDex, 0);
  restored.piles.hand.push({cardId:'core.evade',instanceId:'resumed-evade',upgraded:false});
  const def = registries.cards.get('core.evade');
  // The resumed fight keeps its snapshotted evadeStackBase of 1: its card face reads that, not the shipped 3, and the
  // grant matches the face. Off-combat faces (no combat rules) still read the shipped rule.
  assert.equal(cardPlainText(registries, {cardId:'core.evade'}), 'Gain 3 Evade.');
  const face = cardFaceLines(def, null, registries, restored).map(row=>row.html).join('').replace(/<[^>]*>/g,'');
  const plain = cardPlainText(registries, {cardId:'core.evade'}, { rules: restored });
  const live = cardPlainText(registries, {cardId:'core.evade'}, { rules: restored, preview: previewCard(restored, 'resumed-evade', null) });
  const start=restored.player.statuses.evade?.stacks || 0;
  dispatch(restored,{type:'playCard',cardInstanceId:'resumed-evade'});
  const granted = restored.player.statuses.evade.stacks - start;
  assert.equal(granted, 1);
  for (const text of [face, plain, live]) assert.equal(text, `Gain ${granted} Evade.`, 'the resumed card face matches its grant');
  const roundtrip=restoreStripped({registries,rng:createRng(511),snapshot:serializeCombatSnapshot(restored),expectedGameProfile:restoredRun.gameProfile});
  assert.equal(roundtrip.gameProfile.hash,originalHash);assert.equal(roundtrip.fixCoreRules.accuracy.evadeStackDex,0);
});

test('a run saved on dev before the 2026-10-25 combat retune (runtime 73ef24...) still loads and fights', () => {
  const devRuntime = 'sha256:73ef240835ff52f3dec38ad7b0a972d6f4886adf88fbbf1e3bf12a42d53161f2';
  const profile = structuredClone(resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} }));
  profile.lock.runtimeHash = devRuntime;
  digest(profile);
  const originalHash = profile.hash;
  const validated = validateGameProfileSnapshot(profile);
  assert.equal(validated.hash, originalHash);
  assert.equal(validated.lock.runtimeHash, devRuntime);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, validated)), validated);
  const run = deserializeRun(serializeRun(createRunState({ registries, classId: 'rogue', seed: 513, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a','b','c'] } } } })));
  assert.equal(run.gameProfile.hash, originalHash);
  const combat = createRunCombat({ registries, run, rng: createRng(513), enemyIds: ['wanderingSoldier'] });
  const restored = restoreStripped({ registries, rng: createRng(513), snapshot: serializeCombatSnapshot(combat), expectedGameProfile: run.gameProfile });
  assert.equal(restored.gameProfile.hash, originalHash);
  const other = structuredClone(profile); other.lock.core = 'ashen.core@1.0.0'; digest(other);
  assert.throws(() => validateGameProfileSnapshot(other), /unsupported runtime artifact/);
});

test('compatibility rejects digest damage, unknown runtimes, other cores and future target runtimes', () => {
  const tampered=priorRuntimeEnvelope();tampered.modules.cards.handBase++;
  assert.throws(()=>validateGameProfileSnapshot(tampered),/digest mismatch/);
  const unknown=priorRuntimeEnvelope();unknown.lock.runtimeHash='sha256:unsupported';digest(unknown);
  assert.throws(()=>validateGameProfileSnapshot(unknown),/unsupported runtime artifact/);
  const other=priorRuntimeEnvelope();other.lock.core='ashen.core@1.0.0';digest(other);
  assert.throws(()=>validateGameProfileSnapshot(other),/unsupported runtime artifact/);
  assert.equal(coreEvasionCompatibleRuntime(priorRuntimeEnvelope(),'sha256:future-runtime'),'sha256:future-runtime');
});


test('current shipped Core runtime and combat saves survive presentation-only changes', () => {
  const profile = structuredClone(resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} }));
  // Re-pinned 2026-11-01: the Evade stance retirement edits the stances module defaults, which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-05: retiring the glassCannon status edits engine/mechanics/index.json (the mechanics-runtime artifact), which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-05: the Reach cap (range.maxRange in fixCoreMechanics.json, src/model/combatEngagement.js) moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-07: the keepsake removal drops the keepsake tag and mechanic, which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-07: the combat-rounds removal repoints four mechanic manifests (legacy.file), which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-07: the mechanics-kernel move (src/model/mechanicsKernel.js → engine/runtime/bindings.mjs) moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-08: the stance move (src/engine/combatRounds/stance.js → src/model/stance.js) repoints the maneuver_smash manifest, which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  assert.equal(profile.lock.runtimeHash, 'sha256:f0e3f7d50507dc85138f974f40b6981011e4174da69ded3c3d32dc150e87ea6b');
  const originalHash = profile.hash;
  const validated = validateGameProfileSnapshot(profile);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, validated)), validated);
  const run = createRunState({ registries, classId: 'rogue', seed: 512, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a','b','c'] } } } });
  const restoredRun = deserializeRun(serializeRun(run));
  assert.equal(restoredRun.gameProfile.hash, originalHash);
  const combat = createRunCombat({ registries, run: restoredRun, rng: createRng(512), enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.fixCoreRules.smashVsDefensive.damageMultiplier, 1.25);
  const restored = restoreStripped({ registries, rng: createRng(512), snapshot: serializeCombatSnapshot(combat), expectedGameProfile: restoredRun.gameProfile });
  assert.equal(restored.gameProfile.hash, originalHash);
  assert.equal(fixCoreSmashVsDefensiveRules(restored.fixCoreRules).damageMultiplier, 1.25);
  const target = restored.enemies[0];
  Object.assign(target, { block: 0, statuses: {}, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' }, persistentPoise: {value: 20, max: 20} });
  delete target.combatCounter;
  const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
  assert.equal(profileDamageReceipt(restored, restored.player, target, 12, smash).amount, 15);
  assert.equal(restored.gameProfile.lock.runtimeHash, profile.lock.runtimeHash);
});

test('a run saved before the 2026-10-26 pierce rule (runtime 2d76f2...) keeps its own runtime', () => {
  const profile = resolveGameProfile('core');
  const saved = priorRuntimeEnvelope();
  saved.lock.runtimeHash = 'sha256:2d76f2baf4fae3e676b06003c74c1fb30843067f48dec7fe021457dca05ccae6';
  assert.equal(coreEvasionCompatibleRuntime(saved, profile.lock.runtimeHash), saved.lock.runtimeHash);
});

test('a run saved by the previous release (runtime 83a0c5..., before the glassCannon retirement) keeps its own runtime', () => {
  const profile = resolveGameProfile('core');
  const saved = priorRuntimeEnvelope();
  saved.lock.runtimeHash = 'sha256:83a0c5760dc38cbe463b051e4cb1170e5127b3327d1b47f4750bda03b7993fa8';
  assert.equal(coreEvasionCompatibleRuntime(saved, profile.lock.runtimeHash), saved.lock.runtimeHash);
});

// Real save path: a stored fight carrying the retired glassCannon status loads (not archived), drops it and plays on.
function storedFightWith(profile, statusId) {
  const validated = validateGameProfileSnapshot(profile);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, validated)), validated);
  const run = createRunState({ registries, classId: 'herald', seed: 5, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a','b','c'] } } } });
  const rng = createRng(5);
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'] });
  const entries = new Map();
  const save = createSaveManager({ getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) });
  run.combatEntered = { nodeId: 'n1_4', encounterId: 'patrol', snapshot: serializeCombatSnapshot(combat) };
  save.saveRun(run, rng);
  for (const [key, value] of entries) {
    if (!value.includes('"combatEntered"')) continue;
    entries.set(key, value.replace(/"statuses":\{\}/g, `"statuses":{"${statusId}":{"stacks":1}}`));
  }
  return { registries, run, save, entries };
}

test('a stored fight holding the retired glassCannon status loads, drops it, and the next turn runs', () => {
  const { registries, save, entries } = storedFightWith(structuredClone(resolveGameProfile('core')), 'glassCannon');
  assert.ok([...entries.values()].some(value => value.includes('glassCannon')), 'fixture really stores glassCannon');
  const loaded = save.loadRun(registries);
  assert.ok(loaded, `the save is loaded, not archived: ${[...entries].filter(([k])=>k.includes('archiv')).map(([,v])=>v.slice(0,300))}`);
  const snapshot = loaded.combatEntered.snapshot;
  assert.equal('glassCannon' in snapshot.player.statuses, false);
  assert.equal('glassCannon' in snapshot.enemies[0].statuses, false);
  const restored = restoreStripped({ registries, rng: createRng(5), snapshot, expectedGameProfile: loaded.gameProfile });
  assert.doesNotThrow(() => dispatch(restored, { type: 'endTurn' }));
});

test('a run saved at runtime 83a0c5... with a glassCannon fight resumes through the real load path', () => {
  const profile = priorRuntimeEnvelope();
  profile.lock.runtimeHash = 'sha256:83a0c5760dc38cbe463b051e4cb1170e5127b3327d1b47f4750bda03b7993fa8';
  digest(profile);
  const { registries, save } = storedFightWith(profile, 'glassCannon');
  const loaded = save.loadRun(registries);
  assert.ok(loaded);
  assert.equal(loaded.gameProfile.lock.runtimeHash, 'sha256:83a0c5760dc38cbe463b051e4cb1170e5127b3327d1b47f4750bda03b7993fa8');
  const restored = restoreStripped({ registries, rng: createRng(5), snapshot: loaded.combatEntered.snapshot, expectedGameProfile: loaded.gameProfile });
  assert.doesNotThrow(() => dispatch(restored, { type: 'endTurn' }));
});

test('a stored fight with a status id that was never retired is still refused', () => {
  const { registries, save } = storedFightWith(structuredClone(resolveGameProfile('core')), 'notARealStatus');
  assert.equal(save.loadRun(registries), null);
});
