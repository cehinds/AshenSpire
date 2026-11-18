// Owner, 2026-11-18: Core damage, Block and enemy HP are cut 30%, and a player's spells take twice the Poise.
// Each setting is checked against the shipped default profile and against the same profile with that one setting at 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { computeBlockGain } from '../src/engine/actions.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { playingCardDefinition } from '../src/model/playingCard.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const shipped = Profile.resolveGameProfile('default');
// The soldier opens with its Slash, so the enemy side has a hit to price.
const bundle = { ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, firstMove: 'slash' } : enemy) };
const KEYS = ['playerDamageMultiplier', 'enemyDamageMultiplier', 'blockGainMultiplier', 'spellPoiseDamageMultiplier'];
/** The shipped profile with `effects` settings overridden (a re-hashed snapshot), bound into registries. */
function variant(overrides = {}) {
  const profile = structuredClone(shipped);
  Object.assign(profile.modules.effects, overrides);
  delete profile.hash;
  profile.hash = gameDigest(profile);
  return { profile, registries: Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(bundle, profile)), profile) };
}
const META = { gameProfileUnlocks: { [shipped.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const NEUTRAL = Object.fromEntries(KEYS.map(key => [key, 1]));
const shippedWorld = variant();

function begin(world, { classId = 'reaver', enemyId = 'wanderingSoldier', seed = 31 } = {}) {
  const run = createRunState({ registries: world.registries, classId, seed, profileMeta: META });
  const combat = createRunCombat({ registries: world.registries, run, rng: createRng(seed), enemyIds: [enemyId] });
  primeAccuracyRolls(combat, { count: 2 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  combat.enemies[0].actorIntentRevealed = true;
  return combat;
}
const hits = (combat, from = 0) => combat.eventLog.slice(from).filter(event => event.type === 'damageDealt').flatMap(event => (event.damageReceipt?.hits || []).map(hit => ({ event, hit })));
const scaleRow = hit => hit.sources.find(row => row.id === 'side-damage-scale');

test('the shipped Core sets the four new effects settings and the module default is 1', async () => {
  const effects = shipped.modules.effects;
  assert.equal(effects.playerDamageMultiplier, 0.7);
  assert.equal(effects.enemyDamageMultiplier, 0.7);
  assert.equal(effects.blockGainMultiplier, 0.7);
  assert.equal(effects.spellPoiseDamageMultiplier, 2);
  const defaults = JSON.parse((await import('node:fs')).readFileSync(new URL('../engine/modules/effects/defaults.json', import.meta.url), 'utf8'));
  for (const key of KEYS) assert.equal(defaults[key], 1, `${key} defaults to 1`);
});

test('enemy HP per tier is 70% of the earlier scale', () => {
  assert.deepEqual(shipped.modules.enemies.hpScaleByTier, { minion: 0.385, elite: 0.42, boss: 0.455 });
  const world = shippedWorld, old = variant();
  old.profile.modules.enemies.hpScaleByTier = { minion: 0.55, elite: 0.6, boss: 0.65 };
  const enemy = begin(world).enemies[0];
  assert.ok(enemy.maxHp >= 1);
  const def = world.registries.enemies.get('wanderingSoldier');
  assert.ok(enemy.maxHp <= Math.round(def.hp[1] * 0.385), `HP ${enemy.maxHp} is within the 0.385 minion scale`);
});

test('a player hit takes the player side scale as one receipt stage', () => {
  const play = world => {
    const combat = begin(world);
    combat.piles.hand.push({ instanceId: 'probe', cardId: 'core.strike' });
    const mark = combat.eventLog.length;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'probe', targetId: combat.enemies[0].id });
    return hits(combat, mark).find(({ event }) => event.sourceId === 'player')?.hit;
  };
  const scaled = play(shippedWorld), plain = play(variant(NEUTRAL));
  assert.ok(plain && scaled);
  assert.equal(scaleRow(plain), undefined, 'a neutral profile has no side stage');
  assert.equal(scaleRow(scaled)?.multiplier, 0.7);
  assert.ok(plain.incoming > 1 && scaled.incoming < plain.incoming);
  assert.ok(scaled.incoming >= Math.floor(plain.incoming * 0.7) && scaled.incoming <= Math.floor((plain.incoming + 1) * 0.7), `${plain.incoming} -> ${scaled.incoming}`);
});

test('an enemy hit takes the enemy side scale and a Counter return is not scaled again', () => {
  const enemyHit = world => {
    const combat = begin(world);
    const mark = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    return hits(combat, mark).find(({ event }) => event.sourceId === combat.enemies[0].id)?.hit;
  };
  const scaled = enemyHit(shippedWorld), plain = enemyHit(variant(NEUTRAL));
  assert.ok(plain && scaled, 'the enemy attacks');
  assert.equal(scaleRow(scaled)?.multiplier, 0.7);
  assert.equal(scaleRow(plain), undefined);
  assert.ok(scaled.incoming <= plain.incoming);
  // A Counter return is final damage: it carries no side stage, so the receipt's incoming equals the return the Counter announced.
  const combat = begin(shippedWorld);
  combat.piles.hand.push({ instanceId: 'c', cardId: 'core.counter' });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c' });
  const mark = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const trigger = combat.eventLog.slice(mark).find(event => event.type === 'combatCounterTriggered');
  assert.ok(trigger, 'the Counter answers the Slash');
  {
    const ret = hits(combat, mark).find(({ event }) => event.sourceId === 'player' && event.targetId === trigger.targetId)?.hit;
    assert.equal(scaleRow(ret), undefined, 'the return carries no side stage');
    assert.equal(ret.incoming, trigger.amount);
  }
});

test('Block gain takes blockGainMultiplier, floored, in computeBlockGain', () => {
  const gain = world => { const combat = begin(world); return computeBlockGain(combat, combat.player, 5); };
  const scaled = gain(shippedWorld), plain = gain(variant(NEUTRAL));
  assert.ok(plain >= 5);
  assert.ok(scaled < plain && scaled >= Math.floor(plain * 0.7) && scaled <= Math.floor((plain + 1) * 0.7), `${plain} -> ${scaled}`);
  assert.equal(gain(variant({ blockGainMultiplier: 0 })), 0);
});

test('a player spell takes spellPoiseDamageMultiplier times the Poise, HP unchanged', () => {
  const cast = world => {
    const combat = begin(world, { classId: 'starseer' });
    const enemy = combat.enemies[0];
    enemy.persistentPoise = { value: 40, max: 40 };
    combat.piles.hand.push({ instanceId: 'spell', cardId: 'core.cantrip' });
    dispatch(combat, { type: 'playCard', cardInstanceId: 'spell', targetId: enemy.id });
    const hit = hits(combat)[0].hit;
    return { poiseLost: 40 - enemy.persistentPoise.value, hp: enemy.maxHp - enemy.hp, taken: (hit.poiseReduced || 0) + (hit.poiseDamage || 0), drain: hit.poiseDamage || 0 };
  };
  const doubled = cast(shippedWorld), single = cast(variant({ spellPoiseDamageMultiplier: 1 }));
  assert.ok(single.taken > 0, 'the spell reaches Poise');
  assert.equal(doubled.drain, single.drain + single.taken, 'the hit drains as much Poise again as it took');
  assert.equal(doubled.poiseLost, single.poiseLost + single.taken, 'the pool loses the extra');
  assert.equal(doubled.hp, single.hp, 'HP is unchanged by the Poise multiplier');
  const strike = world => {
    const combat = begin(world);
    const enemy = combat.enemies[0];
    enemy.persistentPoise = { value: 40, max: 40 };
    combat.piles.hand.push({ instanceId: 'p', cardId: 'core.strike' });
    dispatch(combat, { type: 'playCard', cardInstanceId: 'p', targetId: enemy.id });
    return 40 - enemy.persistentPoise.value;
  };
  assert.equal(strike(shippedWorld), strike(variant({ spellPoiseDamageMultiplier: 1 })), 'a non-spell hit is not multiplied');
});

test('a static card face shows the player side scale', () => {
  const run = createRunState({ registries: shippedWorld.registries, classId: 'reaver', seed: 7, profileMeta: META });
  const strike = shippedWorld.registries.cards.get('core.strike');
  const line = def => cardFaceLines(def, undefined, shippedWorld.registries, run).find(row => row.kind === 'damage').html.replace(/<[^>]+>/g, '');
  assert.equal(line(strike), '2 damage', 'ceil(6 x 0.5) = 3, then floor(3 x 0.7) = 2');
  const ranked = playingCardDefinition(shippedWorld.registries, { cardId: 'core.strike', rank: 2 }, { rules: run });
  assert.equal(line(ranked), '2 damage', 'rank 2: ceil(7 x 0.5) = 4, floor(4 x 0.7) = 2');
});
