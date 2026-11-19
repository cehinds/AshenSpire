import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { allocateAttributePoint, rederivePools } from '../src/model/levelup.js';
import { sourceRatingValue } from '../src/model/combatRatings.js';
import { SpellTraditionsActive, SpellScalingValue } from '../src/model/spellTraditions.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { createRng } from '../src/engine/rng.js';
import { profileDamageReceipt, profileHandSize } from '../src/engine/gameProfileCombat.js';
import { ChangeAttribute, RestoreLiveStats } from '../src/engine/liveStats.js';
import { previewCard, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { ElementProtectionView } from '../src/engine/elementIdentity.js';
import { ChannelRowValue } from '../src/model/channelRowValue.js';

const profile = resolveGameProfile('core');
const registriesFor = own => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, own)), own);
const registries = registriesFor(profile);
const makeRun = (reg = registries) => createRunState({ registries: reg, classId: 'reaver', seed: 4242 });
const fight = (run, reg = registries) => createRunCombat({ registries: reg, run, rng: createRng(4242), enemyIds: ['wanderingSoldier'] });
const carrier = school => ({ combatProfile: { camp: 'spell', maneuver: 'casting', range: 'reach', ...(school ? { school } : {}) }, tags: ['camp:spell', ...(school ? [`school:${school}`] : [])] });
const power = (combat, entity, school) => sourceRatingValue(combat, entity, 'pr', undefined, false, carrier(school));
const historicalProfile = () => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-fae7af.json.gz', import.meta.url))));

test('fresh Core snapshots assign only Health to CON and Poise/Mana to WIS', () => {
  const run = makeRun();
  const rows = run.derivedStatRuleSnapshot.rules.rules;
  assert.equal(rows.poise.wisdom, 1);
  assert.equal(rows.poise.constitution, 0);
  assert.equal(rows.mana.wisdom, 1);
  assert.equal(rows.stamina.dexterity, 1);
  for (const id of ['mana', 'stamina']) assert.equal(rows[id].constitution, 0);
  const before = { hp: run.maxHp, mana: run.maxMana, stamina: run.maxStamina, poise: fight(run).player.persistentPoise.max };
  run.level.unspentPoints = 2;
  allocateAttributePoint(registries, run, 'constitution');
  assert.equal(run.maxHp, before.hp + 5);
  assert.equal(run.maxMana, before.mana);
  assert.equal(run.maxStamina, before.stamina);
  assert.equal(fight(run).player.persistentPoise.max, before.poise);
  allocateAttributePoint(registries, run, 'wisdom');
  assert.equal(fight(run).player.persistentPoise.max, before.poise + 1);
  assert.equal(run.maxHp, before.hp + 5);
});

test('real allocations pay SP/MP/hand only on the saved fourth-point thresholds', () => {
  for (const [attribute, pool] of [['dexterity', 'maxStamina'], ['wisdom', 'maxMana']]) {
    const run = makeRun();
    run.attributes[attribute] = 2;
    rederivePools(registries, run, 'threshold fixture');
    const before = run[pool];
    run.level.unspentPoints = 2;
    allocateAttributePoint(registries, run, attribute);
    assert.equal(run[pool], before, `${attribute} 2 -> 3`);
    allocateAttributePoint(registries, run, attribute);
    assert.equal(run[pool], before + 1, `${attribute} 3 -> 4`);
  }
  const run = makeRun();
  run.attributes.intelligence = 2;
  rederivePools(registries, run, 'hand fixture');
  const initial = profileHandSize(fight(run));
  const mana = run.maxMana;
  run.level.unspentPoints = 2;
  allocateAttributePoint(registries, run, 'intelligence');
  assert.equal(profileHandSize(fight(run)), initial);
  allocateAttributePoint(registries, run, 'intelligence');
  assert.equal(profileHandSize(fight(run)), initial + 1);
  assert.equal(run.maxMana, mana, 'INT no longer buys Mana');
});

test('exclusive and shared spells price their actual asymmetric casting attributes', () => {
  for (const attributes of [{ intelligence: 8, wisdom: 2 }, { intelligence: 2, wisdom: 8 }]) {
    const run = makeRun();
    Object.assign(run.attributes, attributes);
    rederivePools(registries, run, 'asymmetric fixture');
    const combat = fight(run);
    assert.equal(SpellTraditionsActive(combat), true);
    for (const school of ['force', 'illusion', 'alteration', 'divine', 'decay', 'fire', 'frost', 'earth', 'lightning', null]) {
      const card = carrier(school);
      const expected = SpellScalingValue(combat.player.attributes, card);
      assert.equal(power(combat, combat.player, school), expected, school);
      const quote = profileDamageReceipt(combat, combat.player, combat.enemies[0], 10, card);
      assert.ok(quote.rawHit > 0);
      const source = quote.damageReceipt.hits[0].sources.find(row => row.id === 'pr:0');
      assert.equal(source.amount, expected, `${school} damage receipt`);
    }
  }
});

test('enemy spells use enemy INT/WIS and casting modifiers retain their scope', () => {
  const combat = fight(makeRun());
  const enemy = combat.enemies[0];
  enemy.attributes = { ...enemy.attributes, strength: 20, intelligence: 7, wisdom: 3 };
  enemy.ratings.pr = 0;
  assert.equal(power(combat, enemy, 'force'), 7);
  assert.equal(power(combat, enemy, 'divine'), 3);
  assert.ok(profileDamageReceipt(combat, enemy, combat.player, 10, carrier('force')).rawHit
    > profileDamageReceipt(combat, enemy, combat.player, 10, carrier('divine')).rawHit);
  const p = combat.player;
  p.combatStance = { maneuver: 'casting', camp: 'spell', range: 'reach' };
  const beforeArcane = power(combat, p, 'illusion');
  const beforeDivine = power(combat, p, 'divine');
  p.itemProps = { ...p.itemProps, stanceAttribute: { casting: { intelligence: 3 } } };
  assert.equal(power(combat, p, 'illusion'), beforeArcane + 3);
  assert.equal(power(combat, p, 'divine'), beforeDivine);
});

test('live WIS raises Poise and Divine power while INT raises only Arcane power', () => {
  const run = makeRun();
  Object.assign(run.attributes, { wisdom: 6, intelligence: 2 });
  rederivePools(registries, run, 'live fixture');
  const combat = fight(run), p = combat.player;
  const before = { poise: p.persistentPoise.max, arcane: power(combat, p, 'force'), divine: power(combat, p, 'divine') };
  ChangeAttribute(combat, p, 'wisdom', 2);
  assert.equal(p.persistentPoise.max, before.poise + 2);
  assert.equal(power(combat, p, 'divine'), before.divine + 2);
  assert.equal(power(combat, p, 'force'), before.arcane);
  ChangeAttribute(combat, p, 'intelligence', 3);
  assert.equal(p.persistentPoise.max, before.poise + 2);
  assert.equal(power(combat, p, 'force'), before.arcane + 3);
  RestoreLiveStats(combat);
  assert.equal(p.persistentPoise.max, before.poise);
  assert.equal(power(combat, p, 'divine'), before.divine);
});

test('real Divine and shared card forecasts match committed damage', () => {
  for (const cardId of ['core.smite', 'core.cinderDart', 'core.galePush']) {
    const run = makeRun();
    Object.assign(run.attributes, { wisdom: 7, intelligence: 2 });
    rederivePools(registries, run, 'card fixture');
    const combat = fight(run), target = combat.enemies[0];
    Object.assign(target, { hp: 500, maxHp: 500, block: 0, statuses: {}, persistentPoise: { max: 0, value: 0 } });
    combat.player.mana = combat.player.maxMana = combat.player.stamina = combat.player.maxStamina = combat.player.energy = 100;
    combat.piles.hand = [{ instanceId: 'cast', cardId, upgraded: false }];
    const preview = previewCard(combat, 'cast', target.id);
    const damage = preview.values.find(row => row.op === 'damage');
    assert.ok(damage, cardId);
    const quoted = damage.perTargetHitDamages[target.id].reduce((sum, n) => sum + n, 0);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'cast', targetId: target.id });
    assert.equal(500 - target.hp, quoted, cardId);
  }
});

test('genuine pre-change profiles retain integrity, old allocation pools and old casting rules', () => {
  const old = historicalProfile(), hash = old.hash;
  const reg = registriesFor(old);
  const run = makeRun(reg);
  const serializedRows = JSON.stringify(run.derivedStatRuleSnapshot);
  assert.equal(run.gameProfile.hash, hash);
  assert.equal(run.gameProfile.modules.effects.spellTraditionsVersion, undefined);
  assert.equal(run.derivedStatRuleSnapshot.rules.rules.poise.constitution, 1);
  run.level.unspentPoints = 1;
  const hp = run.maxHp;
  allocateAttributePoint(reg, run, 'constitution');
  assert.equal(run.maxHp, hp + 10);
  assert.equal(JSON.stringify(run.derivedStatRuleSnapshot), serializedRows);
  const combat = fight(run, reg);
  assert.equal(SpellTraditionsActive(combat), false);
  assert.equal(combat.fixCoreRules.spellTraditionsVersion, undefined);
  assert.equal(power(combat, combat.player, 'force'), power(combat, combat.player, 'divine'));
  assert.equal(deserializeRun(serializeRun(run)).gameProfile.hash, hash);
});

test('new run and combat snapshots retain explicit casting and Poise ownership', () => {
  const run = deserializeRun(serializeRun(makeRun()));
  const combat = fight(run);
  const snapshot = serializeCombatSnapshot(combat);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(4242), snapshot, expectedGameProfile: run.gameProfile });
  assert.equal(restored.fixCoreRules.spellTraditionsVersion, 1);
  assert.equal(restored.derivedStatRuleSnapshot.rules.rules.poise.wisdom, 1);
  assert.equal(restored.player.persistentPoise.max, combat.player.persistentPoise.max);
  assert.equal(power(restored, restored.player, 'divine'), power(combat, combat.player, 'divine'));
  restored.player.attributes.intelligence = 2;
  restored.player.attributes.wisdom = 8;
  const target = restored.enemies[0];
  target.persistentPoise = { max: 100, value: 100 };
  assert.equal(ElementProtectionView(restored, restored.player, target, carrier('fire')).ignored, 8);
});

test('retired spell rows cannot replace fixed casting channels while flat modifiers retain their scope', () => {
  for (const row of [{ base: 0, intelligence: 2 }, { base: 3, intelligence: 2, multiplier: 1.5 }]) {
    const run = makeRun();
    Object.assign(run.attributes, { intelligence: 8, wisdom: 2 });
    run.derivedStatRuleSnapshot.rules.rules.pr = structuredClone(row);
    rederivePools(registries, run, 'custom spell row fixture');
    const combat = fight(run), p = combat.player;
    const expected = attribute => attribute;
    assert.equal(power(combat, p, 'force'), expected(8));
    assert.equal(power(combat, p, 'divine'), expected(2));
    assert.equal(ChannelRowValue(combat, p, 'pr', p.attributes, carrier('divine')), expected(2));
    const quote = profileDamageReceipt(combat, p, combat.enemies[0], 10, carrier('divine'));
    assert.equal(quote.damageReceipt.hits[0].sources.find(source => source.id === 'pr:0').amount, expected(2));
    ChangeAttribute(combat, p, 'wisdom', 1);
    assert.equal(power(combat, p, 'divine'), expected(3));
    assert.equal(power(combat, p, 'force'), expected(8));
    p.combatStance = { maneuver: 'casting', camp: 'spell', range: 'reach' };
    const originalArcane = power(combat, p, 'force'), originalDivine = power(combat, p, 'divine');
    p.itemProps = { ...p.itemProps, stanceAttribute: { casting: { intelligence: 2 } } };
    assert.equal(power(combat, p, 'force'), originalArcane + expected(10) - expected(8));
    assert.equal(power(combat, p, 'divine'), originalDivine);
    p.itemProps.stanceRating = { casting: { pr: 4 } };
    assert.equal(power(combat, p, 'divine'), originalDivine + 4, 'flat stance modifier stays outside intrinsic scaling');
    p.ratingSources.push({ kind: 'equipment', sourceId: 'armament/greatsword', pr: 5 });
    assert.equal(sourceRatingValue(combat, p, 'pr', 'greatsword', true, carrier('divine')), originalDivine + 9);
    assert.equal(sourceRatingValue(combat, p, 'pr', 'different-weapon', true, carrier('divine')), originalDivine + 4);
  }
});
