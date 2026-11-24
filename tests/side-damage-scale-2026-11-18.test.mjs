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
import { dispatch, previewCard } from '../src/engine/combat.js';
import { computeBlockGain } from '../src/engine/actions.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { playingCardDefinition } from '../src/model/playingCard.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const shipped = Profile.resolveGameProfile('default');
// The soldier opens with its Slash, so the enemy side has a hit to price.
const bundle = { ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, firstMove: 'slash' } : enemy) };
const KEYS = ['playerDamageMultiplier', 'enemyDamageMultiplier', 'blockGainMultiplier', 'spellPoiseDamageMultiplier', 'physicalDamageMultiplier'];
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
  assert.equal(effects.blockGainMultiplier, 0.49, 'owner, 2026-11-18: 0.7, then another 0.7 for the playtest');
  assert.equal(effects.physicalDamageMultiplier, 0.7);
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
  // A neutral profile pins the physical cut to 1 too, so the shipped hit carries the side scale and the physical x0.7 (owner, 2026-11-18): x0.49.
  assert.ok(scaled.incoming >= Math.floor(plain.incoming * 0.49) && scaled.incoming <= Math.floor((plain.incoming + 1) * 0.49), `${plain.incoming} -> ${scaled.incoming}`);
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
  assert.ok(scaled < plain && scaled >= Math.floor(plain * 0.49) && scaled <= Math.floor((plain + 1) * 0.49), `${plain} -> ${scaled}`);
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
  assert.equal(doubled.poiseLost, single.poiseLost * 2, 'the pool loses exactly twice the net Poise the hit took');
  assert.equal(doubled.hp, single.hp, 'HP is unchanged by the Poise multiplier');
  assert.equal(doubled.taken, doubled.poiseLost, 'the damage receipt the log and inspector read shows the doubled Poise');
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
  // Owner, 2026-11-18 (static faces): the run's always-on STR (5 for a new Reaver) joins the halved base before the cuts.
  assert.equal(line(strike), '3 damage', 'ceil(6 x 0.5) = 3, + STR 5, then floor(8 x 0.7 x 0.7) = 3 (physical cut, then side scale)');
  const ranked = playingCardDefinition(shippedWorld.registries, { cardId: 'core.strike', rank: 2 }, { rules: run });
  assert.equal(line(ranked), '4 damage', 'rank 2: ceil(7 x 0.5) = 4, + STR 5, floor(9 x 0.7 x 0.7) = 4');
});

test('a spell\'s Block and Ward split takes blockGainMultiplier too, and the preview quotes the played total', () => {
  const quote = world => {
    const combat = begin(world, { classId: 'starseer' });
    combat.piles.hand.push({ instanceId: 'ward', cardId: 'core.wardingGlance' });
    const row = previewCard(combat, 'ward').values.find(value => value.op === 'block');
    return { value: row.value, combat };
  };
  const scaled = quote(shippedWorld), plain = quote(variant(NEUTRAL));
  assert.ok(plain.value >= 2);
  assert.ok(scaled.value < plain.value && scaled.value >= Math.floor(plain.value * 0.49) && scaled.value <= Math.floor((plain.value + 1) * 0.49), `${plain.value} -> ${scaled.value}`);
  const { combat } = scaled;
  const had = (combat.player.block || 0) + (combat.player.persistentWard?.value || 0);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'ward' });
  const now = (combat.player.block || 0) + (combat.player.persistentWard?.value || 0);
  assert.equal(now - had, scaled.value, 'the quote equals the Block and Ward the card gave');
});

test('an explicit spell poiseDamage effect: the preview quote equals the Poise the play removes, at the x2 factor', () => {
  const run = (world) => {
    const combat = begin(world, { classId: 'starseer' });
    const enemy = combat.enemies[0];
    enemy.persistentPoise = { value: 40, max: 40 };
    combat.piles.hand.push({ instanceId: 'grasp', cardId: 'core.shockingGrasp' });
    const row = previewCard(combat, 'grasp', enemy.id).values.find(value => value.op === 'poiseDamage');
    dispatch(combat, { type: 'playCard', cardInstanceId: 'grasp', targetId: enemy.id });
    const spent = combat.eventLog.filter(e => e.type === 'persistentPoiseChanged' && e.source === 'poiseDamage').reduce((n, e) => n + e.spent, 0);
    return { quoted: row?.perTargetPoise?.[enemy.id]?.removed ?? row?.perTargetPoise?.removed, spent };
  };
  const doubled = run(shippedWorld), single = run(variant({ spellPoiseDamageMultiplier: 1 }));
  assert.ok(single.spent > 0, 'the spell has an explicit Poise effect');
  assert.equal(doubled.spent, single.spent * 2);
  assert.equal(doubled.quoted, doubled.spent, 'the preview quote is what the play removed');
});

test('spell Poise x2 doubles the completed net loss: a fire spell\'s ignored Poise and a Defend target\'s spared share', async () => {
  const { previewCard: preview } = await import('../src/engine/combat.js');
  const loss = (world, setup) => {
    const combat = begin(world, { classId: 'starseer' });
    const enemy = combat.enemies[0];
    Object.assign(enemy, { hp: 500, maxHp: 500 });
    enemy.persistentPoise = { value: 100, max: 100 };
    setup?.(enemy);
    combat.piles.hand.push({ instanceId: 'sp', cardId: setup?.card || 'core.cantrip' });
    const row = preview(combat, 'sp', enemy.id).values.find(value => value.op === 'damage');
    dispatch(combat, { type: 'playCard', cardInstanceId: 'sp', targetId: enemy.id });
    const pool = combat.enemies[0].persistentPoise;
    const live = pool.max === 100 ? 100 - pool.value : pool.missing || 0; // a Poise change may re-derive the pool's max from ratings, which records the loss as `missing`
    return { live, quoted: row?.perTargetPoise?.[enemy.id]?.removed ?? row?.perTargetPoise?.removed };
  };
  const fire = enemy => { enemy.__fire = true; };
  fire.card = 'core.cinderDart';
  const defend = enemy => { enemy.block = 2; enemy.combatStance = { id: 'defend', maneuver: 'defend', camp: 'physical' }; };
  for (const setup of [fire, defend]) {
    const one = loss(variant({ spellPoiseDamageMultiplier: 1 }), setup), two = loss(shippedWorld, setup);
    assert.ok(one.live > 0, 'the spell costs Poise');
    assert.equal(two.live, one.live * 2, 'exactly twice the m=1 net loss');
    if (two.quoted !== undefined) assert.equal(two.quoted, two.live, 'preview equals play');
  }
});

test('a Defend target holding Block and Ward keeps its Poise floor against the spell Poise extra, whether or not the base hit reached it', async () => {
  const { profileDamageReceipt } = await import('../src/engine/gameProfileCombat.js');
  const FORCE = { combatProfile: { camp: 'spell', school: 'force', damageType: 'arcane', magicShare: 1 }, tags: ['school:force'], magicShare: 1 };
  const receipt = world => {
    const combat = begin(world, { classId: 'starseer' });
    const enemy = combat.enemies[0];
    Object.assign(enemy, { hp: 500, maxHp: 500, block: 1, statuses: { ward: { stacks: 1 } }, persistentPoise: { value: 16, max: 16 } });
    enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
    return profileDamageReceipt(combat, combat.player, enemy, 20, { ...FORCE, skipRatingBonus: true }, { roll: 0 });
  };
  for (const [name, world] of [['x2', shippedWorld], ['x1', variant({ spellPoiseDamageMultiplier: 1 })]]) {
    const r = receipt(world);
    const lost = (r.poiseMitigated || 0) + (r.poiseDrain || 0) - (r.poiseSpared || 0);
    assert.ok(16 - lost >= 1, `${name}: at least the Defend floor of 1 Poise is left (lost ${lost})`);
  }
  // The preview prices through the same receipt, so the quote cannot drain past the floor either.
  const combat = begin(shippedWorld, { classId: 'starseer' });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 1, statuses: { ward: { stacks: 1 } }, persistentPoise: { value: 16, max: 16 } });
  enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  combat.piles.hand.push({ instanceId: 'cleave', cardId: 'core.cantrip' });
  const quoted = previewCard(combat, 'cleave', enemy.id).values.find(value => value.op === 'damage')?.perTargetPoise?.[enemy.id]?.removed;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cleave', targetId: enemy.id });
  const pool = combat.enemies[0].persistentPoise;
  assert.ok(pool.value >= 1, 'the played spell left the floor');
  if (quoted !== undefined) assert.ok(16 - quoted >= 1, 'and so did its quote');
});

test('cantrip into a Defend target with Block and Ward: x2 leaves the same Poise floor as x1, and the quote equals the play', () => {
  const cast = (world, value) => {
    const combat = begin(world, { classId: 'starseer' });
    const enemy = combat.enemies[0];
    Object.assign(enemy, { hp: 500, maxHp: 500, block: 2, statuses: { ...(enemy.statuses || {}), ward: { stacks: 1 } } });
    enemy.persistentPoise = { value, max: value };
    enemy.combatStance = { id: 'defend', maneuver: 'defend', camp: 'physical' };
    combat.piles.hand.push({ instanceId: 'sp', cardId: 'core.cantrip' });
    const quoted = previewCard(combat, 'sp', enemy.id).values.find(v => v.op === 'damage')?.perTargetPoise?.[enemy.id]?.removed;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'sp', targetId: enemy.id });
    return { left: combat.enemies[0].persistentPoise.value, quoted };
  };
  for (const pool of [10, 5]) {
    const one = cast(variant({ spellPoiseDamageMultiplier: 1 }), pool), two = cast(shippedWorld, pool);
    assert.ok(one.left >= 1, `pool ${pool}: the Defend floor holds at x1`);
    assert.ok(two.left >= 1, `pool ${pool}: and at x2 (left ${two.left})`);
    assert.ok(two.left <= one.left, `pool ${pool}: x2 never leaves more than x1`);
    if (two.quoted !== undefined) assert.equal(pool - two.quoted, two.left, `pool ${pool}: the quote equals the play`);
  }
});
