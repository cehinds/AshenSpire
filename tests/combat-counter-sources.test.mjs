import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, playCard, endTurn } from '../src/engine/coopCombat.js';
import { cardSourceSnapshots } from '../src/engine/combatRules.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const prepared = { id: 'prepared-weapon', sourceType: 'weapon', family: 'blade', weight: 2,
  grip: 'oneHand', damageType: 'slashing', tags: ['theme:blood'], buildup: [{ status: 'bleed', amount: 1 }] };
const replacement = { ...prepared, id: 'replacement-weapon', damageType: 'fire', tags: [], buildup: [] };

function fight(cardId, coop) {
  const enemyId = cardId === 'nockAndWait' ? 'chainScavenger' : 'wanderingSoldier';
  const moveId = cardId === 'nockAndWait' ? 'hookCast' : 'slash';
  const registries = createRegistries({ ...contentBundle,
    enemies: contentBundle.enemies.map(enemy => enemy.id === enemyId ? { ...enemy, firstMove: moveId } : enemy),
    enemyMoves: contentBundle.enemyMoves.map(move => move.enemyId === enemyId && move.id === moveId
      ? { ...move, damage: 4 } : move),
  });
  const player = { classId: cardId === 'nockAndWait' ? 'rogue' : 'reaver', hp: 200, maxHp: 200,
    energyMax: 10, drawPerTurn: 1, deck: [{ instanceId: 'counter1', cardId }], relicIds: [] };
  const actorId = coop ? 'p1' : 'player';
  const options = { registries, rng: createRng(50), enemyIds: [enemyId], ruleset: combatRules, ratingsRules: null,
    combatProfiles: { [actorId]: { sources: { mainHand: prepared } },
      e1: { resistances: { slashing: 0.5 }, immunities: ['fire'] } } };
  const c = coop ? createCoopCombat({ ...options, players: [{ ...player, id: actorId }] })
    : createCombat({ ...options, player });
  return { c, actorId, registries,
    actor: () => coop ? c.players.get(actorId).entity : c.player,
    play: () => coop ? playCard(c, actorId, 'counter1') : dispatch(c, { type: 'playCard', cardInstanceId: 'counter1' }),
    end: () => coop ? endTurn(c, actorId) : dispatch(c, { type: 'endTurn' }) };
}

for (const coop of [false, true]) for (const cardId of ['rondelParry', 'nockAndWait']) {
  for (const eventType of ['cardPreparing', 'energySpent']) {
    test(`${coop ? 'co-op' : 'solo'} ${cardId} captures default reply source before ${eventType} changes it`, () => {
      const { c, actorId, actor, play, end } = fight(cardId, coop);
      const emit = c._emitEvent;
      c._emitEvent = (candidate, type, payload) => {
        if (type === eventType) candidate.foundation.profiles[actorId].sources.mainHand = structuredClone(replacement);
        return emit(candidate, type, payload);
      };
      play();
      assert.equal(c.foundation.profiles[actorId].sources.mainHand.id, replacement.id, 'hook really changes the live source');
      const reply = actor().combatCounter;
      assert.equal(reply.damage, 6, 'unprinted retaliation retains its default base');
      assert.deepEqual(reply.carrier.resolvedSource, { ...prepared, hand: 'mainHand' });
      assert.equal(reply.carrier.combatProfile.damageType, 'slashing');
      assert(reply.carrier.tags.includes('theme:blood'));
      end();
      const hit = c.eventLog.find(event => event.type === 'damageDealt' && event.sourceId === 'player');
      assert.equal(hit.sourceInstanceId, prepared.id);
      assert.deepEqual(hit.components, [{ type: 'slashing', amount: 7 }], 'original type uses its resistance, not later fire immunity');
      assert.equal(actor().hp, 200);
    });
  }
}

for (const cardId of ['rondelParry', 'nockAndWait']) {
  test(`${cardId} default reply source survives an ordinary save and later equipment change`, () => {
    const { c, actor, play, registries } = fight(cardId, false);
    play();
    c.foundation.profiles.player.sources.mainHand = structuredClone(replacement);
    const snapshot = serializeCombatSnapshot(c);
    const loaded = restoreCombatSnapshot({ registries, rng: createRng(50, c.rng.getCounters()), snapshot });
    assert.deepEqual(loaded.player.combatCounter.carrier.resolvedSource, actor().combatCounter.carrier.resolvedSource);
    dispatch(loaded, { type: 'endTurn' });
    assert.equal(loaded.eventLog.find(event => event.type === 'damageDealt' && event.sourceId === 'player').sourceInstanceId, prepared.id);
  });
}

test('source capture preserves per-effect attack overrides and explicit empty identity', () => {
  const { c } = fight('rondelParry', false);
  c.foundation.profiles.player.sources.offHand = { ...replacement, id: 'other-hand' };
  const effects = [{ op: 'damage', amount: 2, attack: { source: 'weapon', hand: 'mainHand' } },
    { op: 'damage', amount: 3, attack: { source: 'weapon', hand: 'offHand' } }];
  const snapshots = cardSourceSnapshots(c, { effects }, c.player, { tags: [], combatProfile: { camp: null, maneuver: null } });
  assert.equal(snapshots.size, 2);
  assert.equal(snapshots.get(effects[0]).resolvedSource.id, prepared.id);
  assert.equal(snapshots.get(effects[1]).resolvedSource.id, 'other-hand');
  assert.equal(snapshots.get(effects[0]).combatProfile.camp, null);
  const empty = cardSourceSnapshots(c, { effects: [] }, c.player, { tags: [], combatProfile: { camp: null, maneuver: null } });
  assert.equal(empty.size, 0, 'an explicit empty identity is not turned into a Counter');
});
