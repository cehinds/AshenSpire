// stances.sameStanceDiscount also gates the Prepared spell SP cut (spellCosts preparedStamina).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SpellCostAdjust } from '../src/engine/spellCosts.js';
import {
  SimpleCombatFixture,
  SimpleCombatRegistries,
  SimpleCombatFight,
} from './helpers/simple-combat.mjs';

const DISCOUNT_OFF = 'sameStanceDiscountOff';
const PREPARED_STANCE = 'prepared';
const SPELL_PROBE = SimpleCombatFixture.preparedSpellProbe;

function preparedPrice(registries)
{
  const combat = SimpleCombatFight(registries);
  const definition = registries.cards.get(SPELL_PROBE.cardId);
  combat.player = {
    ...combat.player,
    combatStance:
    {
      maneuver: PREPARED_STANCE,
    },
  };
  return SpellCostAdjust(combat, definition, SPELL_PROBE.price);
}

test('stances.sameStanceDiscount on: Prepared cuts a spell\'s SP', () =>
{
  const price = preparedPrice(SimpleCombatRegistries());
  assert.ok(price.stamina < SPELL_PROBE.price.stamina, 'Prepared spell costs less');
});

test('stances.sameStanceDiscount off: Prepared spell pays full SP', () =>
{
  const price = preparedPrice(SimpleCombatRegistries(DISCOUNT_OFF));
  assert.equal(price.stamina, SPELL_PROBE.price.stamina);
});
