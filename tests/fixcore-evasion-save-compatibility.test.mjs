import test from 'node:test';
import assert from 'node:assert/strict';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, validateGameProfileSnapshot, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { coreEvasionCompatibleRuntime } from '../src/model/coreEvasionCompatibility.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { cardPlainText } from '../src/ui/components/card.js';
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
  delete snapshot.fixCoreRules.accuracy.evasionVersion;snapshot.fixCoreRules.accuracy.evadeStackDex = 1;
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511), snapshot, expectedGameProfile: restoredRun.gameProfile });
  assert.equal(restored.gameProfile.hash, originalHash);
  assert.equal(restored.fixCoreRules.accuracy.evasionVersion, 2);assert.equal(restored.fixCoreRules.accuracy.evadeStackDex, 0);
  restored.piles.hand.push({cardId:'core.evade',instanceId:'resumed-evade',upgraded:false});
  const def = registries.cards.get('core.evade');
  assert.equal(cardFaceLines(def, null, registries).map(row=>row.html).join('').replace(/<[^>]*>/g,''), 'Gain 1 Evade.');
  assert.equal(cardPlainText(registries, {cardId:'core.evade'}), 'Gain 1 Evade.');
  const start=restored.player.statuses.evade?.stacks || 0;
  dispatch(restored,{type:'playCard',cardInstanceId:'resumed-evade'});
  assert.equal(restored.player.statuses.evade.stacks,start+1);
  const roundtrip=restoreCombatSnapshot({registries,rng:createRng(511),snapshot:serializeCombatSnapshot(restored),expectedGameProfile:restoredRun.gameProfile});
  assert.equal(roundtrip.gameProfile.hash,originalHash);assert.equal(roundtrip.fixCoreRules.accuracy.evadeStackDex,0);
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
