// Reaction rules version 2: Counterstrike scales a played card's effect amounts
// (docs/combat-card-traits-contract.md, "Counterstrike").
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { prepareTacticalCard } from '../src/engine/combatCardTactics.js';

// Variants of the basic `strike` (an Attack; authored effect damage 6 to the enemy).
// Each registry swaps the one card's fields; the id stays put so its classification rows resolve.
const strike = contentBundle.cards.find(card => card.id === 'strike');
const damage = amount => [{ op: 'damage', target: 'enemy', amount }];
function registryWith(fields) {
  return createRegistries({ ...contentBundle,
    cards: contentBundle.cards.map(card => card.id === 'strike' ? { ...card, ...fields } : card) });
}
const CS = { counterstrike: true };
const plain = createRegistries(contentBundle);
const counter = registryWith({ traitValues: CS });
const counterDraw = registryWith({ traitValues: CS, effects: [...damage(6), { op: 'draw', amount: 2 }] });
const counterOne = registryWith({ traitValues: CS, effects: damage(1) });
// Unscaled references: a card authored at the value Counterstrike should produce.
const authored = amount => registryWith({ effects: damage(amount) });

function play({ version = 2, stance = null, registries = counter } = {}) {
  const combat = createCombat({ registries, rng: createRng(913), combatExpansionVersion: 2, reactionRulesVersion: version,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 0,
      deck: [{ cardId: 'strike', instanceId: 'c0', upgraded: false }, ...[1, 2, 3, 4, 5].map(i => ({ cardId: 'strike', instanceId: `d${i}`, upgraded: false }))] } });
  const enemy = combat.enemies[0];
  enemy.hp = 100; enemy.maxHp = 100; enemy.block = 0;
  if (stance) enemy.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
  // Pin the hand to the played card so the draw count is measurable.
  combat.piles.hand = combat.piles.hand.filter(card => card.instanceId === 'c0');
  const handBefore = combat.piles.hand.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c0', targetId: enemy.id });
  const dealt = combat.eventLog.find(event => event.type === 'damageDealt');
  return { combat, enemy, lost: 100 - enemy.hp, dealt: dealt?.amount, handBefore, handAfter: combat.piles.hand.length };
}

// Expected values are checked against unscaled cards authored at the Counterstrike
// amount, so the card rating and stance multiplier are applied exactly as the engine
// applies them to any Attack. The literal numbers are worked out in the comments.

test('an unbeaten Counterstrike attack deals what a 9-damage Attack deals against Defend', () => {
  // Defend is not in Attack's advantage row, so pct = 50%: 6 + floor(6 × 0.5) = 9.
  // Attack vs Defend has no stance multiplier. The card rating adds ceil(9 / 4) = 3 on the
  // scaled amount (the same as an authored 9), so 9 + 3 = 12 total.
  const scaled = play({ stance: 'defend' });
  assert.equal(scaled.dealt, 12);
  assert.equal(scaled.dealt, play({ stance: 'defend', registries: authored(9), version: 2 }).dealt);
  const events = scaled.combat.eventLog.filter(event => event.type === 'combatCounterstrikeApplied');
  assert.equal(events.length, 1);
  assert.equal(events[0].pct, 0.5);
  assert.equal(events[0].advantaged, false);
});

test('Counterstrike retains its authored advantage without the removed Attack vs Smash multiplier', () => {
  // Attack beats Smash, so pct = 75%: 6 + floor(6 × 0.75) = 10 authored damage.
  // Rating on the scaled amount: ceil(10 / 4) = 3, so 13. Attack has no extra Smash multiplier.
  // It equals an unscaled 10-damage Attack against Smash.
  const scaled = play({ stance: 'smash' });
  assert.equal(scaled.dealt, 13);
  assert.equal(scaled.dealt, play({ stance: 'smash', registries: authored(10) }).dealt);
  const [event] = scaled.combat.eventLog.filter(entry => entry.type === 'combatCounterstrikeApplied');
  assert.equal(event.cardId, 'strike');
  assert.equal(event.pct, 0.75);
  assert.equal(event.advantaged, true);
});

test('the same attack without Counterstrike keeps its authored damage plus rating', () => {
  assert.equal(play({ stance: 'smash', registries: plain }).dealt, 8);
});

test('authored damage 1 becomes 2 under Counterstrike (1 + max(floor(0.5), 1))', () => {
  const scaled = play({ stance: 'defend', registries: counterOne });
  assert.equal(scaled.dealt, play({ stance: 'defend', registries: authored(2) }).dealt);
});

test('Counterstrike leaves the draw count unchanged', () => {
  const withDraw = play({ stance: 'defend', registries: counterDraw });
  // One card leaves the hand; the card's own draw 2 adds two. Counterstrike does not touch draw.
  assert.equal(withDraw.handAfter - withDraw.handBefore, 1);
  const unscaled = play({ stance: 'defend', registries: plain });
  assert.equal(unscaled.handAfter - unscaled.handBefore, -1);
});

test('reaction rules version 1 never scales the card', () => {
  const v1 = play({ version: 1, stance: 'defend' });
  assert.equal(v1.dealt, play({ version: 1, stance: 'defend', registries: plain }).dealt);
  assert.equal(v1.dealt, 8);
  assert.equal(v1.combat.eventLog.filter(event => event.type === 'combatCounterstrikeApplied').length, 0);
});

test('playing a Counterstrike card leaves its registry definition unchanged', () => {
  const before = JSON.stringify(counter.cards.get('strike'));
  play({ stance: 'smash' });
  assert.equal(JSON.stringify(counter.cards.get('strike')), before);
  assert.deepEqual(counter.cards.get('strike').effects, strike.effects);
});

// Counter cards: their own played effects (Block here) scale; their return payload does not
// go through this path. Checked on the prepared effect list, the same list the card executes.
test('a Counterstrike Counter scales its own Block: 6 → 9 against Defend, unscaled without the trait', () => {
  const counterCarrier = { cardId: 'guardCounter', traitValues: CS, combatProfile: { maneuver: 'counter' } };
  const prepare = (carrier, enemyStance) => {
    const combat = createCombat({ registries: plain, rng: createRng(913), combatExpansionVersion: 2, reactionRulesVersion: 2,
      enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 20, mana: 20,
        maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 0, deck: [] } });
    const enemy = combat.enemies[0];
    enemy.combatStance = { maneuver: enemyStance, camp: 'physical', range: 'melee' };
    const effects = [{ op: 'block', target: 'self', amount: 6 }];
    // arm: false keeps the Counter from arming, so only the played effects are prepared.
    return { combat, support: prepareTacticalCard(combat, combat.player, enemy, { ...carrier }, effects, {}, { arm: false }) };
  };
  const scaled = prepare(counterCarrier, 'defend');
  assert.equal(scaled.support.find(effect => effect.op === 'block').amount, 9);
  const event = scaled.combat.eventLog.find(entry => entry.type === 'combatCounterstrikeApplied');
  assert.equal(event.cardId, 'guardCounter');
  assert.equal(event.pct, 0.5);
  const untraited = prepare({ cardId: 'guardCounter', combatProfile: { maneuver: 'counter' } }, 'defend');
  assert.equal(untraited.support.find(effect => effect.op === 'block').amount, 6);
});

// A Counterstrike Counter played as a reaction from the stack: Counter beats Attack, and the
// attacking enemy's stance is its resolving Attack move, so pct = 75%.
test('a Counterstrike Counter played from the reaction stack vs an attacking enemy gets 75%', () => {
  const registries = createRegistries({ ...contentBundle,
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
      ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'attack', damage: 20, hits: 1, weight: 1,
        tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'] } } } : enemy) });
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 20, mana: 20,
      maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1,
      deck: [{ cardId: 'guardCounter', instanceId: 'r0', upgraded: false }] } });
  combat.player.block = 0;
  for (const enemy of combat.enemies) { enemy.intentRevealed = false; enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 }; }
  dispatch(combat, { type: 'endTurn' });
  const offer = combat.pendingReaction;
  const option = offer.options.find(row => row.play.cardInstanceId === 'r0');
  assert.ok(option, 'the Counter is offered as a reaction');
  dispatch(combat, { type: 'chooseReaction', offerId: offer.id, optionId: option.id });
  for (let i = 0; i < 5 && combat.pendingReaction; i++) {
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  const types = combat.eventLog.map(event => event.type);
  const applied = combat.eventLog.filter(event => event.type === 'combatCounterstrikeApplied');
  assert.equal(applied.length, 1);
  assert.equal(applied[0].cardId, 'guardCounter');
  assert.equal(applied[0].pct, 0.75);
  assert.equal(applied[0].advantaged, true);
  assert.ok(types.indexOf('combatReactionStacked') < types.indexOf('combatCounterstrikeApplied'));
});

test('a Counterstrike Counter without an authored payload records its damage base and rating for the return', () => {
  const combat = createCombat({ registries: plain, rng: createRng(913), combatExpansionVersion: 2, reactionRulesVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 20, mana: 20,
      maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 0, deck: [] } });
  const enemy = combat.enemies[0];
  const carrier = { cardId: 'guardCounter', traitValues: CS, combatProfile: { maneuver: 'counter', camp: 'physical', range: 'melee', targeting: 'single', counterMode: 'melee' } };
  prepareTacticalCard(combat, combat.player, enemy, carrier, [{ op: 'damage', target: 'enemy', amount: 5 }], {}, { arm: true });
  assert.ok(combat.player.combatCounter, 'the Counter armed');
  const payload = combat.player.combatCounter.payload;
  assert.equal(payload.hpBase, 5);
  assert.equal(payload.hp, payload.hpBase + payload.hpRating, 'hp is the base plus its rating, before any other bonus');
});
