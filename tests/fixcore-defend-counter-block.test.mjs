// Owner ruling 2026-11-28: a card's stored Block and damage are what it gives in play (no hidden multiplier).
// Defend is 5 Block for 1 SP; Counter keeps what it gave in play before the ruling (3 Block, 1 damage).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DEFEND_BLOCK = 5;
const DEFEND_SP = 1;
const COUNTER_BLOCK = 3;
const COUNTER_DAMAGE = 1;
const REACTION_TAG = 'trait:reaction';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const list = Array.isArray(cards) ? cards : cards.cards;
const cardOf = id => list.find(card => card.id === id);
const amountOf = (id, op) => cardOf(id).effects.find(effect => effect.op === op).amount;

test('core.defend stores 5 Block for 1 SP', () =>
{
  assert.equal(amountOf('core.defend', 'block'), DEFEND_BLOCK);
  assert.equal(cardOf('core.defend').staminaCost, DEFEND_SP);
});

test('core.counter stores the Block and damage it gave in play', () =>
{
  assert.equal(amountOf('core.counter', 'block'), COUNTER_BLOCK);
  assert.equal(amountOf('core.counter', 'damage'), COUNTER_DAMAGE);
});

test('neither Defend nor Counter is a Reaction card', () =>
{
  for (const id of ['core.defend', 'core.counter'])
  {
    assert.ok(!(cardOf(id).tags || []).includes(REACTION_TAG), `${id} carries no ${REACTION_TAG}`);
  }
});
