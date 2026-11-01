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
  assert.equal(profile.lock.runtimeHash, 'sha256:bc9c46837da134c46cca9abf9f5edc65b5c8132ea88a02235b28e8eaabb85b02');
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
