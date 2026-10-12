// Combat Rounds Preview (SPEC §4.11), P3b fixes: the Mana-discount charges a queued card claims.
//   (a) a card that costs no Mana claims no Mana-discount charge;
//   (b) queue-time charge matching reads the same ability kind as play-time (cardRef).
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

test('(b) queue-time matching reads the same ability kind a card plays with', () => {
  // A Mana card that authors no abilityKind: it plays as a spell (source:spell), and the charge is keyed to that.
  const base = createRegistries(contentBundle);
  const card = { ...base.cards.get('defend'), gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined, name: 'Kind fixture', cost: 1, manaCost: 2, effects: [{ op: 'block', target: 'self', amount: 4 }], upgrade: {}, abilityKind: undefined, cardTags: ['kind.skill', 'source:spell'] };
  const registries = { ...base, cards: { ...base.cards, get: (id) => (id === 'defend' ? card : base.cards.get(id)) } };
  const player = { id: 'p1', classId: 'herald', maxHp: 80, hp: 50, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, relicIds: [], deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'defend', upgraded: false })) };
  const c = createCombat({ registries, rng: createRng(9), player, enemyIds: [ENEMY], combatRounds: combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true }) });
  const inHand = c.piles.hand[0];
  assert.equal(resolveCard(registries, inHand).abilityKind, undefined, 'fixture: the card authors no abilityKind');
  grantAbilityCharge(c.player, { key: 'kind', block: 1, manaDiscount: 1, abilityKind: 'spell' });
  queue(c, inHand);
  assert.deepEqual(c.combatRounds.playerQueue[0].claims, ['kind'], 'queue-time pricing reads the play-time kind (spell)');
});
