import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { resolveHandRules } from '../src/model/handRules.js';
import { handStatRows } from '../src/model/statRows.js';

// Owner, 2026-10-31: at turn start the draw pile is drawn first; the discard
// reshuffles only when the draw pile is empty and more cards are owed.
const registries = createRegistries(contentBundle);
const card = id => ({ instanceId: id, cardId: 'strike', upgraded: false });
const mk = ids => ids.map(card);
const DRAW = ['d1', 'd2', 'd3'];
const DISC = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'];

function turn({ draw, discard, reshuffle = true }) {
  const rules = resolveHandRules({}, { ...handStatRows(registries, null), handSize: { base: 5, min: 1, max: 5 } });
  rules.reshuffle = reshuffle;
  const c = createCombat({ registries, rng: createRng(2309), handRules: rules,
    player: { classId: 'reaver', maxHp: 10000, hp: 10000, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10,
      energyMax: 3, drawPerTurn: 5, attributes: { intelligence: 4 },
      deck: Array.from({ length: 30 }, (_, i) => card(`c${i}`)), relicIds: [] },
    enemyIds: ['wanderingSoldier'] });
  c.piles.hand = []; c.piles.draw = mk(draw); c.piles.discard = mk(discard);
  const log = [];
  const emit = c.emit;
  c.emit = (type, payload) => {
    if (type === 'cardDrawn') log.push(payload.cardInstanceId);
    else if (type === 'deckShuffled') log.push('SHUFFLE');
    return emit.call(c, type, payload);
  };
  dispatch(c, { type: 'endTurn' });
  return { c, log };
}

test('draw pile cards are drawn first, then the rest come from the reshuffled former discard', () => {
  const { c, log } = turn({ draw: DRAW, discard: DISC });
  // The refresh shuffle is announced at turn end, but it is built beneath the
  // untouched draw pile, so the draws still run d1, d2, d3 before any discard.
  const draws = log.filter(x => x !== 'SHUFFLE');
  assert.deepEqual(draws.slice(0, 3), DRAW);
  assert(draws.length > 3 && draws.slice(3).every(id => DISC.includes(id)), 'remaining draws come from the former discard');
  assert.equal(log.filter(x => x === 'SHUFFLE').length, 1);
  assert.equal(c.piles.hand.length, draws.length);
});

test('an empty draw pile reshuffles first', () => {
  const { log } = turn({ draw: [], discard: DISC });
  assert.equal(log[0], 'SHUFFLE');
  assert(log.slice(1).every(id => DISC.includes(id)));
  assert(log.length > 1);
});

test('with reshuffle off only the draw pile is drawn', () => {
  const { c, log } = turn({ draw: DRAW, discard: DISC, reshuffle: false });
  assert.deepEqual(log, DRAW);
  assert.deepEqual(c.piles.discard.map(x => x.instanceId), DISC);
});
