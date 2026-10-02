import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, endTurn, leaveCombat } from '../src/engine/coopCombat.js';

// #1432 fans every enemy seat-pile op (addCard, draw, discard, exhaust,
// shuffleDiscardIntoDraw) out to each living seat. Its own test covers the
// authored addCard rows; no shipped enemy authors the other four yet, so this
// file gives a test-only enemy one move per op (targetless, like the Dazed
// injectors) and runs it through the real co-op enemy phase. Every living seat
// must be affected; a downed seat and a disconnected seat must not be.

const PROBE = 'pileProbe';
const AMOUNT = 2;
const OPS = {
  draw: { op: 'draw', amount: AMOUNT },
  discard: { op: 'discard', amount: AMOUNT },
  exhaust: { op: 'exhaust', amount: AMOUNT },
  shuffleDiscardIntoDraw: { op: 'shuffleDiscardIntoDraw' },
};

const base = contentBundle.enemies.find((enemy) => enemy.id === 'huskBrute');
const probeEnemy = {
  ...base,
  id: PROBE,
  name: 'Pile Probe',
  moves: Object.fromEntries(Object.entries(OPS).map(([name, eff]) => [name, { intent: 'debuff', weight: 1, effects: [eff] }])),
};
const registries = createRegistries({ ...contentBundle, enemies: [...contentBundle.enemies, probeEnemy] });

const SEATS = ['p1', 'p2', 'p3', 'p4']; // p1, p2 living; p3 downed; p4 disconnected
const seat = (id) => ({
  id, classId: 'reaver', maxHp: 100, hp: 100,
  mana: 2, maxMana: 2, stamina: 0, maxStamina: 0,
  energyMax: 3, drawPerTurn: 5, relicIds: [], flasks: [],
  deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `${id}:strike:${i}`, cardId: 'strike', upgraded: false })),
});

const sizes = (piles) => ({ draw: piles.draw.length, hand: piles.hand.length, discard: piles.discard.length, exhaust: piles.exhaust.length });
const ids = (pile) => pile.map((card) => card.instanceId);

// Runs `moveId` through the production enemy phase. At enemyTurnStart every
// seat (including the excluded ones) is given a known layout — 3 cards in hand,
// 4 in discard — so each op has something to act on; the piles are recorded
// then and again at enemyTurnEnd, before the next player turn redraws.
function runProbe(moveId) {
  const combat = createCoopCombat({ registries, rng: createRng(21), enemyIds: [PROBE], players: SEATS.map(seat) });
  const downed = combat.players.get('p3');
  downed.entity.hp = 0;
  downed.entity.alive = false;
  leaveCombat(combat, 'p4');
  assert.equal(combat.players.get('p4').connected, false, 'p4 is disconnected');

  const before = {};
  const after = {};
  const emit = combat.emit;
  combat.emit = (type, payload) => {
    if (type === 'enemyTurnStart') {
      for (const id of SEATS) {
        const piles = combat.players.get(id).piles;
        const pool = [...piles.draw, ...piles.hand, ...piles.discard];
        piles.hand = pool.slice(0, 3);
        piles.discard = pool.slice(3, 7);
        piles.draw = pool.slice(7);
        before[id] = { ...sizes(piles), drawIds: ids(piles.draw), discardIds: ids(piles.discard) };
      }
    }
    if (type === 'enemyTurnEnd') {
      for (const id of SEATS) {
        const piles = combat.players.get(id).piles;
        after[id] = { ...sizes(piles), drawIds: ids(piles.draw), discardIds: ids(piles.discard) };
      }
    }
    return emit(type, payload);
  };

  combat.enemies[0].intent = { moveId };
  endTurn(combat, 'p1');
  endTurn(combat, 'p2');
  assert.ok(combat.eventLog.some((event) => event.type === 'enemyMoveStarted' && event.enemyId === PROBE && event.moveId === moveId), 'the production enemy phase executed the move');
  assert.ok(before.p1 && after.p1, 'the enemy phase ran start to end');
  return { before, after };
}

const EXPECT = {
  draw: (b, a) => {
    assert.equal(a.hand, b.hand + AMOUNT);
    assert.equal(a.draw, b.draw - AMOUNT);
    assert.equal(a.discard, b.discard);
  },
  discard: (b, a) => {
    assert.equal(a.hand, b.hand - AMOUNT);
    assert.equal(a.discard, b.discard + AMOUNT);
    assert.equal(a.draw, b.draw);
  },
  exhaust: (b, a) => {
    assert.equal(a.hand, b.hand - AMOUNT);
    assert.equal(a.exhaust, b.exhaust + AMOUNT);
    assert.equal(a.discard, b.discard);
  },
  shuffleDiscardIntoDraw: (b, a) => {
    assert.equal(a.discard, 0);
    assert.equal(a.draw, b.draw + b.discard);
    assert.equal(a.hand, b.hand);
    assert.deepEqual([...a.drawIds].sort(), [...b.drawIds, ...b.discardIds].sort(), 'the draw pile now holds exactly the old draw + discard');
  },
};

test('the probe enemy authors exactly the four non-addCard seat-pile ops', () => {
  assert.deepEqual(Object.keys(registries.enemies.get(PROBE).moves).sort(), Object.keys(EXPECT).sort());
});

for (const moveId of Object.keys(OPS)) {
  test(`an enemy ${moveId} reaches every living co-op seat and skips downed and disconnected seats`, () => {
    const { before, after } = runProbe(moveId);
    for (const id of ['p1', 'p2']) {
      EXPECT[moveId](before[id], after[id]);
    }
    for (const id of ['p3', 'p4']) {
      assert.deepEqual(after[id], before[id], `${id} (${id === 'p3' ? 'downed' : 'disconnected'}) piles are untouched by ${moveId}`);
    }
  });
}
