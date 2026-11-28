import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { allocateAttributePoint, rederivePools } from '../src/model/levelup.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { sourceRatingValue } from '../src/model/combatRatings.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { ChangeAttribute, RestoreLiveStats, ElementStatScale } from '../src/engine/liveStats.js';
import { ElementProtectionView, ApplyElementReceipt, OnPoiseBreak, ElementPreviewBreak } from '../src/engine/elementIdentity.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { SpellScalingValue, SpellTraditionsActive, TraditionSpellPower } from '../src/model/spellTraditions.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { validateGameProfileSnapshot } from '../src/model/gameProfile.js';
import { POISE_ON_MODULES } from './helpers/poise-on.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { ...POISE_ON_MODULES,
  effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 },
} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function make(attributes = { intelligence: 8, wisdom: 2 }) {
  const run = createRunState({ registries, classId: 'reaver', seed: 4242 });
  Object.assign(run.attributes, attributes);
  rederivePools(registries, run, 'casting test');
  const combat = createRunCombat({ registries, run, rng: createRng(4242), enemyIds: ['wanderingSoldier'] });
  return { run, combat, p: combat.player, target: combat.enemies[0] };
}
const carrier = school => ({ combatProfile: { camp: 'spell', maneuver: 'casting', range: 'reach', ...(school ? { school } : {}) },
  tags: ['camp:spell', ...(school ? [`school:${school}`] : [])] });
const power = (combat, entity, card) => sourceRatingValue(combat, entity, 'pr', undefined, false, card);

test('exclusive schools read their own attribute, shared schools read the greater, for both asymmetric builds', () => {
  for (const attributes of [{ intelligence: 8, wisdom: 2 }, { intelligence: 2, wisdom: 8 }]) {
    const { combat, p } = make(attributes);
    assert.equal(SpellTraditionsActive(combat), true);
    for (const school of ['force', 'illusion', 'alteration', 'divine', 'decay', 'fire', 'earth', 'lightning', 'frost', null]) {
      const card = carrier(school);
      const expected = SpellScalingValue(p.attributes, card);
      assert.equal(power(combat, p, card), expected, `${school}: exact intrinsic contribution`);
      const receipt = profileDamageReceipt(combat, p, combat.enemies[0], 10, card);
      assert.ok(receipt.rawHit > 0, `${school}: actual damage path executes`);
      const attributes = receipt.damageReceipt.hits[0].sources.find(row => row.id === 'pr:0');
      assert.equal(attributes.amount, expected, `${school}: contribution receipt names the selected attribute amount`);
    }
  }
});

test('a Divine hit that breaks Poise quotes its direct damage and the separate Smite rider', () => {
  const { combat, p, target } = make({ intelligence: 3, wisdom: 3 });
  target.hp = target.maxHp = 500;
  // The weapon Poise contact must break the pool before any relic acts.
  target.ratings.poise = 3;
  target.persistentPoise = { max: 3, value: 3 };
  target.block = 8;
  p.mana = p.maxMana = p.stamina = p.maxStamina = p.energy = 100;
  combat.piles.hand = [{ instanceId: 'divine-break', cardId: 'core.smite', upgraded: false }];
  const preview = previewCard(combat, 'divine-break', target.id, undefined, { rangeRoute: 'advance' });
  const quoted = preview.values.find(row => row.op === 'damage').perTargetHitDamages[target.id][0];
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'divine-break', targetId: target.id, rangeRoute: 'advance' });
  const events = combat.eventLog.slice(start);
  const direct = events.find(row => row.type === 'damageDealt' && row.targetId === target.id).hpLoss;
  const rider = events.find(row => row.type === 'elementSmite' && row.targetId === target.id);
  assert.ok(rider?.amount > 0, 'a Divine contact breaking the target’s Poise emits its own Smite damage');
  const smite = rider.amount;
  assert.equal(quoted, direct + smite);
  assert.equal(500 - target.hp, quoted);
});

test('a lethal Divine contact quotes direct overkill without a Smite rider that cannot run', () => {
  const { combat, p, target } = make({ intelligence: 3, wisdom: 3 });
  target.hp = 2;
  target.persistentPoise = { max: 3, value: 3 };
  target.ratings.poise = 3;
  target.block = 0;
  p.mana = p.maxMana = p.stamina = p.maxStamina = p.energy = 100;
  combat.piles.hand = [{ instanceId: 'divine-lethal', cardId: 'core.smite', upgraded: false }];
  const preview = previewCard(combat, 'divine-lethal', target.id, undefined, { rangeRoute: 'advance' });
  const quoted = preview.values.find(row => row.op === 'damage').perTargetHitDamages[target.id][0];
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'divine-lethal', targetId: target.id, rangeRoute: 'advance' });
  const events = combat.eventLog.slice(start);
  assert.equal(events.some(row => row.type === 'elementSmite'), false);
  assert.equal(quoted, events.find(row => row.type === 'damageDealt' && row.targetId === target.id).hpLoss);
  assert.equal(target.hp, 0);
});

test('enemy spell damage uses its own tradition attributes rather than the player attributes or STR', () => {
  const { combat, target: enemy, p } = make();
  enemy.attributes = { ...enemy.attributes, strength: 20, intelligence: 7, wisdom: 3 };
  enemy.ratings.pr = 0;
  assert.equal(power(combat, enemy, carrier('force')), 7);
  assert.equal(power(combat, enemy, carrier('divine')), 3);
  const arcane = profileDamageReceipt(combat, enemy, p, 10, carrier('force'));
  const divine = profileDamageReceipt(combat, enemy, p, 10, carrier('divine'));
  assert.ok(arcane.rawHit > divine.rawHit);
});

test('stance attribute grants use the selected school and preserve flat spell modifiers', () => {
  const { combat, p } = make({ intelligence: 2, wisdom: 7 });
  p.combatStance = { maneuver: 'casting', camp: 'spell', range: 'reach' };
  p.itemProps = { ...p.itemProps, stanceAttribute: { casting: { intelligence: 3 } } };
  const arcane = carrier('illusion'), divine = carrier('divine');
  assert.equal(power(combat, p, arcane) - power({ ...combat }, { ...p, itemProps: {} }, arcane), 3);
  assert.equal(power(combat, p, divine) - power({ ...combat }, { ...p, itemProps: {} }, divine), 0);
  assert.equal(TraditionSpellPower(combat, p, divine, p.ratings.pr + 4), p.attributes.wisdom + 4);
});

test('Wisdom alone grows new-run Poise at allocation and combat creation; Constitution grows Health', () => {
  const { run, combat, p } = make();
  const poise = p.persistentPoise.max, hp = run.maxHp;
  run.level.unspentPoints = 2;
  allocateAttributePoint(registries, run, 'constitution');
  assert.equal(run.maxHp, hp + 5);
  const con = createRunCombat({ registries, run, rng: createRng(4242), enemyIds: ['wanderingSoldier'] });
  assert.equal(con.player.persistentPoise.max, poise);
  allocateAttributePoint(registries, run, 'wisdom');
  const wis = createRunCombat({ registries, run, rng: createRng(4242), enemyIds: ['wanderingSoldier'] });
  assert.equal(wis.player.persistentPoise.max, poise + 1);
  assert.equal(combat.player.persistentPoise.max, poise, 'separate preview fight leaves the original untouched');
});

test('live Wisdom boosts resize Poise and Divine spells; INT boosts only Arcane spells; restoration removes both', () => {
  const { combat, p } = make({ intelligence: 3, wisdom: 6 });
  const before = { poise: p.persistentPoise.max, arcane: power(combat, p, carrier('force')), divine: power(combat, p, carrier('divine')) };
  ChangeAttribute(combat, p, 'wisdom', 2);
  assert.equal(p.persistentPoise.max, before.poise + 2);
  assert.equal(power(combat, p, carrier('divine')), before.divine + 2);
  assert.equal(power(combat, p, carrier('force')), before.arcane);
  ChangeAttribute(combat, p, 'intelligence', 2);
  assert.equal(p.persistentPoise.max, before.poise + 2);
  assert.equal(power(combat, p, carrier('force')), before.arcane + 2);
  RestoreLiveStats(combat);
  assert.equal(p.persistentPoise.max, before.poise);
  assert.equal(power(combat, p, carrier('divine')), before.divine);
  assert.equal(power(combat, p, carrier('force')), before.arcane);
});

test('shared Fire/Frost riders use the greater attribute and Necrotic buildup uses Wisdom', () => {
  const { combat, p, target } = make({ intelligence: 2, wisdom: 8 });
  target.persistentPoise = { value: 100, max: 100 };
  assert.equal(ElementProtectionView(combat, p, target, carrier('fire')).ignored, 8);
  const preview = structuredClone(target);
  ElementPreviewBreak(combat, p, preview, 'fire');
  OnPoiseBreak(combat, p, target, { targetId: target.id, element: 'fire' });
  assert.equal(target.statuses.burn.stacks, preview.statuses.burn.stacks);
  assert.equal(target.statuses.burn.stacks, 8);
  ApplyElementReceipt(combat, p, target, { amount: 1 }, carrier('frost'));
  assert.equal(target.statuses.chill.stacks, 1 + Math.floor(8 / 3));
  target.persistentPoise.value = 0;
  ApplyElementReceipt(combat, p, target, { amount: 1 }, carrier('decay'));
  assert.equal(target.statuses.necroticBuildup.stacks, 8);
  assert.equal(ElementStatScale(p, 'fire', combat), 8);
  assert.equal(ElementStatScale(p, 'necrotic', combat), 8);
});

test('run and combat serialization retain Wisdom Poise and the explicit casting version', () => {
  const { run, combat } = make();
  const restoredRun = deserializeRun(serializeRun(run));
  assert.equal(restoredRun.derivedStatRuleSnapshot.rules.rules.poise.wisdom, 1);
  assert.equal(restoredRun.derivedStatRuleSnapshot.rules.rules.poise.constitution || 0, 0);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(4242), snapshot: serializeCombatSnapshot(combat), expectedGameProfile: run.gameProfile });
  assert.equal(SpellTraditionsActive(restored), true);
  assert.equal(restored.player.persistentPoise.max, combat.player.persistentPoise.max);
  assert.equal(power(restored, restored.player, carrier('divine')), power(combat, combat.player, carrier('divine')));
});

test('a fight without the version flag retains shared spell damage and its old elemental formulas', () => {
  const { combat, p, target } = make({ intelligence: 2, wisdom: 8 });
  const legacy = structuredClone(combat.fixCoreRules);
  delete legacy.spellTraditionsVersion;
  combat.fixCoreRules = legacy;
  assert.equal(SpellTraditionsActive(combat), false);
  assert.equal(power(combat, p, carrier('force')), power(combat, p, carrier('divine')));
  target.persistentPoise = { value: 100, max: 100 };
  assert.equal(ElementProtectionView(combat, p, target, carrier('fire')).ignored, 10);
  ApplyElementReceipt(combat, p, target, { amount: 1 }, carrier('frost'));
  assert.equal(target.statuses.chill.stacks, 1 + Math.floor(2 / 3));
  target.persistentPoise.value = 0;
  ApplyElementReceipt(combat, p, target, { amount: 1 }, carrier('decay'));
  assert.equal(target.statuses.necroticBuildup.stacks, 2);
});

test('real card forecasts equal committed damage under Arcane, Divine and shared scaling', () => {
  for (const cardId of ['core.galePush', 'core.venomSpray', 'core.cinderDart']) {
    const { combat, p, target } = make({ intelligence: 2, wisdom: 8 });
    p.energy = p.stamina = p.mana = 100;
    target.hp = target.maxHp = 5000;
    target.block = 0;
    target.persistentPoise = { value: 0, max: 100 };
    combat.piles.hand = [{ cardId, instanceId: 'tradition-test', upgraded: false }];
    const preview = previewCard(combat, 'tradition-test', target.id);
    const rows = preview.values.filter(row => row.op === 'damage');
    assert.ok(rows.length > 0, `${cardId}: forecast includes damage`);
    const before = target.hp;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'tradition-test', targetId: target.id });
    assert.equal(before - target.hp, rows.reduce((sum, row) => sum + row.faceValue, 0), `${cardId}: forecast equals dealt damage`);
  }
});

test('a real Divine support card restores the current Wisdom-derived Poise pool, capped at its maximum', () => {
  const { combat, p, target } = make({ intelligence: 2, wisdom: 5 });
  const maximum = p.persistentPoise.max;
  p.persistentPoise.value = Math.max(0, maximum - 1);
  p.energy = p.stamina = p.mana = 100;
  combat.piles.hand = [{ cardId: 'core.graveToll', instanceId: 'restore-poise', upgraded: false }];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'restore-poise', targetId: target.id });
  assert.equal(p.persistentPoise.max, maximum);
  assert.equal(p.persistentPoise.value, maximum);
});

test('equipped Wisdom bonuses feed Poise and Divine power while equipped Constitution feeds Health only', () => {
  const { run, combat } = make({ intelligence: 2, wisdom: 5 });
  const maximum = combat.player.persistentPoise.max, hp = run.maxHp;
  const relic = `relic/${run.relics[0]}`;
  const nextFight = () => createRunCombat({ registries, run, rng: createRng(4242), enemyIds: ['wanderingSoldier'] });
  run.itemUpgradePicks = { [relic]: [{ id: 'wisdom', k: 'stat', stat: 'wisdom', n: 2 }] };
  rederivePools(registries, run, 'equipped Wisdom');
  const wis = nextFight();
  assert.equal(wis.player.persistentPoise.max, maximum + 2);
  assert.equal(power(wis, wis.player, carrier('divine')), power(combat, combat.player, carrier('divine')) + 2);
  assert.equal(run.maxHp, hp);
  run.itemUpgradePicks[relic] = [{ id: 'constitution', k: 'stat', stat: 'constitution', n: 2 }];
  rederivePools(registries, run, 'equipped Constitution');
  assert.equal(nextFight().player.persistentPoise.max, maximum);
  assert.equal(run.maxHp, hp + 10);
});

test('the genuine previous-dev profile and saved CON Poise row survive loading and a new fight', () => {
  // Captured from unmodified dev commit 66e473a..., not today's profile under
  // a forged old runtime hash. Integrity is checked through the real loader.
  const savedProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-521250.json.gz', import.meta.url))));
  const savedRules = JSON.parse(readFileSync(new URL('./fixtures/dev-derived-rules-521250.json', import.meta.url), 'utf8'));
  const profile = validateGameProfileSnapshot(savedProfile);
  assert.equal(profile.hash, savedRules.profileHash);
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const born = createRunState({ registries: reg, classId: 'reaver', seed: 4242, derivedStatRuleSnapshot: savedRules.snapshot });
  const run = deserializeRun(serializeRun(born));
  assert.deepEqual(run.derivedStatRuleSnapshot, savedRules.snapshot);
  assert.equal(SpellTraditionsActive(run), false);
  const fight = () => createRunCombat({ registries: reg, run, rng: createRng(4242), enemyIds: ['wanderingSoldier'] });
  const before = fight();
  assert.equal(before.fixCoreRules.spellTraditionsVersion, undefined, 'new fight on old run stays on old scaling');
  const poise = before.player.persistentPoise.max;
  run.level.unspentPoints = 2;
  allocateAttributePoint(reg, run, 'constitution');
  assert.equal(fight().player.persistentPoise.max, poise + 1, 'saved Constitution contribution is retained');
  allocateAttributePoint(reg, run, 'wisdom');
  assert.equal(fight().player.persistentPoise.max, poise + 1, 'the new Wisdom row does not leak into the saved run');
  const resumed = fight();
  assert.equal(power(resumed, resumed.player, carrier('force')), power(resumed, resumed.player, carrier('divine')));
});

test('the genuine incoming Dev profile retains its casting, Wisdom Poise and unrebalanced card definitions', () => {
  // Resolved from MERGE_HEAD 0b11a358's own compiled catalog. Its digest also
  // matches that commit's game.lock.json profiles.default.hash.
  const archived = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-0b11a358.json.gz', import.meta.url))));
  const archivedBefore = structuredClone(archived);
  const profile = validateGameProfileSnapshot(archived);
  assert.equal(profile.hash, 'sha256:427182c7b26d668c06eb20470df7f23f022600bd10d8a430b9ea4bf6bb71308a');
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const born = createRunState({ registries: reg, classId: 'reaver', seed: 4242 });
  Object.assign(born.attributes, { intelligence: 8, wisdom: 2 });
  rederivePools(reg, born, 'archived Dev casting');
  const run = deserializeRun(serializeRun(born));
  assert.equal(SpellTraditionsActive(run), true);
  assert.equal(run.gameProfile.modules.effects.spellRewardPolicyVersion || 0, 0, 'casting opt-in does not opt the saved profile into new reward policy');
  assert.ok(reg.cards.get('core.graveToll').effects.some(effect => effect.op === 'damage'), 'saved Grave Toll keeps its original offensive effects');
  const fight = () => createRunCombat({ registries: reg, run, rng: createRng(4242), enemyIds: ['wanderingSoldier'] });
  const before = fight();
  for (const school of ['force', 'divine', 'fire']) {
    const card = carrier(school);
    assert.equal(power(before, before.player, card), SpellScalingValue(before.player.attributes, card));
  }
  run.level.unspentPoints = 1;
  allocateAttributePoint(reg, run, 'wisdom');
  const later = fight();
  assert.equal(later.player.persistentPoise.max, before.player.persistentPoise.max + 1);
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(4242), snapshot: serializeCombatSnapshot(later), expectedGameProfile: profile });
  assert.equal(restored.gameProfile.hash, profile.hash);
  assert.equal(power(restored, restored.player, carrier('divine')), power(later, later.player, carrier('divine')));
  assert.deepEqual(archived, archivedBefore, 'loading and allocation leave the archived profile immutable');
});

test('the ac607 checkpoint profile and its saved Wisdom snapshot retain the implemented support cards', () => {
  const archived = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/checkpoint-profile-8204b997.json.gz', import.meta.url))));
  const profile = validateGameProfileSnapshot(archived);
  assert.equal(profile.hash, 'sha256:2a25d3cbf87b70b876c5c4c6dde9dd86df9dd582f692cce9efe15ae9c5fdae07');
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const born = createRunState({ registries: reg, classId: 'reaver', seed: 4242 });
  const run = deserializeRun(serializeRun(born));
  assert.equal(run.derivedStatRuleSnapshot.rules.rules.poise.wisdom, 1);
  assert.equal(run.derivedStatRuleSnapshot.rules.rules.poise.constitution || 0, 0);
  assert.ok(reg.cards.get('core.graveToll').effects.some(effect => effect.op === 'restorePoise'));
  const combat = createRunCombat({ registries: reg, run, rng: createRng(4242), enemyIds: ['wanderingSoldier'] });
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(4242), snapshot: serializeCombatSnapshot(combat), expectedGameProfile: profile });
  assert.equal(restored.gameProfile.hash, profile.hash);
  assert.equal(SpellTraditionsActive(restored), true);
  assert.equal(restored.player.persistentPoise.max, combat.player.persistentPoise.max);
});
