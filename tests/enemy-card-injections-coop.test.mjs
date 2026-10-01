import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, endTurn } from '../src/engine/coopCombat.js';
import { createCombat, dispatch } from '../src/engine/combat.js';

const registries = createRegistries(contentBundle);
const seat = (id) => ({
  id, classId: 'reaver', maxHp: 100, hp: 100,
  mana: 2, maxMana: 2, stamina: 0, maxStamina: 0,
  energyMax: 3, drawPerTurn: 5, relicIds: [], flasks: [],
  deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `${id}:strike:${i}`, cardId: 'strike', upgraded: false })),
});

// Every enemy move that puts a status card into a player's piles. Two already
// say `target: 'player'`; the four Dazed injectors are targetless. A card
// injection acts on a seat's piles, so in co-op it reaches every living seat
// whether or not the row names a target (docs/FINISH.md, Owner decisions).
const INJECTORS = [
  ['huskBrute', 'bellow', 'slimed'],
  ['courtSurgeon', 'scalpel', 'wound'],
  ['graveWisp', 'curse', 'dazed'],
  ['mirrorScribe', 'silverScript', 'dazed'],
  ['eclipseCantor', 'fadingEcho', 'dazed'],
  ['hollowAstronomer', 'starChart', 'dazed'],
];

const count = (piles, cardId) => Object.values(piles).flat().filter((card) => card.cardId === cardId).length;

test('the injector list covers every enemy addCard row in the content', () => {
  const authored = [];
  for (const enemy of contentBundle.enemies) {
    for (const [moveId, move] of Object.entries(enemy.moves || {})) {
      const effects = [...(move.effects || []), ...((move.delay && move.delay.whileCharging && move.delay.whileCharging.effects) || [])];
      for (const eff of effects) if (eff.op === 'addCard') authored.push(`${enemy.id}.${moveId}.${eff.card}`);
    }
  }
  assert.deepEqual(authored.sort(), INJECTORS.map(([e, m, c]) => `${e}.${m}.${c}`).sort());
});

for (const [enemyId, moveId, cardId] of INJECTORS) {
  test(`${enemyId}'s ${moveId} injects one ${cardId} into each living co-op seat and none into a downed one`, () => {
    const combat = createCoopCombat({ registries, rng: createRng(21), enemyIds: [enemyId], players: [seat('p1'), seat('p2'), seat('p3')] });
    // p3 is downed before the enemy acts.
    const downed = combat.players.get('p3');
    downed.entity.hp = 0;
    downed.entity.alive = false;
    const before = Object.fromEntries(['p1', 'p2', 'p3'].map((id) => [id, count(combat.players.get(id).piles, cardId)]));
    // Select the real authored move, independent of the AI's random roll.
    combat.enemies[0].intent = { moveId };
    endTurn(combat, 'p1');
    endTurn(combat, 'p2');
    assert.ok(combat.eventLog.some((event) => event.type === 'enemyMoveStarted' && event.enemyId === enemyId && event.moveId === moveId), 'the production enemy phase executed the authored action');
    for (const id of ['p1', 'p2']) {
      const player = combat.players.get(id);
      assert.equal(player.entity.alive, true);
      assert.equal(count(player.piles, cardId) - before[id], 1, `${id} receives exactly one ${cardId}`);
    }
    assert.equal(count(downed.piles, cardId) - before.p3, 0, `the downed seat receives no ${cardId}`);
  });

  test(`${enemyId}'s ${moveId} still injects exactly one ${cardId} in solo`, () => {
    const combat = createCombat({ registries, rng: createRng(21), enemyIds: [enemyId], player: seat('solo') });
    const before = count(combat.piles, cardId);
    combat.enemies[0].intent = { moveId };
    dispatch(combat, { type: 'endTurn' });
    assert.ok(combat.eventLog.some((event) => event.type === 'enemyMoveStarted' && event.enemyId === enemyId && event.moveId === moveId), 'the solo enemy phase executed the authored action');
    assert.equal(count(combat.piles, cardId) - before, 1);
  });
}
