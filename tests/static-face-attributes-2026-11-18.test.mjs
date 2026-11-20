// Owner, 2026-11-18: a card face outside combat (deck editor, rewards, shop, upgrade picker) carries the run character's always-on attribute bonus,
// so it reads the number a neutral-stance hit makes: physical damage adds STR, Block adds DEX, magic damage adds max(INT, WIS), then the same
// multipliers as combat (base x0.5, physical x0.7, side x0.7, Block x0.49, min 1). No stance, status or enemy defence is in it (those show in combat).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
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

test('a face with no run keeps the authored number', () => {
  assert.equal(number(cardPlainText(registries, { cardId: 'core.strike' }, {})), 6);
  assert.equal(number(cardPlainText(registries, { cardId: 'core.defend' }, {})), 8); // Block-per-card retune, owner 2026-11-20 (was 10)
});

test('Strike and Defend add STR and DEX through the shipped multipliers', () => {
  for (const classId of ['reaver', 'rogue']) {
    const run = newRun(classId);
    const attributes = gameProfileEffectiveAttributes(registries, run);
    const strike = Math.floor((Math.ceil(6 * effects.baseDamageMultiplier) + attributes.strength * effects.strengthDamageWeight)
      * effects.physicalDamageMultiplier * effects.playerDamageMultiplier);
    const armourBlock = classId === 'reaver' ? 3 : 1; // Heavy +3, Light +1 on Block cards.
    const defend = Math.floor((8 + armourBlock + attributes.dexterity * effects.dexterityBlockWeight) * effects.blockGainMultiplier);
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
    assert.ok(attributed, 'the receipt names the STR stage');
    const withoutStance = Math.floor(attributed.effective * effects.physicalDamageMultiplier * effects.playerDamageMultiplier);
    assert.equal(number(face(run, 'core.strike')), withoutStance, `${classId}: the static face is the receipt's STR stage through the cuts, without the stance stages`);
  }
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
    const expected = Math.floor((attributed.effective - physical + physical * effects.physicalDamageMultiplier) * effects.playerDamageMultiplier);
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
