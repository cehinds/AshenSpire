import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { expandedEnemyMove, primeEnemyCounter } from '../src/engine/combatCardTactics.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction } from '../src/engine/actions.js';

const registries = createRegistries(contentBundle);
function fight() {
  return createCombat({ registries, rng: createRng(811), combatExpansionVersion: 2,
    enemyIds: ['gildedKnight'], player: { classId: 'reaver', hp: 1000, maxHp: 1000,
      mana: 20, maxMana: 20, stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 0, deck: [] } });
}
const drain = combat => { for (let n = 0; combat.queue.length; n++) {
  assert.ok(n < 100, 'the ordinary action queue must settle'); executeAction(combat, combat.queue.shift());
} };

for (const [authored, fallback, expected] of [[0, 3, 3], [0, 7, 7], [5, 7, 5]]) {
  test(`live Gilded Knight Counter uses Poise ${expected} with authored ${authored} and fallback ${fallback}`, () => {
    const combat = fight(), enemy = combat.enemies[0], player = combat.player;
    drain(combat);
    combat.stanceRules = { fallbackPoise: fallback };
    delete enemy.combatCounterReturnedCycle;
    const move = { ...registries.enemies.get('gildedKnight').moves.parry, counterPoiseDamage: authored };
    primeEnemyCounter(combat, enemy, move, 'parry'); drain(combat);
    assert.equal(enemy.combatCounter.payload.poise, expected);
    enemy.block = 1000; enemy.wardBlock = 0; enemy.evasion = 0;
    player.block = player.wardBlock = 0; player.evasion = 0;
    player.statuses = {}; player.combatStance = { camp: 'physical', maneuver: 'attack', range: 'melee' };
    player.poiseMeter = { value: 0, max: 1000 };
    combat.rng.int = () => 20;
    const carrier = { type: 'attack', tags: ['camp:physical', 'maneuver:attack', 'range:melee'], combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
    enqueueExpandedAction(combat, [{ effect: { op: 'damage', amount: 1 }, source: player, owner: player,
      target: enemy, card: carrier, meta: {} }], { source: player, target: enemy, carrier });
    const returnGroups = new Set();
    for (let n = 0; combat.queue.length; n++) {
      assert.ok(n < 100, 'the ordinary action queue must settle');
      const action = combat.queue.shift();
      if (action.meta?.expansionGroup?.counterReturn) returnGroups.add(action.meta.expansionGroup);
      executeAction(combat, action);
    }
    assert.equal(returnGroups.size, 1, 'one fully blocked incoming Attack produces one live return');
    const reply = [...returnGroups][0].counterReturn;
    assert.equal(reply.poiseDamage, expected, 'the reply retains its authored or configured base');
    assert.equal(player.poiseMeter.value, Math.ceil(expected * 1.5), 'the landed return applies its Attack matchup to pressure');
  });
}

test('enemy Smash fallback is configured, idempotent and excludes support-only charging stages', () => {
  const combat = fight(), enemy = { enemyId: 'fellWarden' };
  combat.stanceRules = { fallbackPoise: 7 };
  const move = registries.enemies.get('fellWarden').moves.heldBlade;
  const projected = expandedEnemyMove(enemy, move, 'heldBlade', combat);
  assert.equal(projected.effects.filter(effect => effect.op === 'poiseDamage').length, 1);
  assert.equal(projected.effects.find(effect => effect.op === 'poiseDamage').amount, 7);
  assert.equal(projected.delay.whileCharging.effects.some(effect => effect.op === 'poiseDamage'), false);
  assert.equal(expandedEnemyMove(enemy, projected, 'heldBlade', combat).effects.filter(effect => effect.op === 'poiseDamage').length, 1);
  const authored = expandedEnemyMove(enemy, { ...move, effects: [{ op: 'poiseDamage', target: 'player', amount: 4 }] }, 'heldBlade', combat);
  assert.deepEqual(authored.effects.filter(effect => effect.op === 'poiseDamage'), [{ op: 'poiseDamage', target: 'player', amount: 4 }]);
  assert.equal(move.effects?.some(effect => effect.op === 'poiseDamage') || false, false, 'projection does not mutate authored content');
});
