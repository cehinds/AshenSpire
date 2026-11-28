// ScalePhysicalDamage cuts only the physical share of a hit. Owner ruling 2026-11-28: physicalDamageMultiplier and
// blockGainMultiplier read as 1 in every profile, so a profile saved with 0.7 and 0.49 plays 1:1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';
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
// The cuts a profile saved before the 1:1 ruling may carry.
const SAVED_PHYSICAL_SCALE = 0.7;
const SAVED_BLOCK_SCALE = 0.49;
const SHIPPED_SCALE = 1;
const cut = variant({
  physicalDamageMultiplier: SAVED_PHYSICAL_SCALE,
  blockGainMultiplier: SAVED_BLOCK_SCALE,
});
const flat = variant({ physicalDamageMultiplier: 1 });

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

test('Core sets physicalDamageMultiplier and blockGainMultiplier to 1; the module default is 1', () => {
  assert.equal(shipped.modules.effects.physicalDamageMultiplier, SHIPPED_SCALE);
  assert.equal(shipped.modules.effects.blockGainMultiplier, SHIPPED_SCALE);
  assert.equal(shipped.modules.effects.playerDamageMultiplier, SHIPPED_SCALE);
  assert.equal(shipped.modules.effects.enemyDamageMultiplier, SHIPPED_SCALE);
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

test('a player physical hit under a saved physical cut takes no physical stage; preview, receipt and HP loss agree', () => {
  const a = playCard(cut, 'core.strike');
  const b = playCard(flat, 'core.strike');
  assert.equal(physRow(a.hit), undefined, 'the saved cut reads as 1');
  assert.equal(physRow(b.hit), undefined, 'a neutral profile has no physical stage');
  assert.ok(a.hpLoss > 0);
  assert.equal(a.hpLoss, b.hpLoss);
  assert.equal(a.preview.values.find(v => v.op === 'damage').value, a.hpLoss, 'preview == played');
  assert.equal(a.hit.incoming, a.hpLoss);
});

test('a saved physical cut leaves a mixed Arcane spell and a pure fire spell at their 1:1 damage', () => {
  const spark = playCard(cut, 'core.cantrip', 'starseer');
  const sparkFlat = playCard(flat, 'core.cantrip', 'starseer');
  assert.equal(physRow(spark.hit), undefined, 'no physical stage on the mixed spell');
  assert.ok(spark.hpLoss > 0);
  assert.equal(spark.hpLoss, sparkFlat.hpLoss);
  const fire = playCard(cut, 'core.cinderDart', 'starseer'), fireFlat = playCard(flat, 'core.cinderDart', 'starseer');
  assert.ok(fire.hpLoss > 0);
  assert.equal(physRow(fire.hit), undefined, 'a pure magic hit has no physical stage');
  assert.equal(fire.hpLoss, fireFlat.hpLoss, 'and its damage is unchanged');
});

test('an enemy physical hit under a saved physical cut takes no physical stage either', () => {
  const enemyHit = world => {
    const { combat } = begin(world);
    const mark = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    return hits(combat, mark).find(({ event }) => event.sourceId === combat.enemies[0].id)?.hit;
  };
  const a = enemyHit(cut);
  const b = enemyHit(flat);
  assert.ok(a && b, 'the Slash lands');
  assert.equal(physRow(a), undefined);
  assert.equal(physRow(b), undefined);
  assert.equal(a.incoming, b.incoming);
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

test('Block gain is 1:1 under a saved Block factor, in the preview and in the play', () => {
  const a = playCard(cut, 'core.defend');
  const b = playCard(variant({ blockGainMultiplier: 1 }), 'core.defend');
  assert.ok(a.blockGain > 0);
  assert.equal(a.blockGain, b.blockGain, 'the saved 0.49 reads as 1');
  assert.equal(a.preview.values.find(v => v.op === 'block').value, a.blockGain, 'preview == played');
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

test('a static card face shows the 1:1 figure under a saved physical cut, for a physical card and a spell', () => {
  const faceOf = (world, cardId, classId) => {
    const run = createRunState({ registries: world.registries, classId, seed: 7, profileMeta: META });
    const def = world.registries.cards.get(cardId);
    return Number(/(\d+)/.exec(strip(cardFaceLines(def, undefined, world.registries, run).find(row => row.kind === 'damage').html))[1]);
  };
  const neutral = { playerDamageMultiplier: 1, baseDamageMultiplier: 1 };
  const plain = variant({ ...neutral, physicalDamageMultiplier: 1 }), halved = variant({ ...neutral, physicalDamageMultiplier: 0.5 });
  const run = createRunState({ registries: plain.registries, classId: 'reaver', seed: 7, profileMeta: META });
  const strength = gameProfileEffectiveAttributes(plain.registries, run).strength;
  const stored = plain.registries.cards.get('core.strike').effects.find(effect => effect.op === 'damage').amount;
  assert.equal(faceOf(plain, 'core.strike', 'reaver'), stored + strength);
  assert.equal(faceOf(halved, 'core.strike', 'reaver'), stored + strength, 'the saved cut reads as 1');
  for (const cardId of ['core.cinderDart', 'core.cantrip'])
  {
    assert.equal(faceOf(halved, cardId, 'starseer'), faceOf(plain, cardId, 'starseer'), cardId);
  }
});
