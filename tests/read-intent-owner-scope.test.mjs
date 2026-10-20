import test from 'node:test';
import { COOP_TESTS_ENABLED, COOP_TEST_SKIP_REASON } from './feature-scopes.js';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, playCard, previewCoopIntent } from '../src/engine/coopCombat.js';
import { projectEnemyBurdenHand } from '../src/ui/models/EnemyBurdenModel.js';

const registries = createRegistries(contentBundle);
const seat = id => ({ id, classId: 'reaver', maxHp: 80, hp: 80, energyMax: 20, maxStamina: 20,
  stamina: 20, maxMana: 5, mana: 5, drawPerTurn: 1, relicIds: [], deck: [] });

test('targeted Read Intent reveals only its selected enemy to its owner and expires for intent and hand', { skip: !COOP_TESTS_ENABLED && COOP_TEST_SKIP_REASON }, () => {
  const combat = createCoopCombat({ registries, rng: createRng(421), players: [seat('p1'), seat('p2')],
    enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  const [selected, other] = combat.enemies;
  for (const enemy of combat.enemies) {
    enemy.intent = { kind: 'attack', moveId: 'slash', damage: 8, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
    enemy.intentReads = { p1: false, p2: false };
    enemy.burdenPiles = { draw: [], hand: [{ instanceId: `${enemy.id}-secret`, cardId: 'base.stagger-status-card' }], discard: [], exhaust: [] };
  }
  const owner = combat.players.get('p1');
  owner.piles.hand.push({ instanceId: 'read-p1', cardId: 'base.reveal-opponent-hand', upgraded: false });
  playCard(combat, 'p1', 'read-p1', selected.id);
  const until = selected.proposalIntentRevealedUntilByOwner.p1;
  assert.ok(until > combat.turn);
  assert.equal(selected.proposalIntentRevealedUntilByOwner.p2, undefined);
  assert.equal(previewCoopIntent(combat, 'p1', selected.id).hidden, false);
  assert.equal(previewCoopIntent(combat, 'p1', other.id).hidden, true, 'the active marker does not reveal an unselected enemy');
  assert.equal(previewCoopIntent(combat, 'p2', selected.id).hidden, true, "the owner's private read does not leak to another seat");
  assert.equal(previewCoopIntent(combat, 'p2', other.id).hidden, true);
  const selectedHand = projectEnemyBurdenHand(selected, { turn: combat.turn, registries, ownerId: 'p1' });
  assert.equal(selectedHand.cards[0].name, registries.cards.get('base.stagger-status-card').name);
  assert.equal(projectEnemyBurdenHand(selected, { turn: combat.turn, registries, ownerId: 'p2' }), null);
  assert.equal(projectEnemyBurdenHand(other, { turn: combat.turn, registries, ownerId: 'p1' }), null);

  combat.turn = until;
  assert.equal(previewCoopIntent(combat, 'p1', selected.id).hidden, true, 'the exact move gate closes at expiry');
  assert.equal(projectEnemyBurdenHand(selected, { turn: combat.turn, registries, ownerId: 'p1' }), null,
    'card identities and counts close at the same expiry');
});
