// stagger.poise (docs/design/SIMPLE-COMBAT-PLAN.md step 1): off empties every Poise pool, so Poise
// damage does nothing and nothing breaks; on (Core today) keeps the pools and the break.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dealPoiseDamage, OPCODE_HANDLERS } from '../src/engine/actions.js';
import { PoiseEnabled } from '../src/model/simpleCombatFlags.js';
import { SimpleCombatRegistries, SimpleCombatFight } from './helpers/simple-combat.mjs';

const POISE_OFF = 'poiseOff';
const HUGE_POISE_DAMAGE = 999;
const BREAK_EVENT = 'poiseBroken';
const POISE_ONLY_EFFECT = {
  op: 'poiseDamage',
  target: 'enemy',
  amount: 3,
};

function breakEvents(combat, start)
{
  return combat.eventLog.slice(start).filter(event => event.type === BREAK_EVENT);
}

test('stagger.poise on: Core fighters hold Poise and a big Poise hit breaks the enemy', () =>
{
  const combat = SimpleCombatFight(SimpleCombatRegistries());
  const enemy = combat.enemies[0];
  assert.equal(PoiseEnabled(combat), true);
  assert.ok(combat.player.persistentPoise.max > 0, 'the player has a Poise pool');
  assert.ok(enemy.persistentPoise.max > 0, 'the enemy has a Poise pool');
  const start = combat.eventLog.length;
  dealPoiseDamage(combat, enemy, HUGE_POISE_DAMAGE, { source: combat.player });
  assert.equal(enemy.persistentPoise.value, 0);
  assert.equal(breakEvents(combat, start).length, 1, 'the empty pool breaks');
});

test('stagger.poise off: every pool is empty and Poise damage breaks nothing', () =>
{
  const combat = SimpleCombatFight(SimpleCombatRegistries(POISE_OFF));
  const enemy = combat.enemies[0];
  assert.equal(PoiseEnabled(combat), false);
  assert.equal(combat.player.persistentPoise.max, 0);
  assert.equal(enemy.persistentPoise.max, 0);
  const stanceBefore = enemy.combatStance;
  const start = combat.eventLog.length;
  dealPoiseDamage(combat, enemy, HUGE_POISE_DAMAGE, { source: combat.player });
  assert.equal(breakEvents(combat, start).length, 0, 'no Poise break');
  assert.equal(enemy.broken, undefined, 'the enemy is not Broken');
  assert.equal(enemy.combatStance, stanceBefore, 'the enemy is not Staggered');
});

// A Poise-only card counts as a hit through the Poise it dealt
// (combatExpansionActions traitLanded).
function poiseOnlyPressure(overrideName)
{
  const combat = SimpleCombatFight(SimpleCombatRegistries(overrideName));
  const enemy = combat.enemies[0];
  const action = {
    source: combat.player,
    owner: combat.player,
    target: enemy,
    card: {},
    meta:
    {
      expansionGroup:
      {
        targets: {},
      },
    },
  };
  OPCODE_HANDLERS.poiseDamage(combat, action, POISE_ONLY_EFFECT);
  const pressure = action.meta.expansionGroup.ownPressure || {};
  return pressure[enemy.id]?.poiseDealt || 0;
}

test('stagger.poise on: a Poise-only card records the Poise it dealt', () =>
{
  assert.equal(poiseOnlyPressure(null), POISE_ONLY_EFFECT.amount);
});

test('stagger.poise off: a Poise-only card records no Poise, so it is not a hit', () =>
{
  assert.equal(poiseOnlyPressure(POISE_OFF), 0);
});
