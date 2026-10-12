// Combat Rounds Preview (SPEC §4.11), P3b fixes: the Mana-discount charges a queued card claims.
//   (a) a card that costs no Mana claims no Mana-discount charge;
//   (b) a card claims a Mana-discount charge only when the price would discount it (claim follows price, SPEC §4.11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createCombat, dispatch, cardPlayCosts } from '../src/engine/combat.js';
import { combatRoundsFor } from '../src/model/combatRounds.js';
import { createRng } from '../src/engine/rng.js';
import { COMBAT_ROUNDS_KEY } from '../src/model/combatRounds.js';
import { grantAbilityCharge } from '../src/engine/abilityRiders.js';

const registries = createRegistries(contentBundle);
const ENEMY = 'wanderingSoldier';

function fight(classId = 'reaver', seed = 5) {
  const run = createRunState({ seed, classId, registries, combatExpansionVersion: 1, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  return createRunCombat({ registries, rng: createRng(seed), run, enemyIds: [ENEMY], settings: {} });
}

// Queues a card, aimed at a foe when the card takes one and untargeted otherwise.
function queue(c, card) {
  const targetId = c.enemies.find((e) => e.alive)?.id;
  for (const attempt of [{ targetId }, {}]) {
    try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, ...attempt }); return; } catch (err) { if (!/target/i.test(err.message)) throw err; }
  }
  throw new Error('fixture: the card does not queue');
}

// The ability kind a card plays with when the card does not author one (cardRef's default, combat.js).
const playKindOf = (def) => def.abilityKind || ((def.cardTags || def.tags || []).includes('source:spell') ? 'spell' : 'maneuver');

test('(a) a card that costs no Mana claims no Mana-discount charge', () => {
  const c = fight();
  const free = c.piles.hand.find((card) => cardPlayCosts(c, card.instanceId).mana === 0 && cardPlayCosts(c, card.instanceId).energy <= c.player.energy);
  assert.ok(free, 'fixture: a 0-Mana card is in the opening hand');
  grantAbilityCharge(c.player, { key: 'discount', damage: 2, manaDiscount: 1 });
  queue(c, free);
  const [record] = c.combatRounds.playerQueue;
  assert.deepEqual(record.claims, [], 'a 0-Mana card does not hold the discount');
  assert.ok(c.player.abilityRiders.charges.discount, 'the charge stays free for a card that costs Mana');
});

test('(a) a Mana card still claims the discount it prices with', () => {
  const c = fight();
  const costed = c.piles.hand.find((card) => cardPlayCosts(c, card.instanceId).mana > 0 && cardPlayCosts(c, card.instanceId).energy <= c.player.energy);
  if (!costed) return;
  grantAbilityCharge(c.player, { key: 'discount', damage: 2, manaDiscount: 1 });
  queue(c, costed);
  assert.deepEqual(c.combatRounds.playerQueue[0].claims, ['discount']);
});

// The Mana a card is priced at right now, with no queued claim taken out (the price doPlayCard pays).
const pricedMana = (c, instanceId) => cardPlayCosts(c, instanceId).mana;

test('(b) a charge keyed to an ability kind the price does not read is not claimed, and the card pays full Mana', () => {
  // The probe: a Mana card with no authored abilityKind (it prices as a plain card) and a charge keyed to 'spell'.
  // The price (resolvedCardPlayCosts) never reads abilityKind, so the discount does not apply and nothing is claimed.
  const base = createRegistries(contentBundle);
  const card = { ...base.cards.get('defend'), gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined, name: 'Kind fixture', cost: 1, manaCost: 2, effects: [{ op: 'block', target: 'self', amount: 4 }], upgrade: {}, abilityKind: undefined, cardTags: ['kind.skill', 'source:spell'] };
  const registries = { ...base, cards: { ...base.cards, get: (id) => (id === 'defend' ? card : base.cards.get(id)) } };
  const player = { id: 'p1', classId: 'herald', maxHp: 80, hp: 50, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, relicIds: [], deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'defend', upgraded: false })) };
  const c = createCombat({ registries, rng: createRng(9), player, enemyIds: [ENEMY], combatRounds: combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true }) });
  const inHand = c.piles.hand[0];
  assert.equal(resolveCard(registries, inHand).abilityKind, undefined, 'fixture: the card authors no abilityKind');
  const full = pricedMana(c, inHand.instanceId);
  assert.equal(full, 2, 'fixture: the card costs 2 Mana before any charge');
  grantAbilityCharge(c.player, { key: 'kind', block: 1, manaDiscount: 1, abilityKind: 'spell' });
  assert.equal(pricedMana(c, inHand.instanceId), full, 'the price does not discount it');
  const before = c.player.mana;
  queue(c, inHand);
  const [record] = c.combatRounds.playerQueue;
  assert.deepEqual(record.claims, [], 'so the card claims no charge');
  assert.ok(c.player.abilityRiders.charges.kind, 'the charge stays free for a card the price does discount');
  assert.equal(before - c.player.mana, full, 'and the card pays the full Mana it was priced at');
});

test('the claim agrees with the price for a charge the price does discount', () => {
  // The same card keyed to no kind: the price discounts it, so the queued card claims the charge and pays less.
  const c = fight();
  const costed = c.piles.hand.find((card) => pricedMana(c, card.instanceId) > 0 && cardPlayCosts(c, card.instanceId).energy <= c.player.energy);
  if (!costed) return;
  const full = pricedMana(c, costed.instanceId);
  grantAbilityCharge(c.player, { key: 'discount', damage: 2, manaDiscount: 1 });
  const discounted = pricedMana(c, costed.instanceId);
  assert.equal(discounted, Math.max(0, full - 1), 'the price discounts the charge');
  const before = c.player.mana;
  queue(c, costed);
  assert.deepEqual(c.combatRounds.playerQueue[0].claims, ['discount'], 'the card claims the charge the price used');
  assert.equal(before - c.player.mana, discounted, 'and pays the discounted Mana');
});
