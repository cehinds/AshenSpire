// Owner, 2026-11-18: a card face outside combat (deck editor, rewards, shop, upgrade picker) carries the run character's always-on attribute bonus,
// so it reads the number a neutral-stance hit makes: physical damage adds STR, Block adds DEX, magic damage adds max(INT, WIS), then the same
// multipliers as combat (all 1, owner ruling 2026-11-28), min 1. No stance, status or enemy defence is in it (those show in combat).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { previewCard } from '../src/engine/combat.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';

const profile = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const newRun = classId => { const run = createRunState({ registries, classId, seed: 31, profileMeta: META }); run.relics = []; return run; };
const effects = profile.modules.effects;
const face = (run, cardId) => cardPlainText(registries, { cardId }, { rules: run });
const number = text => Number(/\d+/.exec(text)[0]);
// Defend's authored Block comes from the pack (#3039 restored it to grant Block again).
const defendBlockEffect = registries.cards.get('core.defend').effects.find(effect => effect.op === 'block');
const DEFEND_AUTHORED_BLOCK = defendBlockEffect.amount;
const strikeDamageEffect = registries.cards.get('core.strike').effects.find(effect => effect.op === 'damage');
const STRIKE_AUTHORED_DAMAGE = strikeDamageEffect.amount;

test('a face with no run keeps the authored number', () => {
  assert.equal(number(cardPlainText(registries, { cardId: 'core.strike' }, {})), STRIKE_AUTHORED_DAMAGE);
  assert.equal(number(cardPlainText(registries, { cardId: 'core.defend' }, {})), DEFEND_AUTHORED_BLOCK);
});

test('Strike and Defend use the wielded attack stat and DEX through the shipped multipliers', () => {
  for (const classId of ['reaver', 'rogue']) {
    const run = newRun(classId);
    const attributes = gameProfileEffectiveAttributes(registries, run);
    const attribute = classId === 'rogue' ? 'dexterity' : 'strength'; // The starter dagger is finesse.
    const strikeBase = Math.ceil(STRIKE_AUTHORED_DAMAGE * effects.baseDamageMultiplier);
    const strike = Math.floor((strikeBase + attributes[attribute] * effects.strengthDamageWeight)
      * effects.physicalDamageMultiplier * effects.playerDamageMultiplier);
    const defendRaw = DEFEND_AUTHORED_BLOCK + attributes.dexterity * effects.dexterityBlockWeight;
    const defend = Math.floor(defendRaw * effects.blockGainMultiplier);
    assert.equal(number(face(run, 'core.strike')), strike, `${classId} Strike`);
    assert.equal(number(face(run, 'core.defend')), defend, `${classId} Defend`);
  }
});

test('a magic hit adds max(INT, WIS) and takes no physical cut', () => {
  const run = newRun('starseer');
  const attributes = gameProfileEffectiveAttributes(registries, run);
  const stat = Math.max(attributes.intelligence, attributes.wisdom);
  const cantrip = registries.cards.get('core.cinderDart').effects.find(effect => effect.op === 'damage').amount;
  const expected = Math.floor((Math.ceil((cantrip + 1) * effects.baseDamageMultiplier) + stat * effects.magicStatWeight) * effects.playerDamageMultiplier);
  assert.equal(number(face(run, 'core.cinderDart')), expected, 'Sceptre adds 1 authored magic damage before the base scale');
});

test('the face equals the combat receipt amount before any stance stage', () => {
  for (const classId of ['reaver', 'rogue']) {
    const run = newRun(classId);
    const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
    combat.piles.hand.push({ instanceId: 'probe', cardId: 'core.strike' });
    const hit = previewCard(combat, 'probe', combat.enemies[0].id).values[0].damageReceipt.hits[0];
    const attributed = hit.sources.find(source => source.id === 'ar:0' || source.id === 'ar');
    assert.ok(attributed, 'the receipt names its attack attribute stage');
    const withoutStance = Math.floor(attributed.effective * effects.physicalDamageMultiplier * effects.playerDamageMultiplier);
    assert.equal(number(face(run, 'core.strike')), withoutStance, `${classId}: the static face is the receipt's attack attribute stage through the cuts, without the stance stages`);
  }
});

test('a resumed version-1 dagger fight keeps Strength in its static face and receipt', () => {
  const run = newRun('rogue');
  const live = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  const snapshot = serializeCombatSnapshot(live);
  snapshot.core2ActionRulesVersion = 1;
  const combat = restoreCombatSnapshot({ registries, snapshot, rng: createRng(31) });
  const strike = { instanceId: 'probe-v1', cardId: 'core.strike' };
  combat.piles.hand.push(strike);
  const preview = previewCard(combat, strike.instanceId, combat.enemies[0].id);
  const source = preview.values[0].damageReceipt.hits[0].sources.find(row => row.id === 'ar:0');
  assert.equal(source.amount, combat.player.attributes.strength);
  assert.notEqual(combat.player.attributes.strength, combat.player.attributes.dexterity);
  const expected = Math.floor(source.effective * effects.physicalDamageMultiplier * effects.playerDamageMultiplier);
  assert.equal(number(face(combat, strike.cardId)), expected, 'a restored pile uses the fight action rules');
  assert.equal(number(face(preview.faceRules, strike.cardId)), expected, 'the face baseline carries the same version');
});

// Codex review on PR #2835: the in-combat pile viewer passes the combat as `rules`; its faces keep the player's always-on attributes.
test('a face rendered with the combat as rules matches the same card outside combat', () => {
  for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) {
    const run = newRun(classId);
    const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
    assert.equal(number(face(combat, 'core.strike')), number(face(run, 'core.strike')), `${classId} Strike in the pile viewer`);
    assert.equal(number(face(combat, 'core.defend')), number(face(run, 'core.defend')), `${classId} Defend in the pile viewer`);
  }
});

// Codex review on PR #2835: an untyped spell takes its wielded armament's type before the physical/magic split, as combat resolves it
// (a Herald's Arcane Spark is Arcane, half magic), so its face cuts the same physical share as the receipt.
test('an untyped spell face reads the wielded armament type, as the combat carrier does', async () => {
  const { tacticalCarrier } = await import('../src/engine/combatCardTactics.js');
  const { magicShareOf } = await import('../src/model/combatRatings.js');
  for (const classId of ['herald', 'starseer']) {
    const run = newRun(classId);
    const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
    combat.piles.hand.push({ instanceId: 'probe', cardId: 'core.cantrip' });
    const hit = previewCard(combat, 'probe', combat.enemies[0].id).values[0].damageReceipt.hits[0];
    const attributed = hit.sources.find(source => source.id === 'pr:0' || source.id === 'pr');
    assert.ok(attributed, 'the receipt names the magic-stat stage');
    const share = magicShareOf(tacticalCarrier(registries.cards.get('core.cantrip'), {}, combat, combat.player).combatProfile);
    // The INT/WIS bonus belongs to the magic channel; only the scaled authored base has a physical share.
    const base = Math.ceil(hit.sources.find(source => source.id === 'base').amount * effects.baseDamageMultiplier);
    const physical = base * (1 - share);
    // Owner 2026-11-22 (Arcane Spark prints 3): mirror ScalePhysicalDamage - a positive physical part never rounds below 1.
    const scaledPhysical = physical > 0 && effects.physicalDamageMultiplier > 0 ? Math.max(Math.min(1, physical), physical * effects.physicalDamageMultiplier) : 0;
    const expected = Math.floor((attributed.effective - physical + scaledPhysical) * effects.playerDamageMultiplier);
    assert.equal(number(face(run, 'core.cantrip')), expected, `${classId} Arcane Spark outside combat`);
    assert.equal(number(face(combat, 'core.cantrip')), expected, `${classId} Arcane Spark in the pile viewer`);
  }
});

// Codex review on PR #2835: the hand preview's face baseline (faceRules) resolves the same armament type as the run face.
test('the hand preview face baseline matches the run face for an untyped spell', () => {
  for (const classId of ['herald', 'starseer']) {
    const run = newRun(classId);
    const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
    combat.piles.hand.push({ instanceId: 'probe', cardId: 'core.cantrip' });
    const preview = previewCard(combat, 'probe', combat.enemies[0].id);
    assert.ok(preview.faceRules, 'the preview carries its face baseline');
    const baseline = number(cardPlainText(registries, { cardId: 'core.cantrip' }, { rules: preview.faceRules }));
    assert.equal(baseline, number(face(run, 'core.cantrip')), `${classId} Arcane Spark hand baseline`);
  }
});
