// Owner, 2026-11-18: physical damage drops another x0.7 for both sides (`effects.physicalDamageMultiplier`), on top of the side scale,
// and Core Block gain is 0.49. Only the physical share of a hit takes it; every number here is measured in the engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { ScalePhysicalDamage } from '../src/model/combatCardProfile.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const shipped = Profile.resolveGameProfile('default');
const bundle = { ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, firstMove: 'slash' } : enemy) };
function variant(overrides = {}) {
  const profile = structuredClone(shipped);
  Object.assign(profile.modules.effects, overrides);
  delete profile.hash;
  profile.hash = gameDigest(profile);
  return { profile, registries: Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(bundle, profile)), profile) };
}
const META = { gameProfileUnlocks: { [shipped.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const cut = variant(), flat = variant({ physicalDamageMultiplier: 1 });

function begin(world, { classId = 'reaver', seed = 31 } = {}) {
  const run = createRunState({ registries: world.registries, classId, seed, profileMeta: META });
  run.relics = [];
  const combat = createRunCombat({ registries: world.registries, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  primeAccuracyRolls(combat, { count: 2 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const enemy = combat.enemies[0];
  enemy.actorIntentRevealed = true; enemy.weaknesses = []; enemy.hp = enemy.maxHp = 5000; enemy.block = 0;
  enemy.ratings = { ...enemy.ratings, poise: 0 }; enemy.persistentPoise = { value: 0, max: 0 };
  Object.assign(combat.player, { stamina: 10, maxStamina: 10, mana: 10, maxMana: 10 });
  return { combat, run, enemy };
}
const hits = (combat, from = 0) => combat.eventLog.slice(from).filter(event => event.type === 'damageDealt').flatMap(event => (event.damageReceipt?.hits || []).map(hit => ({ event, hit })));
const physRow = hit => hit?.sources.find(row => row.id === 'physical-damage-scale');
const strip = html => String(html).replace(/<[^>]+>/g, '');
function playCard(world, cardId, classId = 'reaver') {
  const { combat, enemy } = begin(world, { classId });
  combat.piles.hand.push({ instanceId: 'probe', cardId });
  const preview = previewCard(combat, 'probe', enemy.id);
  const hp0 = enemy.hp, block0 = combat.player.block || 0, mark = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'probe', ...(preview.needsTarget ? { targetId: enemy.id } : {}) });
  return { combat, enemy, preview, hpLoss: hp0 - enemy.hp, blockGain: (combat.player.block || 0) - block0, hit: hits(combat, mark).find(({ event }) => event.sourceId === 'player')?.hit };
}

test('Core sets physicalDamageMultiplier 0.7 and blockGainMultiplier 0.49; the module default is 1', () => {
  assert.equal(shipped.modules.effects.physicalDamageMultiplier, 0.7);
  assert.equal(shipped.modules.effects.blockGainMultiplier, 0.49);
  assert.equal(shipped.modules.effects.playerDamageMultiplier, 0.7);
  assert.equal(shipped.modules.effects.enemyDamageMultiplier, 0.7);
  const defaults = JSON.parse(readFileSync(new URL('../engine/modules/effects/defaults.json', import.meta.url), 'utf8'));
  assert.equal(defaults.physicalDamageMultiplier, 1);
});

test('ScalePhysicalDamage cuts only the physical fraction and never rounds a positive physical part to 0', () => {
  assert.equal(ScalePhysicalDamage(10, 1, 0.7), 7);
  assert.equal(ScalePhysicalDamage(10, 0, 0.7), 10, 'a pure magic hit is untouched');
  assert.equal(ScalePhysicalDamage(10, 0.5, 0.5), 7.5, 'half physical: 5 + 5 x 0.5');
  assert.equal(ScalePhysicalDamage(10, 1, 1), 10);
  assert.ok(ScalePhysicalDamage(1, 1, 0.1) >= 1, 'min 1 for a positive physical part');
  assert.equal(ScalePhysicalDamage(10, 1, 0), 0, 'a 0 multiplier removes the physical part');
});

test('a player physical hit takes the physical stage, and the preview, the receipt and the HP loss agree', () => {
  const a = playCard(cut, 'core.strike'), b = playCard(flat, 'core.strike');
  assert.equal(physRow(a.hit)?.multiplier, 0.7);
  assert.equal(physRow(b.hit), undefined, 'a neutral profile has no physical stage');
  assert.ok(a.hpLoss > 0 && a.hpLoss < b.hpLoss, `${b.hpLoss} -> ${a.hpLoss}`);
  assert.equal(a.preview.values.find(v => v.op === 'damage').value, a.hpLoss, 'preview == played');
  assert.equal(a.hit.incoming, a.hpLoss);
});

test('only the physical share is cut: Arcane Spark is half physical in Core, a fire spell is pure magic', () => {
  const spark = playCard(cut, 'core.cantrip', 'starseer');
  const row = physRow(spark.hit);
  assert.ok(row, 'Arcane Spark carries a physical part in the receipt split');
  assert.ok(row.effective > Math.floor(row.requested * 0.7), `${row.requested} -> ${row.effective}: the magic share is not cut`);
  assert.ok(row.effective < row.requested);
  const fire = playCard(cut, 'core.cinderDart', 'starseer'), fireFlat = playCard(flat, 'core.cinderDart', 'starseer');
  assert.ok(fire.hpLoss > 0);
  assert.equal(physRow(fire.hit), undefined, 'a pure magic hit has no physical stage');
  assert.equal(fire.hpLoss, fireFlat.hpLoss, 'and its damage is unchanged');
});

test('an enemy physical hit takes the physical stage too', () => {
  const enemyHit = world => {
    const { combat } = begin(world);
    const mark = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    return hits(combat, mark).find(({ event }) => event.sourceId === combat.enemies[0].id)?.hit;
  };
  const a = enemyHit(cut), b = enemyHit(flat);
  assert.ok(a && b, 'the Slash lands');
  assert.equal(physRow(a)?.multiplier, 0.7);
  assert.equal(physRow(b), undefined);
  assert.ok(a.incoming < b.incoming, `${b.incoming} -> ${a.incoming}`);
});

test('a Counter return is final damage: no physical stage', () => {
  const { combat } = begin(cut);
  combat.piles.hand.push({ instanceId: 'c', cardId: 'core.counter' });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c' });
  const mark = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const trigger = combat.eventLog.slice(mark).find(event => event.type === 'combatCounterTriggered');
  assert.ok(trigger, 'the Counter answers the Slash');
  const ret = hits(combat, mark).find(({ event }) => event.sourceId === 'player' && event.targetId === trigger.targetId)?.hit;
  assert.equal(physRow(ret), undefined);
  assert.equal(ret.incoming, trigger.amount);
});

test('Block gain takes the 0.49 Core factor in the preview and in the play', () => {
  const a = playCard(cut, 'core.defend'), b = playCard(variant({ blockGainMultiplier: 1 }), 'core.defend');
  assert.ok(a.blockGain > 0 && a.blockGain < b.blockGain);
  assert.equal(a.preview.values.find(v => v.op === 'block').value, a.blockGain, 'preview == played');
  const seven = playCard(variant({ blockGainMultiplier: 0.7 }), 'core.defend');
  assert.ok(a.blockGain < seven.blockGain, 'the 0.49 factor gives less than the earlier 0.7');
});

test('the in-combat hand face shows the number the card deals and gains', () => {
  for (const [cardId, kind, classId] of [['core.strike', 'damage', 'reaver'], ['core.defend', 'block', 'reaver'], ['core.cantrip', 'damage', 'starseer']]) {
    const played = playCard(cut, cardId, classId);
    const def = played.preview.resolvedDefinition || cut.registries.cards.get(cardId);
    const text = cardFaceLines(def, played.preview, cut.registries, played.combat).map(row => strip(row.html)).join(' ');
    const amount = kind === 'damage' ? played.hpLoss : played.blockGain;
    assert.ok(amount > 0, cardId);
    assert.ok(new RegExp(`\\b${amount}\\b`).test(text), `${cardId}: the face "${text}" shows the played ${amount}`);
  }
});

test('a static card face applies the physical cut to a physical damage figure, and not to a spell', () => {
  const faceOf = (world, cardId, classId) => {
    const run = createRunState({ registries: world.registries, classId, seed: 7, profileMeta: META });
    const def = world.registries.cards.get(cardId);
    return Number(/(\d+)/.exec(strip(cardFaceLines(def, undefined, world.registries, run).find(row => row.kind === 'damage').html))[1]);
  };
  const neutral = { playerDamageMultiplier: 1, baseDamageMultiplier: 1 };
  const plain = variant({ ...neutral, physicalDamageMultiplier: 1 }), halved = variant({ ...neutral, physicalDamageMultiplier: 0.5 });
  // Owner, 2026-11-18 (static faces): a face outside combat adds the run's STR first (a new Reaver's effective STR is 5), then the cut.
  assert.equal(faceOf(plain, 'core.strike', 'reaver'), 6 + 5);
  assert.equal(faceOf(halved, 'core.strike', 'reaver'), Math.floor((6 + 5) * 0.5), 'floor((6 + STR) x 0.5)');
  assert.equal(faceOf(halved, 'core.cantrip', 'starseer'), faceOf(plain, 'core.cantrip', 'starseer'), 'a spell face is untouched');
});
