// Owner decisions 2026-10-12 ("on poise break yes"; "any break but
// vulnerable to any damage type"): under combat ratings EVERY enemy break is a
// full Stagger. Besides the skipped turn it runs balance.poise.onFill (the
// `staggered` status), so Executioner and every other rider gated on
// Staggered fires: Poise or Ward in two-meter fights, physical or magical on
// the single break meter, where a spell break no longer adds magicVulnerable.
// With ratings off nothing changes (SPEC §4.4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { applyRatingImpact } from '../src/engine/combatRatings.js';
import { dealPoiseDamage, executeAction } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';
import { getStacks } from '../src/engine/statuses.js';

const insanityCard = { id: 'tInsanityBreakR', name: 'T Insanity', class: 'colorless', rarity: 'special', cost: 0, type: 'skill',
  keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 30 }], textTemplate: 'Apply {insanity} Insanity.' };
const registries = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, insanityCard],
  tagging: [...contentBundle.tagging, ...['classification.skill', 'camp:physical', 'maneuver:defend']
    .map((tagId) => ({ family: 'card', scope: '', objectId: insanityCard.id, tagId }))] });
const onFillStacks = registries.balance.poise.onFill.find((e) => e.status === 'staggered').stacks;
const physical = { cardId: 'strike', type: 'attack', damageSchool: 'physical' };
const magical = { cardId: 'strike', type: 'attack', damageSchool: 'magic' };

function fight({ ratings = true, cards = ['strike', 'executioner'], breakMeterVersion = null } = {}) {
  return createCombat({ registries, rng: createRng(50), enemyIds: ['wanderingSoldier'], breakMeterVersion,
    ratingsRules: ratings ? resolveCombatRatings({}, contentBundle) : null,
    player: { classId: 'reaver', maxHp: 1000, hp: 1000, maxMana: 99, mana: 99, energyMax: 10, drawPerTurn: 5,
      attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 },
      deck: cards.map((cardId, i) => ({ instanceId: 'c' + i, cardId })), relicIds: [] } });
}
const lastHit = (c, id) => c.eventLog.filter((e) => e.type === 'damageDealt' && e.targetId === id && e.sourceId !== id)
  .map((e) => e.amount).pop();
const drain = (c) => { while (c.queue.length) executeAction(c, c.queue.shift()); };
const queuedStaggered = (c) => c.queue.filter((a) => a.effect?.op === 'applyStatus' && a.effect.status === 'staggered').length;

// Strike, then Executioner. `fragile` sets the enemy's Poise meter to break on the Strike.
function strikeThenExecute(fragile) {
  const c = fight();
  const enemy = c.enemies[0];
  enemy.poiseMeter = { value: 0, max: fragile ? 1 : 100000, growths: 0 };
  dispatch(c, { type: 'playCard', cardInstanceId: 'c0', targetId: enemy.id });
  const state = { skip: !!enemy.skipNextTurn, staggered: getStacks(enemy, 'staggered') };
  dispatch(c, { type: 'playCard', cardInstanceId: 'c1', targetId: enemy.id });
  return { ...state, hit: lastHit(c, enemy.id) };
}

test('ratings: a Poise meter break applies Staggered, so Executioner deals its Staggered damage', () => {
  const clean = strikeThenExecute(false);
  const broken = strikeThenExecute(true);
  assert.equal(clean.staggered, 0);
  assert.ok(broken.skip, 'the break still skips the enemy\'s next turn');
  assert.equal(broken.staggered, onFillStacks, 'the Poise break applies balance.poise.onFill');
  assert.ok(broken.hit > clean.hit * 2, `Staggered rider fired (${clean.hit} -> ${broken.hit})`);
});

test('ratings: onFill runs once per impact, however many thresholds it crosses', () => {
  const c = fight();
  const enemy = c.enemies[0];
  enemy.poiseMeter = { value: 0, max: 1, growths: 0 };
  applyRatingImpact(c, c.player, enemy, physical, 10);
  assert.ok(enemy.poiseMeter.growths > 1, 'the impact crossed more than one threshold');
  assert.equal(queuedStaggered(c), 1);
});

test('ratings, two meters: a Ward break skips the turn and applies Staggered', () => {
  const c = fight();
  const enemy = c.enemies[0];
  assert.ok(enemy.wardMeter, 'two-meter fight has a Ward meter');
  enemy.wardMeter = { value: 0, max: 1, growths: 0 };
  applyRatingImpact(c, c.player, enemy, magical, 5);
  assert.ok(enemy.skipNextTurn);
  assert.equal(queuedStaggered(c), 1);
  drain(c);
  assert.equal(getStacks(enemy, 'staggered'), onFillStacks);
});

test('ratings, single break meter: a physical break applies Staggered', () => {
  const c = fight({ breakMeterVersion: 1 });
  const enemy = c.enemies[0];
  assert.equal(enemy.wardMeter, undefined, 'single-meter fight has no Ward meter');
  enemy.poiseMeter = { value: 0, max: 1, growths: 0 };
  applyRatingImpact(c, c.player, enemy, physical, 5);
  assert.ok(enemy.skipNextTurn);
  assert.equal(queuedStaggered(c), 1);
  drain(c);
  assert.equal(getStacks(enemy, 'staggered'), onFillStacks);
});

test('ratings, single break meter: a spell break applies Staggered and no magicVulnerable', () => {
  const c = fight({ breakMeterVersion: 1 });
  const enemy = c.enemies[0];
  enemy.poiseMeter = { value: 0, max: 1, growths: 0 };
  applyRatingImpact(c, c.player, enemy, magical, 5);
  assert.ok(enemy.skipNextTurn);
  assert.equal(c.eventLog.filter((e) => e.type === 'arcaneStagger').length, 1, 'the arcaneStagger event still fires');
  assert.equal(queuedStaggered(c), 1);
  drain(c);
  assert.equal(getStacks(enemy, 'staggered'), onFillStacks);
  assert.equal(getStacks(enemy, 'magicVulnerable'), 0);
});

test('ratings: a player Poise break applies no enemy onFill', () => {
  const c = fight();
  c.player.poiseMeter = { value: 0, max: 1, growths: 0 };
  applyRatingImpact(c, c.enemies[0], c.player, physical, 5);
  assert.equal(queuedStaggered(c), 0);
  assert.equal(c.player.pendingActionLoss > 0, true);
});

test('ratings: an Insanity break applies Staggered', () => {
  const c = fight({ cards: ['tInsanityBreakR', 'executioner'] });
  const enemy = c.enemies[0];
  dispatch(c, { type: 'playCard', cardInstanceId: 'c0', targetId: enemy.id });
  assert.ok(enemy.skipNextTurn, 'the proc skips the enemy\'s next turn');
  assert.equal(getStacks(enemy, 'staggered'), onFillStacks);
});

test('ratings off: a filled Poise bar still applies Staggered, unchanged', () => {
  const c = fight({ ratings: false });
  const enemy = c.enemies[0];
  enemy.poiseMeter = { value: 0, max: 1, growths: 0 };
  dealPoiseDamage(c, enemy, 1);
  assert.ok(enemy.skipNextTurn);
  assert.equal(queuedStaggered(c), 1);
});
