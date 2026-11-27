import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, validateGameProfileSnapshot, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { coreEvasionCompatibleRuntime } from '../src/model/coreEvasionCompatibility.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRunCombat, withoutWeaknesses } from './withoutWeaknesses.mjs'; // fixtures drop enemy weaknesses (SPEC 5.3)
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { fixCoreSmashVsDefensiveRules } from '../src/model/fixCoreMechanics.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { RealSpellSchool, SpellCategory, SpellScalingValue } from '../src/model/spellTraditions.js';
import { GearSelectorMatches } from '../src/model/gearEffects.js';

const preRegistryRuntime = 'sha256:777939d6ee4065a02491fcd7ff21fc2d9f44271a0d7f10ec3b2435d1786a72cd';
const registryRuntime = 'sha256:c77d4f30494cb821fc66b9b9ef19b91fbb2c699633fe0137b72ab89d261ec831';
const preScalingRuntime = 'sha256:eff6f5c38dcdba3c78d012bf55c8baf6fe703f664bc3f3416244b15d1fa07216';
// Re-pinned 2026-11-27: routes.floorTypes moves the kernel; defbcd... is now in PREVIOUS_RUNTIMES.
const catalogRuntime = 'sha256:71ca407be49798e8df326bd759a2a9ce70956a736abfa64420d188fa62a8434d';
const preRegistrySave = () => gunzipSync(readFileSync(new URL('./fixtures/pre-registry-dev-7dff4b03-save.json.gz', import.meta.url))).toString('utf8');

test('the real Dev 7dff4b03 save resumes its active fight without changing the old profile or policy', () => {
  const bytes = preRegistrySave();
  const original = JSON.parse(bytes);
  assert.equal(original.gameProfile.lock.runtimeHash, preRegistryRuntime);
  assert.equal(original.gameProfile.hash, 'sha256:0d1e774aa158d069e4516e769249cc3c97c6864d14ab61bccf0b30ddf8034cb7');
  const run = deserializeRun(bytes);
  assert.deepEqual(run.gameProfile, original.gameProfile);
  assert.equal(run.levelRewardRuleSnapshot, undefined);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, run.gameProfile)), run.gameProfile);
  const saved = run.combatEntered.snapshot;
  const combat = restoreCombatSnapshot({ registries, snapshot: saved,
    rng: createRng(run.seed, run.streamCounters), expectedGameProfile: run.gameProfile });
  assert.equal(combat.phase, 'player');
  assert.deepEqual(combat.fixCoreRules, original.combatEntered.snapshot.fixCoreRules);
  assert.equal(combat.fixCoreRules.poise.weaponPoiseEnabled, true);
  assert.equal(combat.fixCoreRules.ward.routing, 'hpBuffer');
  assert.deepEqual(serializeCombatSnapshot(combat).piles, saved.piles);
  const held = combat.piles.hand.find(row => row.cardId === 'core.strike');
  const result = dispatch(combat, { type: 'playCard', cardInstanceId: held.instanceId, targetId: combat.enemies[0].id, rangeRoute: 'advance' });
  assert.ok(result.events.some(event => event.type === 'damageDealt' && event.cardInstanceId === held.instanceId));
  assert.equal(combat.gameProfile.hash, original.gameProfile.hash);

  const manager = createSaveManager(createMemoryStorage());
  manager.saveRun(run, createRng(run.seed, run.streamCounters));
  const loaded = manager.loadRun(registries);
  assert.ok(loaded, manager.runStatus().reason);
  assert.deepEqual(loaded.gameProfile, original.gameProfile);
  assert.equal(loaded.combatEntered.snapshot.gameProfile.hash, saved.gameProfile.hash);
});

test('the registry transition retains a closed Core-specific edge and rejects changed saved profiles', () => {
  const genuine = JSON.parse(preRegistrySave()).gameProfile;
  assert.equal(coreEvasionCompatibleRuntime(genuine, registryRuntime), preRegistryRuntime);
  assert.equal(coreEvasionCompatibleRuntime(genuine, 'sha256:arbitrary-runtime'), 'sha256:arbitrary-runtime');
  for (const [key, value] of [['runtimeABI', 'ashen.runtime@999'], ['numericPolicy', 'ashen.adapter-numbers@999'], ['core', 'ashen.core@999']]) {
    const wrong = structuredClone(genuine);
    wrong.lock[key] = value;
    assert.equal(coreEvasionCompatibleRuntime(wrong, registryRuntime), registryRuntime);
  }
  const unknown = structuredClone(genuine);
  unknown.lock.runtimeHash = 'sha256:unknown-runtime';
  assert.throws(() => validateGameProfileSnapshot(digest(unknown)), /unsupported runtime artifact/);
  const tampered = structuredClone(genuine);
  tampered.modules.cards.handBase++;
  assert.throws(() => validateGameProfileSnapshot(tampered), /digest mismatch/);
});

const oldRuntime = 'sha256:0ca590715034b7f075d9ca81ad54ce1734e2d6af951ffd39e202d2148f2c10e9';
const digest = profile => { delete profile.hash; profile.hash = gameDigest(profile); return profile; };

function capturedRegistryProfile() {
  const bytes = readFileSync(new URL('./fixtures/core2-cleanup-profile-10911.json.gz', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '2d23a93ffc5c778f08c86bd6a76914a51347df0a62ca8adab362cd95b5a2cd2d');
  const profile = JSON.parse(gunzipSync(bytes));
  assert.equal(profile.hash, 'sha256:9b5f7a725112f76a65f8037f4313f886b95a2d4ad3b8b705eb63d59a820c65a5');
  assert.equal(profile.lock.runtimeHash, registryRuntime);
  return profile;
}

test('the exact pre-scaling Dev profile resumes without inheriting enemy floor scaling or level-card moves', () => {
  // Captured from c5c5ec4a's committed author/catalog. Its resolved hash was
  // checked against that commit's game.lock.json before storing this archive.
  const bytes = readFileSync(new URL('./fixtures/pre-enemy-level-scaling-c5c5ec4a-profile.json.gz', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'c186c135c3ac6e870335b9b96a3157fbf3b37bc02bc44019ac28f8398fc3a918');
  const { sourceCommit, profile } = JSON.parse(gunzipSync(bytes));
  assert.equal(sourceCommit, 'c5c5ec4a58df620410914a483c042989ea93707b');
  assert.equal(profile.hash, 'sha256:53f1aebaeafea90ac78083b07b5f3ff1785bf047895c5e314030b771dbb5ea4a');
  assert.equal(profile.lock.runtimeHash, preScalingRuntime);
  assert.equal(profile.modules.characters.enemyLevelScaling, undefined);
  assert.equal(profile.content.enemyLevelCards, undefined);
  const before = structuredClone(profile);
  const validated = validateGameProfileSnapshot(profile);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, validated)), validated);
  const originalRuntime = coreEvasionCompatibleRuntime(profile, catalogRuntime);
  assert.equal(originalRuntime, preScalingRuntime);
  for (const tier of ['minion', 'elite', 'boss']) {
    const enemyId = profile.content.enemies.find(row => row.tier === tier)?.id;
    assert.ok(enemyId, `the recorded profile contains ${tier}`);
    const run = createRunState({ registries, classId: 'reaver', seed: 511 });
    run.actNumber = 2;
    run.floor = 2;
    const low = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [enemyId] });
    run.floor = 8;
    const high = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [enemyId] });
    assert.deepEqual(high.enemies, low.enemies, `${tier}: floor does not change the recorded level, stats or moves`);
    assert.equal('levelStep' in high.enemies[0], false);
    assert.equal('extraMoves' in high.enemies[0], false);
    const snapshot = serializeCombatSnapshot(high);
    run.combatEntered = { nodeId: 'n1_4', encounterId: 'patrol', snapshot };
    const manager = createSaveManager(createMemoryStorage());
    manager.saveRun(run, createRng(511));
    const loaded = manager.loadRun(registries);
    assert.ok(loaded, manager.runStatus().reason);
    assert.deepEqual(loaded.gameProfile, before);
    const restored = restoreStripped({ registries, snapshot: loaded.combatEntered.snapshot,
      rng: createRng(511), expectedGameProfile: loaded.gameProfile });
    assert.deepEqual(restored.gameProfile, before);
    assert.deepEqual(JSON.parse(JSON.stringify(restored.enemies)), JSON.parse(JSON.stringify(high.enemies)));
    assert.deepEqual(restored.fixCoreRules, high.fixCoreRules);
  }
  assert.deepEqual(profile, before);
});

test('the genuine c77d profile retains its recorded schoolless Shared spell through save and combat round trips', () => {
  const profile = capturedRegistryProfile();
  const before = structuredClone(profile);
  // The newly introduced category selectors have no operands in this archived
  // gear vocabulary; its existing generic Spell/element modifiers stay intact.
  assert.doesNotMatch(JSON.stringify(profile), /arcaneSpell|divineSpell/);
  assert.equal(coreEvasionCompatibleRuntime(profile, catalogRuntime), registryRuntime);
  const validated = validateGameProfileSnapshot(profile);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, validated)), validated);
  const assertRecordedSpell = saved => {
    const recorded = saved.content.cards.find(card => card.id === 'core.cantrip');
    assert.equal(RealSpellSchool(recorded), null);
    assert.deepEqual(recorded.tags.filter(tag => tag.startsWith('tradition:')), ['tradition:arcane', 'tradition:divine']);
    const projected = projectGameCard(saved, recorded.id);
    assert.deepEqual(projected.tags, recorded.tags);
    assert.equal(SpellCategory(projected), 'shared');
    assert.equal(GearSelectorMatches('arcaneSpell', null, projected), true);
    assert.equal(GearSelectorMatches('divineSpell', null, projected), true);
    assert.equal(SpellScalingValue({ intelligence: 3, wisdom: 7 }, projected), 7);
    assert.deepEqual(projected.effects, recorded.effects);
  };
  assertRecordedSpell(validated);
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const snapshot = serializeCombatSnapshot(combat);
  run.combatEntered = { nodeId: 'n1_4', encounterId: 'patrol', snapshot };
  const manager = createSaveManager(createMemoryStorage());
  manager.saveRun(run, createRng(511));
  const loaded = manager.loadRun(registries);
  assert.ok(loaded, manager.runStatus().reason);
  assert.deepEqual(loaded.gameProfile, before);
  assertRecordedSpell(loaded.gameProfile);
  const restored = restoreCombatSnapshot({ registries, snapshot: loaded.combatEntered.snapshot,
    rng: createRng(511), expectedGameProfile: loaded.gameProfile });
  assert.deepEqual(restored.gameProfile, before);
  assert.deepEqual(restored.fixCoreRules, snapshot.fixCoreRules);
  assertRecordedSpell(restored.gameProfile);
  assert.deepEqual(profile, before);
});

test('the regenerated host admits only exact Core envelopes and still validates their original digest', () => {
  const genuine = capturedRegistryProfile();
  assert.equal(resolveGameProfile('default').lock.runtimeHash, catalogRuntime);
  for (const [name, change] of [
    ['unknown runtime', p => { p.lock.runtimeHash = 'sha256:' + 'f'.repeat(64); }],
    ['malformed runtime', p => { p.lock.runtimeHash = 'sha256:not-a-digest'; }],
    ['foreign ABI', p => { p.lock.runtimeABI = 'ashen.runtime@999'; }],
    ['foreign numeric policy', p => { p.lock.numericPolicy = 'ashen.adapter-numbers@999'; }],
    ['foreign core', p => { p.lock.core = 'ashen.core@1.0.0'; }],
    ['unconfigured foundation', p => { p.foundation.mode = 'legacy'; }],
    ['foreign effects version', p => { p.modules.effects.fixCoreVersion = 2; }],
  ]) {
    const wrong = structuredClone(genuine);
    change(wrong);
    digest(wrong);
    assert.equal(coreEvasionCompatibleRuntime(wrong, catalogRuntime), catalogRuntime, name);
    assert.throws(() => validateGameProfileSnapshot(wrong), /unsupported runtime artifact/, name);
  }
  for (const malformed of [null, {}, { lock: null }, { lock: { runtimeHash: registryRuntime } }]) {
    assert.equal(coreEvasionCompatibleRuntime(malformed, catalogRuntime), catalogRuntime);
    assert.throws(() => validateGameProfileSnapshot(malformed));
  }
  assert.equal(coreEvasionCompatibleRuntime(genuine, 'sha256:' + 'f'.repeat(64)), 'sha256:' + 'f'.repeat(64));
  const damaged = structuredClone(genuine);
  damaged.modules.cards.handBase++;
  assert.throws(() => validateGameProfileSnapshot(damaged), /digest mismatch/);
});

function priorRuntimeEnvelope() {
  const profile = structuredClone(resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } }));
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
// Genuine resolved profiles from the two exact merge parents, rather than current profiles with edited runtime hashes.
for (const [name, file, runtime, rulesFile] of [
  ['Dev 213 parent 0b11a358', 'dev-0b11a358-profile.json.gz', 'sha256:7dd4e158c7af1a4af501cc4fa83f9647c2559a84b20a9c1c5ae881712bfcbc92', 'dev-0b11a358-rules.json'],
  ['Retreat WIP parent 54d43945', 'retreat-54d43945-profile.json.gz', 'sha256:edb03b160d360fcbd7ac312134fc535bc1e2b90ad45d6bcbfcff780c6dc8ec06', 'retreat-54d43945-rules.json'],
  ['stat parent 6e2cb1b8', 'stat-profile-6e2cb1b8.json.gz', 'sha256:de42dafc4ec394c607c7c52a5772bdd940728ff863ccfb21508e8a2a05f1d0bc'],
  ['Gear parent 62323292', 'gear-profile-62323292.json.gz', 'sha256:72ec668dbba9685fd6fe6ab7f95b33c98410450e412336982b5a9dc005281649'],
  ['stat parent 05ce3864', 'stat-profile-05ce3864.json.gz', 'sha256:045ee701108b82e397597cb08696c4400efd156c848b4cf2e4e18dae1db286c9', 'stat-rules-05ce3864.json'],
  ['Smash Dev parent 4fc475a2', 'dev-profile-4fc475a2.json.gz', 'sha256:04de9306278ad81f89b62fa2a2fbde640f6d7ba258fe74e63b9f46cb23d9b0b8', 'dev-rules-4fc475a2.json'],
]) test(`the genuine ${name} profile resumes with its exact saved policy`, () => {
  const profile = JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${file}`, import.meta.url))));
  const before = structuredClone(profile);
  assert.equal(profile.lock.runtimeHash, runtime);
  assert.deepEqual(validateGameProfileSnapshot(profile), before);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 512 });
  const restoredRun = deserializeRun(serializeRun(run));
  assert.deepEqual(restoredRun.gameProfile, before);
  const combat = createRunCombat({ registries, run: restoredRun, rng: createRng(512), enemyIds: ['wanderingSoldier'] });
  const snapshot = serializeCombatSnapshot(combat);
  // These exact parent JSON bytes pin the original combat policy, independently of today's new-fight defaults.
  if (rulesFile) snapshot.fixCoreRules = JSON.parse(readFileSync(new URL(`./fixtures/${rulesFile}`, import.meta.url)));
  const rulesBefore = structuredClone(snapshot.fixCoreRules);
  if (rulesFile) {
    assert.equal(snapshot.fixCoreRules.spellTraditionsVersion, profile.modules.effects.spellTraditionsVersion);
    assert.equal(snapshot.fixCoreRules.smashVsDefensive.defendDamageMultiplier, name.startsWith('Smash') || name.startsWith('Dev 213') ? 1.5 : undefined);
    const entries = new Map();
    const save = createSaveManager({ getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) });
    restoredRun.combatEntered = { nodeId: 'n1_4', encounterId: 'patrol', snapshot };
    save.saveRun(restoredRun, combat.rng);
    const loaded = save.loadRun(registries);
    assert.ok(loaded, 'the genuine parent loads through the real save path');
    assert.deepEqual(loaded.gameProfile, before);
    assert.deepEqual(loaded.combatEntered.snapshot.fixCoreRules, rulesBefore, 'the complete original policy survives save/load');
  }
  const restored = restoreStripped({ registries, rng: createRng(512), snapshot, expectedGameProfile: restoredRun.gameProfile });
  assert.deepEqual(restored.gameProfile, before);
  assert.deepEqual(restored.fixCoreRules, rulesBefore, 'the complete saved rules survive restoration');
  assert.deepEqual(profile, before, 'loading must not rewrite either parent profile');
});
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
  delete snapshot.fixCoreRules.smashVsDefensive.defendDamageMultiplier; // this is the old snapshot's shared tuning, not the new default
  snapshot.fixCoreRules.smashVsDefensive.damageMultiplier = 2;
  delete snapshot.fixCoreRules.accuracy.evasionVersion;snapshot.fixCoreRules.accuracy.evadeStackBase = 1;snapshot.fixCoreRules.accuracy.evadeStackDex = 1;
  // A fight saved before the 2026-11-14 ruling: it has no hitRoll / evadeStacksPerCard / perception.roll keys, so it keeps rolling and grants evadeStackBase.
  delete snapshot.fixCoreRules.accuracy.hitRoll; delete snapshot.fixCoreRules.accuracy.evadeStacksPerCard; delete snapshot.fixCoreRules.perception.roll;
  const restored = restoreStripped({ registries, rng: createRng(511), snapshot, expectedGameProfile: restoredRun.gameProfile });
  assert.equal(restored.gameProfile.hash, originalHash);
  assert.equal(fixCoreSmashVsDefensiveRules(restored.fixCoreRules).damageMultiplier, 2);
  const target = restored.enemies[0];
  Object.assign(target, { block: 0, statuses: {}, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' }, persistentPoise: {value: 20, max: 20} });
  delete target.combatCounter;
  const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
  // The envelope is today's Core profile under an older runtime pin, so it carries effects.baseDamageMultiplier 0.5 (2026-11-17): 12 -> 6, x2 = 12.
  assert.equal(profileDamageReceipt(restored, restored.player, target, 12, smash).amount, 12);
  assert.equal(restored.fixCoreRules.accuracy.evasionVersion, 2);assert.equal(restored.fixCoreRules.accuracy.evadeStackDex, 0);
  delete restored.player.itemProps?.gainBonus; // the Rogue's Leathers give +1 on every Evade gain (gear pass, 2026-11-18); this test reads the snapshotted card rule alone
  restored.piles.hand.push({cardId:'core.evade',instanceId:'resumed-evade',upgraded:false});
  const def = registries.cards.get('core.evade');
  // The resumed fight keeps its snapshotted evadeStackBase of 1: its card face reads that, not the shipped evadeStacksPerCard, and the
  // grant matches the face. Off-combat faces (no combat rules) still read the shipped rule.
  assert.equal(cardPlainText(registries, {cardId:'core.evade'}), 'Gain 1 Evade.');
  assert.equal(restored.fixCoreRules.accuracy.hitRoll, undefined, 'the saved fight keeps rolling');
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
  const profile = structuredClone(resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } }));
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

test('a profile saved under the previous build\'s runtime (before #2843) still validates', () => {
  const saved = priorRuntimeEnvelope();
  saved.lock.runtimeHash = 'sha256:0a9ca339e4e8b0c57969966057718b6eb946e30387099430d5b8868643c0aeb8';
  digest(saved);
  assert.doesNotThrow(() => validateGameProfileSnapshot(saved));
  assert.equal(coreEvasionCompatibleRuntime(saved, resolveGameProfile('default').lock.runtimeHash), saved.lock.runtimeHash);
});

test('profiles saved under dev\'s route-spread runtime (6ef5d3...) and the rules-pass runtime (0bf081...) and dev\'s current runtime (58cd1d...) still validate on the merged runtime', () => {
  for (const hash of ['sha256:ca7639619f5a9ff7adceb0622043ea676fb18bace9ef14166ca4724fafb619f8', 'sha256:50362dd44639557361f67ebe789bf6109bb8459242b0d48d48535a00aabf95e9', 'sha256:58cd1d56ba6007b40be607b77077ca7df0ac3f29e14600f32aabd48c41cc4085', 'sha256:6ef5d30c3d03a486ab6dafa5756463219cd801324544beedfa76d170066865eb', 'sha256:0bf0815362566977311de28e6a67c2826858afcb9bf92f3555a149110cc522e5']) {
    const saved = priorRuntimeEnvelope();
    saved.lock.runtimeHash = hash;
    digest(saved);
    assert.doesNotThrow(() => validateGameProfileSnapshot(saved));
    assert.equal(coreEvasionCompatibleRuntime(saved, resolveGameProfile('default').lock.runtimeHash), hash);
  }
});

for (const priorRuntime of [
  'sha256:521250500d421c9742b8877b11e395c5718e0fc218c1add1c27c85d338253772',
  'sha256:72ec668dbba9685fd6fe6ab7f95b33c98410450e412336982b5a9dc005281649',
  'sha256:59cc12805591c6c2441d3b34360fd2562376fad622f136e591680a05d56af10a',
]) test(`a profile saved before GearPass + Smash integration keeps runtime ${priorRuntime}`, () => {
  const saved = priorRuntimeEnvelope();
  saved.lock.runtimeHash = priorRuntime;
  digest(saved);
  const before = JSON.stringify(saved);
  assert.equal(validateGameProfileSnapshot(saved).hash, saved.hash);
  assert.equal(coreEvasionCompatibleRuntime(saved, resolveGameProfile('default').lock.runtimeHash), saved.lock.runtimeHash);
  assert.equal(JSON.stringify(saved), before);
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
  const profile = structuredClone(resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } }));
  // Re-pinned 2026-11-01: the Evade stance retirement edits the stances module defaults, which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-05: retiring the glassCannon status edits engine/mechanics/index.json (the mechanics-runtime artifact), which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-05: the Reach cap (range.maxRange in fixCoreMechanics.json, src/model/combatEngagement.js) moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-07: the keepsake removal drops the keepsake tag and mechanic, which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-07: the combat-rounds removal repoints four mechanic manifests (legacy.file), which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-07: the mechanics-kernel move (src/model/mechanicsKernel.js → engine/runtime/bindings.mjs) moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-08: the stance move (src/engine/combatRounds/stance.js → src/model/stance.js) repoints the maneuver_smash manifest, which moves the runtime hash (the old one is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-08: enemy-level budgets on the integrated dev runtime; old saves keep their own rules.
  // Re-pinned 2026-11-14: exact hits and intents (hitRoll, evadeStacksPerCard, perception.roll) move the runtime hash (63e8... is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-14: the one-pick rest (rest module accepts the `rest` service and a fractional recovery.hp) moves the runtime hash (9808... is now in PREVIOUS_RUNTIMES, so a save from it still resumes).
  // Re-pinned 2026-11-14: Ward Poise and the Poise break rule merged together (batch 1); 1551ec... and e4f237... are each branch's own hash, now in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-14: Ward as a Poise effect (ward.poisePerStack in fixCoreMechanics.json, src/model/combatRatings.js) moves the runtime hash (68d4... is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-14: the batch-1 fix pass (the card preview skips an unmet conditional row; the Reaction upgrade on any stance) moves the runtime hash (6c4dab... is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-14 (batch 2): the batch-2 merge of w25-modals (blacksmith/option modals, item properties) moves the runtime hash; earlier batch-1 668f10... is kept.
  // Re-pinned 2026-11-14: stance natural benefits (stanceBenefits rules, src/engine/stanceBenefits.js) move the runtime hash (68d4... is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-14 (batch 2): the batch-2 merge of w25-stances (stance natural benefits, stanceBenefits rules) moves the runtime hash; w25-stances' own 211930... and the earlier f2b79e... are kept.
  // Re-pinned 2026-11-14 (batch 2): Sweep has no extra benefit (owner: sweeps are AoE for full damage): the sweep row leaves stanceBenefits and the hash moves; the batch-2 stances merge hash 28288b... is kept.
  // Re-pinned 2026-11-14 (batch 2): the batch-2 merge of w25-elements (element identity: fixCoreMechanics.json elements, the shock/chill/freeze/brittle/necroticBuildup/knockback statuses, the receipt stages) moves the runtime hash; a save made before keeps its snapshotted rules, which lack elements, and plays as before. w25-elements' own 33931a... and cc8bab... and the earlier 093f55... are kept.
  // Re-pinned 2026-11-14 (batch 2): the batch-2 merge of w25-stats (PR from max(INT, WIS): ratings.prAttributes; live attribute changes in a fight) moves the runtime hash; a fight saved without the key keeps INT-only PR. w25-stats' own 4d6cf7... and the earlier f47819... are kept.
  // Re-pinned 2026-11-15: changeAttribute gains its engine/runtime/ops.json row (mechanics-runtime artifact), which moves the runtime hash (a4c872... is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-15 (batch 3): the Broken wording on cards, relics and the Prepared status moves the runtime hash; batch-2's a4c872... and ad67bc... are kept (a2854a... was batch 3's own pin before merging dev).
  // Re-pinned 2026-11-15 (batch 3): the rankUpCard row in engine/runtime/ops.json moves the runtime hash (753eed... is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-15 (W25-F): spell costs and elemental flux rules (spellCosts/elementFlux) move the runtime hash (0ea717..., 9f3348... are now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-15 (W25-W): Ward's `ward.routing` rule and the Barrier -> "Gain N Poise" wording move the runtime hash (batch 3's 753eed... is now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-15 (W25-MS): the cost.manaOnly tag and the nine mana-only Core spells move it again (the branch pins 63e86f... and 8af5d7... are now in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-15 (W25-NC, Wave 2 batch 5, W25-BANDS): statusCaps, the Counter stack rule and the bands rules move the runtime hash; W25-EvadeCards moved it again (the Evade card face phrase and Quickstep's Counter stack); every earlier hash, 8c57f3... included, is in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-17 (theme B, status and stance rules): armedWhileStacks, the Defend Poise floor, enemyBadgeStacks and the stance weaknesses move it; b9c055... is in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-17 (theme A balance: base damage halved, single-stat ratings, stat-point gear, act levels, Smith prices); 73fdb0... is in PREVIOUS_RUNTIMES.
  // Re-pinned for the #2820 review (tier HP scale, reactive returns unscaled); fa12ec... is in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-17 (theme C on theme B): the shorter Melee, Reach, Ranged, Reaction and Ethereal tooltips regenerate their mechanic manifests; wording only (73fdb0... and cb5271... are in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-17 (review of #2819): the Ethereal manifest names the engine as its reader again (edad64... is in PREVIOUS_RUNTIMES).
  // Re-pinned 2026-11-19: the deferred Axe Strength reader's generated call-map now names finishAbilityPlay; 2a83899... remains readable.
  // Gear and stat traditions combine; both independently shipped parent runtimes remain compatible.
  // Re-pinned 2026-11-20 (#2892 review): card tradition labels move to uiStrings.csv (card.tradition.*); wording only, edf0d9... is now in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-20 on the Retreat reach merge: 7d13f1... (dev) and e5b5d5... (this branch before dev) are now in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-22: the Magic Adept zero Mana floor (stance.playerMinimumCost, owner ruling) moves the runtime hash; fbf370... is now in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-22: no card has a cost minimum (owner ruling); d5db9a... is now in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-22: cost.manaOnly is a data mechanic now (the cost-minimum validator rule is gone) and Exhaust/Ethereal score flat (owner rulings); a5c68d... is now in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-23: the spell Stamina surcharge is dropped (spellCosts.staminaSurcharge 0, owner ruling); 0805e9... is now in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-24: Ward health buffer (ward.routing "hpBuffer", owner ruling); e31663... is now in PREVIOUS_RUNTIMES.
  // Re-pinned 2026-11-24: Weapon poise damage & stance-gated Poise reduction (weaponPoiseEnabled, owner ruling); d24363... is now in PREVIOUS_RUNTIMES.
  assert.equal(profile.lock.runtimeHash, catalogRuntime);
  const originalHash = profile.hash;
  const validated = validateGameProfileSnapshot(profile);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, validated)), validated);
  const run = createRunState({ registries, classId: 'rogue', seed: 512, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a','b','c'] } } } });
  const restoredRun = deserializeRun(serializeRun(run));
  assert.equal(restoredRun.gameProfile.hash, originalHash);
  const combat = createRunCombat({ registries, run: restoredRun, rng: createRng(512), enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.fixCoreRules.smashVsDefensive.damageMultiplier, 1.25);
  assert.equal(combat.fixCoreRules.smashVsDefensive.defendDamageMultiplier, 1.5);
  const restored = restoreStripped({ registries, rng: createRng(512), snapshot: serializeCombatSnapshot(combat), expectedGameProfile: restoredRun.gameProfile });
  assert.equal(restored.gameProfile.hash, originalHash);
  assert.equal(fixCoreSmashVsDefensiveRules(restored.fixCoreRules).damageMultiplier, 1.25);
  assert.equal(restored.fixCoreRules.smashVsDefensive.defendDamageMultiplier, 1.5);
  const target = restored.enemies[0];
  Object.assign(target, { block: 0, statuses: {}, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' }, persistentPoise: {value: 20, max: 20} });
  delete target.combatCounter;
  const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
  // This is a CURRENT-rules round trip: 12 -> 6, x1.5 against Defend = 9; Prepared keeps its shared x1.25 = 7.
  assert.equal(profileDamageReceipt(restored, restored.player, target, 12, smash).amount, 9);
  target.combatStance.maneuver = 'prepared';
  const preparedReceipt = profileDamageReceipt(restored, restored.player, target, 12, smash);
  assert.equal(preparedReceipt.rawHit, 7);
  assert.equal(preparedReceipt.poiseMitigated, 7, 'Prepared target with 20 Poise mitigates up to 10 (50% of 20), reducing 7 -> 0');
  assert.equal(preparedReceipt.amount, 0);
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
