// Owner, 2026-11-15 (W25-BANDS) rule 5: retreat weapons put a free, Ethereal Retreat card in hand each turn; it ends the Advance and does nothing else.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { bandsFight, registries, pairOf } from './helpers/bands-fight.mjs';
import { cardClassification } from '../src/model/cardClassification.js';
import { GrantRetreatCard } from '../src/engine/bandRows.js';

const gear = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/gear.json', import.meta.url), 'utf8'));
const RETREAT_WEAPONS = ['shortbow', 'halberd', 'boneSceptre', 'emberlightSceptre', 'gorefireBrand'];

test('every bow, the halberd and the sceptres carry the retreat tag, and no other weapon does', () => {
  const tagged = gear.filter(g => (g.tags || []).includes('retreat')).map(g => g.id).sort();
  assert.deepEqual(tagged, [...RETREAT_WEAPONS].sort());
  for (const g of gear.filter(g => (g.tags || []).includes('bow') || (g.tags || []).includes('sceptre'))) assert.ok((g.tags || []).includes('retreat'), g.id);
});

test('the Retreat card costs 0 Stamina the first time (owner 2026-11-19; it rises 1 per use in a fight), is a Defense card, Ethereal and Exhaust, and moves nothing but the Advance', () => {
  const card = registries.cards.get('core.retreat');
  assert.equal(card.cost, 0);
  assert.equal(card.staminaCost, 0);
  assert.equal(card.costGrowth.stamina, 1);
  assert.equal(cardClassification(card).stanceType, 'defense', 'resolves as Defense');
  assert.ok(card.keywords.includes('exhaust'));
  assert.ok(card.keywords.includes('ethereal'));
  assert.deepEqual(card.effects, [{ op: 'moveEngagement', target: 'self', bands: 1 }]);
});

function withWeapon(weaponId, hand = ['core.strike']) {
  const combat = bandsFight({ hand });
  combat.loadout = structuredClone(combat.loadout);
  combat.loadout.sets.rightHand = [weaponId];
  return combat;
}

test('a retreat weapon grants one Retreat per turn start, never two', () => {
  const combat = withWeapon('shortbow');
  assert.equal(GrantRetreatCard(combat), true);
  assert.equal(combat.piles.hand.filter(c => c.cardId === 'core.retreat').length, 1);
  assert.equal(GrantRetreatCard(combat), false, 'a second retreat weapon does not stack');
  assert.equal(combat.piles.hand.filter(c => c.cardId === 'core.retreat').length, 1);
});

test('a weapon without the tag grants none', () => {
  const combat = withWeapon('straightSword');
  assert.equal(GrantRetreatCard(combat), false);
});

test('playing Retreat ends the Advance and costs 0 Stamina the first time (shown = paid); an unplayed one exhausts at end of turn', () => {
  const combat = withWeapon('shortbow', ['core.advance']);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' }); // the Advance card at the back row: Advanced
  assert.ok(combat.player.advanced > 0);
  GrantRetreatCard(combat);
  const retreat = combat.piles.hand.find(c => c.cardId === 'core.retreat');
  const stamina = combat.player.stamina;
  assert.equal(previewCard(combat, retreat.instanceId).cost, 0, 'the quote shows 0');
  dispatch(combat, { type: 'playCard', cardInstanceId: retreat.instanceId });
  assert.equal(combat.player.stamina, stamina, 'paid 0');
  assert.equal(combat.player.advanced, 0);
  assert.equal(combat.rangeState.engagements[pairOf('e2')], 1, 'the back row is out of reach again');
  const again = withWeapon('shortbow'); GrantRetreatCard(again);
  dispatch(again, { type: 'endTurn' });
  assert.ok(again.piles.exhaust.some(c => c.cardId === 'core.retreat'), 'Ethereal: exhausted at end of turn');
});

// Review fix 1 (W25Bands): Retreat is Ethereal and Exhaust, so it never reaches the draw or discard pile; a full hand is granted none.
const retreatIn = pile => pile.filter(c => c.cardId === 'core.retreat').length;
test('Retreat exhausts when played: three turns of shortbow leave none in the draw or discard pile and one in hand each turn start', () => {
  const combat = withWeapon('shortbow', []);
  combat.piles.hand.length = 0;
  GrantRetreatCard(combat);
  for (let turn = 0; turn < 3; turn++) {
    assert.equal(retreatIn(combat.piles.hand), 1, `one in hand at turn ${turn + 1}`);
    assert.equal(retreatIn(combat.piles.draw), 0);
    assert.equal(retreatIn(combat.piles.discard), 0);
    const retreat = combat.piles.hand.find(c => c.cardId === 'core.retreat');
    dispatch(combat, { type: 'playCard', cardInstanceId: retreat.instanceId });
    assert.equal(retreatIn(combat.piles.discard), 0, 'played Retreat is exhausted, not discarded');
    dispatch(combat, { type: 'endTurn' });
    assert.equal(retreatIn(combat.piles.draw) + retreatIn(combat.piles.discard), 0);
    assert.equal(retreatIn(combat.piles.hand), 1, 'the new turn grants exactly one');
  }
  assert.equal(retreatIn(combat.piles.exhaust), 3);
});
test('a full hand is granted no Retreat (no overflow past handMax)', () => {
  const combat = withWeapon('shortbow', []);
  combat.piles.hand.length = 0;
  for (let i = 0; i < combat.handMax; i++) combat.piles.hand.push({ instanceId: `f${i}`, cardId: 'core.strike', upgraded: false });
  assert.equal(GrantRetreatCard(combat), false);
  assert.equal(combat.piles.hand.length, combat.handMax);
  combat.piles.hand.pop();
  assert.equal(GrantRetreatCard(combat), true);
});
